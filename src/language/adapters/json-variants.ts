import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'json',
  wasmPath: require.resolve('tree-sitter-json/tree-sitter-json.wasm'),
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: [],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class JsonVariantsAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'JSON'; }
  fileExtensions(): string[] { return ['.jsonc', '.json5']; }
  fileNames(): string[] { return []; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.walkPairs(tree.rootNode, symbols, filePath, '');
    return symbols;
  }

  private walkPairs(node: any, symbols: CodeSymbol[], filePath: string, parentId: string) {
    if (node.type === 'pair') {
      let key = '';
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child && child.type === 'string' && !key) {
          key = child.text?.replace(/"/g, '') || '';
          break;
        }
      }
      if (key) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: key, type: SymbolType.Property, language: 'json',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: parentId || null, children: [], metadata: {},
        });
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child && (child.type === 'object' || child.type === 'array')) {
            this.walkPairs(child, symbols, filePath, id);
          }
        }
      }
      return;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.walkPairs(child, symbols, filePath, parentId);
    }
  }
}
