import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js';
import { SearchEngine, SearchResult } from '../retrieval/search.js';
import { logger } from '../logging.js';

export function createMCPServer(searchEngine: SearchEngine, rootPath: string): Server {
  const server = new Server(
    {
      name: 'edhindex',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'search_codebase',
          description: `Search the indexed codebase using hybrid (keyword + semantic + reranked) search. Workspace: ${rootPath}. Searches file contents, symbols, and code structure.`,
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'Search query - natural language or code terms',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum results to return (default 10)',
                default: 10,
              },
              fileFilter: {
                type: 'string',
                description: 'Optional file path filter (glob pattern)',
              },
              languageFilter: {
                type: 'string',
                description: 'Optional language filter (ts, js, py, go)',
              },
            },
            required: ['query'],
          },
        },
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    if (request.params.name !== 'search_codebase') {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
    }

    const args = request.params.arguments || {};
    const query = String(args.query || '').trim();

    if (!query) {
      throw new McpError(ErrorCode.InvalidParams, 'query is required');
    }

    const maxResults = Math.min(Math.max(Number(args.maxResults) || 10, 1), 100);
    const fileFilter = args.fileFilter ? String(args.fileFilter) : undefined;
    const languageFilter = args.languageFilter ? String(args.languageFilter) : undefined;

    // Security: sanitize and restrict to workspace
    if (fileFilter) {
      const { sanitizePath } = await import('../security.js');
      const safe = sanitizePath(rootPath, fileFilter);
      if (!safe) {
        throw new McpError(ErrorCode.InvalidParams, 'File filter is outside the workspace');
      }
    }

    try {
      const results = await searchEngine.search({ query, maxResults, fileFilter, languageFilter });
      return formatResults(results);
    } catch (e: any) {
      logger.error('Search failed:', e);
      throw new McpError(ErrorCode.InternalError, `Search failed: ${e.message}`);
    }
  });

  // Error handler
  server.onerror = (error: any) => {
    logger.error('MCP Server error:', error);
  };

  return server;
}

function formatResults(results: SearchResult[]) {
  const textParts: string[] = [];

  if (results.length === 0) {
    textParts.push('No results found.');
  } else {
    textParts.push(`Found ${results.length} result(s):\n`);
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const lines: string[] = [];
      lines.push(`[${i + 1}] ${r.file}:${r.startLine}-${r.endLine}`);
      lines.push(`    Language: ${r.language}  |  Type: ${r.matchType}  |  Score: ${r.score.toFixed(3)}`);
      if (r.symbol) lines.push(`    Symbol: ${r.symbol}${r.kind ? ` (${r.kind})` : ''}`);
      lines.push(`    ${'─'.repeat(60)}`);
      textParts.push(lines.join('\n'));
    }
  }

  return {
    content: [
      {
        type: 'text',
        text: textParts.join('\n'),
      },
    ],
  };
}
