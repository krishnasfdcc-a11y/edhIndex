import { createHash } from 'node:crypto';
import { SymbolInfo } from './parser.js';
import { logger } from '../logging.js';

export interface Chunk {
  id: string;
  file: string;
  language: string;
  symbol: string;
  kind: string | null;
  parent: string | null;
  hash: string;
  startLine: number;
  endLine: number;
  content: string;
  imports: string[];
  exports: string[];
}

const MAX_TOKENS_PER_CHUNK = 512;

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function computeHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}

export async function chunkFile(
  filePath: string,
  relativePath: string,
  language: string,
  symbols: SymbolInfo[],
  content: string,
  lines: string[],
  imports: string[],
  exports: string[],
): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  const priorityOrder: Record<string, number> = {
    function: 0,
    method: 1,
    class: 2,
    interface: 3,
    enum: 4,
    module: 5,
  };

  const sorted = [...symbols].sort((a, b) => {
    const aP = priorityOrder[a.kind] ?? 99;
    const bP = priorityOrder[b.kind] ?? 99;
    if (aP !== bP) return aP - bP;
    return a.startLine - b.startLine;
  });

  const covered = new Set<number>();

  for (const sym of sorted) {
    if (isCovered(covered, sym.startLine, sym.endLine)) continue;
    markCovered(covered, sym.startLine, sym.endLine);

    const chunkContent = sym.text || content.slice(
      content.split('\n').slice(0, sym.startLine - 1).join('\n').length + (sym.startLine > 1 ? 1 : 0),
      content.split('\n').slice(0, sym.endLine).join('\n').length
    );

    if (estimateTokens(chunkContent) <= MAX_TOKENS_PER_CHUNK) {
      const hash = computeHash(chunkContent);
      chunks.push({
        id: `${relativePath}:${sym.startLine}-${sym.endLine}`,
        file: relativePath,
        language,
        symbol: sym.name,
        kind: sym.kind,
        parent: null,
        hash,
        startLine: sym.startLine,
        endLine: sym.endLine,
        content: chunkContent,
        imports,
        exports,
      });
    } else {
      const childChunks = splitRecursive(
        chunkContent, lines, sym.startLine, sym.name, sym.kind,
        relativePath, language, imports, exports
      );
      chunks.push(...childChunks);
    }
  }

  const fileContent = content;
  if (estimateTokens(fileContent) <= MAX_TOKENS_PER_CHUNK * 2 && covered.size < lines.length) {
    const uncoveredLines = getUncoveredLines(lines, covered);
    if (uncoveredLines.length > 0 && estimateTokens(uncoveredLines.join('\n')) <= MAX_TOKENS_PER_CHUNK) {
      const startLine = uncoveredLines[0].line;
      const endLine = uncoveredLines[uncoveredLines.length - 1].line;
      const hash = computeHash(uncoveredLines.map(l => l.text).join('\n'));
      chunks.push({
        id: `${relativePath}:${startLine}-${endLine}`,
        file: relativePath,
        language,
        symbol: `file_${relativePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
        kind: 'module',
        parent: null,
        hash,
        startLine,
        endLine,
        content: uncoveredLines.map(l => l.text).join('\n'),
        imports,
        exports,
      });
    }
  }

  return chunks;
}

function splitRecursive(
  text: string,
  allLines: string[],
  baseLine: number,
  symbolName: string,
  kind: string | null,
  relativePath: string,
  language: string,
  imports: string[],
  exports: string[],
): Chunk[] {
  const chunks: Chunk[] = [];
  const textLines = text.split('\n');
  const lineCount = textLines.length;

  let currentStart = 0;
  while (currentStart < lineCount) {
    const remaining = lineCount - currentStart;
    let end = currentStart + Math.min(remaining, Math.floor(MAX_TOKENS_PER_CHUNK * 2));

    let chunkText = textLines.slice(currentStart, end).join('\n');
    while (estimateTokens(chunkText) > MAX_TOKENS_PER_CHUNK && end > currentStart + 1) {
      end--;
      chunkText = textLines.slice(currentStart, end).join('\n');
    }

    if (end <= currentStart) {
      chunkText = textLines[currentStart];
      end = currentStart + 1;
    }

    const hash = computeHash(chunkText);
    chunks.push({
      id: `${relativePath}:${baseLine + currentStart}-${baseLine + end - 1}`,
      file: relativePath,
      language,
      symbol: symbolName,
      kind,
      parent: `${relativePath}:${baseLine}-${baseLine + lineCount - 1}`,
      hash,
      startLine: baseLine + currentStart,
      endLine: baseLine + end - 1,
      content: chunkText,
      imports,
      exports,
    });

    currentStart = end;
  }

  return chunks;
}

function isCovered(covered: Set<number>, start: number, end: number): boolean {
  for (let i = start; i <= end; i++) {
    if (covered.has(i)) return true;
  }
  return false;
}

function markCovered(covered: Set<number>, start: number, end: number) {
  for (let i = start; i <= end; i++) {
    covered.add(i);
  }
}

function getUncoveredLines(lines: string[], covered: Set<number>): { line: number; text: string }[] {
  const result: { line: number; text: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (!covered.has(i + 1)) {
      result.push({ line: i + 1, text: lines[i] });
    }
  }
  return result;
}

export function chunkHash(content: string): string {
  return createHash('sha256').update(content, 'utf-8').digest('hex');
}
