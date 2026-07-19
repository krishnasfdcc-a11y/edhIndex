# EDHIndex

Local-first hybrid code search engine with Knowledge Graph — zero telemetry, fully offline.

## Setup

```sh
git clone <repo>
cd edhIndex
npm install        # installs deps + auto-builds
npm link           # makes "edhindex" available globally
```

Then use it in any project:

```sh
cd ~/your-project
edhindex init
edhindex start
```

## Commands

| Command | What it does |
|---|---|
| `edhindex init` | Initialize index in current directory |
| `edhindex start` | Build index + start MCP server |
| `edhindex index` | Build or update the index |
| `edhindex search <query>` | Search the codebase |
| `edhindex status` | Index stats |
| `edhindex kg --rebuild` | Build knowledge graph |
| `edhindex kg --stats` | Graph statistics |
| `edhindex kg --serve` | Interactive graph in browser |
| `edhindex kg --write` | Write graph file for VS Code |
| `edhindex graph` | Static SVG dependency graph |
| `edhindex config` | View/update settings |
| `edhindex doctor` | Diagnostics |
| `edhindex reset` | Delete the index |

## Knowledge Graph

Explore your codebase as an interactive node graph.

```
edhindex kg --serve      # Opens in browser (localhost)
edhindex kg --write      # Writes .edhindex/knowledge-graph.html
                         # → drag into VS Code to view
```

Every symbol becomes a glowing node. Imports, exports, and hierarchy become edges. Click any node for details. Search by name. Switch between Force, Hierarchy, Circle, Grid layouts.

Built on tree-sitter parsing + SQLite + Cytoscape.js — all local, no telemetry, no cloud.

## MCP Tools

When `edhindex start` is running, any MCP client (OpenCode, Claude Code, Cline, etc.) can call:

| Tool | What it does |
|---|---|
| `search_codebase` | Hybrid search (BM25 + vector + rerank) |
| `get_graph` | Full knowledge graph (nodes + edges) |
| `get_node` | Node details with neighbors |
| `search_graph` | Search nodes by name |
| `get_graph_stats` | Graph statistics |

## MCP Client Setup

During `edhindex init`, pick your MCP client and the config file is created automatically:

- **OpenCode** → `opencode.json`
- **Cline** → `.cline/mcp.json`
- **Roo Code** → `.roo/mcp.json`
- **Claude Code** → `claude.jsonc`
- **Cursor** → `.cursor/mcp.json`
- **Windsurf** → `.windsurf/mcp_config.json`
- **GitHub Copilot** → `.vscode/settings.json`
- **Continue** → `.continue/config.json`

## How it works

```
Source code → Tree-sitter → Chunks → SQLite (metadata + FTS5)
                                       → LanceDB (vectors)
                                       → Graph (SQLite)
                                               ↓
                    MCP Server ← Search Engine ← Hybrid Rerank
```

- **Keyword search**: SQLite FTS5 (BM25)
- **Semantic search**: transformers.js embeddings → LanceDB vector search
- **Hybrid**: Top 30 BM25 + top 30 vectors → deduplicate → rerank → top 10
- **Knowledge Graph**: Symbols, files, folders, imports/exports, hierarchy

## Requirements

- Node.js 18+
- npm

## License

MIT
