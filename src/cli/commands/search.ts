import { join } from 'node:path';
import { loadConfig, MODEL_CONFIGS } from '../../config/index.js';
import { setLogLevel, LogLevel } from '../../logging.js';
import { MetadataStore } from '../../storage/metadata.js';
import { FTSStore } from '../../storage/fts.js';
import { TransformersEmbeddingProvider } from '../../embeddings/transformers.js';
import { LanceDBStore } from '../../vector/lancedb.js';
import { SearchEngine } from '../../retrieval/search.js';
import chalk from 'chalk';

export async function searchCommand(rootPath: string, query: string, maxResults: number) {
  const indexDir = join(rootPath, '.edhindex');
  setLogLevel(LogLevel.Silent);

  const config = loadConfig(indexDir);
  const modelCfg = MODEL_CONFIGS[config.model];

  const metadataStore = new MetadataStore(indexDir);
  const ftsStore = new FTSStore(indexDir);
  const vectorStore = new LanceDBStore(indexDir, modelCfg.dimensions);
  await vectorStore.init();

  const embedder = new TransformersEmbeddingProvider(config.model);
  await embedder.load();

  const engine = new SearchEngine(ftsStore, metadataStore, vectorStore, embedder, null, false);
  const results = await engine.search({ query, maxResults });

  if (results.length === 0) {
    console.log(chalk.yellow('No results found.'));
  } else {
    for (const r of results) {
      const tag = r.matchType === 'keyword' ? chalk.blue('KW') : r.matchType === 'vector' ? chalk.magenta('VEC') : chalk.green('HYB');
      console.log(`${tag} ${chalk.cyan(`${r.file}:${r.startLine}-${r.endLine}`)} (${r.language})`);
      if (r.symbol) console.log(`    ${chalk.dim('Symbol:')} ${r.symbol}${r.kind ? ` (${r.kind})` : ''}`);
      console.log(`    ${chalk.dim('Score:')} ${r.score.toFixed(4)}`);
      console.log('');
    }
  }

  metadataStore.close();
  ftsStore.close();
  await vectorStore.close();
}
