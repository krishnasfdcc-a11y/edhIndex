import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'haskell',
  wasmPath: new URL('../../node_modules/tree-sitter-haskell/tree-sitter-haskell.wasm', import.meta.url).pathname,
  queryPatterns: {
    data_declaration: '(data_declaration name: (type) @name)',
    type_declaration: '(type_declaration name: (type) @name)',
    class_declaration: '(class_declaration name: (type) @name)',
    instance_declaration: '(instance_declaration type: (type) @name)',
    function_declaration: '(function name: (variable) @name)',
  },
  typeMap: {
    data_declaration: SymbolType.Struct,
    type_declaration: SymbolType.TypeAlias,
    class_declaration: SymbolType.Interface,
    instance_declaration: SymbolType.Object,
    function_declaration: SymbolType.Function,
    import_declaration: SymbolType.Import,
    module_declaration: SymbolType.Module,
  },
  nameNodeTypes: ['variable', 'type'],
  importNodeTypes: ['import_declaration'],
  exportNodeTypes: [],
};

export class HaskellAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Haskell'; }
  fileExtensions(): string[] { return ['.hs', '.lhs']; }
}
