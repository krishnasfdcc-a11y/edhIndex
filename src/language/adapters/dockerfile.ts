import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class DockerfileAdapter implements LanguageAdapter {
  languageName(): string { return 'Dockerfile'; }
  fileExtensions(): string[] { return []; }
  fileNames(): string[] { return ['dockerfile', 'Dockerfile', 'dockerfile.dev', 'Dockerfile.dev', 'dockerfile.prod', 'Dockerfile.prod']; }
  canParse(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    return lower.endsWith('dockerfile') || lower.includes('dockerfile.');
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    this.extractDockerInstructions(lines, symbols, filePath);
    this.extractComments(lines, comments);

    return { symbols, imports, exports, comments };
  }

  private extractDockerInstructions(lines: string[], symbols: CodeSymbol[], filePath: string) {
    const patterns = [
      { regex: /^FROM\s+(.+)$/gi, type: SymbolType.Import, name: 'FROM' },
      { regex: /^RUN\s+(.+)$/gi, type: SymbolType.Function, name: 'RUN' },
      { regex: /^CMD\s+(.+)$/gi, type: SymbolType.Function, name: 'CMD' },
      { regex: /^ENTRYPOINT\s+(.+)$/gi, type: SymbolType.Function, name: 'ENTRYPOINT' },
      { regex: /^COPY\s+(.+)$/gi, type: SymbolType.Function, name: 'COPY' },
      { regex: /^ADD\s+(.+)$/gi, type: SymbolType.Function, name: 'ADD' },
      { regex: /^ENV\s+(\w+)/gi, type: SymbolType.Variable, name: 'ENV' },
      { regex: /^EXPOSE\s+(\d+)/gi, type: SymbolType.Variable, name: 'EXPOSE' },
      { regex: /^VOLUME\s+(.+)$/gi, type: SymbolType.Variable, name: 'VOLUME' },
      { regex: /^WORKDIR\s+(.+)$/gi, type: SymbolType.Variable, name: 'WORKDIR' },
      { regex: /^USER\s+(.+)$/gi, type: SymbolType.Variable, name: 'USER' },
      { regex: /^LABEL\s+(\w+)/gi, type: SymbolType.Property, name: 'LABEL' },
      { regex: /^ARG\s+(\w+)/gi, type: SymbolType.Variable, name: 'ARG' },
      { regex: /^STOPSIGNAL\s+(.+)$/gi, type: SymbolType.Variable, name: 'STOPSIGNAL' },
      { regex: /^HEALTHCHECK\s+(.+)$/gi, type: SymbolType.Function, name: 'HEALTHCHECK' },
      { regex: /^SHELL\s+(.+)$/gi, type: SymbolType.Function, name: 'SHELL' },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(line);
        if (match) {
          symbols.push({
            id: `${filePath}:${i + 1}`,
            name: pattern.name,
            type: pattern.type,
            language: 'dockerfile',
            file: filePath,
            startLine: i + 1,
            endLine: i + 1,
            parent: null,
            children: [],
            metadata: { instruction: match[1]?.trim() },
          });
        }
      }
    }
  }

  private extractComments(lines: string[], comments: string[]) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        comments.push(trimmed);
      }
    }
  }
}
