export type NodeType =
  | 'workspace'
  | 'folder'
  | 'file'
  | 'module'
  | 'class'
  | 'interface'
  | 'enum'
  | 'function'
  | 'method'
  | 'variable'
  | 'import'
  | 'export'
  | 'package'
  | 'constructor'
  | 'extension'
  | 'field'
  | 'type_alias'
  | 'document'
  | 'section'
  | 'table'
  | 'selector'
  | 'rule'
  | 'actor'
  | 'object'
  | 'protocol';

export type EdgeType =
  | 'contains'
  | 'imports'
  | 'exports'
  | 'inherits'
  | 'implements'
  | 'calls'
  | 'references'
  | 'defines'
  | 'belongs_to';

export interface GraphNode {
  id: string;
  label: string;
  type: NodeType;
  language: string;
  file: string;
  startLine: number;
  endLine: number;
  metadata: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  metadata: Record<string, unknown>;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export type GraphLayout = 'force' | 'hierarchical' | 'circular' | 'grid';

export interface GraphConfig {
  enabled: boolean;
  layout: GraphLayout;
  animations: boolean;
  showFolders: boolean;
  showFiles: boolean;
  showFunctions: boolean;
}

export const DEFAULT_GRAPH_CONFIG: GraphConfig = {
  enabled: true,
  layout: 'force',
  animations: true,
  showFolders: true,
  showFiles: true,
  showFunctions: true,
};
