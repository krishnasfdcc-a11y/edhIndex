import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { loadConfig, MODEL_CONFIGS } from '../../config/index.js';
import { logger, setLogLevel, LogLevel, getLogLevel } from '../../logging.js';
import { emitProgress, onProgress } from '../../progress.js';
import { loadVersion, saveVersion, getExpectedVersion, needsRebuild } from '../../version.js';
import { MetadataStore } from '../../storage/metadata.js';
import { FTSStore } from '../../storage/fts.js';
import { TransformersEmbeddingProvider, TransformersReranker } from '../../embeddings/transformers.js';
import { LanceDBStore } from '../../vector/lancedb.js';
import { Indexer } from '../../indexer/indexer.js';
import { SearchEngine } from '../../retrieval/search.js';
import { createMCPServer } from '../../mcp/server.js';
import { FileWatcher } from '../../watcher/index.js';
import cliProgress from 'cli-progress';
import chalk from 'chalk';

export async function startCommand(rootPath: string) {
  const indexDir = join(rootPath, '.edhindex');
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  const config = loadConfig(indexDir);
  const modelCfg = MODEL_CONFIGS[config.model];

  const logLevelMap: Record<string, LogLevel> = {
    silent: LogLevel.Silent,
    info: LogLevel.Info,
    verbose: LogLevel.Verbose,
    debug: LogLevel.Debug,
  };
  setLogLevel(logLevelMap[config.logLevel] || LogLevel.Info);

  console.log(chalk.bold('EDHIndex v1.0.0'));
  console.log(`Workspace: ${rootPath}`);
  console.log(`Model: ${modelCfg.displayName} (${modelCfg.dimensions}d)`);
  console.log(`Languages: ${config.languages.join(', ')}`);
  console.log('');

  // Check index version
  const version = loadVersion(indexDir);
  if (needsRebuild(version, config.model)) {
    if (version) {
      console.log(chalk.yellow('Index version mismatch — full rebuild required.'));
      console.log(chalk.dim(`  Expected model: ${config.model}, existing: ${version.embeddingModel}`));
    } else {
      console.log(chalk.dim('No existing index found — building from scratch.'));
    }
  } else {
    console.log(chalk.dim('Existing index is compatible — incremental update.'));
  }

  // Setup progress bar
  let progressBar: cliProgress.SingleBar | null = null;
  const unsub = onProgress((event) => {
    if (progressBar) {
      if (event.phase === 'scanning' && event.total) {
        progressBar.setTotal(event.total);
        progressBar.update(event.current || 0);
      } else if (event.phase === 'embedding' && event.percent !== undefined) {
        progressBar.setTotal(100);
        progressBar.update(event.percent);
      }
    }
  });

  // Initialize stores
  console.log(chalk.dim('Initializing storage...'));
  const metadataStore = new MetadataStore(indexDir);
  const ftsStore = new FTSStore(indexDir);

  // Initialize vector store
  const vectorStore = new LanceDBStore(indexDir, modelCfg.dimensions);
  await vectorStore.init();

  // Initialize embedding provider
  const embedder = new TransformersEmbeddingProvider(config.model);
  console.log(chalk.dim(`Loading embedding model (${modelCfg.displayName})...`));
  await embedder.load();

  // Initialize reranker if enabled
  let reranker: TransformersReranker | null = null;
  if (config.rerank) {
    console.log(chalk.dim('Loading reranker model...'));
    reranker = new TransformersReranker();
    await reranker.load();
  }

  // Initialize indexer
  const indexer = new Indexer({
    config,
    rootPath,
    indexDir,
    onIndex: async (result) => {
      for (const chunk of result.chunks) {
        metadataStore.upsertChunk({
          id: chunk.id,
          file: chunk.file,
          language: chunk.language,
          symbol: chunk.symbol,
          kind: chunk.kind,
          parent: chunk.parent,
          hash: chunk.hash,
          git_commit: null,
          start_line: chunk.startLine,
          end_line: chunk.endLine,
          imports: chunk.imports.join('\n'),
          exports: chunk.exports.join('\n'),
          embedding_model: embedder.name(),
          last_indexed: new Date().toISOString(),
          checksum: chunk.hash,
        });

        ftsStore.insertChunk(chunk.id, chunk.content, chunk.file, chunk.symbol, chunk.language);
      }

      if (result.chunks.length > 0) {
        const texts = result.chunks.map(c => c.content);
        const embeddings = await embedder.embed(texts);
        const vectors = result.chunks.map((c, i) => ({
          id: c.id,
          values: embeddings[i],
          metadata: {
            file: c.file,
            symbol: c.symbol,
            kind: c.kind,
            text: c.content,
            language: c.language,
          },
        }));
        await vectorStore.insert(vectors);
      }

      metadataStore.upsertFileHash(result.relativePath, result.hash);
    },
    onDelete: async (chunkIds) => {
      for (const id of chunkIds) {
        ftsStore.deleteChunk(id);
      }
      await vectorStore.delete(chunkIds);
    },
  });

  await indexer.initialize();

  // Determine if full or incremental
  const existingFileHashes = metadataStore.getAllFileHashes();
  const existingChunkHashes = metadataStore.getAllChunkHashes();
  const doFullRebuild = needsRebuild(version, config.model) || existingFileHashes.size === 0;

  // Index
  console.log('');
  progressBar = new cliProgress.SingleBar({
    format: '{phase} | {bar} | {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });

  if (doFullRebuild) {
    progressBar.start(100, 0, { phase: 'Scanning' });
    console.log(chalk.dim('Running full index...'));
    const chunks = await indexer.runFullIndex();
    progressBar.stop();
    console.log(chalk.green(`Indexed ${chunks.length} chunks.`));

    // Save version
    const newVersion = getExpectedVersion(config.model);
    saveVersion(indexDir, newVersion);
  } else {
    progressBar.start(100, 0, { phase: 'Scanning' });
    console.log(chalk.dim('Running incremental index...'));
    const result = await indexer.runIncremental(existingFileHashes, existingChunkHashes);
    progressBar.stop();
    console.log(chalk.green(`Indexed ${result.chunks.length} chunks, removed ${result.removed.length} files.`));

    // Update version
    const existingVersion = version!;
    existingVersion.lastIndexed = new Date().toISOString();
    saveVersion(indexDir, existingVersion);
  }

  unsub();

  // Build search engine
  const searchEngine = new SearchEngine(ftsStore, metadataStore, vectorStore, embedder, reranker, config.rerank);

  // Start file watcher if enabled
  let watcher: FileWatcher | null = null;
  if (config.watch) {
    watcher = new FileWatcher(rootPath, async (filePath) => {
      logger.info(`File changed: ${filePath}`);
      const { scanFiles } = await import('../../indexer/file-utils.js');
      const files = scanFiles(rootPath, config.languages);
      const file = files.find(f => f.relativePath === filePath);
      if (file) {
        const oldChunks = metadataStore.getChunksForFile(filePath);
        const oldIds = oldChunks.map(c => c.id);
        if (oldIds.length > 0) {
          for (const id of oldIds) ftsStore.deleteChunk(id);
          await vectorStore.delete(oldIds);
        }
        metadataStore.deleteChunksForFile(filePath);
        metadataStore.deleteFileHash(filePath);

        const chunks = await indexer.processFile(file.path, file.relativePath, file.language);
        for (const chunk of chunks) {
          metadataStore.upsertChunk({
            id: chunk.id, file: chunk.file, language: chunk.language, symbol: chunk.symbol,
            kind: chunk.kind, parent: chunk.parent, hash: chunk.hash, git_commit: null,
            start_line: chunk.startLine, end_line: chunk.endLine,
            imports: chunk.imports.join('\n'), exports: chunk.exports.join('\n'),
            embedding_model: embedder.name(), last_indexed: new Date().toISOString(), checksum: chunk.hash,
          });
          ftsStore.insertChunk(chunk.id, chunk.content, chunk.file, chunk.symbol, chunk.language);
        }
        if (chunks.length > 0) {
          const embeddings = await embedder.embed(chunks.map(c => c.content));
          await vectorStore.insert(chunks.map((c, i) => ({
            id: c.id, values: embeddings[i],
            metadata: { file: c.file, symbol: c.symbol, kind: c.kind, text: c.content, language: c.language },
          })));
        }
        metadataStore.upsertFileHash(filePath, file.hash);
        logger.info(`Re-indexed: ${filePath}`);
      }
    });
    await watcher.start();
    console.log(chalk.green('File watcher started.'));
  }

  // Start MCP server
  console.log(chalk.green('Starting MCP server on stdio...'));
  const mcpServer = createMCPServer(searchEngine, rootPath);

  const transport = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const stdioTransport = new transport.StdioServerTransport();
  await mcpServer.connect(stdioTransport);

  // Handle shutdown
  const shutdown = async () => {
    console.log(chalk.yellow('\nShutting down...'));
    if (watcher) await watcher.stop();
    vectorStore.close();
    metadataStore.close();
    ftsStore.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
