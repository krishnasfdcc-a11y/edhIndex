import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class ConfigAdapter implements LanguageAdapter {
  languageName(): string { return 'Config'; }
  fileExtensions(): string[] { return ['.ini', '.properties', '.env', '.conf', '.cfg']; }
  fileNames(): string[] { return ['.gitignore', '.editorconfig']; }
  canParse(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    for (const ext of this.fileExtensions()) {
      if (lower.endsWith(ext)) return true;
    }
    for (const name of this.fileNames()) {
      if (lower.endsWith('/' + name) || lower === name || lower.endsWith(name)) return true;
    }
    return false;
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    if (filePath.endsWith('.ini') || filePath.endsWith('.conf') || filePath.endsWith('.cfg') || filePath.endsWith('.editorconfig')) {
      this.extractIniStyle(lines, symbols, filePath);
    } else if (filePath.endsWith('.properties') || filePath.endsWith('.env')) {
      this.extractKeyValue(lines, symbols, filePath);
    } else if (filePath.endsWith('.gitignore')) {
      this.extractGitignore(lines, symbols, filePath);
    } else {
      this.extractKeyValue(lines, symbols, filePath);
    }

    this.extractComments(lines, comments);

    return { symbols, imports, exports, comments };
  }

  private extractIniStyle(lines: string[], symbols: CodeSymbol[], filePath: string) {
    let currentSection: string | null = null;
    let currentSectionId: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Section headers: [section]
      const sectionMatch = line.match(/^\[(.+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        currentSectionId = `${filePath}:${i + 1}`;
        symbols.push({
          id: currentSectionId,
          name: currentSection,
          type: SymbolType.Section,
          language: 'config',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: {},
        });
        continue;
      }

      // Key-value pairs
      const kvMatch = line.match(/^([^#=]+?)\s*=\s*(.+)$/);
      if (kvMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: kvMatch[1].trim(),
          type: SymbolType.Property,
          language: 'config',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: currentSectionId,
          children: [],
          metadata: { value: kvMatch[2].trim() },
        });
      }
    }
  }

  private extractKeyValue(lines: string[], symbols: CodeSymbol[], filePath: string) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#') || line.startsWith('!')) continue;

      // Key-value pairs
      const kvMatch = line.match(/^([^=]+?)\s*=\s*(.+)$/);
      if (kvMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: kvMatch[1].trim(),
          type: SymbolType.Property,
          language: 'config',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: { value: kvMatch[2].trim() },
        });
      }
    }
  }

  private extractGitignore(lines: string[], symbols: CodeSymbol[], filePath: string) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip empty lines and comments
      if (!line || line.startsWith('#')) continue;

      // Treat each pattern as a property
      symbols.push({
        id: `${filePath}:${i + 1}`,
        name: line,
        type: SymbolType.Property,
        language: 'config',
        file: filePath,
        startLine: i + 1,
        endLine: i + 1,
        parent: null,
        children: [],
        metadata: {},
      });
    }
  }

  private extractComments(lines: string[], comments: string[]) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#') || trimmed.startsWith(';') || trimmed.startsWith('!')) {
        comments.push(trimmed);
      }
    }
  }
}
