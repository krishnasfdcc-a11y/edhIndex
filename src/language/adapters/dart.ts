import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'dart',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-dart.wasm', import.meta.url).pathname,
  queryPatterns: {
    class_declaration: '(class_declaration name: (identifier) @name)',
    mixin_declaration: '(mixin_declaration name: (identifier) @name)',
    extension_declaration: '(extension_declaration name: (identifier) @name)',
    enum_declaration: '(enum_declaration name: (identifier) @name)',
    function_declaration: '(function_signature name: (identifier) @name)',
    method_declaration: '(method_signature name: (identifier) @name)',
  },
  typeMap: {
    class_declaration: SymbolType.Class,
    mixin_declaration: SymbolType.Extension,
    extension_declaration: SymbolType.Extension,
    enum_declaration: SymbolType.Enum,
    typedef_declaration: SymbolType.TypeAlias,
    function_declaration: SymbolType.Function,
    method_declaration: SymbolType.Method,
    constructor_declaration: SymbolType.Constructor,
    variable_declaration: SymbolType.Variable,
    import_or_export: SymbolType.Import,
  },
  nameNodeTypes: ['identifier'],
  importNodeTypes: ['import_or_export'],
  exportNodeTypes: [],
};

export class DartAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Dart'; }
  fileExtensions(): string[] { return ['.dart']; }
}
