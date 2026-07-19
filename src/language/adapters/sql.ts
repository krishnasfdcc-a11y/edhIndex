import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class SqlAdapter implements LanguageAdapter {
  languageName(): string { return 'SQL'; }
  fileExtensions(): string[] { return ['.sql']; }
  fileNames(): string[] { return []; }
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.sql');
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    // Extract SQL objects using regex patterns
    this.extractSqlObjects(lines, symbols, filePath);
    
    // Extract comments
    this.extractComments(lines, comments);

    return { symbols, imports, exports, comments };
  }

  private extractSqlObjects(lines: string[], symbols: CodeSymbol[], filePath: string) {
    const patterns = [
      { regex: /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"']?(\w+)[`"']?/gi, type: SymbolType.Table },
      { regex: /CREATE\s+VIEW\s+[`"']?(\w+)[`"']?/gi, type: SymbolType.Table },
      { regex: /CREATE\s+INDEX\s+[`"']?(\w+)[`"']?/gi, type: SymbolType.Property },
      { regex: /CREATE\s+(?:UNIQUE\s+)?INDEX\s+[`"']?(\w+)[`"']?/gi, type: SymbolType.Property },
      { regex: /CREATE\s+TRIGGER\s+[`"']?(\w+)[`"']?/gi, type: SymbolType.Function },
      { regex: /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+[`"']?(\w+)[`"']?/gi, type: SymbolType.Function },
      { regex: /CREATE\s+(?:OR\s+REPLACE\s+)?PROCEDURE\s+[`"']?(\w+)[`"']?/gi, type: SymbolType.Function },
      { regex: /CREATE\s+SCHEMA\s+[`"']?(\w+)[`"']?/gi, type: SymbolType.Namespace },
      { regex: /CREATE\s+DATABASE\s+[`"']?(\w+)[`"']?/gi, type: SymbolType.Module },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      for (const pattern of patterns) {
        const matches = line.matchAll(pattern.regex);
        for (const match of matches) {
          if (match[1]) {
            symbols.push({
              id: `${filePath}:${i + 1}`,
              name: match[1],
              type: pattern.type,
              language: 'sql',
              file: filePath,
              startLine: i + 1,
              endLine: i + 1,
              parent: null,
              children: [],
              metadata: {},
            });
          }
        }
      }
    }
  }

  private extractComments(lines: string[], comments: string[]) {
    let inBlockComment = false;
    let blockComment = '';

    for (const line of lines) {
      if (inBlockComment) {
        const endIdx = line.indexOf('*/');
        if (endIdx >= 0) {
          blockComment += line.substring(0, endIdx + 2);
          comments.push(blockComment.trim());
          blockComment = '';
          inBlockComment = false;
        } else {
          blockComment += line + '\n';
        }
      } else {
        const startIdx = line.indexOf('/*');
        if (startIdx >= 0) {
          const endIdx = line.indexOf('*/', startIdx + 2);
          if (endIdx >= 0) {
            comments.push(line.substring(startIdx, endIdx + 2).trim());
          } else {
            blockComment = line.substring(startIdx) + '\n';
            inBlockComment = true;
          }
        }
        
        const lineCommentIdx = line.indexOf('--');
        if (lineCommentIdx >= 0) {
          comments.push(line.substring(lineCommentIdx).trim());
        }
      }
    }
  }
}
