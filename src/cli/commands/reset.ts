import { join } from 'node:path';
import { existsSync, rmSync } from 'node:fs';
import { createInterface } from 'node:readline';
import chalk from 'chalk';

function isInteractive(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

function confirm(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!isInteractive()) {
      resolve(false);
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

export async function resetCommand(rootPath: string) {
  const indexDir = join(rootPath, '.edhindex');

  if (!existsSync(indexDir)) {
    console.log(chalk.yellow('No EDHIndex index found in this directory.'));
    return;
  }

  const ok = await confirm(chalk.red('Delete the entire EDHIndex index (config + vectors + metadata)?'));
  if (!ok) {
    console.log(chalk.dim('Cancelled.'));
    return;
  }

  rmSync(indexDir, { recursive: true, force: true });
  console.log(chalk.green(`Deleted: ${indexDir}`));
}
