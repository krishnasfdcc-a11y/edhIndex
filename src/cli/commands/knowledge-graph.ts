import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { GraphService } from '../../graph/service.js';
import { startGraphServer, writeViewerFile } from '../../graph/serve.js';
import chalk from 'chalk';
import { spawn } from 'node:child_process';

export async function kgCommand(rootPath: string, flags: { rebuild?: boolean; stats?: boolean; serve?: boolean; write?: boolean; port?: string }) {
  const indexDir = join(rootPath, '.edhindex');
  if (!existsSync(indexDir)) {
    console.log(chalk.yellow('No index found. Run "edhindex start" first.'));
    return;
  }

  if (flags.write) {
    console.log(chalk.dim('Writing graph viewer...'));
    const outFile = join(rootPath, '.edhindex', 'knowledge-graph.html');
    writeViewerFile(rootPath, outFile);
    console.log(chalk.green(`\n  Viewer written: ${outFile}`));
    console.log(chalk.dim('\n  Open in VS Code:'));
    console.log(chalk.dim('    1. File > Open File... > select the file'));
    console.log(chalk.dim('    2. Or drag into VS Code and click "Preview"'));
    console.log(chalk.dim('    3. Or right-click → "Open with Live Server"'));
    console.log(chalk.dim('\n  Or open in browser:'));
    console.log(chalk.dim(`    file://${outFile}`));
    return;
  }

  if (flags.serve) {
    const port = flags.port ? parseInt(flags.port, 10) : 0;
    console.log(chalk.dim('Starting graph server...'));
    const { port: actualPort, close } = await startGraphServer(rootPath, port);
    const url = `http://127.0.0.1:${actualPort}`;
    console.log(chalk.green(`\n  Knowledge Graph: ${url}`));
    console.log(chalk.dim('\n  Press Ctrl+C to stop.\n'));

    // Try to open browser
    const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
    try {
      const child = spawn(cmd, [url], { detached: true, stdio: 'ignore' });
      child.unref();
    } catch { /* browser open not critical */ }

    // Keep alive
    process.on('SIGINT', () => { close(); process.exit(0); });
    process.on('SIGTERM', () => { close(); process.exit(0); });
    await new Promise(() => {}); // hang
    return;
  }

  try {
    const svc = new GraphService(rootPath);

    if (flags.rebuild) {
      console.log(chalk.dim('Building knowledge graph...'));
      svc.build();
    }

    const stats = svc.getStats();
    svc.close();

    console.log(chalk.bold('\nKnowledge Graph'));
    console.log(chalk.dim('─'.repeat(40)));
    console.log(`  Nodes: ${chalk.cyan(stats.nodeCount)}`);
    console.log(`  Edges: ${chalk.cyan(stats.edgeCount)}`);

    if (Object.keys(stats.typeCounts).length > 0) {
      console.log(chalk.dim('\n  By type:'));
      for (const [type, count] of Object.entries(stats.typeCounts).sort((a, b) => b[1] - a[1])) {
        console.log(`    ${type.padEnd(14)} ${count}`);
      }
    }

    console.log(chalk.dim('\n  Commands:'));
    console.log(chalk.dim('    edhindex kg serve     — Interactive graph in browser'));
    console.log(chalk.dim('    edhindex graph        — Static SVG graph'));

    console.log(chalk.dim('\n  MCP tools:'));
    console.log(chalk.dim('    get_graph             — Full graph data'));
    console.log(chalk.dim('    get_node              — Node details + neighbors'));
    console.log(chalk.dim('    search_graph          — Search nodes by name'));
  } catch (e) {
    console.error(chalk.red('Failed:'), e instanceof Error ? e.message : e);
  }
}
