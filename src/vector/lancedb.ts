import { VectorStore } from './store.js';
import { logger } from '../logging.js';

export class LanceDBStore implements VectorStore {
  private db: any = null;
  private table: any = null;
  private uri: string;
  private dims: number;
  private tableName = 'chunks';
  private initialized = false;

  constructor(indexDir: string, dimensions: number) {
    this.uri = indexDir;
    this.dims = dimensions;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    const mod = await import('@lancedb/lancedb');
    this.db = await mod.connect(this.uri);
    const tableNames = await this.db.tableNames();

    if (tableNames.includes(this.tableName)) {
      this.table = await this.db.openTable(this.tableName);
    } else {
      this.table = await this.db.createTable(this.tableName, [
        { id: '', vector: new Array(this.dims).fill(0), metadata: {} },
      ]);
    }
    this.initialized = true;
  }

  async insert(vectors: Array<{ id: string; values: number[]; metadata: Record<string, any> }>): Promise<void> {
    await this.init();
    const data = vectors.map(v => ({
      id: v.id,
      vector: v.values,
      metadata: { ...v.metadata, text: v.metadata.text || '' },
    }));
    await this.table.add(data);
  }

  async delete(ids: string[]): Promise<void> {
    await this.init();
    for (const id of ids) {
      try {
        await this.table.delete(`id = '${id.replace(/'/g, "''")}'`);
      } catch (e) {
        logger.debug(`Failed to delete vector ${id}:`, e);
      }
    }
  }

  async search(query: number[], topK: number): Promise<Array<{ id: string; score: number }>> {
    await this.init();
    try {
      const results = await this.table
        .vectorSearch(query)
        .limit(topK)
        .toArray();

      return results.map((r: any) => ({
        id: r.id as string,
        score: r._distance !== undefined ? 1 / (1 + r._distance) : 1,
      }));
    } catch (e) {
      logger.debug('Vector search failed:', e);
      return [];
    }
  }

  async compact(): Promise<void> {
    await this.init();
    try {
      await this.table.compact();
    } catch (e) {
      logger.debug('Compact failed:', e);
    }
  }

  async count(): Promise<number> {
    await this.init();
    try {
      return await this.table.countRows();
    } catch {
      return 0;
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      try { await this.db.close(); } catch { /* ignore */ }
    }
  }
}
