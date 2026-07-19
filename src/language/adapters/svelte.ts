import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const GRAMMAR: GrammarConfig = {
  language: 'svelte',
  wasmPath: new URL('../../node_modules/@tree-sitter-grammars/tree-sitter-svelte/tree-sitter-svelte.wasm', import.meta.url).pathname,
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: ['tag_name', 'attribute_name'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class SvelteAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Svelte'; }
  fileExtensions(): string[] { return ['.svelte']; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.walkSvelte(tree.rootNode, symbols, filePath);
    return symbols;
  }

  private walkSvelte(node: any, symbols: CodeSymbol[], filePath: string) {
    // Extract top-level sections: <script>, <style>, <template>
    if (node.type === 'element' || node.type === 'script_element' || node.type === 'style_element') {
      const tagName = this.extractTagName(node);
      if (tagName && ['script', 'style', 'template'].includes(tagName.toLowerCase())) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: tagName, type: SymbolType.Section, language: 'svelte',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: null, children: [], metadata: {},
        });
      }
      
      // Extract custom components (PascalCase or kebab-case with -)
      if (tagName && (tagName[0] === tagName[0].toUpperCase() || tagName.includes('-'))) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: tagName, type: SymbolType.Class, language: 'svelte',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: null, children: [], metadata: {},
        });
      }
    }
    
    // Extract Svelte-specific blocks: {#if}, {#each}, {#await}
    if (node.type === 'if_block' || node.type === 'each_block' || node.type === 'await_block') {
      const id = `${filePath}:${node.startPosition.row + 1}`;
      symbols.push({
        id, name: node.type.replace('_block', ''), type: SymbolType.Function, language: 'svelte',
        file: filePath, startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1, parent: null, children: [], metadata: {},
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.walkSvelte(child, symbols, filePath);
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
