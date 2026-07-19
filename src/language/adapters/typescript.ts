import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'ts',
  wasmPath: require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm'),
  queryPatterns: {
    function_declaration: '(function_declaration name: (identifier) @name)',
    method_definition: '(method_definition name: (property_identifier) @name)',
    class_declaration: '(class_declaration name: (type_identifier) @name)',
    interface_declaration: '(interface_declaration name: (type_identifier) @name)',
    enum_declaration: '(enum_declaration name: (type_identifier) @name)',
  },
  typeMap: {
    function_declaration: SymbolType.Function,
    arrow_function: SymbolType.Function,
    method_definition: SymbolType.Method,
    class_declaration: SymbolType.Class,
    interface_declaration: SymbolType.Interface,
    enum_declaration: SymbolType.Enum,
    import_statement: SymbolType.Import,
    import_declaration: SymbolType.Import,
    export_statement: SymbolType.Export,
  },
  nameNodeTypes: ['identifier', 'property_identifier', 'type_identifier'],
  importNodeTypes: ['import_statement', 'import_declaration'],
  exportNodeTypes: ['export_statement'],
};

export class TypeScriptAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'TypeScript'; }
  fileExtensions(): string[] { return ['.ts', '.tsx', '.mts', '.cts']; }
}
