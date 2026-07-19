export enum SymbolType {
  Workspace = 'workspace',
  Folder = 'folder',
  File = 'file',
  Module = 'module',
  Namespace = 'namespace',
  Class = 'class',
  Interface = 'interface',
  Enum = 'enum',
  Struct = 'struct',
  Trait = 'trait',
  Function = 'function',
  Method = 'method',
  Variable = 'variable',
  Constant = 'constant',
  Property = 'property',
  Import = 'import',
  Export = 'export',
  Comment = 'comment',
  Unknown = 'unknown',
  Package = 'package',
  Constructor = 'constructor',
  Extension = 'extension',
  Field = 'field',
  TypeAlias = 'type_alias',
  Document = 'document',
  Section = 'section',
  Table = 'table',
  Selector = 'selector',
  Rule = 'rule',
  Actor = 'actor',
  Object = 'object',
  Protocol = 'protocol',
}

export interface CodeSymbol {
  id: string;
  name: string;
  type: SymbolType;
  language: string;
  file: string;
  startLine: number;
  endLine: number;
  parent: string | null;
  children: CodeSymbol[];
  metadata: Record<string, unknown>;
}

export interface ParseResult {
  symbols: CodeSymbol[];
  imports: string[];
  exports: string[];
  comments: string[];
}

export interface LanguageAdapter {
  languageName(): string;
  fileExtensions(): string[];
  fileNames(): string[];
  canParse(filePath: string): boolean;
  parse(content: string, filePath: string): Promise<ParseResult>;
  supportsSymbols(): boolean;
}

export interface AdapterInfo {
  key: string;
  name: string;
  extensions: string[];
  tier: 1 | 2 | 3;
  supportsSymbols: boolean;
}
