import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'swift',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-swift.wasm', import.meta.url).pathname,
  queryPatterns: {
    class_declaration: '(class_declaration name: (type_identifier) @name)',
    struct_declaration: '(struct_declaration name: (type_identifier) @name)',
    enum_declaration: '(enum_declaration name: (type_identifier) @name)',
    protocol_declaration: '(protocol_declaration name: (type_identifier) @name)',
    extension_declaration: '(extension_declaration type: (user_type) @name)',
    actor_declaration: '(actor_declaration name: (type_identifier) @name)',
    function_declaration: '(function_declaration name: (simple_identifier) @name)',
    initializer_declaration: '(initializer_declaration) @name',
  },
  typeMap: {
    class_declaration: SymbolType.Class,
    struct_declaration: SymbolType.Struct,
    enum_declaration: SymbolType.Enum,
    protocol_declaration: SymbolType.Protocol,
    extension_declaration: SymbolType.Extension,
    actor_declaration: SymbolType.Actor,
    function_declaration: SymbolType.Function,
    method_declaration: SymbolType.Method,
    initializer_declaration: SymbolType.Constructor,
    property_declaration: SymbolType.Property,
    variable_declaration: SymbolType.Variable,
    type_alias_declaration: SymbolType.TypeAlias,
    import_declaration: SymbolType.Import,
  },
  nameNodeTypes: ['simple_identifier', 'type_identifier'],
  importNodeTypes: ['import_declaration'],
  exportNodeTypes: [],
};

export class SwiftAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Swift'; }
  fileExtensions(): string[] { return ['.swift']; }
}
