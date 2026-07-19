import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class CsvAdapter implements LanguageAdapter {
  languageName(): string { return 'CSV'; }
  fileExtensions(): string[] { return ['.csv']; }
  fileNames(): string[] { return []; }
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.csv');
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    if (lines.length > 0) {
      // Extract header row as column definitions
      const headers = this.parseCSVLine(lines[0]);
      if (headers.length > 0) {
        symbols.push({
          id: `${filePath}:1`,
          name: 'headers',
          type: SymbolType.Module,
          language: 'csv',
          file: filePath,
          startLine: 1,
          endLine: 1,
          parent: null,
          children: [],
          metadata: { columns: headers, columnCount: headers.length },
        });

        // Extract each column as a property
        headers.forEach((header, index) => {
          if (header.trim()) {
            symbols.push({
              id: `${filePath}:1:${index}`,
              name: header.trim(),
              type: SymbolType.Property,
              language: 'csv',
              file: filePath,
              startLine: 1,
              endLine: 1,
              parent: `${filePath}:1`,
              children: [],
              metadata: { columnIndex: index },
            });
          }
        });
      }

      // Extract data summary
      const dataLines = lines.length - 1;
      if (dataLines > 0) {
        symbols.push({
          id: `${filePath}:data`,
          name: 'data',
          type: SymbolType.Table,
          language: 'csv',
          file: filePath,
          startLine: 2,
          endLine: lines.length,
          parent: null,
          children: [],
          metadata: { rowCount: dataLines, columnCount: headers.length },
        });
      }

      // Extract comments (lines starting with #)
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#')) {
          comments.push(line);
        }
      }
    }

    return { symbols, imports, exports, comments };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }
}
