import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'rb',
  wasmPath: require.resolve('tree-sitter-ruby/tree-sitter-ruby.wasm'),
  queryPatterns: {
    method: '(method name: (identifier) @name)',
    class: '(class name: (constant) @name)',
    module: '(module name: (constant) @name)',
  },
  typeMap: {
    method: SymbolType.Method,
    class: SymbolType.Class,
    module: SymbolType.Module,
    call: SymbolType.Unknown,
    require: SymbolType.Import,
  },
  nameNodeTypes: ['identifier', 'constant'],
  importNodeTypes: ['require'],
  exportNodeTypes: [],
};

export class RubyAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Ruby'; }
  fileExtensions(): string[] { return ['.rb']; }
}
