import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { createHash } from 'node:crypto';
import { checkSymlinkSafety } from '../security.js';
import { createIgnoreRules } from './ignore.js';
import { LanguageRegistry } from '../language/registry.js';
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

export function scanFiles(rootPath: string, registry: LanguageRegistry): ScannedFile[] {
  const ignore = createIgnoreRules(rootPath);
  const results: ScannedFile[] = [];

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

          if (!isIndexableFile(fullPath, stat)) continue;

          const { adapter, key } = registry.getAdapter(relPath);
          if (!adapter.canParse(relPath)) continue;

          try {
            const hash = computeFileHash(fullPath);
            results.push({
              path: fullPath,
              relativePath: relPath,
              language: key,
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
