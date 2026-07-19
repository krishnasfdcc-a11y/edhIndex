import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'csharp',
  wasmPath: require.resolve('tree-sitter-c-sharp/tree-sitter-c_sharp.wasm'),
  queryPatterns: {
    method_declaration: '(method_declaration name: (identifier) @name)',
    class_declaration: '(class_declaration name: (identifier) @name)',
    interface_declaration: '(interface_declaration name: (identifier) @name)',
    struct_declaration: '(struct_declaration name: (identifier) @name)',
    enum_declaration: '(enum_declaration name: (identifier) @name)',
  },
  typeMap: {
    method_declaration: SymbolType.Method,
    class_declaration: SymbolType.Class,
    interface_declaration: SymbolType.Interface,
    struct_declaration: SymbolType.Struct,
    enum_declaration: SymbolType.Enum,
    using_directive: SymbolType.Import,
  },
  nameNodeTypes: ['identifier'],
  importNodeTypes: ['using_directive'],
  exportNodeTypes: [],
};

export class CSharpAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'C#'; }
  fileExtensions(): string[] { return ['.cs']; }
}
