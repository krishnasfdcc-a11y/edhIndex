#!/usr/bin/env node
import { Command } from 'commander';
import { join } from 'node:path';
import { initCommand } from './commands/init.js';
import { startCommand } from './commands/start.js';
import { indexCommand } from './commands/index_cmd.js';
import { searchCommand } from './commands/search.js';
import { statusCommand } from './commands/status.js';
import { configCommand } from './commands/config_cmd.js';
import { modelsCommand } from './commands/models.js';
import { doctorCommand } from './commands/doctor_cmd.js';
import { resetCommand } from './commands/reset.js';
import { graphCommand } from './commands/graph.js';
import { kgCommand } from './commands/knowledge-graph.js';
import { setLogLevel, LogLevel } from '../logging.js';

const program = new Command();

program
  .name('edhindex')
  .description('Local-first hybrid code search engine with MCP')
  .version('2.0.0')
  .option('-v, --verbose', 'Enable verbose logging')
  .option('--debug', 'Enable debug logging')
  .hook('preAction', (thisCommand) => {
    if (thisCommand.opts().debug) setLogLevel(LogLevel.Debug);
    else if (thisCommand.opts().verbose) setLogLevel(LogLevel.Verbose);
  });

program
  .command('init')
  .description('Initialize EDHIndex in the current directory')
  .action(async () => {
    const rootPath = process.cwd();
    await initCommand(rootPath);
  });

program
  .command('start')
  .description('Build/update index and start the MCP server')
  .action(async () => {
    const rootPath = process.cwd();
    await startCommand(rootPath);
  });

program
  .command('index')
  .description('Build or update the search index')
  .action(async () => {
    const rootPath = process.cwd();
    await indexCommand(rootPath);
  });

program
  .command('search')
  .description('Search the indexed codebase from the CLI')
  .argument('<query>', 'Search query')
  .option('-n, --max-results <number>', 'Max results', '10')
  .action(async (query: string, opts: { maxResults: string }) => {
    const rootPath = process.cwd();
    await searchCommand(rootPath, query, parseInt(opts.maxResults, 10) || 10);
  });

program
  .command('status')
  .description('Show index status')
  .action(async () => {
    const rootPath = process.cwd();
    await statusCommand(rootPath);
  });

program
  .command('config')
  .description('View or update configuration')
  .argument('[key]', 'Config key')
  .argument('[value]', 'Config value')
  .action((key?: string, value?: string) => {
    const rootPath = process.cwd();
    const changes: Record<string, string> = {};
    if (key && value !== undefined) {
      changes[key] = value;
    }
    configCommand(rootPath, changes);
  });

program
  .command('models')
  .description('List available embedding models')
  .action(() => {
    modelsCommand();
  });

program
  .command('doctor')
  .description('Run diagnostics')
  .action(async () => {
    const rootPath = process.cwd();
    const indexDir = join(rootPath, '.edhindex');
    await doctorCommand(rootPath, indexDir);
  });

program
  .command('reset')
  .description('Delete the index and all stored data')
  .action(async () => {
    const rootPath = process.cwd();
    await resetCommand(rootPath);
  });

program
  .command('graph')
  .description('Generate a dependency graph (SVG)')
  .option('-o, --output <path>', 'Output file path')
  .action(async (opts: { output?: string }) => {
    const rootPath = process.cwd();
    await graphCommand(rootPath, opts.output);
  });

program
  .command('kg')
  .description('Knowledge graph — build, stats, serve, write, and query')
  .option('-r, --rebuild', 'Rebuild graph from index')
  .option('-s, --stats', 'Show graph statistics')
  .option('--serve', 'Start interactive graph viewer (opens browser)')
  .option('-w, --write', 'Write graph viewer to .edhindex/knowledge-graph.html')
  .option('-p, --port <number>', 'Port for graph viewer (default: random)')
  .action(async (opts: { rebuild?: boolean; stats?: boolean; serve?: boolean; write?: boolean; port?: string }) => {
    const rootPath = process.cwd();
    await kgCommand(rootPath, opts);
  });

program.parse(process.argv);
