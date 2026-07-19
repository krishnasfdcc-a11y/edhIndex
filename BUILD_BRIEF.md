# EDHIndex — build brief

## How to use this
Save this file as `BUILD_BRIEF.md` in the repo root. Works with whatever AI coding agent you're using — GitHub Copilot, Claude Code, Cursor, Windsurf, or anything else. Reference it however that tool supports. Build the v1 section fully, end to end, before opening the v2 section — v2 exists so an eager agent doesn't try to build everything at once.

## What this is
EDHIndex is a standalone local tool that indexes a codebase and exposes fast, hybrid code search (keyword + semantic + reranked) as an MCP server. Any MCP-compatible client can connect and call it. Self-contained — no dependency on any editor, terminal, or agent application.

## Think of it as a code intelligence engine, not "a RAG project"
RAG is one consumer of this engine, not the whole identity of it. Layers, top to bottom:
```
CLI
  |
Configuration
  |
Workspace manager
  |
Indexer        (tree-sitter parser, file watcher, git integration)
  |
Storage        (SQLite: metadata + FTS5  |  LanceDB: embeddings)
  |
Retrieval engine (BM25, vector search, rerank)
  |
MCP server
```
This separation is what lets you later build a CLI grep tool, a VS Code extension, or anything else on the same core without touching the indexing or retrieval layers.

## Naming conventions
- Repo / npm package / CLI command: `edhindex` — no exact match found on npm at time of writing, but double-check on npmjs.com right before first publish since registry search results can lag.
- Local index folder inside any indexed project: `.edhindex/`
- Ignore file: `.edhindexignore` (same syntax as `.gitignore`)

## Design principles
These are the non-negotiable values the rest of this brief is derived from. When a build decision isn't spelled out explicitly elsewhere, default back to these:
- Local-first — the tool works fully on the user's machine
- Offline-first — no network dependency after the embedding model is downloaded once
- Zero telemetry
- No vendor lock-in — interfaces over concrete libraries, everywhere it matters
- Deterministic indexing — same input produces the same index
- Incremental updates only — never re-do work that isn't stale
- Safe-by-default — security guardrails are load-bearing, not optional
- Extensible without rewriting core components

## Distribution model — git repo, not a hosted service
- User runs `git clone`, then `npm install`
- `npx edhindex start` launches it locally, pointed at whichever folder the user opens
- Everything happens inside that folder — nothing hosted, nothing leaves the machine

## Model tiers — user picks one on first run
- **Light** — bge-small-en-v1.5 (~130MB) or all-MiniLM-L6-v2 (~46MB). Old/weak hardware.
- **Balanced** (default) — nomic-embed-text-v1.5/v2 (~270MB). 8,192 token context, best size-to-quality tradeoff.
- **Max quality** — BGE-M3 (~1.1-2.2GB). Matches commercial APIs on benchmarks, needs more RAM/CPU.

All run locally via `@huggingface/transformers` — no API call, no account, no ongoing cost at any tier. Switching tiers later requires a full re-index — vectors from different models aren't compatible with each other.

---

# V1 — build this first, ship it, then stop

## Supported languages (v1)
TypeScript, JavaScript, Go, Python. Nothing else yet — don't let an agent try to wire up every Tree-sitter grammar that exists.

## Never index these (v1)
`node_modules`, `.git`, `dist`, `build`, `coverage`, `.next`, `out`, `vendor`, `bin`, `obj`, `target`, `tmp`, `.cache`, `.turbo` — plus whatever the user adds to `.edhindexignore`.

## File limits (v1)
Skip anything over 10MB. Skip binaries, images, PDFs, videos, archives, and anything that looks generated.

## Chunking strategy (v1)
Priority order: function → method → class → interface → enum → module → file. If a unit exceeds the embedding model's token limit, split it recursively rather than truncating silently.

## Metadata schema (v1)
Store per chunk in SQLite: `id, file, language, symbol, kind, parent, hash, git_commit, start_line, end_line, imports, exports, embedding_model, last_indexed, checksum`. Define this once, up front — retrofitting new fields into an existing index later is painful.

## Index versioning (v1)
`.edhindex/version.json`, written on every index build:
```json
{
  "schema": 1,
  "embeddingModel": "nomic-v2",
  "chunkStrategy": 1,
  "createdAt": "2026-07-19T00:00:00Z",
  "lastIndexed": "2026-07-19T00:00:00Z"
}
```
On startup, compare this against the current build's expected values. Any mismatch (schema bump, model change, chunk strategy change) → trigger a full rebuild automatically rather than surfacing a confusing runtime error. This is the mechanism that makes "switching tiers requires a full re-index" (above) something the tool detects and handles, not something the user has to remember.

## Incremental indexing (v1)
Hash each file (SHA256). Chokidar triggers a check on save; only re-parse and re-embed if the hash actually changed. Don't re-embed unchanged files just because a save event fired.
Also hash each chunk individually. When a file's hash changes, diff at the chunk level and only re-embed the chunks whose hash actually changed — not the whole file. A one-function edit in a 2,000-line file should cost one embedding call, not fifty.

## Startup flow (v1)
- No index found → full scan → build → ready
- Existing index found → load it → compare hashes → update only what changed → ready

## Ranking formula (v1)
Top 30 BM25 candidates + top 30 vector candidates → deduplicate → rerank the merged set → return top 10 (configurable). Concrete numbers, not "combine and rerank" left vague. Full pipeline, in order:
```
Query
  |
Normalize
  |
BM25 search (top 30)  +  Vector search (top 30)
  |
Merge
  |
Deduplicate
  |
Rerank
  |
Top K (default 10)
  |
MCP response
```

## Embedding and storage abstraction (v1 — cheap now, expensive to retrofit later)
Define interfaces, don't hardcode the concrete libraries:
```
EmbeddingProvider: embed(), dimensions(), name(), load(), dispose()
VectorStore:       insert(), delete(), search(), compact()
```
Ship transformers.js and LanceDB as the default implementations of these interfaces. This is what lets you swap to Ollama, llama.cpp, Qdrant, or anything else later without rewriting the code that calls them.

## Config file (v1)
`.edhindex/config.json`:
```json
{
  "model": "balanced",
  "languages": ["ts", "js", "go", "py"],
  "watch": true,
  "rerank": true,
  "maxResults": 10
}
```

## Progress reporting (v1)
Indexing must never look hung. Emit structured progress events (not just log lines) that a CLI progress bar or an MCP client can both consume — e.g. `{ phase: "scanning", current: 118, total: 624 }`, then `{ phase: "embedding", percent: 42 }`, then `{ phase: "building_fts" }`, then `{ phase: "ready" }`.

## Cancellation (v1)
Indexing must be safely interruptible (Ctrl+C, or an MCP-triggered stop). On interrupt: finish the file currently being processed, flush metadata to SQLite, close the DB cleanly, then exit. Never leave a half-written index — a killed process should produce either the old valid state or the new valid state, never something in between.

## Logging levels (v1)
Four levels, fixed from the start so an agent doesn't scatter ad hoc `console.log` calls: `silent`, `info` (default), `verbose`, `debug`. Configurable via CLI flag and config file.

## CLI (v1)
```
edhindex init
edhindex start
edhindex index
edhindex search <query>
edhindex status
edhindex config
edhindex models
edhindex doctor
```
`doctor` checks SQLite, LanceDB, the embedding model, the MCP server, disk space, permissions, and active file watchers. Build this in v1 — it pays for itself the very first time something breaks and you need to know where.

## Security — non-negotiable, build this in from the start, not after
- Never execute any indexed code
- Never follow symlinks that point outside the selected workspace
- Never transmit source code over the network — enforce this in code, not just as a policy, unless the user explicitly opts into a future remote embedding provider
- Sanitize every path to prevent directory traversal
- Restrict every MCP tool operation strictly to the indexed workspace — a calling agent should never be able to reach outside the folder it was pointed at

This matters because once this runs as an MCP server, it can be driven by an autonomous agent acting on file contents it reads — path traversal and symlink escapes are the first thing that will get tried against a tool like this, intentionally or not.

## MCP tools exposed (v1)
`search_codebase` only. Everything else is v2.

## Non-goals (v1)
Explicit so an eager agent doesn't add any of these on its own initiative:
- No chat interface
- No code generation
- No cloud sync
- No telemetry
- No authentication
- No web UI
- No editor integration
- No remote database
- No hosted service

## Corrections worth keeping in mind
- MCP was created by Anthropic (Nov 2024), not OpenAI — now an open, vendor-neutral standard under the Linux Foundation. Use `@modelcontextprotocol/sdk` or FastMCP.
- `tiktoken` matches OpenAI's tokenizer specifically — treat any token counts here as approximate for other models.

## Recommended stack (v1)
Tree-sitter (AST), SQLite (metadata + FTS5), LanceDB (vectors), transformers.js (embeddings + reranker, local), chokidar (file watching), simple-git (git integration), MCP server (FastMCP or TypeScript SDK).

Note: Language Server Protocol integration is intentionally **not** in v1. Tree-sitter alone (function/class/import/export boundaries) is enough for a strong index and search experience. LSP adds per-language server lifecycle management, installation, and cross-platform quirks — real complexity that isn't needed until the persisted symbol/call graph (v2) makes it worth it. Don't let an agent reach for LSP in v1.

## Build order (v1)
1. Repo scaffold, config file, CLI skeleton, ignore rules, file size limits
2. AST indexing — Tree-sitter, chunking strategy, metadata schema, incremental hashing
3. Embeddings and vector search — via the `EmbeddingProvider` interface, tier selection on first run
4. Keyword search — SQLite FTS5
5. Ranking — the top-30/top-30/dedupe/rerank/top-10 formula
6. MCP server exposing `search_codebase`, with the security guardrails enforced here
7. File watching and the cold-start/warm-start flow
8. `doctor` command and basic recovery (if SQLite fails to open, rebuild from scratch rather than crash)

## Success criteria (v1)
v1 is done when all of the following hold:
- Indexes a 100k-line repository successfully
- Updates incrementally on file save, without a full re-index
- Returns search results in a reasonable time on a warm index
- Runs completely offline after the embedding model is downloaded
- Emits zero network requests beyond that one-time model download
- Recovers cleanly if `.edhindex/` is deleted (falls back to full scan)
- Runs on Windows, macOS, and Linux
- `search_codebase` works end to end through an MCP client

(Hard performance numbers — search latency, index update time, cold start, memory ceiling — are deliberately a v2 tuning target, not a v1 gate. Don't block shipping v1 on numbers that haven't been measured yet.)

---

# V2 — deliberately deferred, don't touch until v1 works end to end

- **Persisted symbol/call graph** (LSP-derived) — enables "expand from a chunk to its related symbols" as part of retrieval. This is the single biggest quality upgrade available, and also the most complex — earn it after the simpler retrieval loop is proven, not before.
- **Additional MCP tools**: `find_symbol`, `find_references`, `find_definition`, `recent_changes`, `workspace_stats`, `reindex`, `index_status`
- **Parallel indexing via worker threads** — only once you've actually confirmed indexing speed is a bottleneck on a real repo, not preemptively
- **Additional languages** beyond the v1 four (Java, C#, Rust, C++, Kotlin, Swift)
- **Formal test suite** as its own tracked effort — unit, integration, large-repo, corrupt-index, model-switch, recovery, watcher tests
- **Sophisticated corruption recovery** — attempt repair before falling back to a full rebuild
- **Full plugin system** — v1 already reserves the extension points via the two interfaces above; a real plugin loader can wait
- **Performance target tuning** — search under 300ms, index update under 2s, cold startup under 10s, memory under 1GB. Good targets to measure against once v1 exists, not a blocker before it ships

## Scope check
This is the entire scope of EDHIndex: index a codebase, keep the index live, expose it over MCP, safely. It does not include an editor, a terminal, or a chat interface — those are separate projects, if built at all.
