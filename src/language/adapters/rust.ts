import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'rs',
  wasmPath: require.resolve('tree-sitter-rust/tree-sitter-rust.wasm'),
  queryPatterns: {
    function_item: '(function_item name: (identifier) @name)',
    struct_item: '(struct_item name: (type_identifier) @name)',
    trait_item: '(trait_item name: (type_identifier) @name)',
    enum_item: '(enum_item name: (type_identifier) @name)',
  },
  typeMap: {
    function_item: SymbolType.Function,
    struct_item: SymbolType.Struct,
    trait_item: SymbolType.Trait,
    impl_item: SymbolType.Module,
    enum_item: SymbolType.Enum,
    use_declaration: SymbolType.Import,
  },
  nameNodeTypes: ['identifier', 'type_identifier'],
  importNodeTypes: ['use_declaration'],
  exportNodeTypes: [],
};

export class RustAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Rust'; }
  fileExtensions(): string[] { return ['.rs']; }
}
