import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../logging.js';

export type ModelTier = 'light' | 'balanced' | 'max';
export type LogLevelConfig = 'silent' | 'info' | 'verbose' | 'debug';
export type GraphLayoutConfig = 'force' | 'hierarchical' | 'circular' | 'grid';

export interface Config {
  model: ModelTier;
  languages: string[];
  watch: boolean;
  rerank: boolean;
  maxResults: number;
  logLevel: LogLevelConfig;
  graphEnabled: boolean;
  graphLayout: GraphLayoutConfig;
  graphAnimations: boolean;
  graphShowFolders: boolean;
  graphShowFiles: boolean;
  graphShowFunctions: boolean;
}

const DEFAULT_CONFIG: Config = {
  model: 'balanced',
  languages: ['ts', 'js', 'py', 'go', 'rs', 'java', 'rb', 'c', 'cpp', 'csharp', 'php', 'scala', 'hs', 'dart', 'solidity', 'css', 'json', 'html'],
  watch: true,
  rerank: true,
  maxResults: 10,
  logLevel: 'info',
  graphEnabled: true,
  graphLayout: 'force',
  graphAnimations: true,
  graphShowFolders: true,
  graphShowFiles: true,
  graphShowFunctions: true,
};

export function defaultConfig(): Config {
  return { ...DEFAULT_CONFIG };
}

export function loadConfig(indexDir: string): Config {
  const path = join(indexDir, 'config.json');
  if (!existsSync(path)) {
    const cfg = defaultConfig();
    saveConfig(indexDir, cfg);
    return cfg;
  }
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<Config>;
    return { ...defaultConfig(), ...parsed };
  } catch (e) {
    logger.error('Failed to load config, using defaults:', e);
    return defaultConfig();
  }
}

export function saveConfig(indexDir: string, config: Config) {
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }
  writeFileSync(join(indexDir, 'config.json'), JSON.stringify(config, null, 2), 'utf-8');
}

export const MODEL_CONFIGS: Record<ModelTier, { modelId: string; dimensions: number; displayName: string; size: string }> = {
  light: {
    modelId: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    displayName: 'all-MiniLM-L6-v2',
    size: '~46MB',
  },
  balanced: {
    modelId: 'Xenova/bge-base-en-v1.5',
    dimensions: 768,
    displayName: 'bge-base-en-v1.5',
    size: '~109MB',
  },
  max: {
    modelId: 'Xenova/bge-m3',
    dimensions: 1024,
    displayName: 'BGE-M3',
    size: '~1.1GB',
  },
};

export const RERANKER_MODEL = 'Xenova/ms-marco-MiniLM-L-6-v2';
