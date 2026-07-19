import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'lua',
  wasmPath: new URL('../../node_modules/tree-sitter-wasms/out/tree-sitter-lua.wasm', import.meta.url).pathname,
  queryPatterns: {
    function_declaration: '(function_declaration name: (identifier) @name)',
    local_function_declaration: '(local_function_declaration name: (identifier) @name)',
    method_definition: '(method_definition name: (identifier) @name)',
    variable_declaration: '(variable_declaration name: (identifier) @name)',
  },
  typeMap: {
    function_declaration: SymbolType.Function,
    local_function_declaration: SymbolType.Function,
    method_definition: SymbolType.Method,
    variable_declaration: SymbolType.Variable,
    local_variable_declaration: SymbolType.Variable,
    table_constructor: SymbolType.Struct,
    require_statement: SymbolType.Import,
  },
  nameNodeTypes: ['identifier'],
  importNodeTypes: ['require_statement'],
  exportNodeTypes: [],
};

export class LuaAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Lua'; }
  fileExtensions(): string[] { return ['.lua']; }
}
