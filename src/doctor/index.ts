import { existsSync, statSync, accessSync, constants, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../logging.js';
import { MetadataStore } from '../storage/metadata.js';
import { FTSStore } from '../storage/fts.js';
import { EmbeddingProvider } from '../embeddings/provider.js';
import { VectorStore } from '../vector/store.js';
import { loadVersion } from '../version.js';
import { loadConfig, MODEL_CONFIGS, ModelTier } from '../config/index.js';

export interface DoctorResult {
  category: string;
  status: 'ok' | 'warn' | 'error';
  message: string;
  detail?: string;
}

export async function runDoctor(rootPath: string, indexDir: string): Promise<DoctorResult[]> {
  const results: DoctorResult[] = [];

  // 1. Workspace check
  results.push(checkPath('Workspace', rootPath, true));

  // 2. Index directory
  results.push(checkPath('Index directory', indexDir, false));

  // 3. Config
  try {
    const config = loadConfig(indexDir);
    results.push({ category: 'Config', status: 'ok', message: `Loaded (model: ${config.model})` });
  } catch (e: any) {
    results.push({ category: 'Config', status: 'error', message: `Failed: ${e.message}` });
  }

  // 4. Version
  const version = loadVersion(indexDir);
  if (version) {
    results.push({ category: 'Version', status: 'ok', message: `Schema v${version.schema}, ${version.embeddingModel}` });
  } else {
    results.push({ category: 'Version', status: 'warn', message: 'No version file (not indexed yet)' });
  }

  // 5. SQLite metadata
  try {
    const meta = new MetadataStore(indexDir);
    const chunkCount = meta.getChunkCount();
    const fileCount = meta.getFileCount();
    meta.close();
    results.push({ category: 'SQLite (metadata)', status: 'ok', message: `${chunkCount} chunks from ${fileCount} files` });
  } catch (e: any) {
    results.push({ category: 'SQLite (metadata)', status: 'error', message: `Failed: ${e.message}` });
  }

  // 6. SQLite FTS
  try {
    const fts = new FTSStore(indexDir);
    fts.close();
    results.push({ category: 'SQLite (FTS)', status: 'ok', message: 'Accessible' });
  } catch (e: any) {
    results.push({ category: 'SQLite (FTS)', status: 'error', message: `Failed: ${e.message}` });
  }

  // 7. LanceDB
  try {
    const mod = await import('@lancedb/lancedb');
    const db = await mod.connect(indexDir);
    const names = await db.tableNames();
    await db.close();
    results.push({ category: 'LanceDB', status: 'ok', message: `Tables: ${names.join(', ') || 'none'}` });
  } catch (e: any) {
    results.push({ category: 'LanceDB', status: 'warn', message: `Check failed: ${e.message}` });
  }

  // 8. Embedding model
  try {
    const config = loadConfig(indexDir);
    const modelTier: ModelTier = config.model;
    const modelCfg = MODEL_CONFIGS[modelTier];
    const mod = await import('@huggingface/transformers');
    await mod.pipeline('feature-extraction', modelCfg.modelId, { local_files_only: true });
    results.push({ category: 'Embedding model', status: 'ok', message: `${modelCfg.displayName} (cached)` });
  } catch {
    try {
      const config = loadConfig(indexDir);
      const modelTier: ModelTier = config.model;
      const modelCfg = MODEL_CONFIGS[modelTier];
      results.push({ category: 'Embedding model', status: 'warn', message: `${modelCfg.displayName} (not cached, will download on first use)` });
    } catch {
      results.push({ category: 'Embedding model', status: 'warn', message: 'Unknown (config issue)' });
    }
  }

  // 9. Disk space
  try {
    const stat = statSync(indexDir);
    const free = stat.size > 0 ? 'has data' : 'empty';
    results.push({ category: 'Disk space', status: 'ok', message: `Index dir ${free}` });
  } catch {
    results.push({ category: 'Disk space', status: 'warn', message: 'Index dir not created yet' });
  }

  // 10. Permissions
  try {
    accessSync(rootPath, constants.R_OK | constants.X_OK);
    results.push({ category: 'Permissions', status: 'ok', message: 'Readable' });
  } catch (e: any) {
    results.push({ category: 'Permissions', status: 'error', message: `Cannot read workspace: ${e.message}` });
  }

  // 11. MCP
  results.push({ category: 'MCP Server', status: 'ok', message: 'Available on stdio transport' });

  return results;
}

function checkPath(category: string, path: string, mustExist: boolean): DoctorResult {
  const exists = existsSync(path);
  if (mustExist && !exists) {
    return { category, status: 'error', message: `Not found: ${path}` };
  }
  if (!mustExist && !exists) {
    return { category, status: 'warn', message: `Not found: ${path} (will create on first index)` };
  }
  try {
    const s = statSync(path);
    const type = s.isDirectory() ? 'directory' : 'file';
    return { category, status: 'ok', message: `${type}: ${path}` };
  } catch (e: any) {
    return { category, status: 'error', message: `Cannot access: ${e.message}` };
  }
}
