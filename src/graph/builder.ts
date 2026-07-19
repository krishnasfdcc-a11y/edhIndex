import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { MetadataStore } from '../storage/metadata.js';
import { GraphStore } from './storage.js';
import type { GraphNode, GraphEdge, NodeType, EdgeType } from './types.js';
import { logger } from '../logging.js';

export class GraphBuilder {
  private rootPath: string;
  private meta: MetadataStore;
  private graph: GraphStore;
  private nodeIds = new Set<string>();
  private edgeIds = new Set<string>();

  constructor(rootPath: string, meta: MetadataStore, graph: GraphStore) {
    this.rootPath = rootPath;
    this.meta = meta;
    this.graph = graph;
  }

  buildFull() {
    logger.info('Building knowledge graph...');
    this.graph.clear();
    this.nodeIds.clear();
    this.edgeIds.clear();

    this.addWorkspaceNode();
    this.addFolderNodes();
    this.addFileAndSymbolNodes();
    this.addImportExportEdges();

    logger.info(`Graph built: ${this.graph.getNodeCount()} nodes, ${this.graph.getEdgeCount()} edges`);
  }

  updateFile(filePath: string) {
    const relPath = relative(this.rootPath, filePath);

    // Remove existing nodes/edges for this file
    this.graph.deleteEdgesForFile(relPath);
    this.graph.deleteNodesForFile(relPath);

    // Re-add nodes for this file
    const chunks = this.meta.getChunksForFile(relPath);
    if (chunks.length === 0) return;

    const symbolsInFile = new Set(chunks.filter(c => c.symbol).map(c => c.symbol));

    const fileNode = this.makeNode(`file:${relPath}`, relPath, 'file', chunks[0].language, relPath, 0, 0);
    this.addEdge(`contains:file:${relPath}`, `workspace:${this.nodeId('workspace')}`, fileNode.id, 'contains');
    this.graph.upsertNode(fileNode);

    for (const chunk of chunks) {
      if (!chunk.symbol) continue;
      const nodeType = this.mapKind(chunk.kind);
      const nid = `sym:${chunk.file}:${chunk.symbol}`;
      const node = this.makeNode(nid, chunk.symbol, nodeType, chunk.language, chunk.file, chunk.start_line, chunk.end_line, { parent: chunk.parent || undefined });
      this.graph.upsertNode(node);
      this.addEdge(`defines:${relPath}:${chunk.symbol}`, fileNode.id, nid, 'defines');

      if (chunk.parent && symbolsInFile.has(chunk.parent)) {
        const parentId = `sym:${chunk.file}:${chunk.parent}`;
        this.addEdge(`contains:sym:${chunk.file}:${chunk.parent}:${chunk.symbol}`, parentId, nid, 'contains');
      }
    }

    this.addImportExportEdgesForFile(relPath, chunks);
  }

  private addWorkspaceNode() {
    const wid = this.nodeId('workspace');
    const node = this.makeNode(wid, this.rootPath.split(sep).pop() || 'workspace', 'workspace', '', '', 0, 0);
    this.graph.upsertNode(node);
  }

  private addFolderNodes() {
    const walk = (dir: string) => {
      try {
        const entries = readdirSync(dir);
        for (const entry of entries) {
          if (entry.startsWith('.') || entry === 'node_modules') continue;
          const full = join(dir, entry);
          const stat = statSync(full);
          if (stat.isDirectory()) {
            const relPath = relative(this.rootPath, full);
            const fid = this.nodeId(`folder:${relPath}`);
            const node = this.makeNode(fid, entry, 'folder', '', relPath, 0, 0);
            this.graph.upsertNode(node);

            const parentRel = relative(this.rootPath, join(full, '..'));
            const parentId = parentRel === '' ? this.nodeId('workspace') : this.nodeId(`folder:${parentRel}`);
            this.addEdge(`contains:folder:${relPath}`, parentId, fid, 'contains');

            walk(full);
          }
        }
      } catch { /* skip unreadable dirs */ }
    };
    walk(this.rootPath);
  }

  private addFileAndSymbolNodes() {
    const files = this.meta.getAllFilesWithImports();
    for (const f of files) {
      const fid = this.nodeId(`file:${f.file}`);
      const fileNode = this.makeNode(fid, f.file.split('/').pop() || f.file, 'file', f.language, f.file, 0, 0);
      this.graph.upsertNode(fileNode);

      const parentRel = f.file.includes('/') ? f.file.slice(0, f.file.lastIndexOf('/')) : '';
      const parentId = parentRel ? this.nodeId(`folder:${parentRel}`) : this.nodeId('workspace');
      this.addEdge(`contains:file:${f.file}`, parentId, fid, 'contains');

      const chunks = this.meta.getChunksForFile(f.file);
      const symbolsInFile = new Set<string>();
      for (const chunk of chunks) {
        if (chunk.symbol) symbolsInFile.add(chunk.symbol);
      }
      for (const chunk of chunks) {
        if (!chunk.symbol) continue;
        const nodeType = this.mapKind(chunk.kind);
        const nid = this.nodeId(`sym:${chunk.file}:${chunk.symbol}`);
        const node = this.makeNode(nid, chunk.symbol, nodeType, chunk.language, chunk.file, chunk.start_line, chunk.end_line, {
          parent: symbolsInFile.has(chunk.parent || '') ? chunk.parent : undefined,
          hash: chunk.hash,
        });
        this.graph.upsertNode(node);
        this.addEdge(`defines:${f.file}:${chunk.symbol}`, fid, nid, 'defines');

        if (chunk.parent && symbolsInFile.has(chunk.parent)) {
          const parentId = this.nodeId(`sym:${chunk.file}:${chunk.parent}`);
          this.addEdge(`contains:${chunk.file}:${chunk.parent}:${chunk.symbol}`, parentId, nid, 'contains');
        }
      }
    }
  }

  private addImportExportEdges() {
    const files = this.meta.getAllFilesWithImports();
    const indexedFiles = new Set(files.map(f => f.file));
    for (const f of files) {
      const chunks = this.meta.getChunksForFile(f.file);
      this.addImportExportEdgesForFile(f.file, chunks, indexedFiles);
    }
  }

  private addImportExportEdgesForFile(file: string, chunks: { symbol: string; imports: string; exports: string }[], indexedFiles?: Set<string>) {
    if (!indexedFiles) {
      indexedFiles = new Set(this.meta.getAllFilesWithImports().map(f => f.file));
    }

    const fid = this.nodeId(`file:${file}`);

    for (const chunk of chunks) {
      // Import edges
      const importModules = this.parseImportPaths(chunk.imports);
      for (const imp of importModules) {
        const resolved = this.resolveImport(file, imp, indexedFiles);
        if (resolved) {
          const tid = this.nodeId(`file:${resolved}`);
          this.addEdge(`imports:${file}:${resolved}`, fid, tid, 'imports');
        }
      }

      // Export edges
      const exportModules = this.parseImportPaths(chunk.exports);
      for (const exp of exportModules) {
        const resolved = this.resolveImport(file, exp, indexedFiles);
        if (resolved) {
          const tid = this.nodeId(`file:${resolved}`);
          this.addEdge(`exports:${file}:${resolved}`, fid, tid, 'exports');
        }
      }
    }
  }

  private parseImportPaths(raw: string): string[] {
    if (!raw) return [];
    const results: string[] = [];
    for (const line of raw.split('\n')) {
      const t = line.trim();
      let m = t.match(/from\s+['"](\..*?)['"]/);
      if (!m) m = t.match(/require\s*\(\s*['"](\..*?)['"]\s*\)/);
      if (!m) m = t.match(/import\s+['"](\..*?)['"]/);
      if (m) results.push(m[1]);
    }
    return results;
  }

  private resolveImport(sourceFile: string, importPath: string, indexedFiles: Set<string>): string | null {
    const raw = importPath.replace(/^['"]|['"]$/g, '');
    const dir = sourceFile.includes('/') ? sourceFile.slice(0, sourceFile.lastIndexOf('/')) : '';

    const normalize = (base: string, rel: string): string => {
      const parts = (base ? base.split('/') : []).concat(rel.split('/'));
      const out: string[] = [];
      for (const p of parts) {
        if (p === '.' || p === '') continue;
        if (p === '..') { out.pop(); continue; }
        out.push(p);
      }
      return out.join('/');
    };

    const full = normalize(dir, raw);
    const candidates = [full];
    for (const jsExt of ['.js', '.jsx']) {
      if (full.endsWith(jsExt)) candidates.push(full.replace(jsExt, ''), full.replace(jsExt, '.ts'), full.replace(jsExt, '.tsx'));
    }

    for (const c of candidates) { if (indexedFiles.has(c)) return c; }
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.py', '.go']) { if (indexedFiles.has(full + ext)) return full + ext; }
    for (const idx of ['index.ts', 'index.tsx', 'index.js', 'index.jsx', '__init__.py']) { if (indexedFiles.has(full + '/' + idx)) return full + '/' + idx; }
    return null;
  }

  private mapKind(kind: string | null): NodeType {
    switch (kind) {
      case 'class': return 'class';
      case 'interface': return 'interface';
      case 'enum': return 'enum';
      case 'function': return 'function';
      case 'method': return 'method';
      case 'variable': return 'variable';
      case 'module': return 'module';
      default: return 'module';
    }
  }

  private makeNode(id: string, label: string, type: NodeType, language: string, file: string, startLine: number, endLine: number, extra?: Record<string, unknown>): GraphNode {
    return { id, label, type, language, file, startLine, endLine, metadata: extra || {} };
  }

  private addEdge(id: string, source: string, target: string, type: EdgeType) {
    if (this.edgeIds.has(id)) return;
    this.edgeIds.add(id);
    this.graph.upsertEdge({ id, source, target, type, metadata: {} });
  }

  private nodeId(key: string): string {
    const id = `kg:${key}`;
    this.nodeIds.add(id);
    return id;
  }
}
