import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { GraphNode, GraphEdge, GraphData } from './types.js';
import { logger } from '../logging.js';

export class GraphStore {
  private db: Database.Database;
  private path: string;

  constructor(indexDir: string) {
    this.path = join(indexDir, 'graph.sqlite');
    const exists = existsSync(this.path);
    this.db = new Database(this.path);
    if (!exists) this.createSchema();
  }

  private createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        type TEXT NOT NULL,
        language TEXT NOT NULL DEFAULT '',
        file TEXT NOT NULL DEFAULT '',
        start_line INTEGER NOT NULL DEFAULT 0,
        end_line INTEGER NOT NULL DEFAULT 0,
        metadata TEXT NOT NULL DEFAULT '{}'
      );
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        type TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}'
      );
      CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target);
      CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type);
      CREATE INDEX IF NOT EXISTS idx_nodes_file ON nodes(file);
      CREATE INDEX IF NOT EXISTS idx_nodes_label ON nodes(label);
      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);
  }

  begin() { this.db.exec('BEGIN TRANSACTION'); }
  commit() { this.db.exec('COMMIT'); }
  rollback() { this.db.exec('ROLLBACK'); }

  upsertNode(node: GraphNode) {
    this.db.prepare(`
      INSERT OR REPLACE INTO nodes (id, label, type, language, file, start_line, end_line, metadata)
      VALUES (@id, @label, @type, @language, @file, @startLine, @endLine, @metadata)
    `).run({ ...node, metadata: JSON.stringify(node.metadata) });
  }

  upsertEdge(edge: GraphEdge) {
    this.db.prepare(`
      INSERT OR REPLACE INTO edges (id, source, target, type, metadata)
      VALUES (@id, @source, @target, @type, @metadata)
    `).run({ ...edge, metadata: JSON.stringify(edge.metadata) });
  }

  deleteNodes(ids: string[]) {
    if (ids.length === 0) return;
    const del = this.db.prepare('DELETE FROM nodes WHERE id = ?');
    for (const id of ids) del.run(id);
  }

  deleteEdgesForNodes(ids: string[]) {
    if (ids.length === 0) return;
    const del = this.db.prepare('DELETE FROM edges WHERE source = ? OR target = ?');
    for (const id of ids) { del.run(id, id); }
  }

  deleteEdgesForFile(file: string) {
    this.db.prepare(`
      DELETE FROM edges WHERE id IN (
        SELECT e.id FROM edges e JOIN nodes n ON e.source = n.id OR e.target = n.id
        WHERE n.file = ?
      )
    `).run(file);
  }

  deleteNodesForFile(file: string) {
    this.db.prepare('DELETE FROM nodes WHERE file = ?').run(file);
  }

  getNode(id: string): GraphNode | null {
    const row = this.db.prepare('SELECT * FROM nodes WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    return row ? this.rowToNode(row) : null;
  }

  getNodes(ids: string[]): GraphNode[] {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return this.db.prepare(`SELECT * FROM nodes WHERE id IN (${placeholders})`).all(...ids).map(r => this.rowToNode(r as Record<string, unknown>));
  }

  getAllNodes(): GraphNode[] {
    return this.db.prepare('SELECT * FROM nodes').all().map(r => this.rowToNode(r as Record<string, unknown>));
  }

  getAllEdges(): GraphEdge[] {
    return this.db.prepare('SELECT * FROM edges').all().map(r => this.rowToEdge(r as Record<string, unknown>));
  }

  getNeighbors(id: string): { node: GraphNode; edge: GraphEdge }[] {
    const rows = this.db.prepare(`
      SELECT n.*, e.id as edge_id, e.source as edge_source, e.target as edge_target,
             e.type as edge_type, e.metadata as edge_metadata
      FROM edges e JOIN nodes n ON (e.source = ? AND n.id = e.target) OR (e.target = ? AND n.id = e.source)
    `).all(id, id) as Record<string, unknown>[];
    return rows.map(r => ({
      node: this.rowToNode(r),
      edge: {
        id: r.edge_id as string,
        source: r.edge_source as string,
        target: r.edge_target as string,
        type: r.edge_type as import('./types.js').EdgeType,
        metadata: JSON.parse(r.edge_metadata as string),
      },
    }));
  }

  getChildren(id: string): GraphNode[] {
    return this.db.prepare(`
      SELECT n.* FROM nodes n JOIN edges e ON e.target = n.id
      WHERE e.source = ? AND e.type = 'contains'
    `).all(id).map(r => this.rowToNode(r as Record<string, unknown>));
  }

  searchNodes(query: string): GraphNode[] {
    const q = `%${query}%`;
    return this.db.prepare(`
      SELECT * FROM nodes WHERE label LIKE ? OR file LIKE ? OR id LIKE ?
      LIMIT 50
    `).all(q, q, q).map(r => this.rowToNode(r as Record<string, unknown>));
  }

  getNodeCount(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM nodes').get() as { c: number }).c;
  }

  getEdgeCount(): number {
    return (this.db.prepare('SELECT COUNT(*) as c FROM edges').get() as { c: number }).c;
  }

  clear() {
    this.db.exec('DELETE FROM nodes; DELETE FROM edges');
  }

  close() {
    this.db.close();
  }

  private rowToNode(r: Record<string, unknown>): GraphNode {
    return {
      id: r.id as string,
      label: r.label as string,
      type: r.type as import('./types.js').NodeType,
      language: r.language as string,
      file: r.file as string,
      startLine: r.start_line as number,
      endLine: r.end_line as number,
      metadata: JSON.parse(r.metadata as string),
    };
  }

  private rowToEdge(r: Record<string, unknown>): GraphEdge {
    return {
      id: r.id as string,
      source: r.source as string,
      target: r.target as string,
      type: r.type as import('./types.js').EdgeType,
      metadata: JSON.parse(r.metadata as string),
    };
  }
}
