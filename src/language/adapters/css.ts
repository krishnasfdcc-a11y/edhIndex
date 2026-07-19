import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'css',
  wasmPath: require.resolve('tree-sitter-css/tree-sitter-css.wasm'),
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: [],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class CssAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'CSS'; }
  fileExtensions(): string[] { return ['.css', '.scss', '.less']; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.collectRules(tree.rootNode, symbols, filePath);
    return symbols;
  }

  private collectRules(node: any, symbols: CodeSymbol[], filePath: string) {
    if (node.type === 'rule_set') {
      let selectorText = '';
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === 'selectors') {
          selectorText = child.text || '';
          break;
        }
      }
      if (selectorText) {
        const first = selectorText.split(',')[0].trim();
        symbols.push({
          id: `${filePath}:${node.startPosition.row + 1}`,
          name: first,
          type: SymbolType.Module,
          language: 'css',
          file: filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          parent: null, children: [], metadata: { selector: selectorText },
        });
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.collectRules(child, symbols, filePath);
    }
  }
}
