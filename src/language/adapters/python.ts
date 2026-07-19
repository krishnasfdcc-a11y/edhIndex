import { createRequire } from 'node:module';
import { BaseTreeSitterAdapter, GrammarConfig } from '../base.js';
import { SymbolType } from '../types.js';

const require = createRequire(import.meta.url);

const GRAMMAR: GrammarConfig = {
  language: 'py',
  wasmPath: require.resolve('tree-sitter-python/tree-sitter-python.wasm'),
  queryPatterns: {
    function_definition: '(function_definition name: (identifier) @name)',
    class_definition: '(class_definition name: (identifier) @name)',
  },
  typeMap: {
    function_definition: SymbolType.Function,
    class_definition: SymbolType.Class,
    import_statement: SymbolType.Import,
    import_from_statement: SymbolType.Import,
  },
  nameNodeTypes: ['identifier'],
  importNodeTypes: ['import_statement', 'import_from_statement'],
  exportNodeTypes: [],
};

export class PythonAdapter extends BaseTreeSitterAdapter {
  protected grammar = GRAMMAR;
  languageName(): string { return 'Python'; }
  fileExtensions(): string[] { return ['.py', '.pyw']; }
}
