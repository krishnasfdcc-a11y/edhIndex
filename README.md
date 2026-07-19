# EDHIndex

[![npm version](https://img.shields.io/npm/v/edhindex.svg)](https://www.npmjs.com/package/edhindex)

Local-first hybrid code search engine with Knowledge Graph — zero telemetry, fully offline.

```sh
npm install -g edhindex
# or
npx edhindex <command>
```

## Quick start

```sh
cd ~/your-project
edhindex init     # initialize index (pick your model + MCP client)
edhindex start    # build index + start MCP server + watch for changes
```

Then ask any MCP client (OpenCode, Claude Code, Cline, Cursor, etc.) to search your codebase.

---

## Supported file types

EDHIndex uses a pluggable **Language Adapter** architecture. Every language has its own adapter file. To add a new language, just create one adapter — no changes to the core engine.

### Tier 1 — Full symbol extraction

| Language | Key | Extensions | Symbols indexed |
|----------|-----|-----------|----------------|
| TypeScript | `ts` | `.ts`, `.tsx`, `.mts`, `.cts` | functions, methods, classes, interfaces, enums |
| JavaScript | `js` | `.js`, `.jsx`, `.mjs`, `.cjs` | functions, methods, classes |
| Python | `py` | `.py`, `.pyw` | functions, classes |
| Go | `go` | `.go` | functions, methods |
| Rust | `rs` | `.rs` | functions, structs, traits, enums |
| Java | `java` | `.java` | methods, classes, interfaces, enums |
| Ruby | `rb` | `.rb` | methods, classes, modules |
| C | `c` | `.c`, `.h` | functions, structs |
| C++ | `cpp` | `.cpp`, `.cxx`, `.cc`, `.c++`, `.hpp`, `.hxx`, `.hh` | functions, classes, structs, enums |
| C# | `csharp` | `.cs` | methods, classes, interfaces, structs, enums |
| PHP | `php` | `.php` | functions, methods, classes, interfaces |

### Tier 2 — Structural support (no symbol extraction, still chunked & searchable)

| Language | Key | Extensions | What gets extracted |
|----------|-----|-----------|-------------------|
| HTML | `html` | `.html`, `.htm` | significant elements (section, nav, header, etc.) |
| CSS | `css` | `.css`, `.scss`, `.less` | rule selectors |
| JSON | `json` | `.json` | object keys |

### Generic fallback

Any file with an unrecognized (non-binary) extension goes through the **GenericAdapter** — splits content by paragraphs, indexes as plain text. Never crashes.

### Not yet available (no WASM grammar on npm)

Swift, Kotlin, Dart, Scala, Haskell, Solidity, Elm, Lua, YAML, TOML, SQL, Markdown

These can be added later without modifying the indexer — just create an adapter.

### General rules

- Each file is parsed by its **Language Adapter** (tree-sitter WASM for Tier 1/2, paragraph splitter for generic)
- Files larger than **10 MB** are skipped
- Binary files are skipped
- Generated files (`*.min.js`, `*.min.css`, `*.generated.ts`, `*.g.ts`, `package.json`, `tsconfig.json`) are skipped

## What gets ignored

EDHIndex uses three layers of filtering. **Every file must pass all three** to be indexed.

### Layer 1: Default ignore patterns

Directories and files ignored by default (no need for a `.edhindexignore`):

```
Directories:         node_modules, .git, dist, build, coverage, .next,
                     out, vendor, bin, obj, target, tmp, .cache, .turbo,
                     .edhindex

Binaries:            *.exe, *.dll, *.so, *.dylib, *.bin, *.wasm
                     *.o, *.a, *.lib

Images/Media:        *.png, *.jpg, *.jpeg, *.gif, *.svg, *.ico, *.webp,
                     *.bmp, *.tiff

Docs/Archives:       *.pdf, *.doc, *.docx, *.xls, *.xlsx, *.ppt, *.pptx
                     *.zip, *.tar, *.gz, *.bz2, *.7z, *.rar

Audio/Video:         *.mp3, *.wav, *.flac, *.ogg
                     *.mp4, *.avi, *.mov, *.wmv, *.flv, *.mkv

Generated/Minified:  *.min.js, *.min.css
                     package-lock.json, yarn.lock, pnpm-lock.yaml

Language artifacts:  *.pyc, *.class, *.jar, *.war
```

### Layer 2: `.edhindexignore`

Add a `.edhindexignore` file at your project root with additional glob patterns. Supports `#` comments and `!` negation (to re-include a pattern).

Example:
```
# ignore generated code
src/generated/
*.generated.ts
```

### Layer 3: Binary + size gate

Files are checked against a blocklist of binary/media/archive extensions and must be under 10 MB.

---

## Indexing modes

EDHIndex has **three indexing strategies** that work together:

### 1. Full index

Scans **every file** from scratch. Runs when no index exists yet, or when the embedding model or chunk schema changes. The full pipeline:

```
File → tree-sitter parse → extract symbols → chunk (~512 tokens) →
  → SQLite metadata + FTS5 (keyword) → LanceDB vectors (semantic) → Graph (SQLite)
```

### 2. Incremental index

Compares file hashes against the previous index. Only **added, modified, or removed** files are re-processed. Used by `edhindex index` when an existing compatible index is found.

### 3. Live file watcher

When `edhindex start` runs (and `watch: true` in config, which is the default), chokidar watches the filesystem. On every save — removes old chunks for the file, re-parses, re-indexes. Debounced at 300ms.

---

## Search pipeline

```
     User query
         ↓
   ┌────────────────┐
   │  Keyword (BM25) │── SQLite FTS5 → top 30
   └────────────────┘
   ┌────────────────┐
   │  Vector (ANN)   │── transformers.js → LanceDB → top 30
   └────────────────┘
         ↓
   ┌────────────────┐
   │  Deduplicate    │── max score for duplicates
   └────────────────┘
         ↓
   ┌────────────────┐
   │  Reranker       │── cross-encoder → final top N
   └────────────────┘
         ↓
     Results with matchType: keyword | vector | hybrid
```

- **Keyword**: SQLite FTS5 with BM25 scoring (porter + unicode61 tokenizer)
- **Semantic**: `@huggingface/transformers` embeddings → LanceDB ANN search
- **Hybrid**: top 30 BM25 + top 30 vectors → deduplicate → rerank → top 10
- **Reranker**: `Xenova/ms-marco-MiniLM-L-6-v2` cross-encoder (configurable via `edhindex config`)

### Embedding model tiers

| Tier | Model | Dimensions | Download size |
|------|-------|-----------|--------------|
| `light` | all-MiniLM-L6-v2 | 384 | ~46 MB |
| `balanced` (default) | bge-base-en-v1.5 | 768 | ~109 MB |
| `max` | bge-m3 | 1024 | ~1.1 GB |

Switch with `edhindex config model <tier>`.

---

## Knowledge Graph

Every symbol becomes a node. Imports, exports, and hierarchy become edges. Four graph modes (switch in the UI):

| View | Description |
|------|-------------|
| **Force** | Physics-based node layout |
| **Hierarchy** | Directory tree structure |
| **Circle** | Circular arrangement |
| **Grid** | Grid layout |

### Commands

```
edhindex kg --rebuild    Build the knowledge graph from the index
edhindex kg --stats      Node/edge counts by type
edhindex kg --serve      Open interactive browser at localhost
edhindex kg --write      Write standalone HTML → .edhindex/knowledge-graph.html
```

Built on tree-sitter + SQLite + Cytoscape.js — all local, no telemetry, no cloud.

### Node/edge types

**Node kinds**: `workspace`, `folder`, `file`, `module`, `class`, `interface`, `enum`, `struct`, `trait`, `function`, `method`, `variable`, `constant`, `property`, `import`, `export`, `namespace`

**Edge kinds**: `contains`, `imports`, `exports`, `inherits`, `implements`, `calls`, `references`, `defines`, `belongs_to`

---

## Commands

| Command | What it does |
|---------|-------------|
| `edhindex init` | Initialize `.edhindex/` — pick model + MCP client |
| `edhindex start` | Full build + MCP server + file watcher |
| `edhindex index` | Just build/update the index (no server) |
| `edhindex search <query>` | CLI hybrid search |
| `edhindex status` | Index stats |
| `edhindex config` | View/update settings |
| `edhindex models` | List available embedding models |
| `edhindex kg ...` | Knowledge graph operations |
| `edhindex graph` | Static SVG dependency graph |
| `edhindex doctor` | Diagnostics (10 checks) |
| `edhindex reset` | Delete the entire `.edhindex/` |

---

## MCP Tools

When `edhindex start` is running, any MCP client can call:

| Tool | What it does |
|------|-------------|
| `search_codebase` | Hybrid search with file/language filters |
| `get_graph` | Full knowledge graph (nodes + edges) |
| `get_node` | Node details + neighbors |
| `search_graph` | Search nodes by name |
| `get_graph_stats` | Graph statistics |

### Client setup

During `edhindex init`, pick your MCP client and the config file is created automatically:

- **OpenCode** → `opencode.json`
- **Cline** → `.cline/mcp.json`
- **Roo Code** → `.roo/mcp.json`
- **Claude Code** → `claude.jsonc`
- **Cursor** → `.cursor/mcp.json`
- **Windsurf** → `.windsurf/mcp_config.json`
- **GitHub Copilot** → `.vscode/settings.json`
- **Continue** → `.continue/config.json`

---

## Requirements

- Node.js 18+

## License

MIT
