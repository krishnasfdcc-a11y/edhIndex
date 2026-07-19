import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { logger } from '../logging.js';

export interface ChunkMetadata {
  id: string;
  file: string;
  language: string;
  symbol: string;
  kind: string | null;
  parent: string | null;
  hash: string;
  git_commit: string | null;
  start_line: number;
  end_line: number;
  imports: string;
  exports: string;
  embedding_model: string;
  last_indexed: string;
  checksum: string;
}

export class MetadataStore {
  private db: Database.Database;
  private path: string;

  constructor(indexDir: string) {
    this.path = join(indexDir, 'metadata.db');
    const exists = existsSync(this.path);
    this.db = new Database(this.path);

    if (!exists) {
      this.createSchema();
    }
  }

  private createSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id TEXT PRIMARY KEY,
        file TEXT NOT NULL,
        language TEXT NOT NULL,
        symbol TEXT NOT NULL DEFAULT '',
        kind TEXT,
        parent TEXT,
        hash TEXT NOT NULL,
        git_commit TEXT,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        imports TEXT DEFAULT '',
        exports TEXT DEFAULT '',
        embedding_model TEXT NOT NULL DEFAULT '',
        last_indexed TEXT NOT NULL,
        checksum TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file);
      CREATE INDEX IF NOT EXISTS idx_chunks_language ON chunks(language);
      CREATE INDEX IF NOT EXISTS idx_chunks_symbol ON chunks(symbol);
      CREATE INDEX IF NOT EXISTS idx_chunks_kind ON chunks(kind);
      CREATE INDEX IF NOT EXISTS idx_chunks_hash ON chunks(hash);

      CREATE TABLE IF NOT EXISTS file_hashes (
        path TEXT PRIMARY KEY,
        hash TEXT NOT NULL,
        last_indexed TEXT NOT NULL
      );

      PRAGMA journal_mode = WAL;
      PRAGMA synchronous = NORMAL;
    `);
  }

  beginTransaction() {
    this.db.exec('BEGIN TRANSACTION');
  }

  commit() {
    this.db.exec('COMMIT');
  }

  rollback() {
    this.db.exec('ROLLBACK');
  }

  upsertChunk(chunk: ChunkMetadata) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO chunks
        (id, file, language, symbol, kind, parent, hash, git_commit,
         start_line, end_line, imports, exports, embedding_model, last_indexed, checksum)
      VALUES
        (@id, @file, @language, @symbol, @kind, @parent, @hash, @git_commit,
         @start_line, @end_line, @imports, @exports, @embedding_model, @last_indexed, @checksum)
    `);
    stmt.run(chunk);
  }

  deleteChunks(chunkIds: string[]) {
    if (chunkIds.length === 0) return;
    const stmt = this.db.prepare('DELETE FROM chunks WHERE id = ?');
    for (const id of chunkIds) {
      stmt.run(id);
    }
  }

  deleteChunksForFile(filePath: string) {
    this.db.prepare('DELETE FROM chunks WHERE file = ?').run(filePath);
  }

  getChunk(id: string): ChunkMetadata | undefined {
    return this.db.prepare('SELECT * FROM chunks WHERE id = ?').get(id) as ChunkMetadata | undefined;
  }

  getAllChunkHashes(): Map<string, string> {
    const rows = this.db.prepare('SELECT id, hash FROM chunks').all() as { id: string; hash: string }[];
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.id, row.hash);
    }
    return map;
  }

  getAllFileHashes(): Map<string, string> {
    const rows = this.db.prepare('SELECT path, hash FROM file_hashes').all() as { path: string; hash: string }[];
    const map = new Map<string, string>();
    for (const row of rows) {
      map.set(row.path, row.hash);
    }
    return map;
  }

  upsertFileHash(path: string, hash: string) {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO file_hashes (path, hash, last_indexed)
      VALUES (?, ?, ?)
    `);
    stmt.run(path, hash, new Date().toISOString());
  }

  deleteFileHash(path: string) {
    this.db.prepare('DELETE FROM file_hashes WHERE path = ?').run(path);
  }

  getChunksForFile(file: string): ChunkMetadata[] {
    return this.db.prepare('SELECT * FROM chunks WHERE file = ?').all() as ChunkMetadata[];
  }

  getChunkCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number };
    return row.count;
  }

  getFileCount(): number {
    const row = this.db.prepare('SELECT COUNT(DISTINCT file) as count FROM chunks').get() as { count: number };
    return row.count;
  }

  close() {
    this.db.close();
  }
}
