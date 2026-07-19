import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'go',
  wasmPath: require.resolve('tree-sitter-go/tree-sitter-go.wasm'),
  queryPatterns: {
    function_declaration: '(function_declaration name: (identifier) @name)',
    method_declaration: '(method_declaration name: (field_identifier) @name)',
  },
  typeMap: {
    function_declaration: SymbolType.Function,
    method_declaration: SymbolType.Method,
    import_declaration: SymbolType.Import,
  },
  nameNodeTypes: ['identifier', 'field_identifier'],
  importNodeTypes: ['import_declaration', 'import_spec'],
  exportNodeTypes: [],
};

export class GoAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Go'; }
  fileExtensions(): string[] { return ['.go']; }
}
