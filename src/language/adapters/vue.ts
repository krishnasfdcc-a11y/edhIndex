import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const GRAMMAR: GrammarConfig = {
  language: 'vue',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-vue.wasm', import.meta.url).pathname,
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: ['tag_name', 'attribute_name', 'directive_attribute'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class VueAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Vue'; }
  fileExtensions(): string[] { return ['.vue']; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.walkVue(tree.rootNode, symbols, filePath);
    return symbols;
  }

  private walkVue(node: any, symbols: CodeSymbol[], filePath: string) {
    // Extract top-level sections: <template>, <script>, <style>
    if (node.type === 'element') {
      const tagName = this.extractTagName(node);
      if (tagName && ['template', 'script', 'style'].includes(tagName.toLowerCase())) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: tagName, type: SymbolType.Section, language: 'vue',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: null, children: [], metadata: {},
        });
      }
      
      // Extract custom components (PascalCase or kebab-case with -)
      if (tagName && (tagName[0] === tagName[0].toUpperCase() || tagName.includes('-'))) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: tagName, type: SymbolType.Class, language: 'vue',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: null, children: [], metadata: {},
        });
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.walkVue(child, symbols, filePath);
    }
  }

  private extractTagName(node: any): string | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'tag_name') return child.text;
      if (child.type === 'start_tag' || child.type === 'self_closing_tag') {
        for (let j = 0; j < child.childCount; j++) {
          const grandchild = child.child(j);
          if (grandchild && grandchild.type === 'tag_name') return grandchild.text;
        }
      }
    }
    return null;
  }
}
