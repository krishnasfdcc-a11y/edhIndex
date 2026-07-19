import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class TextAdapter implements LanguageAdapter {
  languageName(): string { return 'Text'; }
  fileExtensions(): string[] { return ['.txt', '.log']; }
  fileNames(): string[] { return []; }
  canParse(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return lower.endsWith('.txt') || lower.endsWith('.log');
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    if (filePath.endsWith('.log')) {
      this.extractLogEntries(lines, symbols, filePath);
    } else {
      this.extractTextSections(lines, symbols, filePath);
    }

    return { symbols, imports, exports, comments };
  }

  private extractLogEntries(lines: string[], symbols: CodeSymbol[], filePath: string) {
    const logPatterns = [
      { regex: /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/i, type: SymbolType.Function },
      { regex: /^\[?\d{4}-\d{2}-\d{2}\]?/i, type: SymbolType.Function },
      { regex: /^(ERROR|WARN|INFO|DEBUG|FATAL)/i, type: SymbolType.Function },
      { regex: /^Exception|Error|Warning/i, type: SymbolType.Function },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (!line) continue;

      for (const pattern of logPatterns) {
        if (pattern.regex.test(line)) {
          symbols.push({
            id: `${filePath}:${i + 1}`,
            name: line.substring(0, 50),
            type: pattern.type,
            language: 'log',
            file: filePath,
            startLine: i + 1,
            endLine: i + 1,
            parent: null,
            children: [],
            metadata: { fullLine: line },
          });
          break;
        }
      }

      // Extract stack traces
      if (line.includes('at ') && line.includes('(') && line.includes(')')) {
        symbols.push({
          id: `${filePath}:${i + 1}:stack`,
          name: 'stackTrace',
          type: SymbolType.Function,
          language: 'log',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: { trace: line },
        });
      }
    }
  }

  private extractTextSections(lines: string[], symbols: CodeSymbol[], filePath: string) {
    let currentSection: string | null = null;
    let currentSectionId: string | null = null;
    let sectionStart = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Detect section headers (lines that are all uppercase, or followed by underline)
      const isHeader = this.isSectionHeader(line, lines[i + 1]);
      
      if (isHeader && line.length > 0) {
        // Save previous section
        if (currentSection) {
          symbols.push({
            id: currentSectionId!,
            name: currentSection,
            type: SymbolType.Section,
            language: 'text',
            file: filePath,
            startLine: sectionStart,
            endLine: i,
            parent: null,
            children: [],
            metadata: {},
          });
        }

        // Start new section
        currentSection = line;
        currentSectionId = `${filePath}:${i + 1}`;
        sectionStart = i + 1;
      }
    }

    // Save last section
    if (currentSection) {
      symbols.push({
        id: currentSectionId!,
        name: currentSection,
        type: SymbolType.Section,
        language: 'text',
        file: filePath,
        startLine: sectionStart,
        endLine: lines.length,
        parent: null,
        children: [],
        metadata: {},
      });
    }

    // If no sections found, create paragraph-based symbols
    if (symbols.length === 0) {
      this.extractParagraphs(lines, symbols, filePath);
    }
  }

  private isSectionHeader(line: string, nextLine: string | undefined): boolean {
    if (!line || line.length < 3) return false;
    
    // Check if line is all uppercase
    if (line === line.toUpperCase() && /[A-Z]/.test(line)) return true;
    
    // Check if next line is underline (=== or ---)
    if (nextLine) {
      const underline = nextLine.trim();
      if (/^[=-]{3,}$/.test(underline)) return true;
    }
    
    return false;
  }

  private extractParagraphs(lines: string[], symbols: CodeSymbol[], filePath: string) {
    let paragraphStart = 0;
    let paragraphText = '';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      if (line === '') {
        if (paragraphText.length > 0) {
          symbols.push({
            id: `${filePath}:${paragraphStart + 1}`,
            name: paragraphText.substring(0, 50),
            type: SymbolType.Section,
            language: 'text',
            file: filePath,
            startLine: paragraphStart + 1,
            endLine: i,
            parent: null,
            children: [],
            metadata: { size: paragraphText.length },
          });
          paragraphText = '';
        }
        paragraphStart = i + 1;
      } else {
        paragraphText += (paragraphText ? ' ' : '') + line;
      }
    }

    // Handle last paragraph
    if (paragraphText.length > 0) {
      symbols.push({
        id: `${filePath}:${paragraphStart + 1}`,
        name: paragraphText.substring(0, 50),
        type: SymbolType.Section,
        language: 'text',
        file: filePath,
        startLine: paragraphStart + 1,
        endLine: lines.length,
        parent: null,
        children: [],
        metadata: { size: paragraphText.length },
      });
    }
  }
}
