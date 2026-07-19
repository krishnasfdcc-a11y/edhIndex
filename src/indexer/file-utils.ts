import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { checkSymlinkSafety } from '../security.js';
import { createIgnoreRules, IgnoreRules } from './ignore.js';
import { logger } from '../logging.js';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.o', '.a', '.lib',
  '.pyc', '.class', '.jar', '.war',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv',
  '.mp3', '.wav', '.flac', '.ogg',
]);

const LANGUAGE_EXTENSIONS: Record<string, string[]> = {
  ts: ['.ts', '.tsx', '.mts', '.cts'],
  js: ['.js', '.jsx', '.mjs', '.cjs'],
  py: ['.py', '.pyw'],
  go: ['.go'],
  rs: ['.rs'],
  java: ['.java'],
  rb: ['.rb'],
  c: ['.c', '.h'],
  cpp: ['.cpp', '.cxx', '.cc', '.c++', '.hpp', '.hxx', '.hh'],
  csharp: ['.cs'],
  php: ['.php'],
  scala: ['.scala'],
  hs: ['.hs'],
  dart: ['.dart'],
  solidity: ['.sol'],
  css: ['.css', '.scss', '.less'],
  json: ['.json'],
  html: ['.html', '.htm'],
};

const EXTENSION_TO_LANG: Record<string, string> = {};
for (const [lang, exts] of Object.entries(LANGUAGE_EXTENSIONS)) {
  for (const ext of exts) {
    EXTENSION_TO_LANG[ext] = lang;
  }
}

export function getLanguageForFile(filePath: string): string | null {
  const ext = filePath.toLowerCase().split('.').pop();
  return EXTENSION_TO_LANG[`.${ext}`] || null;
}

export function languageFromExtension(ext: string): string | null {
  return EXTENSION_TO_LANG[ext.toLowerCase()] || null;
}

export function isIndexableFile(filePath: string, stat: { size: number }): boolean {
  if (stat.size > MAX_FILE_SIZE) return false;
  if (stat.size === 0) return false;
  const ext = filePath.toLowerCase().split('.').pop();
  if (BINARY_EXTENSIONS.has(`.${ext}`)) return false;
  return true;
}

export function isGeneratedFile(filePath: string): boolean {
  const name = filePath.split('/').pop() || filePath;
  return name.endsWith('.generated.ts') || name.endsWith('.g.ts') ||
         name === 'tsconfig.json' || name === 'package.json' ||
         name.endsWith('.min.js') || name.endsWith('.min.css');
}

export function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return computeHash(content);
}

export interface ScannedFile {
  path: string;
  relativePath: string;
  language: string;
  hash: string;
  size: number;
}

export function scanFiles(rootPath: string, languages: string[]): ScannedFile[] {
  const ignore = createIgnoreRules(rootPath);
  const results: ScannedFile[] = [];

  const allowedExts = new Set<string>();
  for (const lang of languages) {
    const exts = LANGUAGE_EXTENSIONS[lang];
    if (exts) for (const ext of exts) allowedExts.add(ext);
  }

  function walk(dir: string) {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const relPath = relative(rootPath, fullPath).replace(/\\/g, '/');

      if (ignore.isIgnored(relPath)) continue;

      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          walk(fullPath);
        } else if (stat.isFile() || stat.isSymbolicLink()) {
          if (stat.isSymbolicLink()) {
            if (!checkSymlinkSafety(rootPath, fullPath)) continue;
          }

          const ext = '.' + (entry.split('.').pop() || '').toLowerCase();
          if (!allowedExts.has(ext)) continue;
          if (!isIndexableFile(fullPath, stat)) continue;

          const lang = EXTENSION_TO_LANG[ext];
          if (!lang) continue;

          try {
            const hash = computeFileHash(fullPath);
            results.push({
              path: fullPath,
              relativePath: relPath,
              language: lang,
              hash,
              size: stat.size,
            });
          } catch {
            // skip unreadable files
          }
        }
      } catch {
        // skip inaccessible entries
      }
    }
  }

  walk(rootPath);
  return results;
}


