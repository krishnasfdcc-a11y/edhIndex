import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'cpp',
  wasmPath: require.resolve('tree-sitter-cpp/tree-sitter-cpp.wasm'),
  queryPatterns: {
    function_definition: '(function_definition declarator: (function_declarator declarator: (identifier) @name))',
    class_specifier: '(class_specifier name: (type_identifier) @name)',
    struct_specifier: '(struct_specifier name: (type_identifier) @name)',
    enum_specifier: '(enum_specifier name: (type_identifier) @name)',
  },
  typeMap: {
    function_definition: SymbolType.Function,
    class_specifier: SymbolType.Class,
    struct_specifier: SymbolType.Struct,
    enum_specifier: SymbolType.Enum,
  },
  nameNodeTypes: ['identifier', 'type_identifier', 'field_identifier'],
  importNodeTypes: ['preproc_include', 'using_declaration'],
  exportNodeTypes: [],
};

export class CppAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'C++'; }
  fileExtensions(): string[] { return ['.cpp', '.cxx', '.cc', '.c++', '.hpp', '.hxx', '.hh']; }
}
