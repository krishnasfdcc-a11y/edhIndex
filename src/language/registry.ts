import { LanguageAdapter, AdapterInfo } from './types.js';
import { TypeScriptAdapter } from './adapters/typescript.js';
import { JavaScriptAdapter } from './adapters/javascript.js';
import { PythonAdapter } from './adapters/python.js';
import { GoAdapter } from './adapters/go.js';
import { RustAdapter } from './adapters/rust.js';
import { JavaAdapter } from './adapters/java.js';
import { RubyAdapter } from './adapters/ruby.js';
import { CAdapter } from './adapters/c.js';
import { CppAdapter } from './adapters/cpp.js';
import { CSharpAdapter } from './adapters/csharp.js';
import { PhpAdapter } from './adapters/php.js';
import { HtmlAdapter } from './adapters/html.js';
import { CssAdapter } from './adapters/css.js';
import { JsonAdapter } from './adapters/json.js';
import { SwiftAdapter } from './adapters/swift.js';
import { KotlinAdapter } from './adapters/kotlin.js';
import { DartAdapter } from './adapters/dart.js';
import { ScalaAdapter } from './adapters/scala.js';
import { HaskellAdapter } from './adapters/haskell.js';
import { SolidityAdapter } from './adapters/solidity.js';
import { LuaAdapter } from './adapters/lua.js';
import { YamlAdapter } from './adapters/yaml.js';
import { TomlAdapter } from './adapters/toml.js';
import { SqlAdapter } from './adapters/sql.js';
import { MarkdownAdapter } from './adapters/markdown.js';
import { XmlAdapter } from './adapters/xml.js';
import { VueAdapter } from './adapters/vue.js';
import { SvelteAdapter } from './adapters/svelte.js';
import { TerraformAdapter } from './adapters/terraform.js';
import { DockerfileAdapter } from './adapters/dockerfile.js';
import { SalesforceAdapter } from './adapters/salesforce.js';
import { CsvAdapter } from './adapters/csv.js';
import { JsonVariantsAdapter } from './adapters/json-variants.js';
import { ConfigAdapter } from './adapters/config.js';
import { DocumentationAdapter } from './adapters/documentation.js';
import { SvgAdapter } from './adapters/svg.js';
import { TextAdapter } from './adapters/text.js';
import { AstroAdapter } from './adapters/astro.js';
import { GenericAdapter } from './generic.js';

export type AdapterEntry = {
  key: string;
  adapter: LanguageAdapter;
  tier: 1 | 2 | 3;
};

export class LanguageRegistry {
  private adapters: AdapterEntry[] = [];
  private extMap: Map<string, AdapterEntry> = new Map();
  private nameMap: Map<string, AdapterEntry> = new Map();
  private generic: GenericAdapter;

  constructor() {
    this.generic = new GenericAdapter();
    this.registerDefaults();
  }

  private registerDefaults() {
    // Tier 1: Full symbol extraction (programming languages)
    this.register('ts', new TypeScriptAdapter(), 1);
    this.register('js', new JavaScriptAdapter(), 1);
    this.register('py', new PythonAdapter(), 1);
    this.register('go', new GoAdapter(), 1);
    this.register('rs', new RustAdapter(), 1);
    this.register('java', new JavaAdapter(), 1);
    this.register('rb', new RubyAdapter(), 1);
    this.register('c', new CAdapter(), 1);
    this.register('cpp', new CppAdapter(), 1);
    this.register('csharp', new CSharpAdapter(), 1);
    this.register('php', new PhpAdapter(), 1);
    this.register('swift', new SwiftAdapter(), 1);
    this.register('kotlin', new KotlinAdapter(), 1);
    this.register('dart', new DartAdapter(), 1);
    this.register('scala', new ScalaAdapter(), 1);
    this.register('haskell', new HaskellAdapter(), 1);
    this.register('solidity', new SolidityAdapter(), 1);
    this.register('lua', new LuaAdapter(), 1);
    
    // Tier 2: Structural extraction (markup, config, data)
    this.register('html', new HtmlAdapter(), 2);
    this.register('css', new CssAdapter(), 2);
    this.register('json', new JsonAdapter(), 2);
    this.register('yaml', new YamlAdapter(), 2);
    this.register('toml', new TomlAdapter(), 2);
    this.register('sql', new SqlAdapter(), 2);
    this.register('markdown', new MarkdownAdapter(), 2);
    
    // Tier 2: Additional markup and config languages
    this.register('xml', new XmlAdapter(), 2);
    this.register('vue', new VueAdapter(), 2);
    this.register('svelte', new SvelteAdapter(), 2);
    this.register('terraform', new TerraformAdapter(), 2);
    this.register('dockerfile', new DockerfileAdapter(), 2);
    this.register('salesforce', new SalesforceAdapter(), 2);
    this.register('csv', new CsvAdapter(), 2);
    this.register('json-variants', new JsonVariantsAdapter(), 2);
    this.register('config', new ConfigAdapter(), 2);
    this.register('documentation', new DocumentationAdapter(), 2);
    this.register('svg', new SvgAdapter(), 2);
    this.register('text', new TextAdapter(), 2);
    this.register('astro', new AstroAdapter(), 2);
  }

  register(key: string, adapter: LanguageAdapter, tier: 1 | 2 | 3) {
    const entry: AdapterEntry = { key, adapter, tier };
    this.adapters.push(entry);
    for (const ext of adapter.fileExtensions()) {
      const lower = ext.toLowerCase();
      if (!this.extMap.has(lower)) {
        this.extMap.set(lower, entry);
      }
    }
    for (const name of adapter.fileNames()) {
      const lower = name.toLowerCase();
      if (!this.nameMap.has(lower)) {
        this.nameMap.set(lower, entry);
      }
    }
  }

  getAdapter(filePath: string): { adapter: LanguageAdapter; key: string } {
    const lower = filePath.toLowerCase();
    const fileName = lower.split('/').pop() || lower;

    const nameEntry = this.nameMap.get(fileName);
    if (nameEntry) return { adapter: nameEntry.adapter, key: nameEntry.key };

    for (const [ext, entry] of this.extMap) {
      if (lower.endsWith(ext)) return { adapter: entry.adapter, key: entry.key };
    }

    return { adapter: this.generic, key: 'generic' };
  }

  getAdapterByKey(key: string): { adapter: LanguageAdapter; key: string } | null {
    const entry = this.adapters.find(a => a.key === key);
    if (!entry) return null;
    return { adapter: entry.adapter, key: entry.key };
  }

  getAllAdapters(): AdapterEntry[] {
    return [...this.adapters];
  }

  getInfoList(): AdapterInfo[] {
    return this.adapters.map(a => ({
      key: a.key,
      name: a.adapter.languageName(),
      extensions: a.adapter.fileExtensions(),
      tier: a.tier,
      supportsSymbols: a.adapter.supportsSymbols(),
    }));
  }

  getExtensionsForKeys(keys: string[]): string[] {
    const exts: string[] = [];
    for (const key of keys) {
      const entry = this.adapters.find(a => a.key === key);
      if (entry) exts.push(...entry.adapter.fileExtensions());
    }
    return exts;
  }

  async initialize(keys: string[]): Promise<void> {
    for (const key of keys) {
      const entry = this.adapters.find(a => a.key === key);
      if (entry && entry.adapter instanceof (await import('./base.js')).BaseTreeSitterAdapter) {
        try {
          await (entry.adapter as any).loadGrammar();
        } catch (e) {
          // grammar load failure is non-fatal
        }
      }
    }
  }
}

export const defaultRegistry = new LanguageRegistry();
