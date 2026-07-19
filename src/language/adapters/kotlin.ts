import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'kotlin',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-kotlin.wasm', import.meta.url).pathname,
  queryPatterns: {
    class_declaration: '(class_declaration name: (simple_identifier) @name)',
    interface_declaration: '(class_declaration "data" name: (simple_identifier) @name)',
    object_declaration: '(object_declaration name: (simple_identifier) @name)',
    enum_declaration: '(enum_declaration name: (simple_identifier) @name)',
    function_declaration: '(function_declaration name: (simple_identifier) @name)',
    property_declaration: '(property_declaration name: (simple_identifier) @name)',
  },
  typeMap: {
    class_declaration: SymbolType.Class,
    interface_declaration: SymbolType.Interface,
    object_declaration: SymbolType.Object,
    enum_declaration: SymbolType.Enum,
    function_declaration: SymbolType.Function,
    property_declaration: SymbolType.Property,
    import_declaration: SymbolType.Import,
    package_declaration: SymbolType.Package,
  },
  nameNodeTypes: ['simple_identifier'],
  importNodeTypes: ['import_declaration'],
  exportNodeTypes: [],
};

export class KotlinAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Kotlin'; }
  fileExtensions(): string[] { return ['.kt', '.kts']; }
}
