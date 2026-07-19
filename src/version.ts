import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from './logging.js';

export interface IndexVersion {
  schema: number;
  embeddingModel: string;
  chunkStrategy: number;
  createdAt: string;
  lastIndexed: string;
}

const CURRENT_SCHEMA = 1;
const CURRENT_CHUNK_STRATEGY = 1;

export function getExpectedVersion(embeddingModelName: string): IndexVersion {
  return {
    schema: CURRENT_SCHEMA,
    embeddingModel: embeddingModelName,
    chunkStrategy: CURRENT_CHUNK_STRATEGY,
    createdAt: new Date().toISOString(),
    lastIndexed: new Date().toISOString(),
  };
}

export function loadVersion(indexDir: string): IndexVersion | null {
  const path = join(indexDir, 'version.json');
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw) as IndexVersion;
  } catch (e) {
    logger.debug('Failed to load version.json:', e);
    return null;
  }
}

export function saveVersion(indexDir: string, version: IndexVersion) {
  const path = join(indexDir, 'version.json');
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }
  writeFileSync(path, JSON.stringify(version, null, 2), 'utf-8');
}

export function needsRebuild(
  existing: IndexVersion | null,
  embeddingModel: string,
): boolean {
  if (!existing) return true;
  if (existing.schema !== CURRENT_SCHEMA) return true;
  if (existing.embeddingModel !== embeddingModel) return true;
  if (existing.chunkStrategy !== CURRENT_CHUNK_STRATEGY) return true;
  return false;
}
