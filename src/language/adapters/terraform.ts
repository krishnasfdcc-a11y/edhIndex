import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const GRAMMAR: GrammarConfig = {
  language: 'hcl',
  wasmPath: new URL('../../node_modules/@tree-sitter-grammars/tree-sitter-hcl/tree-sitter-hcl.wasm', import.meta.url).pathname,
  queryPatterns: {
    block: '(block (identifier) @name)',
    attribute: '(attribute (identifier) @name)',
  },
  typeMap: {
    block: SymbolType.Module,
    attribute: SymbolType.Property,
  },
  nameNodeTypes: ['identifier'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class TerraformAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Terraform'; }
  fileExtensions(): string[] { return ['.tf', '.tfvars']; }
}
