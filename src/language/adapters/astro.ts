import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class AstroAdapter implements LanguageAdapter {
  languageName(): string { return 'Astro'; }
  fileExtensions(): string[] { return ['.astro']; }
  fileNames(): string[] { return []; }
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.astro');
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    this.extractAstroComponents(lines, symbols, imports, filePath);
    this.extractComments(lines, comments);

    return { symbols, imports, exports, comments };
  }

  private extractAstroComponents(lines: string[], symbols: CodeSymbol[], imports: string[], filePath: string) {
    // Astro files have three sections: frontmatter (---), template, and style
    let inFrontmatter = false;
    let frontmatterStart = 0;
    let currentSection: string | null = null;
    let currentSectionId: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // Frontmatter boundaries
      if (line === '---') {
        if (!inFrontmatter) {
          inFrontmatter = true;
          frontmatterStart = i;
          currentSectionId = `${filePath}:${i + 1}`;
          symbols.push({
            id: currentSectionId,
            name: 'frontmatter',
            type: SymbolType.Section,
            language: 'astro',
            file: filePath,
            startLine: i + 1,
            endLine: i + 1,
            parent: null,
            children: [],
            metadata: {},
          });
        } else {
          inFrontmatter = false;
          if (currentSectionId) {
            // Update end line for frontmatter
            const idx = symbols.findIndex(s => s.id === currentSectionId);
            if (idx >= 0) {
              symbols[idx].endLine = i + 1;
            }
          }
        }
        continue;
      }

      // Extract imports in frontmatter
      if (inFrontmatter) {
        const importMatch = line.match(/^import\s+(.+?)\s+from\s+['"](.+?)['"]/);
        if (importMatch) {
          imports.push(line);
          symbols.push({
            id: `${filePath}:${i + 1}`,
            name: importMatch[1],
            type: SymbolType.Import,
            language: 'astro',
            file: filePath,
            startLine: i + 1,
            endLine: i + 1,
            parent: currentSectionId,
            children: [],
            metadata: { source: importMatch[2] },
          });
        }

        // Extract variable declarations
        const varMatch = line.match(/^(?:const|let|var)\s+(\w+)/);
        if (varMatch) {
          symbols.push({
            id: `${filePath}:${i + 1}`,
            name: varMatch[1],
            type: SymbolType.Variable,
            language: 'astro',
            file: filePath,
            startLine: i + 1,
            endLine: i + 1,
            parent: currentSectionId,
            children: [],
            metadata: {},
          });
        }
      }

      // Extract Astro components in template
      if (!inFrontmatter) {
        const componentMatch = line.match(/<(\w+[-\w]*)/);
        if (componentMatch) {
          const componentName = componentMatch[1];
          // Astro components are PascalCase or kebab-case
          if (componentName[0] === componentName[0].toUpperCase() || componentName.includes('-')) {
            symbols.push({
              id: `${filePath}:${i + 1}`,
              name: componentName,
              type: SymbolType.Class,
              language: 'astro',
              file: filePath,
              startLine: i + 1,
              endLine: i + 1,
              parent: null,
              children: [],
              metadata: {},
            });
          }
        }

        // Extract style blocks
        if (line.includes('<style')) {
          currentSectionId = `${filePath}:${i + 1}`;
          symbols.push({
            id: currentSectionId,
            name: 'style',
            type: SymbolType.Section,
            language: 'astro',
            file: filePath,
            startLine: i + 1,
            endLine: i + 1,
            parent: null,
            children: [],
            metadata: {},
          });
        }

        // Extract script blocks
        if (line.includes('<script')) {
          currentSectionId = `${filePath}:${i + 1}`;
          symbols.push({
            id: currentSectionId,
            name: 'script',
            type: SymbolType.Section,
            language: 'astro',
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

        // Single-line comments
        const lineCommentIdx = line.indexOf('//');
        if (lineCommentIdx >= 0) {
          comments.push(line.substring(lineCommentIdx).trim());
        }

        // HTML comments
        const htmlCommentIdx = line.indexOf('<!--');
        if (htmlCommentIdx >= 0) {
          const endIdx = line.indexOf('-->', htmlCommentIdx + 4);
          if (endIdx >= 0) {
            comments.push(line.substring(htmlCommentIdx, endIdx + 3).trim());
          }
        }
      }
    }
  }
}
