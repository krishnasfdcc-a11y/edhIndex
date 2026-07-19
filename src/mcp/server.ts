import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { SearchEngine, SearchResult } from '../retrieval/search.js';
import { GraphService } from '../graph/service.js';
import { renderGraphSVG } from '../graph/render.js';
import { logger } from '../logging.js';

export function createMCPServer(searchEngine: SearchEngine, rootPath: string): Server {
  let graphSvc: GraphService | null = null;

  function getGraph(): GraphService {
    if (!graphSvc) {
      try {
        graphSvc = new GraphService(rootPath);
      } catch {
        throw new McpError(ErrorCode.InternalError, 'No graph available — run `edhindex start` to build the index');
      }
    }
    return graphSvc;
  }

  const server = new Server(
    { name: 'edhindex', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_codebase',
        description: `Search the indexed codebase using hybrid (keyword + semantic + reranked) search. Workspace: ${rootPath}. Searches file contents, symbols, and code structure.`,
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
            maxResults: { type: 'number', description: 'Max results (default 10)', default: 10 },
            fileFilter: { type: 'string', description: 'File path filter (glob)' },
            languageFilter: { type: 'string', description: 'Language filter (ts, js, py, go)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_graph',
        description: 'Get the full knowledge graph — all nodes and edges representing the indexed codebase structure. Returns nodes (files, folders, classes, functions, etc.) and their relationships (imports, exports, contains, defines).',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Max nodes to return (default all)' },
            offset: { type: 'number', description: 'Pagination offset' },
            type: { type: 'string', description: 'Filter by node type (class, function, file, folder, etc.)' },
          },
        },
      },
      {
        name: 'get_node',
        description: 'Get details for a specific node by ID, including all neighbors (connected nodes and edges).',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'Node ID (e.g. "kg:sym:src/app.ts:App")' },
            file: { type: 'string', description: 'Alternative: find node by file path' },
            symbol: { type: 'string', description: 'Symbol name (used with file)' },
          },
        },
      },
      {
        name: 'search_graph',
        description: 'Search nodes in the knowledge graph by name, symbol, or file path. Returns matching nodes with their connections.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query to match against node labels and file paths' },
            type: { type: 'string', description: 'Filter by node type (class, function, file, etc.)' },
          },
          required: ['query'],
        },
      },
      {
        name: 'get_graph_stats',
        description: 'Get statistics about the knowledge graph — total node count, edge count, breakdown by type.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const name = request.params.name;
    const args = request.params.arguments || {};

    switch (name) {
      case 'search_codebase': return handleSearch(args, searchEngine, rootPath);
      case 'get_graph': return handleGetGraph(args, getGraph());
      case 'get_node': return handleGetNode(args, getGraph());
      case 'search_graph': return handleSearchGraph(args, getGraph());
      case 'get_graph_stats': return handleGraphStats(getGraph());
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: `edhindex://${encodeURIComponent(rootPath)}/graph`,
        name: 'Knowledge Graph',
        description: 'Full knowledge graph of the codebase — nodes and edges',
        mimeType: 'application/json',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const uri = request.params.uri;
    if (uri.includes('/graph')) {
      const svc = getGraph();
      const data = svc.getGraphData();
      return {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
      };
    }
    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
  });

  server.onerror = (error: any) => logger.error('MCP Server error:', error);

  return server;
}

async function handleSearch(args: any, searchEngine: SearchEngine, rootPath: string) {
  const query = String(args.query || '').trim();
  if (!query) throw new McpError(ErrorCode.InvalidParams, 'query is required');

  const maxResults = Math.min(Math.max(Number(args.maxResults) || 10, 1), 100);
  const fileFilter = args.fileFilter ? String(args.fileFilter) : undefined;
  const languageFilter = args.languageFilter ? String(args.languageFilter) : undefined;

  if (fileFilter) {
    const { sanitizePath } = await import('../security.js');
    if (!sanitizePath(rootPath, fileFilter)) {
      throw new McpError(ErrorCode.InvalidParams, 'File filter is outside the workspace');
    }
  }

  try {
    const results = await searchEngine.search({ query, maxResults, fileFilter, languageFilter });
    return {
      content: [
        {
          type: 'text',
          text: formatResults(results),
        },
      ],
    };
  } catch (e: any) {
    logger.error('Search failed:', e);
    throw new McpError(ErrorCode.InternalError, `Search failed: ${e.message}`);
  }
}

function handleGetGraph(args: any, svc: GraphService) {
  const data = svc.getGraphData(args.limit, args.offset);
  const type = args.type;
  const nodes = type ? data.nodes.filter(n => n.type === type) : data.nodes;
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = data.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  const svg = renderGraphSVG(nodes, edges);

  return {
    content: [
      { type: 'text', text: `Knowledge Graph: ${nodes.length} nodes, ${edges.length} edges\n\nGraph visualization (SVG):` },
      { type: 'text', text: svg },
      { type: 'text', text: `\n\nFull data:\n${JSON.stringify({ nodes, edges, totalNodes: svc.getStats().nodeCount, totalEdges: svc.getStats().edgeCount }, null, 2)}` },
    ],
  };
}

function handleGetNode(args: any, svc: GraphService) {
  let node = null;
  if (args.id) {
    node = svc.getNode(args.id);
  } else if (args.file) {
    node = svc.getNodeByPath(args.file, args.symbol);
  }
  if (!node) throw new McpError(ErrorCode.InvalidParams, 'Node not found');

  const neighbors = svc.getNeighbors(node.id);
  const children = svc.getChildren(node.id);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ node, neighbors, children }, null, 2),
      },
    ],
  };
}

function handleSearchGraph(args: any, svc: GraphService) {
  const query = String(args.query || '').trim();
  if (!query) throw new McpError(ErrorCode.InvalidParams, 'query is required');

  let results = svc.searchNodes(query);
  if (args.type) results = results.filter(n => n.type === args.type);

  const enriched = results.slice(0, 30).map(n => {
    const neighbors = svc.getNeighbors(n.id);
    return { node: n, connectionCount: neighbors.length };
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ results: enriched, total: results.length }, null, 2),
      },
    ],
  };
}

function handleGraphStats(svc: GraphService) {
  const stats = svc.getStats();
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(stats, null, 2),
      },
    ],
  };
}

function formatResults(results: SearchResult[]) {
  if (results.length === 0) return 'No results found.';
  const lines: string[] = [`Found ${results.length} result(s):\n`];
  for (let i = 0; i < results.length; i++) {
    const r = results[i];
    lines.push(`[${i + 1}] ${r.file}:${r.startLine}-${r.endLine}`);
    lines.push(`    Language: ${r.language}  |  Type: ${r.matchType}  |  Score: ${r.score.toFixed(3)}`);
    if (r.symbol) lines.push(`    Symbol: ${r.symbol}${r.kind ? ` (${r.kind})` : ''}`);
    lines.push(`    ${'─'.repeat(60)}`);
  }
  return lines.join('\n');
}
