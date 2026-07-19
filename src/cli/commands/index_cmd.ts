import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { loadConfig, saveConfig, MODEL_CONFIGS } from '../../config/index.js';
import { logger, setLogLevel, LogLevel } from '../../logging.js';
import { emitProgress, onProgress } from '../../progress.js';
import { loadVersion, saveVersion, getExpectedVersion, needsRebuild } from '../../version.js';
import { MetadataStore } from '../../storage/metadata.js';
import { FTSStore } from '../../storage/fts.js';
import { TransformersEmbeddingProvider } from '../../embeddings/transformers.js';
import { LanceDBStore } from '../../vector/lancedb.js';
import { Indexer } from '../../indexer/indexer.js';
import cliProgress from 'cli-progress';
import chalk from 'chalk';

export async function indexCommand(rootPath: string) {
  const indexDir = join(rootPath, '.edhindex');
  if (!existsSync(indexDir)) {
    mkdirSync(indexDir, { recursive: true });
  }

  const config = loadConfig(indexDir);
  const modelCfg = MODEL_CONFIGS[config.model];

  setLogLevel(LogLevel.Info);

  // Check version
  const version = loadVersion(indexDir);
  const fullRebuild = needsRebuild(version, config.model);

  if (fullRebuild && version) {
    console.log(chalk.yellow('Index version mismatch — full rebuild.'));
  }

  const metadataStore = new MetadataStore(indexDir);
  const ftsStore = new FTSStore(indexDir);
  const vectorStore = new LanceDBStore(indexDir, modelCfg.dimensions);
  await vectorStore.init();

  const embedder = new TransformersEmbeddingProvider(config.model);
  console.log(chalk.dim('Loading embedding model...'));
  await embedder.load();

  const indexer = new Indexer({
    config,
    rootPath,
    indexDir,
    onIndex: async (result) => {
      for (const chunk of result.chunks) {
        metadataStore.upsertChunk({
          id: chunk.id, file: chunk.file, language: chunk.language,
          symbol: chunk.symbol, kind: chunk.kind, parent: chunk.parent,
          hash: chunk.hash, git_commit: null,
          start_line: chunk.startLine, end_line: chunk.endLine,
          imports: chunk.imports.join('\n'), exports: chunk.exports.join('\n'),
          embedding_model: embedder.name(), last_indexed: new Date().toISOString(),
          checksum: chunk.hash,
        });
        ftsStore.insertChunk(chunk.id, chunk.content, chunk.file, chunk.symbol, chunk.language);
      }
      if (result.chunks.length > 0) {
        const texts = result.chunks.map(c => c.content);
        const embeddings = await embedder.embed(texts);
        await vectorStore.insert(result.chunks.map((c, i) => ({
          id: c.id, values: embeddings[i],
          metadata: { file: c.file, symbol: c.symbol, kind: c.kind, text: c.content, language: c.language },
        })));
      }
      metadataStore.upsertFileHash(result.relativePath, result.hash);
    },
    onDelete: async (chunkIds) => {
      for (const id of chunkIds) ftsStore.deleteChunk(id);
      await vectorStore.delete(chunkIds);
    },
  });

  await indexer.initialize();

  const progressBar = new cliProgress.SingleBar({
    format: '{phase} | {bar} | {percentage}% | {value}/{total}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
  });
  progressBar.start(100, 0, { phase: 'Scanning' });
  const unsub = onProgress((e) => {
    if (e.phase === 'scanning' && e.total) {
      progressBar.setTotal(e.total);
      progressBar.update(e.current || 0);
    } else if (e.phase === 'embedding' && e.percent !== undefined) {
      progressBar.setTotal(100);
      progressBar.update(e.percent);
    }
  });

  const existingHashes = metadataStore.getAllFileHashes();
  const doFull = fullRebuild || existingHashes.size === 0;

  if (doFull) {
    await indexer.runFullIndex();
    const newVersion = getExpectedVersion(config.model);
    saveVersion(indexDir, newVersion);
  } else {
    const existingChunkHashes = metadataStore.getAllChunkHashes();
    await indexer.runIncremental(existingHashes, existingChunkHashes);
    const ver = version!;
    ver.lastIndexed = new Date().toISOString();
    saveVersion(indexDir, ver);
  }

  progressBar.stop();
  unsub();

  const finalChunkCount = metadataStore.getChunkCount();
  const finalFileCount = metadataStore.getFileCount();
  console.log(chalk.green(`Index complete. ${finalChunkCount} chunks across ${finalFileCount} files.`));
  console.log(chalk.dim(`Run "edhindex start" to serve the MCP server.`));

  metadataStore.close();
  ftsStore.close();
  await vectorStore.close();
}
