import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { MetadataStore } from '../storage/metadata.js';
import { GraphStore } from './storage.js';
import { GraphBuilder } from './builder.js';
import type { GraphNode, GraphEdge } from './types.js';
import { logger } from '../logging.js';

export class GraphService {
  private rootPath: string;
  private indexDir: string;
  private graph: GraphStore;
  private meta: MetadataStore;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.indexDir = join(rootPath, '.edhindex');
    if (!existsSync(this.indexDir)) throw new Error('No index found');
    this.meta = new MetadataStore(this.indexDir);
    this.graph = new GraphStore(this.indexDir);
  }

  build() {
    const builder = new GraphBuilder(this.rootPath, this.meta, this.graph);
    builder.buildFull();
  }

  updateFile(filePath: string) {
    const builder = new GraphBuilder(this.rootPath, this.meta, this.graph);
    builder.updateFile(filePath);
  }

  getNode(id: string): GraphNode | null {
    return this.graph.getNode(id);
  }

  getNeighbors(id: string): { node: GraphNode; edge: GraphEdge }[] {
    return this.graph.getNeighbors(id);
  }

  getChildren(id: string): GraphNode[] {
    return this.graph.getChildren(id);
  }

  searchNodes(query: string): GraphNode[] {
    return this.graph.searchNodes(query);
  }

  getStats(): { nodeCount: number; edgeCount: number; typeCounts: Record<string, number> } {
    const nodes = this.graph.getAllNodes();
    const typeCounts: Record<string, number> = {};
    for (const n of nodes) {
      typeCounts[n.type] = (typeCounts[n.type] || 0) + 1;
    }
    return {
      nodeCount: this.graph.getNodeCount(),
      edgeCount: this.graph.getEdgeCount(),
      typeCounts,
    };
  }

  getGraphData(limit?: number, offset?: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
    const allNodes = this.graph.getAllNodes();
    const allEdges = this.graph.getAllEdges();
    const slice = (arr: any[]) => {
      if (limit === undefined) return arr;
      return arr.slice(offset || 0, (offset || 0) + limit);
    };
    return { nodes: slice(allNodes), edges: slice(allEdges) };
  }

  getNodeByPath(file: string, symbol?: string): GraphNode | null {
    const nodes = this.graph.getAllNodes();
    if (symbol) {
      return nodes.find(n => n.file === file && n.label === symbol) || null;
    }
    return nodes.find(n => n.file === file && n.type === 'file') || null;
  }

  close() {
    this.graph.close();
    this.meta.close();
  }
}
