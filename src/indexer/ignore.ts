import { readFileSync, existsSync } from 'node:fs';
import { join, relative, isAbsolute, sep } from 'node:path';

const IGNORE_FILE = '.edhindexignore';

const DEFAULT_IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  'coverage',
  '.next',
  'out',
  'vendor',
  'bin',
  'obj',
  'target',
  'tmp',
  '.cache',
  '.turbo',
  '.edhindex',
  '*.exe', '*.dll', '*.so', '*.dylib', '*.bin', '*.wasm',
  '*.o', '*.a', '*.lib',
  '*.pyc', '*.class', '*.jar', '*.war',
  '*.png', '*.jpg', '*.jpeg', '*.gif', '*.svg', '*.ico', '*.webp', '*.bmp', '*.tiff',
  '*.pdf', '*.doc', '*.docx', '*.xls', '*.xlsx', '*.ppt', '*.pptx',
  '*.zip', '*.tar', '*.gz', '*.bz2', '*.7z', '*.rar',
  '*.mp4', '*.avi', '*.mov', '*.wmv', '*.flv', '*.mkv',
  '*.mp3', '*.wav', '*.flac', '*.ogg',
  '*.min.js', '*.min.css',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
];

export interface IgnoreRules {
  isIgnored(relativePath: string): boolean;
}

function globToRegex(pattern: string): RegExp {
  const isNegated = pattern.startsWith('!');
  const p = isNegated ? pattern.slice(1) : pattern;

  let regexStr = '^';
  for (let i = 0; i < p.length; i++) {
    const ch = p[i];
    if (ch === '*') {
      if (i + 1 < p.length && p[i + 1] === '*') {
        regexStr += '.*';
        i++;
        if (i + 1 < p.length && (p[i + 1] === '/' || p[i + 1] === '\\\\')) i++;
      } else {
        regexStr += '[^/]*';
      }
    } else if (ch === '?') {
      regexStr += '[^/]';
    } else if (ch === '.') {
      regexStr += '\\.';
    } else if (ch === '/') {
      regexStr += '[/\\\\]';
    } else if (ch === '\\') {
      regexStr += '\\\\';
    } else {
      regexStr += ch;
    }
  }
  regexStr += '$';

  return new RegExp(regexStr, 'i');
}

export function createIgnoreRules(rootPath: string): IgnoreRules {
  const patterns: { regex: RegExp; negated: boolean }[] = [];

  for (const p of DEFAULT_IGNORE_PATTERNS) {
    patterns.push({ regex: globToRegex(p), negated: false });
  }

  const ignoreFilePath = join(rootPath, IGNORE_FILE);
  if (existsSync(ignoreFilePath)) {
    const content = readFileSync(ignoreFilePath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const isNegated = trimmed.startsWith('!');
      patterns.push({ regex: globToRegex(trimmed), negated: isNegated });
    }
  }

  return {
    isIgnored(relativePath: string): boolean {
      const normalized = relativePath.replace(/\\/g, '/');
      let ignored = false;
      for (const p of patterns) {
        if (p.regex.test(normalized) || p.regex.test(normalized.split('/').pop() || '')) {
          ignored = !p.negated;
        }
      }
      return ignored;
    },
  };
}
