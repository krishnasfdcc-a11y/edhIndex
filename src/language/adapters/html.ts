import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'html',
  wasmPath: require.resolve('tree-sitter-html/tree-sitter-html.wasm'),
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: ['tag_name', 'attribute_name'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class HtmlAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'HTML'; }
  fileExtensions(): string[] { return ['.html', '.htm']; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.collectElements(tree.rootNode, symbols, filePath);
    return symbols;
  }

  private collectElements(node: any, symbols: CodeSymbol[], filePath: string) {
    if (node.type === 'element') {
      const tagName = this.extractTagName(node);
      const significant = ['script', 'style', 'template', 'main', 'nav', 'header', 'footer',
        'section', 'article', 'form', 'aside', 'dialog', 'details'];
      if (significant.includes(tagName) || tagName.includes('-')) {
        symbols.push({
          id: `${filePath}:${node.startPosition.row + 1}`,
          name: tagName,
          type: SymbolType.Module,
          language: 'html',
          file: filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          parent: null,
          children: [],
          metadata: { tag: tagName },
        });
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.collectElements(child, symbols, filePath);
    }
  }

  private extractTagName(node: any): string {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'tag_name') return child.text;
      if (child.type === 'start_tag' || child.type === 'end_tag') {
        for (let j = 0; j < child.childCount; j++) {
          const grandchild = child.child(j);
          if (grandchild && grandchild.type === 'tag_name') return grandchild.text;
        }
      }
    }
    return 'unknown';
  }
}
