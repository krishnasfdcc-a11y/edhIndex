import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { logger } from '../logging.js';

const require = createRequire(import.meta.url);

import { Parser, Language } from 'web-tree-sitter';

let initialized = false;
const loadedLanguages = new Map<string, any>();

export interface ASTNode {
  type: string;
  startLine: number;
  endLine: number;
  startCol: number;
  endCol: number;
  text: string;
  children: ASTNode[];
}

export async function initParser() {
  if (initialized) return;
  await Parser.init();
  initialized = true;
}

export async function loadLanguage(language: string): Promise<any> {
  if (loadedLanguages.has(language)) {
    return loadedLanguages.get(language)!;
  }

  let wasmPath: string;

  switch (language) {
    case 'ts':
    case 'js':
      wasmPath = require.resolve('tree-sitter-typescript/tree-sitter-typescript.wasm');
      break;
    case 'py':
      wasmPath = require.resolve('tree-sitter-python/tree-sitter-python.wasm');
      break;
    case 'go':
      wasmPath = require.resolve('tree-sitter-go/tree-sitter-go.wasm');
      break;
    case 'rs':
      wasmPath = require.resolve('tree-sitter-rust/tree-sitter-rust.wasm');
      break;
    case 'java':
      wasmPath = require.resolve('tree-sitter-java/tree-sitter-java.wasm');
      break;
    case 'rb':
      wasmPath = require.resolve('tree-sitter-ruby/tree-sitter-ruby.wasm');
      break;
    case 'c':
      wasmPath = require.resolve('tree-sitter-c/tree-sitter-c.wasm');
      break;
    case 'cpp':
      wasmPath = require.resolve('tree-sitter-cpp/tree-sitter-cpp.wasm');
      break;
    case 'csharp':
      wasmPath = require.resolve('tree-sitter-c-sharp/tree-sitter-c_sharp.wasm');
      break;
    case 'php':
      wasmPath = require.resolve('tree-sitter-php/tree-sitter-php.wasm');
      break;
    case 'scala':
      wasmPath = require.resolve('tree-sitter-scala/tree-sitter-scala.wasm');
      break;
    case 'hs':
      wasmPath = require.resolve('tree-sitter-haskell/tree-sitter-haskell.wasm');
      break;
    case 'dart':
      wasmPath = require.resolve('tree-sitter-dart/tree-sitter-dart.wasm');
      break;
    case 'solidity':
      wasmPath = require.resolve('tree-sitter-solidity/tree-sitter-solidity.wasm');
      break;
    case 'css':
      wasmPath = require.resolve('tree-sitter-css/tree-sitter-css.wasm');
      break;
    case 'json':
      wasmPath = require.resolve('tree-sitter-json/tree-sitter-json.wasm');
      break;
    case 'html':
      wasmPath = require.resolve('tree-sitter-html/tree-sitter-html.wasm');
      break;
    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  const lang = await Language.load(wasmPath);
  loadedLanguages.set(language, lang);

  return lang;
}

function langKey(language: string): string {
  if (language === 'ts' || language === 'js') return 'ts';
  if (language === 'c' || language === 'cpp') return 'c-like';
  return language;
}

export function parseFile(filePath: string, language: string): any {
  const content = readFileSync(filePath, 'utf-8');
  return parseContent(content, language);
}

function parseContent(content: string, _language?: string): never {
  throw new Error('Use parseContentAsync for async parsing');
}

export async function parseContentAsync(content: string, language: string): Promise<{ tree: any; rootNode: ASTNode }> {
  const lk = langKey(language);
  const lang = loadedLanguages.get(language) || loadedLanguages.get(lk);
  if (!lang) {
    throw new Error(`Language not loaded: ${language}`);
  }
  const parser = new Parser();
  parser.setLanguage(lang);
  const tree = parser.parse(content);
  if (!tree) {
    throw new Error('Failed to parse content');
  }
  const rootNode = convertNode(tree.rootNode);
  return { tree, rootNode };
}

export function getNodeText(node: any): string {
  return node.text;
}

export function getChildCount(node: any): number {
  return node.childCount;
}

export function getChild(node: any, index: number): any {
  return node.child(index);
}

function convertNode(node: any): ASTNode {
  return {
    type: node.type,
    startLine: node.startPosition.row + 1,
    endLine: node.endPosition.row + 1,
    startCol: node.startPosition.column,
    endCol: node.endPosition.column,
    text: node.text || '',
    children: [],
  };
}

export interface SymbolInfo {
  name: string;
  kind: 'function' | 'method' | 'class' | 'interface' | 'enum' | 'module';
  startLine: number;
  endLine: number;
  text: string;
}

const QUERY_PATTERNS: Record<string, Record<string, string>> = {
  ts: {
    function: '(function_declaration name: (identifier) @name)',
    method: '(method_definition name: (property_identifier) @name)',
    class: '(class_declaration name: (type_identifier) @name)',
    interface: '(interface_declaration name: (type_identifier) @name)',
    enum: '(enum_declaration name: (type_identifier) @name)',
  },
  js: {
    function: '(function_declaration name: (identifier) @name)',
    method: '(method_definition name: (property_identifier) @name)',
    class: '(class_declaration name: (identifier) @name)',
  },
  py: {
    function: '(function_definition name: (identifier) @name)',
    class: '(class_definition name: (identifier) @name)',
  },
  go: {
    function: '(function_declaration name: (identifier) @name)',
    method: '(method_declaration name: (field_identifier) @name)',
  },
  rs: {
    function: '(function_item name: (identifier) @name)',
    struct: '(struct_item name: (type_identifier) @name)',
    trait: '(trait_item name: (type_identifier) @name)',
    impl: '(impl_item trait: (type_identifier) @name)',
    enum: '(enum_item name: (type_identifier) @name)',
  },
  java: {
    method: '(method_declaration name: (identifier) @name)',
    class: '(class_declaration name: (identifier) @name)',
    interface: '(interface_declaration name: (identifier) @name)',
    enum: '(enum_declaration name: (identifier) @name)',
  },
  rb: {
    method: '(method name: (identifier) @name)',
    class: '(class name: (constant) @name)',
    module: '(module name: (constant) @name)',
  },
  c: {
    function: '(function_definition declarator: (function_declarator declarator: (identifier) @name))',
    struct: '(struct_specifier name: (type_identifier) @name)',
  },
  cpp: {
    function: '(function_definition declarator: (function_declarator declarator: (identifier) @name))',
    method: '(function_definition declarator: (function_declarator declarator: (field_identifier) @name))',
    class: '(class_specifier name: (type_identifier) @name)',
    struct: '(struct_specifier name: (type_identifier) @name)',
    enum: '(enum_specifier name: (type_identifier) @name)',
  },
  csharp: {
    method: '(method_declaration name: (identifier) @name)',
    class: '(class_declaration name: (identifier) @name)',
    interface: '(interface_declaration name: (identifier) @name)',
    struct: '(struct_declaration name: (identifier) @name)',
    enum: '(enum_declaration name: (identifier) @name)',
  },
  php: {
    function: '(function_definition name: (name) @name)',
    method: '(method_declaration name: (name) @name)',
    class: '(class_declaration name: (name) @name)',
    interface: '(interface_declaration name: (name) @name)',
  },
  scala: {
    function: '(function_definition name: (identifier) @name)',
    class: '(class_definition name: (identifier) @name)',
    trait: '(trait_definition name: (identifier) @name)',
    object: '(object_definition name: (identifier) @name)',
    enum: '(enum_definition name: (identifier) @name)',
  },
  hs: {
    function: '(function name: (variable) @name)',
    class: '(class name: (type) @name)',
  },
  dart: {
    method: '(method_declaration name: (identifier) @name)',
    function: '(function_declaration name: (identifier) @name)',
    class: '(class_declaration name: (identifier) @name)',
    enum: '(enum_declaration name: (identifier) @name)',
  },
  solidity: {
    function: '(function_definition name: (identifier) @name)',
    event: '(event_definition name: (identifier) @name)',
    error: '(error_definition name: (identifier) @name)',
    modifier: '(modifier_definition name: (identifier) @name)',
  },
  css: {
    rule: '(rule_set selectors: (selectors) @name)',
  },
};

export function extractSymbols(tree: any, language: string): SymbolInfo[] {
  const symbols: SymbolInfo[] = [];
  const patterns = QUERY_PATTERNS[language];
  if (!patterns) return symbols;

  const rootNode = tree.rootNode;
  walkTree(rootNode, symbols, language);
  return symbols;
}

function walkTree(node: any, symbols: SymbolInfo[], language: string) {
  const kind = nodeTypeToKind(node.type, language);
  if (kind) {
    const name = extractName(node, language);
    symbols.push({
      name: name || `anonymous_${kind}_${node.startPosition.row + 1}`,
      kind,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      text: node.text || '',
    });
  }

  for (let i = 0; i < node.childCount; i++) {
    walkTree(node.child(i), symbols, language);
  }
}

function nodeTypeToKind(type: string, language: string): SymbolInfo['kind'] | null {
  switch (language) {
    case 'ts':
    case 'js':
      switch (type) {
        case 'function_declaration': return 'function';
        case 'arrow_function': return 'function';
        case 'method_definition': return 'method';
        case 'class_declaration': return 'class';
        case 'interface_declaration': return 'interface';
        case 'enum_declaration': return 'enum';
        default: return null;
      }
    case 'py':
      switch (type) {
        case 'function_definition': return 'function';
        case 'class_definition': return 'class';
        default: return null;
      }
    case 'go':
      switch (type) {
        case 'function_declaration': return 'function';
        case 'method_declaration': return 'method';
        default: return null;
      }
    case 'rs':
      switch (type) {
        case 'function_item': return 'function';
        case 'struct_item': return 'class';
        case 'trait_item': return 'interface';
        case 'impl_item': return 'module';
        case 'enum_item': return 'enum';
        default: return null;
      }
    case 'java':
      switch (type) {
        case 'method_declaration': return 'method';
        case 'class_declaration': return 'class';
        case 'interface_declaration': return 'interface';
        case 'enum_declaration': return 'enum';
        default: return null;
      }
    case 'rb':
      switch (type) {
        case 'method': return 'method';
        case 'class': return 'class';
        case 'module': return 'module';
        default: return null;
      }
    case 'c':
      switch (type) {
        case 'function_definition': return 'function';
        case 'struct_specifier': return 'class';
        default: return null;
      }
    case 'cpp':
      switch (type) {
        case 'function_definition': return 'function';
        case 'class_specifier': return 'class';
        case 'struct_specifier': return 'class';
        case 'enum_specifier': return 'enum';
        default: return null;
      }
    case 'csharp':
      switch (type) {
        case 'method_declaration': return 'method';
        case 'class_declaration': return 'class';
        case 'interface_declaration': return 'interface';
        case 'struct_declaration': return 'class';
        case 'enum_declaration': return 'enum';
        default: return null;
      }
    case 'php':
      switch (type) {
        case 'function_definition': return 'function';
        case 'method_declaration': return 'method';
        case 'class_declaration': return 'class';
        case 'interface_declaration': return 'interface';
        default: return null;
      }
    case 'scala':
      switch (type) {
        case 'function_definition': return 'function';
        case 'class_definition': return 'class';
        case 'trait_definition': return 'interface';
        case 'object_definition': return 'module';
        case 'enum_definition': return 'enum';
        default: return null;
      }
    case 'hs':
      switch (type) {
        case 'function': return 'function';
        case 'class': return 'interface';
        default: return null;
      }
    case 'dart':
      switch (type) {
        case 'method_declaration': return 'method';
        case 'function_declaration': return 'function';
        case 'class_declaration': return 'class';
        case 'enum_declaration': return 'enum';
        default: return null;
      }
    case 'solidity':
      switch (type) {
        case 'function_definition': return 'function';
        case 'event_definition': return 'function';
        case 'error_definition': return 'function';
        case 'modifier_definition': return 'method';
        default: return null;
      }
    case 'css':
      if (type === 'rule_set') return 'module';
      return null;
    default:
      return null;
  }
}

function extractName(node: any, language: string): string | null {
  try {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      const nameTypes = new Set([
        'identifier', 'property_identifier', 'type_identifier',
        'field_identifier', 'constant', 'variable', 'name', 'type',
      ]);
      if (nameTypes.has(child.type)) {
        return child.text;
      }
      if (language === 'css' && child.type === 'selectors') {
        return child.text?.split(',')[0]?.trim() || null;
      }
    }
  } catch {
    // ignore
  }
  return null;
}

export function extractImports(tree: any, language: string): string[] {
  const imports: string[] = [];
  const rootNode = tree.rootNode;
  collectImports(rootNode, imports, language);
  return imports;
}

function collectImports(node: any, imports: string[], language: string) {
  if (node.type === 'import_statement' || node.type === 'import_declaration' ||
      node.type === 'import_from_statement' || node.type === 'require_statement' ||
      (language === 'py' && node.type === 'import_statement') ||
      (language === 'py' && node.type === 'import_from_statement') ||
      (language === 'go' && node.type === 'import_declaration') ||
      (language === 'go' && node.type === 'import_spec')) {
    imports.push(node.text || '');
  }
  for (let i = 0; i < node.childCount; i++) {
    collectImports(node.child(i), imports, language);
  }
}

export function extractExports(tree: any, language: string): string[] {
  const exports: string[] = [];
  const rootNode = tree.rootNode;
  collectExports(rootNode, exports, language);
  return exports;
}

function collectExports(node: any, exports: string[], language: string) {
  if (language === 'ts' || language === 'js') {
    if (node.type === 'export_statement') {
      for (let i = 0; i < node.childCount; i++) {
        const child = node.child(i);
        if (child.type === 'function_declaration' || child.type === 'class_declaration' ||
            child.type === 'variable_declaration' || child.type === 'interface_declaration' ||
            child.type === 'type_alias_declaration') {
          exports.push(child.text || '');
        }
      }
    }
  }
  for (let i = 0; i < node.childCount; i++) {
    collectExports(node.child(i), exports, language);
  }
}
