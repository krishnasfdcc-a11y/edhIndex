import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import { loadConfig, saveConfig, defaultConfig, MODEL_CONFIGS, type ModelTier } from '../../config/index.js';
import { promptAndWriteMCPConfigs } from '../../mcp-config.js';
import { createInterface } from 'node:readline';
import { logger } from '../../logging.js';
import chalk from 'chalk';

function isInteractive(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

function askModel(): Promise<ModelTier> {
  return new Promise((resolve) => {
    if (!isInteractive()) {
      resolve('balanced');
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const tiers: ModelTier[] = ['light', 'balanced', 'max'];
    const lines = tiers.map((t, i) => {
      const c = MODEL_CONFIGS[t];
      return `  ${i + 1}. ${c.displayName} (${c.dimensions}d, ${c.size})`;
    });
    rl.question(
      `\n${chalk.bold('Embedding Model')}\nWhich embedding model do you want to use?\n${lines.join('\n')}\n\nChoose (1-3) [2]: `,
      (answer) => {
        rl.close();
        const idx = parseInt(answer.trim(), 10);
        if (idx >= 1 && idx <= 3) {
          resolve(tiers[idx - 1]);
        } else {
          resolve('balanced');
        }
      }
    );
  });
}

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
  config.model = await askModel();
  saveConfig(indexDir, config);

  console.log(chalk.green('EDHIndex initialized.'));
  const mc = MODEL_CONFIGS[config.model];
  console.log(`Model: ${mc.displayName} (${mc.dimensions}d, ${mc.size})`);
  console.log(`Languages: ${config.languages.join(', ')}`);

  await promptAndWriteMCPConfigs(rootPath);

  console.log(chalk.dim('Run "edhindex start" to build the index and start the MCP server.'));
}
