import { MetadataStore } from '../storage/metadata.js';
import { FileNode, parseImportPaths, resolveImport } from './svg.js';

export interface GraphData {
  nodes: FileNode[];
  edges: { source: string; target: string }[];
  fileCount: number;
  edgeCount: number;
}

export function buildGraphData(store: MetadataStore): GraphData {
  const files = store.getAllFilesWithImports();

  const nodeMap = new Map<string, FileNode>();
  for (const row of files) {
    if (!nodeMap.has(row.file)) {
      nodeMap.set(row.file, {
        id: row.file,
        label: row.file,
        language: row.language,
        chunkCount: row.chunkCount,
        imports: parseImportPaths(row.imports),
      });
    }
  }

  const edgeSet = new Set<string>();
  const indexedFiles = new Set(nodeMap.keys());
  for (const node of nodeMap.values()) {
    for (const imp of node.imports) {
      const resolved = resolveImport(node.id, imp, indexedFiles);
      if (resolved && resolved !== node.id) {
        edgeSet.add(`${node.id}|${resolved}`);
      }
    }
  }

  const nodes = [...nodeMap.values()];
  const edges = [...edgeSet].map((e) => {
    const [source, target] = e.split('|');
    return { source, target };
  });

  return { nodes, edges, fileCount: nodes.length, edgeCount: edges.length };
}
