import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const GRAMMAR: GrammarConfig = {
  language: 'xml',
  wasmPath: new URL('../../node_modules/@tree-sitter-grammars/tree-sitter-xml/tree-sitter-xml.wasm', import.meta.url).pathname,
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: ['tag_name', 'attribute_name'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class XmlAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'XML'; }
  fileExtensions(): string[] { return ['.xml']; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.collectElements(tree.rootNode, symbols, filePath, '');
    return symbols;
  }

  private collectElements(node: any, symbols: CodeSymbol[], filePath: string, parentId: string) {
    if (node.type === 'element') {
      const tagName = this.extractTagName(node);
      if (tagName) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        const symbolType = this.getSymbolType(tagName);
        
        symbols.push({
          id, name: tagName, type: symbolType, language: 'xml',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: parentId || null, children: [], metadata: {},
        });
        
        // Recurse into child elements
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child) this.collectElements(child, symbols, filePath, id);
        }
        return;
      }
    }
    
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.collectElements(child, symbols, filePath, parentId);
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

  private getSymbolType(tagName: string): SymbolType {
    const significant = ['configuration', 'settings', 'properties', 'beans', 'component', 'module', 'project'];
    if (significant.includes(tagName.toLowerCase())) return SymbolType.Module;
    return SymbolType.Property;
  }
}
