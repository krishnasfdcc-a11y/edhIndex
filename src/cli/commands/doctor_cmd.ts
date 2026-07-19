import { runDoctor, DoctorResult } from '../../doctor/index.js';
import chalk from 'chalk';

export async function doctorCommand(rootPath: string, indexDir: string) {
  console.log(chalk.bold('EDHIndex Diagnostics\n'));

  const results = await runDoctor(rootPath, indexDir);

  let okCount = 0;
  let warnCount = 0;
  let errorCount = 0;

  for (const r of results) {
    const icon = r.status === 'ok' ? chalk.green('✓') : r.status === 'warn' ? chalk.yellow('⚠') : chalk.red('✗');
    console.log(`  ${icon} ${chalk.bold(r.category)}: ${r.message}`);
    if (r.detail) console.log(`       ${chalk.dim(r.detail)}`);

    if (r.status === 'ok') okCount++;
    else if (r.status === 'warn') warnCount++;
    else errorCount++;
  }

  console.log('');
  if (errorCount > 0) {
    console.log(chalk.red(`  ${errorCount} error(s), ${warnCount} warning(s), ${okCount} ok`));
  } else if (warnCount > 0) {
    console.log(chalk.yellow(`  ${warnCount} warning(s), ${okCount} ok`));
  } else {
    console.log(chalk.green(`  All ${okCount} checks passed.`));
  }
}
