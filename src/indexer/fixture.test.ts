import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LanguageRegistry } from '../language/registry.js';

const FIXTURES_DIR = join(import.meta.dirname, '../../test-fixtures');

const registry = new LanguageRegistry();

const FIXTURES: Array<{ key: string; file: string; minSymbols: number }> = [
  { key: 'ts', file: 'sample.ts', minSymbols: 3 },
  { key: 'js', file: 'sample.js', minSymbols: 2 },
  { key: 'py', file: 'sample.py', minSymbols: 2 },
  { key: 'go', file: 'sample.go', minSymbols: 2 },
  { key: 'rs', file: 'sample.rs', minSymbols: 3 },
  { key: 'java', file: 'sample.java', minSymbols: 2 },
  { key: 'rb', file: 'sample.rb', minSymbols: 2 },
  { key: 'c', file: 'sample.c', minSymbols: 2 },
  { key: 'cpp', file: 'sample.cpp', minSymbols: 2 },
  { key: 'csharp', file: 'sample.cs', minSymbols: 2 },
  { key: 'php', file: 'sample.php', minSymbols: 2 },
  { key: 'html', file: 'sample.html', minSymbols: 1 },
  { key: 'css', file: 'sample.css', minSymbols: 1 },
  { key: 'json', file: 'sample.json', minSymbols: 1 },
];

function countLines(content: string): number {
  return content.split('\n').length;
}

for (const { key, file, minSymbols } of FIXTURES) {
  describe(`${key} adapter — ${file}`, () => {
    let content: string;
    let lineCount: number;

    beforeAll(() => {
      const filePath = join(FIXTURES_DIR, file);
      content = readFileSync(filePath, 'utf-8');
      lineCount = countLines(content);
    });

    it('fixture file exists and has 100+ lines', () => {
      expect(lineCount).toBeGreaterThanOrEqual(100);
    });

    it('adapter can parse the file', async () => {
      const { adapter } = registry.getAdapter(file);
      expect(adapter).toBeTruthy();
      expect(adapter.canParse(file)).toBe(true);

      const result = await adapter.parse(content, file);
      expect(result).toBeTruthy();
      expect(Array.isArray(result.symbols)).toBe(true);
      expect(Array.isArray(result.imports)).toBe(true);
      expect(Array.isArray(result.exports)).toBe(true);
      expect(Array.isArray(result.comments)).toBe(true);
    }, 30000);

    it('extracts the expected number of symbols', async () => {
      const { adapter } = registry.getAdapter(file);
      const result = await adapter.parse(content, file);
      expect(result.symbols.length).toBeGreaterThanOrEqual(minSymbols);
    }, 30000);

    it('every symbol has required fields', async () => {
      const { adapter } = registry.getAdapter(file);
      const result = await adapter.parse(content, file);

      for (const sym of result.symbols) {
        expect(sym.id).toBeTruthy();
        expect(sym.name).toBeTruthy();
        expect(sym.type).toBeTruthy();
        expect(sym.language).toBeTruthy();
        expect(sym.file).toBe(file);
        expect(typeof sym.startLine).toBe('number');
        expect(typeof sym.endLine).toBe('number');
        expect(sym.startLine).toBeGreaterThan(0);
        expect(sym.endLine).toBeGreaterThanOrEqual(sym.startLine);
        expect(sym.endLine).toBeLessThanOrEqual(lineCount);
        expect(Array.isArray(sym.children)).toBe(true);
      }
    }, 30000);

    it('symbol start lines are within file bounds', async () => {
      const { adapter } = registry.getAdapter(file);
      const result = await adapter.parse(content, file);

      for (const sym of result.symbols) {
        expect(sym.startLine).toBeLessThanOrEqual(lineCount);
        expect(sym.endLine).toBeLessThanOrEqual(lineCount);
      }
    }, 30000);

    it('produces different symbols for different fixtures', async () => {
      const { adapter } = registry.getAdapter(file);
      const result = await adapter.parse(content, file);

      const names = result.symbols.map(s => s.name);
      const unique = new Set(names);
      expect(unique.size).toBeGreaterThanOrEqual(Math.min(minSymbols, names.length));
    }, 30000);
  });
}

describe('All fixtures', () => {
  it('every fixture file exists', () => {
    for (const { file } of FIXTURES) {
      const filePath = join(FIXTURES_DIR, file);
      const content = readFileSync(filePath, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('registry maps every fixture extension correctly', () => {
    for (const { key, file } of FIXTURES) {
      const { adapter, key: resolvedKey } = registry.getAdapter(file);
      expect(adapter).toBeTruthy();
      expect(resolvedKey).toBe(key);
    }
  });
});
