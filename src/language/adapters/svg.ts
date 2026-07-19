import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class SvgAdapter implements LanguageAdapter {
  languageName(): string { return 'SVG'; }
  fileExtensions(): string[] { return ['.svg']; }
  fileNames(): string[] { return []; }
  canParse(filePath: string): boolean {
    return filePath.toLowerCase().endsWith('.svg');
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    this.extractSvgElements(lines, symbols, filePath);
    this.extractComments(lines, comments);

    return { symbols, imports, exports, comments };
  }

  private extractSvgElements(lines: string[], symbols: CodeSymbol[], filePath: string) {
    const significantElements = [
      'svg', 'g', 'defs', 'symbol', 'use', 'path', 'rect', 'circle', 'ellipse',
      'line', 'polyline', 'polygon', 'text', 'tspan', 'textPath', 'image',
      'switch', 'foreignObject', 'marker', 'pattern', 'clipPath', 'mask',
      'filter', 'feBlend', 'feColorMatrix', 'feComponentTransfer', 'feComposite',
      'feConvolveMatrix', 'feDiffuseLighting', 'feDisplacementMap', 'feFlood',
      'feGaussianBlur', 'feImage', 'feMerge', 'feMergeNode', 'feMorphology',
      'feOffset', 'feSpecularLighting', 'feTile', 'feTurbulence', 'animate',
      'animateTransform', 'animateMotion', 'set',
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract SVG elements
      const elementMatch = line.match(/<(\w+)(?:\s|>|\/)/);
      if (elementMatch) {
        const elementName = elementMatch[1].toLowerCase();
        if (significantElements.includes(elementName)) {
          const symbolType = this.getSymbolType(elementName);
          symbols.push({
            id: `${filePath}:${i + 1}`,
            name: elementName,
            type: symbolType,
            language: 'svg',
            file: filePath,
            startLine: i + 1,
            endLine: i + 1,
            parent: null,
            children: [],
            metadata: {},
          });
        }
      }

      // Extract id attributes as properties
      const idMatch = line.match(/\bid=["']([^"']+)["']/);
      if (idMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}:id`,
          name: idMatch[1],
          type: SymbolType.Property,
          language: 'svg',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: {},
        });
      }

      // Extract class attributes
      const classMatch = line.match(/\bclass=["']([^"']+)["']/);
      if (classMatch) {
        const classes = classMatch[1].split(/\s+/);
        for (const cls of classes) {
          if (cls.trim()) {
            symbols.push({
              id: `${filePath}:${i + 1}:class:${cls}`,
              name: cls,
              type: SymbolType.Property,
              language: 'svg',
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

  private getSymbolType(elementName: string): SymbolType {
    const structural = ['svg', 'g', 'defs', 'symbol', 'marker', 'pattern', 'clipPath', 'mask', 'filter'];
    if (structural.includes(elementName)) return SymbolType.Module;
    return SymbolType.Property;
  }

  private extractComments(lines: string[], comments: string[]) {
    let inComment = false;
    let comment = '';

    for (const line of lines) {
      if (inComment) {
        const endIdx = line.indexOf('-->');
        if (endIdx >= 0) {
          comment += line.substring(0, endIdx + 3);
          comments.push(comment.trim());
          comment = '';
          inComment = false;
        } else {
          comment += line + '\n';
        }
      } else {
        const startIdx = line.indexOf('<!--');
        if (startIdx >= 0) {
          const endIdx = line.indexOf('-->', startIdx + 4);
          if (endIdx >= 0) {
            comments.push(line.substring(startIdx, endIdx + 3).trim());
          } else {
            comment = line.substring(startIdx) + '\n';
            inComment = true;
          }
        }
      }
    }
  }
}
