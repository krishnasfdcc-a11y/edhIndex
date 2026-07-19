import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'java',
  wasmPath: require.resolve('tree-sitter-java/tree-sitter-java.wasm'),
  queryPatterns: {
    method_declaration: '(method_declaration name: (identifier) @name)',
    class_declaration: '(class_declaration name: (identifier) @name)',
    interface_declaration: '(interface_declaration name: (identifier) @name)',
    enum_declaration: '(enum_declaration name: (identifier) @name)',
  },
  typeMap: {
    method_declaration: SymbolType.Method,
    class_declaration: SymbolType.Class,
    interface_declaration: SymbolType.Interface,
    enum_declaration: SymbolType.Enum,
    import_declaration: SymbolType.Import,
  },
  nameNodeTypes: ['identifier'],
  importNodeTypes: ['import_declaration'],
  exportNodeTypes: [],
};

export class JavaAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Java'; }
  fileExtensions(): string[] { return ['.java']; }
}
