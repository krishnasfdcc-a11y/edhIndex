import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'c',
  wasmPath: require.resolve('tree-sitter-c/tree-sitter-c.wasm'),
  queryPatterns: {
    function_definition: '(function_definition declarator: (function_declarator declarator: (identifier) @name))',
    struct_specifier: '(struct_specifier name: (type_identifier) @name)',
  },
  typeMap: {
    function_definition: SymbolType.Function,
    struct_specifier: SymbolType.Struct,
  },
  nameNodeTypes: ['identifier', 'type_identifier', 'field_identifier'],
  importNodeTypes: ['preproc_include'],
  exportNodeTypes: [],
};

export class CAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'C'; }
  fileExtensions(): string[] { return ['.c', '.h']; }
}
