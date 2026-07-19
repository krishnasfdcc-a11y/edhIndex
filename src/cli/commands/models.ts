import { MODEL_CONFIGS } from '../../config/index.js';
import chalk from 'chalk';

export function modelsCommand() {
  console.log(chalk.bold('Available embedding models:\n'));

  for (const [tier, cfg] of Object.entries(MODEL_CONFIGS)) {
    const tag = tier === 'balanced' ? ' (default)' : '';
    console.log(`  ${chalk.cyan(tier)}${chalk.dim(tag)}`);
    console.log(`    Model:    ${cfg.displayName}`);
    console.log(`    Size:     ${cfg.size}`);
    console.log(`    Dims:     ${cfg.dimensions}`);
    console.log(`    HF ID:    ${cfg.modelId}`);
    console.log('');
  }

  console.log(chalk.dim('Switch models with: edhindex config model <tier>'));
  console.log(chalk.dim('Note: Changing models requires a full re-index.'));
}
