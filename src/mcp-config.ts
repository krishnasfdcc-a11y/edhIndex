import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline';
import chalk from 'chalk';

export type MCPClient =
  | 'opencode'
  | 'cline'
  | 'roo-code'
  | 'claude-code'
  | 'cursor'
  | 'windsurf'
  | 'github-copilot'
  | 'continue'
  | 'none';

interface ClientConfig {
  key: MCPClient;
  label: string;
  description: string;
}

const CLIENT_OPTIONS: ClientConfig[] = [
  { key: 'opencode', label: 'OpenCode', description: 'opencode.json at project root' },
  { key: 'cline', label: 'Cline', description: '.cline/mcp.json at project root' },
  { key: 'roo-code', label: 'Roo Code', description: '.roo/mcp.json at project root' },
  { key: 'claude-code', label: 'Claude Code', description: 'claude.jsonc at project root' },
  { key: 'cursor', label: 'Cursor', description: '.cursor/mcp.json at project root' },
  { key: 'windsurf', label: 'Windsurf', description: '.windsurf/mcp_config.json at project root' },
  { key: 'github-copilot', label: 'GitHub Copilot', description: '.vscode/settings.json (VS Code workspace)' },
  { key: 'continue', label: 'Continue', description: '.continue/config.json at project root' },
];

function isInteractive(): boolean {
  return process.stdin.isTTY && process.stdout.isTTY;
}

function askClients(): Promise<MCPClient[]> {
  return new Promise((resolve) => {
    if (!isInteractive()) {
      resolve([]);
      return;
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const lines = CLIENT_OPTIONS.map((opt, i) => `  ${i + 1}. ${opt.label} — ${opt.description}`);
    const prompt = [
      `\n${chalk.bold('MCP Client Configuration')}`,
      'Which MCP clients do you want to configure?',
      'Enter numbers separated by commas (e.g. 1,3,5) or press Enter to skip:',
      '',
      ...lines,
      '',
    ].join('\n');
    rl.question(prompt, (answer) => {
      rl.close();
      const trimmed = answer.trim();
      if (!trimmed) {
        resolve([]);
        return;
      }
      const indices = trimmed
        .split(/[, ]+/)
        .map((s) => parseInt(s, 10))
        .filter((n) => !isNaN(n) && n >= 1 && n <= CLIENT_OPTIONS.length);
      const selected = [...new Set(indices.map((i) => CLIENT_OPTIONS[i - 1].key))];
      resolve(selected);
    });
  });
}

function writeSingleConfig(rootPath: string, client: MCPClient): string {
  const mcpServer = {
    mcpServers: {
      edhindex: {
        command: 'edhindex',
        args: ['start'],
      },
    },
  };
  const mcpServerCopilot = {
    edhindex: {
      command: 'edhindex',
      args: ['start'],
    },
  };

  switch (client) {
    case 'opencode': {
      const fp = join(rootPath, 'opencode.json');
      const cfg: Record<string, unknown> = { $schema: 'https://opencode.ai/config.json' };
      if (existsSync(fp)) {
        try { Object.assign(cfg, JSON.parse(readFileSync(fp, 'utf-8'))); } catch { /* merge */ }
      }
      cfg.mcp = {
        edhindex: { type: 'local', command: ['edhindex', 'start'], enabled: true, timeout: 120000 },
      };
      writeFileSync(fp, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
      return fp;
    }
    case 'cline': {
      const dir = join(rootPath, '.cline');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const fp = join(dir, 'mcp.json');
      writeFileSync(fp, JSON.stringify(mcpServer, null, 2) + '\n', 'utf-8');
      return fp;
    }
    case 'roo-code': {
      const dir = join(rootPath, '.roo');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const fp = join(dir, 'mcp.json');
      writeFileSync(fp, JSON.stringify(mcpServer, null, 2) + '\n', 'utf-8');
      return fp;
    }
    case 'claude-code': {
      const fp = join(rootPath, 'claude.jsonc');
      writeFileSync(fp, JSON.stringify(mcpServer, null, 2) + '\n', 'utf-8');
      return fp;
    }
    case 'cursor': {
      const dir = join(rootPath, '.cursor');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const fp = join(dir, 'mcp.json');
      writeFileSync(fp, JSON.stringify(mcpServer, null, 2) + '\n', 'utf-8');
      return fp;
    }
    case 'windsurf': {
      const dir = join(rootPath, '.windsurf');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const fp = join(dir, 'mcp_config.json');
      writeFileSync(fp, JSON.stringify(mcpServer, null, 2) + '\n', 'utf-8');
      return fp;
    }
    case 'github-copilot': {
      const dir = join(rootPath, '.vscode');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const fp = join(dir, 'settings.json');
      const settings: Record<string, unknown> = {};
      if (existsSync(fp)) {
        try {
          Object.assign(settings, JSON.parse(readFileSync(fp, 'utf-8')));
        } catch { /* start fresh if corrupt */ }
      }
      settings['github.copilot.chat.mcpServers'] = mcpServerCopilot;
      writeFileSync(fp, JSON.stringify(settings, null, 2) + '\n', 'utf-8');
      return fp;
    }
    case 'continue': {
      const dir = join(rootPath, '.continue');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const fp = join(dir, 'config.json');
      const cfg: Record<string, unknown> = {};
      if (existsSync(fp)) {
        try {
          Object.assign(cfg, JSON.parse(readFileSync(fp, 'utf-8')));
        } catch { /* start fresh if corrupt */ }
      }
      const existing = (cfg.mcpServers as Record<string, unknown>[]) || [];
      if (!existing.find((s: Record<string, unknown>) => s.name === 'edhindex')) {
        cfg.mcpServers = [...existing, { name: 'edhindex', command: 'edhindex', args: ['start'] }];
      }
      writeFileSync(fp, JSON.stringify(cfg, null, 2) + '\n', 'utf-8');
      return fp;
    }
    default:
      throw new Error(`Unknown MCP client: ${client}`);
  }
}

export function writeMCPConfigs(rootPath: string, clients: MCPClient[]): string[] {
  const paths: string[] = [];
  for (const client of clients) {
    if (client === 'none') continue;
    paths.push(writeSingleConfig(rootPath, client));
  }
  return paths;
}

export async function promptAndWriteMCPConfigs(rootPath: string) {
  const clients = await askClients();
  if (clients.length === 0) return;
  const paths = writeMCPConfigs(rootPath, clients);
  for (const fp of paths) {
    console.log(chalk.green(`MCP config written: ${fp}`));
  }
}
