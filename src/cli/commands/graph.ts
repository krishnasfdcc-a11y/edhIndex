import { join } from 'node:path';
import { existsSync, writeFileSync } from 'node:fs';
import { MetadataStore } from '../../storage/metadata.js';
import { buildGraphData } from '../../graph/build.js';
import { generateSVG } from '../../graph/svg.js';
import chalk from 'chalk';

export async function graphCommand(rootPath: string, outputPath?: string) {
  const indexDir = join(rootPath, '.edhindex');
  if (!existsSync(indexDir)) {
    console.log(chalk.yellow('No EDHIndex index found. Run "edhindex start" first.'));
    return;
  }

  const store = new MetadataStore(indexDir);
  const { nodes, edges, fileCount, edgeCount } = buildGraphData(store);
  store.close();

  if (fileCount === 0) {
    console.log(chalk.yellow('No indexed files found.'));
    return;
  }

  const svg = generateSVG(rootPath, nodes, edges);
  const outFile = outputPath || join(rootPath, 'edhindex-graph.svg');
  writeFileSync(outFile, svg, 'utf-8');

  console.log(chalk.green(`Graph generated: ${outFile}`));
  console.log(chalk.dim(`${fileCount} files, ${edgeCount} dependencies`));
}
