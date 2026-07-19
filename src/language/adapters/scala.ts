import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'scala',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-scala.wasm', import.meta.url).pathname,
  queryPatterns: {
    class_definition: '(class_definition name: (identifier) @name)',
    trait_definition: '(trait_definition name: (identifier) @name)',
    object_definition: '(object_definition name: (identifier) @name)',
    function_definition: '(function_definition name: (identifier) @name)',
    val_definition: '(val_definition name: (identifier) @name)',
    var_definition: '(var_definition name: (identifier) @name)',
  },
  typeMap: {
    class_definition: SymbolType.Class,
    trait_definition: SymbolType.Trait,
    object_definition: SymbolType.Object,
    enum_definition: SymbolType.Enum,
    function_definition: SymbolType.Function,
    method_definition: SymbolType.Method,
    val_definition: SymbolType.Constant,
    var_definition: SymbolType.Variable,
    import_declaration: SymbolType.Import,
    package_clause: SymbolType.Package,
  },
  nameNodeTypes: ['identifier'],
  importNodeTypes: ['import_declaration'],
  exportNodeTypes: [],
};

export class ScalaAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Scala'; }
  fileExtensions(): string[] { return ['.scala', '.sc']; }
}
