import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType, CodeSymbol } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'yaml',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-yaml.wasm', import.meta.url).pathname,
  queryPatterns: {},
  typeMap: {},
  nameNodeTypes: ['string_scalar', 'plain_scalar'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class YamlAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'YAML'; }
  fileExtensions(): string[] { return ['.yaml', '.yml']; }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    this.walkYaml(tree.rootNode, symbols, filePath, '');
    return symbols;
  }

  private walkYaml(node: any, symbols: CodeSymbol[], filePath: string, parentId: string) {
    if (node.type === 'block_mapping_pair' || node.type === 'flow_pair') {
      const key = this.extractYamlKey(node);
      if (key) {
        const id = `${filePath}:${node.startPosition.row + 1}`;
        symbols.push({
          id, name: key, type: SymbolType.Property, language: 'yaml',
          file: filePath, startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1, parent: parentId || null, children: [], metadata: {},
        });
        // Recurse into nested mappings
        for (let i = 0; i < node.childCount; i++) {
          const child = node.child(i);
          if (child && (child.type === 'block_mapping' || child.type === 'flow_mapping')) {
            this.walkYaml(child, symbols, filePath, id);
          }
        }
      }
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.walkYaml(child, symbols, filePath, parentId);
    }
  }

  private extractYamlKey(node: any): string | null {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (!child) continue;
      if (child.type === 'string_scalar' || child.type === 'plain_scalar') {
        return child.text || null;
      }
    }
    return null;
  }
}
