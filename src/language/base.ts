import { createRequire } from 'node:module';
import { Parser, Language } from 'web-tree-sitter';
import { SymbolType, CodeSymbol, ParseResult, LanguageAdapter } from './types.js';

const require = createRequire(import.meta.url);

export interface GrammarConfig {
  language: string;
  wasmPath: string;
  queryPatterns: Record<string, string>;
  typeMap: Record<string, SymbolType>;
  nameNodeTypes: string[];
  importNodeTypes: string[];
  exportNodeTypes: string[];
}

export abstract class BaseTreeSitterAdapter implements LanguageAdapter {
  protected abstract grammar: GrammarConfig;
  protected parser: Parser | null = null;
  protected loadedLang: any = null;
  private static initialized = false;
  private static loadedGrammars = new Map<string, any>();

  abstract languageName(): string;
  abstract fileExtensions(): string[];
  fileNames(): string[] { return []; }

  canParse(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    for (const ext of this.fileExtensions()) {
      if (lower.endsWith(ext)) return true;
    }
    for (const name of this.fileNames()) {
      if (lower === name || lower.endsWith('/' + name)) return true;
    }
    return false;
  }

  supportsSymbols(): boolean {
    return Object.keys(this.grammar.queryPatterns).length > 0;
  }

  async loadGrammar(): Promise<void> {
    const key = this.grammar.language;
    if (BaseTreeSitterAdapter.loadedGrammars.has(key)) {
      this.loadedLang = BaseTreeSitterAdapter.loadedGrammars.get(key);
      return;
    }
    if (!BaseTreeSitterAdapter.initialized) {
      await Parser.init();
      BaseTreeSitterAdapter.initialized = true;
    }
    const lang = await Language.load(this.grammar.wasmPath);
    BaseTreeSitterAdapter.loadedGrammars.set(key, lang);
    this.loadedLang = lang;
    this.parser = new Parser();
    this.parser.setLanguage(lang);
  }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    if (!this.parser) await this.loadGrammar();

    const tree = this.parser!.parse(content);
    const symbols = await this.extractSymbolsFromTree(tree, filePath, content);
    const imports = this.extractImportsFromTree(tree);
    const exports = this.extractExportsFromTree(tree);
    const comments = this.extractCommentsFromTree(tree);

    return { symbols, imports, exports, comments };
  }

  protected async extractSymbolsFromTree(tree: any, filePath: string, content: string): Promise<CodeSymbol[]> {
    const symbols: CodeSymbol[] = [];
    if (Object.keys(this.grammar.queryPatterns).length === 0) return symbols;
    this.walkForSymbols(tree.rootNode, symbols, filePath, '');
    return symbols;
  }

  protected walkForSymbols(node: any, symbols: CodeSymbol[], filePath: string, parentId: string): void {
    const type = node.type;
    const symbolType = this.grammar.typeMap[type];

    if (symbolType) {
      const name = this.extractName(node);
      if (name) {
        symbols.push({
          id: `${filePath}:${node.startPosition.row + 1}`,
          name,
          type: symbolType,
          language: this.grammar.language,
          file: filePath,
          startLine: node.startPosition.row + 1,
          endLine: node.endPosition.row + 1,
          parent: parentId || null,
          children: [],
          metadata: {},
        });
      }
    }

    for (let i = 0; i < node.childCount; i++) {
      const childNode = node.child(i);
      if (childNode) {
        this.walkForSymbols(childNode, symbols, filePath, '');
      }
    }
  }

  protected extractName(node: any): string | null {
    try {
      const nameTypes = new Set([
        'identifier', 'property_identifier', 'type_identifier',
        'field_identifier', 'constant', 'variable', 'name', 'type',
        'selector', 'class_name', 'function_name', 'method_name',
      ]);
      return this.findName(node, nameTypes);
    } catch {
      return null;
    }
  }

  private findName(node: any, nameTypes: Set<string>): string | null {
    if (nameTypes.has(node.type)) {
      return node.text;
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) {
        const result = this.findName(child, nameTypes);
        if (result) return result;
      }
    }
    return null;
  }

  protected extractImportsFromTree(tree: any): string[] {
    const imports: string[] = [];
    const importTypes = this.grammar.importNodeTypes;
    if (importTypes.length === 0) return imports;
    this.collectNodesOfType(tree.rootNode, importTypes, imports);
    return imports;
  }

  protected extractExportsFromTree(tree: any): string[] {
    const exports: string[] = [];
    const exportTypes = this.grammar.exportNodeTypes;
    if (exportTypes.length === 0) return exports;
    this.collectNodesOfType(tree.rootNode, exportTypes, exports);
    return exports;
  }

  protected extractCommentsFromTree(tree: any): string[] {
    const comments: string[] = [];
    this.collectNodesOfType(tree.rootNode, ['comment', 'block_comment', 'line_comment'], comments);
    return comments;
  }

  private collectNodesOfType(node: any, types: string[], results: string[]) {
    if (types.includes(node.type)) {
      results.push(node.text || '');
    }
    for (let i = 0; i < node.childCount; i++) {
      const child = node.child(i);
      if (child) this.collectNodesOfType(child, types, results);
    }
  }
}
