import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class DocumentationAdapter implements LanguageAdapter {
  languageName(): string { return 'Documentation'; }
  fileExtensions(): string[] { return ['.rst', '.adoc']; }
  fileNames(): string[] { return []; }
  canParse(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return lower.endsWith('.rst') || lower.endsWith('.adoc');
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    if (filePath.endsWith('.rst')) {
      this.extractRST(lines, symbols, filePath);
    } else if (filePath.endsWith('.adoc')) {
      this.extractAsciiDoc(lines, symbols, filePath);
    }

    return { symbols, imports, exports, comments };
  }

  private extractRST(lines: string[], symbols: CodeSymbol[], filePath: string) {
    const headingChars = ['=', '-', '~', '^', '"', '#', '*', '+'];
    let currentSection: string | null = null;
    let currentSectionId: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for RST headings (underline style)
      if (i > 0 && trimmed.length > 0 && headingChars.includes(trimmed[0])) {
        const prevLine = lines[i - 1].trim();
        if (prevLine.length > 0 && trimmed.length >= prevLine.length) {
          // This is a heading underline
          const level = headingChars.indexOf(trimmed[0]);
          currentSectionId = `${filePath}:${i}`;
          symbols.push({
            id: currentSectionId,
            name: prevLine,
            type: SymbolType.Section,
            language: 'rst',
            file: filePath,
            startLine: i,
            endLine: i + 1,
            parent: null,
            children: [],
            metadata: { level },
          });
          continue;
        }
      }

      // Check for RST directives
      const directiveMatch = trimmed.match(/^\.\.\s+(\w+)::/);
      if (directiveMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: directiveMatch[1],
          type: SymbolType.Function,
          language: 'rst',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: currentSectionId,
          children: [],
          metadata: {},
        });
      }

      // Extract code blocks
      if (trimmed === '.. code-block::' || trimmed.startsWith('.. code-block::')) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: 'code-block',
          type: SymbolType.Module,
          language: 'rst',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: currentSectionId,
          children: [],
          metadata: {},
        });
      }
    }
  }

  private extractAsciiDoc(lines: string[], symbols: CodeSymbol[], filePath: string) {
    let currentSection: string | null = null;
    let currentSectionId: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for AsciiDoc headings
      const headingMatch = trimmed.match(/^(={1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        currentSectionId = `${filePath}:${i + 1}`;
        symbols.push({
          id: currentSectionId,
          name: headingMatch[2],
          type: SymbolType.Section,
          language: 'adoc',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: { level },
        });
        continue;
      }

      // Check for block attributes
      const blockMatch = trimmed.match(/^\[(.+)\]$/);
      if (blockMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: blockMatch[1],
          type: SymbolType.Property,
          language: 'adoc',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: currentSectionId,
          children: [],
          metadata: {},
        });
      }

      // Extract code blocks
      if (trimmed === '----' || trimmed === '....') {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: 'code-block',
          type: SymbolType.Module,
          language: 'adoc',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: currentSectionId,
          children: [],
          metadata: {},
        });
      }
    }
  }
}
