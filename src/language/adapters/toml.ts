import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'toml',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-toml.wasm', import.meta.url).pathname,
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: ['bare_key', 'string'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class TomlAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'TOML'; }
  fileExtensions(): string[] { return ['.toml']; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.walkToml(tree.rootNode, symbols, filePath, '');
    return symbols;
  }

  private walkToml(node: any, symbols: CodeSymbol[], filePath: string, parentId: string) {
    if (node.type === 'table' || node.type === 'table_array_element') {
      const key = this.extractTomlKey(node);
      if (key) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: key, type: SymbolType.Section, language: 'toml',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: parentId || null, children: [], metadata: {},
        });
        parentId = id;
      }
    } else if (node.type === 'pair') {
      const key = this.extractPairKey(node);
      if (key) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: key, type: SymbolType.Property, language: 'toml',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: parentId || null, children: [], metadata: {},
        });
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.walkToml(child, symbols, filePath, parentId);
    }
  }

  private extractTomlKey(node: any): string | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'bare_key' || child.type === 'string') {
        return child.text?.replace(/"/g, '') || null;
      }
      if (child.type === 'dotted_key') {
        return child.text || null;
      }
    }
    return null;
  }

  private extractPairKey(node: any): string | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'bare_key' || child.type === 'string') {
        return child.text?.replace(/"/g, '') || null;
      }
    }
    return null;
  }
}
