import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig, MODEL_CONFIGS } from '../../config/index.js';
import { loadVersion } from '../../version.js';
import { MetadataStore } from '../../storage/metadata.js';
import { FTSStore } from '../../storage/fts.js';
import { LanceDBStore } from '../../vector/lancedb.js';
import chalk from 'chalk';

export async function statusCommand(rootPath: string) {
  const indexDir = join(rootPath, '.edhindex');

  if (!existsSync(indexDir)) {
    console.log(chalk.yellow('No .edhindex directory found. Run "edhindex init" first.'));
    return;
  }

  const config = loadConfig(indexDir);
  const version = loadVersion(indexDir);

  console.log(chalk.bold('EDHIndex Status'));
  console.log('');

  if (version) {
    console.log(`  Index:        ${chalk.green('Present')}`);
    console.log(`  Schema:       v${version.schema}`);
    console.log(`  Model tier:   ${version.embeddingModel}`);
    console.log(`  Created:      ${version.createdAt}`);
    console.log(`  Last indexed: ${version.lastIndexed}`);
  } else {
    console.log(`  Index:        ${chalk.yellow('No version file')}`);
  }

  console.log(`  Config:       ${chalk.cyan(JSON.stringify(config))}`);

  const metadataStore = new MetadataStore(indexDir);
  const chunkCount = metadataStore.getChunkCount();
  const fileCount = metadataStore.getFileCount();
  metadataStore.close();

  console.log(`  Chunks:       ${chunkCount}`);
  console.log(`  Files:        ${fileCount}`);
  console.log(`  Languages:    ${config.languages.join(', ')}`);

  try {
    const vectorStore = new LanceDBStore(indexDir, MODEL_CONFIGS[config.model].dimensions);
    await vectorStore.init();
    const vecCount = await vectorStore.count();
    console.log(`  Vectors:      ${vecCount}`);
    await vectorStore.close();
  } catch {
    console.log(`  Vectors:      ${chalk.yellow('unavailable')}`);
  }
}
