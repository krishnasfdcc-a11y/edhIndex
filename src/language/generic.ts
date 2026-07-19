import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from './types.js';

const BINARY_EXTS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.wasm',
  '.o', '.a', '.lib', '.pyc', '.class', '.jar', '.war',
  '.png', '.jpg', '.jpeg', '.gif', '.svg', '.ico', '.webp', '.bmp', '.tiff',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
  '.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv',
  '.mp3', '.wav', '.flac', '.ogg',
]);

export class GenericAdapter implements LanguageAdapter {
  languageName(): string { return 'Generic'; }
  fileExtensions(): string[] { return []; }
  fileNames(): string[] { return []; }

  canParse(filePath: string): boolean {
    const ext = '.' + filePath.split('.').pop()?.toLowerCase();
    return !BINARY_EXTS.has(ext);
  }

  supportsSymbols(): boolean { return false; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    const symbols: CodeSymbol[] = [];

    for (let i = 0; i < Math.min(paragraphs.length, 100); i++) {
      const plines = paragraphs[i].split('\n');
      const firstLine = plines[0].trim().substring(0, 80);
      const startLine = this.lineOf(content, paragraphs[i]);
      const endLine = startLine + plines.length - 1;

      symbols.push({
        id: `${filePath}:${startLine}`,
        name: firstLine || `paragraph_${i}`,
        type: SymbolType.Module,
        language: 'generic',
        file: filePath,
        startLine,
        endLine,
        parent: null,
        children: [],
        metadata: { size: paragraphs[i].length },
      });
    }

    return { symbols, imports: [], exports: [], comments: [] };
  }

  private lineOf(content: string, substring: string): number {
    const idx = content.indexOf(substring);
    if (idx < 0) return 1;
    return content.substring(0, idx).split('\n').length;
  }
}
