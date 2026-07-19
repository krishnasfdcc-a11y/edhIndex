import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { loadConfig, saveConfig, defaultConfig } from '../../config/index.js';
import { logger } from '../../logging.js';
import chalk from 'chalk';

export async function initCommand(rootPath: string) {
  const indexDir = join(rootPath, '.edhindex');

  if (existsSync(indexDir)) {
    console.log(chalk.yellow('EDHIndex is already initialized in this directory.'));
    const config = loadConfig(indexDir);
    console.log(`Current config: model=${config.model}, languages=[${config.languages.join(', ')}]`);
    return;
  }

  mkdirSync(indexDir, { recursive: true });
  const config = defaultConfig();
  saveConfig(indexDir, config);

  console.log(chalk.green('EDHIndex initialized.'));
  console.log(`Index directory: ${indexDir}`);
  console.log(`Configuration: model=${config.model}, languages=[${config.languages.join(', ')}]`);
  console.log(chalk.dim('Run "edhindex start" to build the index and start the MCP server.'));
}
