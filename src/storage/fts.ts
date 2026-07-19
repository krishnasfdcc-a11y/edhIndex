import Database from 'better-sqlite3';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { logger } from '../logging.js';

export interface FTSResult {
  id: string;
  rank: number;
  content: string;
  file: string;
  symbol: string;
  kind: string | null;
  start_line: number;
  end_line: number;
  language: string;
}

export class FTSStore {
  private db: Database.Database;
  private path: string;

  constructor(indexDir: string) {
    this.path = join(indexDir, 'fts.db');
    this.db = new Database(this.path);
    this.createSchema();
  }

  private createSchema() {
    this.db.exec(`
      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        content,
        file UNINDEXED,
        symbol,
        language UNINDEXED,
        content_id UNINDEXED,
        tokenize='porter unicode61'
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

  insertChunk(id: string, content: string, file: string, symbol: string, language: string) {
    try {
      this.db.prepare(`
        INSERT INTO chunks_fts (content, file, symbol, language, content_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(content, file, symbol, language, id);
    } catch (e: any) {
      if (e?.message?.includes('already exists')) {
        this.db.prepare(`
          UPDATE chunks_fts SET content = ?, file = ?, symbol = ?, language = ?
          WHERE content_id = ?
        `).run(content, file, symbol, language, id);
      }
    }
  }

  deleteChunk(id: string) {
    this.db.prepare('DELETE FROM chunks_fts WHERE content_id = ?').run(id);
  }

  deleteChunksForFile(filePath: string) {
    this.db.prepare('DELETE FROM chunks_fts WHERE file = ?').run(filePath);
  }

  search(query: string, limit: number): FTSResult[] {
    const cleaned = query.replace(/[^\w\s]/g, ' ').trim();
    if (!cleaned) return [];

    try {
      const results = this.db.prepare(`
        SELECT
          content_id as id,
          rank,
          content,
          file,
          symbol,
          language
        FROM chunks_fts
        WHERE chunks_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(cleaned, limit) as FTSResult[];

      return results.map(r => ({
        ...r,
        kind: null,
        start_line: 0,
        end_line: 0,
      }));
    } catch {
      return [];
    }
  }

  searchWithRank(query: string, limit: number): Array<{ id: string; rank: number }> {
    const cleaned = query.replace(/[^\w\s]/g, ' ').trim();
    if (!cleaned) return [];

    try {
      return this.db.prepare(`
        SELECT content_id as id, rank
        FROM chunks_fts
        WHERE chunks_fts MATCH ?
        ORDER BY rank
        LIMIT ?
      `).all(cleaned, limit) as Array<{ id: string; rank: number }>;
    } catch {
      return [];
    }
  }

  close() {
    this.db.close();
  }
}
