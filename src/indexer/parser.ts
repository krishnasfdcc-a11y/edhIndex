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
    default:
      throw new Error(`Unsupported language: ${language}`);
  }

  const lang = await Language.load(wasmPath);
  loadedLanguages.set(language, lang);

  return lang;
}

function langKey(language: string): string {
  return language === 'ts' || language === 'js' ? 'ts' : language;
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
    default:
      return null;
  }
}

function extractName(node: any, language: string): string | null {
  try {
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (language === 'ts' || language === 'js') {
        if (child.type === 'identifier' || child.type === 'property_identifier' || child.type === 'type_identifier') {
          return child.text;
        }
      } else if (language === 'py') {
        if (child.type === 'identifier') {
          return child.text;
        }
      } else if (language === 'go') {
        if (child.type === 'identifier' || child.type === 'field_identifier') {
          return child.text;
        }
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
