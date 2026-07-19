import { readFileSync } from 'node:fs';
import { logger } from '../logging.js';
import { emitProgress } from '../progress.js';
import { Config } from '../config/index.js';
import { LanguageRegistry } from '../language/registry.js';
import { SymbolType } from '../language/types.js';
import { scanFiles, computeFileHash, ScannedFile } from './file-utils.js';
import { Chunk, chunkFile } from './chunker.js';
import { computeFileDelta } from './incremental.js';

export interface IndexFileResult {
  chunks: Chunk[];
  filePath: string;
  relativePath: string;
  hash: string;
}

export type IndexCallback = (result: IndexFileResult) => Promise<void>;
export type DeleteCallback = (chunkIds: string[]) => Promise<void>;

export interface IndexerOptions {
  config: Config;
  rootPath: string;
  indexDir: string;
  registry: LanguageRegistry;
  onIndex: IndexCallback;
  onDelete?: DeleteCallback;
  signal?: AbortSignal;
}

export class Indexer {
  private config: Config;
  private rootPath: string;
  private indexDir: string;
  private registry: LanguageRegistry;
  private onIndex: IndexCallback;
  private onDelete?: DeleteCallback;
  private signal: AbortSignal;

  constructor(opts: IndexerOptions) {
    this.config = opts.config;
    this.rootPath = opts.rootPath;
    this.indexDir = opts.indexDir;
    this.registry = opts.registry;
    this.onIndex = opts.onIndex;
    this.onDelete = opts.onDelete;
    this.signal = opts.signal || new AbortController().signal;
  }

  async initialize() {
    await this.registry.initialize(this.config.languages);
  }

  async runFullIndex(): Promise<Chunk[]> {
    emitProgress({ phase: 'scanning', current: 0, total: 0 });

    const files = scanFiles(this.rootPath, this.registry);
    const allChunks: Chunk[] = [];
    let processed = 0;

    emitProgress({ phase: 'scanning', current: files.length, total: files.length });

    for (const file of files) {
      if (this.signal.aborted) break;

      emitProgress({ phase: 'embedding', percent: Math.round((processed / files.length) * 100) });

      try {
        const chunks = await this.processFile(file.path, file.relativePath, file.language);
        allChunks.push(...chunks);
        await this.onIndex({ chunks, filePath: file.path, relativePath: file.relativePath, hash: file.hash });
      } catch (e) {
        logger.debug(`Failed to process ${file.relativePath}:`, e);
      }

      processed++;
    }

    emitProgress({ phase: 'building_fts' });
    emitProgress({ phase: 'ready' });

    return allChunks;
  }

  async runIncremental(
    existingFileHashes: Map<string, string>,
    existingChunkHashes: Map<string, string>,
  ): Promise<{ chunks: Chunk[]; removed: string[] }> {
    emitProgress({ phase: 'scanning', current: 0, total: 0 });

    const scannedFiles = scanFiles(this.rootPath, this.registry);
    const scannedMap = new Map(scannedFiles.map(f => [f.relativePath, f]));
    const delta = computeFileDelta(scannedMap, existingFileHashes);

    emitProgress({ phase: 'scanning', current: scannedFiles.length, total: scannedFiles.length });

    const changedFiles = [...delta.added, ...delta.modified];
    const allChunks: Chunk[] = [];
    let processed = 0;

    for (const file of changedFiles) {
      if (this.signal.aborted) break;

      emitProgress({ phase: 'embedding', percent: Math.round((processed / changedFiles.length) * 100) });

      try {
        const chunks = await this.processFile(file.path, file.relativePath, file.language);
        allChunks.push(...chunks);
        await this.onIndex({ chunks, filePath: file.path, relativePath: file.relativePath, hash: file.hash });
      } catch (e) {
        logger.debug(`Failed to process ${file.relativePath}:`, e);
      }

      processed++;
    }

    if (this.onDelete && delta.removed.length > 0) {
      const removedChunkIds: string[] = [];
      for (const relPath of delta.removed) {
        for (const [chunkId] of existingChunkHashes) {
          if (chunkId.startsWith(`${relPath}:`)) {
            removedChunkIds.push(chunkId);
          }
        }
      }
      await this.onDelete(removedChunkIds);
    }

    emitProgress({ phase: 'building_fts' });
    emitProgress({ phase: 'ready' });

    return { chunks: allChunks, removed: delta.removed };
  }

  async processFile(
    filePath: string,
    relativePath: string,
    language: string,
  ): Promise<Chunk[]> {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    const { adapter } = this.registry.getAdapter(relativePath);
    const result = await adapter.parse(content, relativePath);

    return chunkFile(
      filePath,
      relativePath,
      language,
      result.symbols,
      content,
      lines,
      result.imports,
      result.exports,
    );
  }
}
