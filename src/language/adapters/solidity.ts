import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'solidity',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-solidity.wasm', import.meta.url).pathname,
  queryPatterns: {
    contract_declaration: '(contract_declaration name: (identifier) @name)',
    interface_declaration: '(interface_declaration name: (identifier) @name)',
    library_declaration: '(library_declaration name: (identifier) @name)',
    struct_declaration: '(struct_declaration name: (identifier) @name)',
    enum_declaration: '(enum_declaration name: (identifier) @name)',
    event_declaration: '(event_declaration name: (identifier) @name)',
    modifier_definition: '(modifier_definition name: (identifier) @name)',
    function_definition: '(function_definition name: (identifier) @name)',
  },
  typeMap: {
    contract_declaration: SymbolType.Class,
    interface_declaration: SymbolType.Interface,
    library_declaration: SymbolType.Module,
    struct_declaration: SymbolType.Struct,
    enum_declaration: SymbolType.Enum,
    event_declaration: SymbolType.Function,
    modifier_definition: SymbolType.Method,
    constructor_definition: SymbolType.Constructor,
    function_definition: SymbolType.Function,
    state_variable_declaration: SymbolType.Variable,
    import_directive: SymbolType.Import,
  },
  nameNodeTypes: ['identifier'],
  importNodeTypes: ['import_directive'],
  exportNodeTypes: [],
};

export class SolidityAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Solidity'; }
  fileExtensions(): string[] { return ['.sol']; }
}
