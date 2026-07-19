import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'js',
  wasmPath: require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm'),
  queryPatterns: {
    function_declaration: '(function_declaration name: (identifier) @name)',
    method_definition: '(method_definition name: (property_identifier) @name)',
    class_declaration: '(class_declaration name: (identifier) @name)',
  },
  typeMap: {
    function_declaration: SymbolType.Function,
    arrow_function: SymbolType.Function,
    method_definition: SymbolType.Method,
    class_declaration: SymbolType.Class,
    import_statement: SymbolType.Import,
    import_declaration: SymbolType.Import,
    export_statement: SymbolType.Export,
  },
  nameNodeTypes: ['identifier', 'property_identifier'],
  importNodeTypes: ['import_statement', 'import_declaration'],
  exportNodeTypes: ['export_statement'],
};

export class JavaScriptAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'JavaScript'; }
  fileExtensions(): string[] { return ['.js', '.jsx', '.mjs', '.cjs']; }
}
