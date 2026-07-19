import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { loadConfig, saveConfig, ModelTier, LogLevelConfig } from '../../config/index.js';
import chalk from 'chalk';

export function configCommand(rootPath: string, changes: Record<string, string>) {
  const indexDir = join(rootPath, '.edhindex');

  if (!existsSync(indexDir)) {
    console.log(chalk.yellow('No .edhindex directory found. Run "edhindex init" first.'));
    return;
  }

  const config = loadConfig(indexDir);

  if (Object.keys(changes).length === 0) {
    console.log(chalk.bold('Current configuration:'));
    console.log(JSON.stringify(config, null, 2));
    return;
  }

  for (const [key, value] of Object.entries(changes)) {
    switch (key) {
      case 'model':
        if (!['light', 'balanced', 'max'].includes(value)) {
          console.log(chalk.red(`Invalid model: ${value}. Must be light, balanced, or max.`));
          return;
        }
        (config as any).model = value as ModelTier;
        break;
      case 'languages':
        config.languages = value.split(',').map(s => s.trim());
        break;
      case 'watch':
        config.watch = value === 'true';
        break;
      case 'rerank':
        config.rerank = value === 'true';
        break;
      case 'maxResults':
        config.maxResults = parseInt(value, 10) || 10;
        break;
      case 'logLevel':
        if (!['silent', 'info', 'verbose', 'debug'].includes(value)) {
          console.log(chalk.red(`Invalid logLevel: ${value}`));
          return;
        }
        config.logLevel = value as LogLevelConfig;
        break;
      default:
        console.log(chalk.yellow(`Unknown config key: ${key}`));
    }
  }

  saveConfig(indexDir, config);
  console.log(chalk.green('Configuration updated.'));
  console.log(JSON.stringify(config, null, 2));
}
