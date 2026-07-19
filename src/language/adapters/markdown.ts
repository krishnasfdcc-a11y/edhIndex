import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'markdown',
  wasmPath: new URL('../../node_modules/tree-sitter-wasm-prebuilt/lib/tree-sitter-markdown.wasm', import.meta.url).pathname,
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: ['inline'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class MarkdownAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Markdown'; }
  fileExtensions(): string[] { return ['.md', '.markdown']; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.walkMarkdown(tree.rootNode, symbols, filePath);
    return symbols;
  }

  private walkMarkdown(node: any, symbols: CodeSymbol[], filePath: string) {
    if (node.type.startsWith('atx_heading') || node.type.startsWith('setext_heading')) {
      const level = parseInt(node.type.match(/\d/)?.[0] || '1');
      const text = this.extractHeadingText(node);
      if (text) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: text, type: SymbolType.Section, language: 'markdown',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: null, children: [],
          metadata: { level },
        });
      }
    }
    
    if (node.type === 'fenced_code_block') {
      const lang = this.extractCodeBlockLang(node);
      const id = `${filePath}:${node.startPosition.row + 1}`;
      symbols.push({
        id, name: `code_block_${lang || 'unknown'}`, type: SymbolType.Module, language: 'markdown',
        file: filePath, startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1, parent: null, children: [],
        metadata: { language: lang },
      });
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.walkMarkdown(child, symbols, filePath);
    }
  }

  private extractHeadingText(node: any): string | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'inline') {
        return child.text?.trim() || null;
      }
    }
    return null;
  }

  private extractCodeBlockLang(node: any): string | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'info_string') {
        return child.text?.trim() || null;
      }
    }
    return null;
  }
}
