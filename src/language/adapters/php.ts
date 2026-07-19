import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'php',
  wasmPath: require.resolve('tree-sitter-php/tree-sitter-php.wasm'),
  queryPatterns: {
    function_definition: '(function_definition name: (name) @name)',
    method_declaration: '(method_declaration name: (name) @name)',
    class_declaration: '(class_declaration name: (name) @name)',
    interface_declaration: '(interface_declaration name: (name) @name)',
  },
  typeMap: {
    function_definition: SymbolType.Function,
    method_declaration: SymbolType.Method,
    class_declaration: SymbolType.Class,
    interface_declaration: SymbolType.Interface,
  },
  nameNodeTypes: ['name'],
  importNodeTypes: [],
  exportNodeTypes: [],
};

export class PhpAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'PHP'; }
  fileExtensions(): string[] { return ['.php']; }
}
