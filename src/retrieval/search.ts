import { FTSStore } from '../storage/fts.js';
import { MetadataStore, ChunkMetadata } from '../storage/metadata.js';
import { VectorStore } from '../vector/store.js';
import { EmbeddingProvider } from '../embeddings/provider.js';
import { TransformersReranker } from '../embeddings/transformers.js';
import { searchBM25 } from './bm25.js';
import { rerankResults, RerankedResult } from './reranker.js';
import { logger } from '../logging.js';

export interface SearchOptions {
  query: string;
  maxResults?: number;
  rerank?: boolean;
  fileFilter?: string;
  languageFilter?: string;
}

export interface SearchResult {
  id: string;
  file: string;
  language: string;
  symbol: string;
  kind: string | null;
  startLine: number;
  endLine: number;
  content: string;
  score: number;
  matchType: 'keyword' | 'vector' | 'hybrid';
}

const BM25_TOP_K = 30;
const VECTOR_TOP_K = 30;

export class SearchEngine {
  private fts: FTSStore;
  private metadata: MetadataStore;
  private vectors: VectorStore;
  private embedder: EmbeddingProvider;
  private reranker: TransformersReranker | null;
  private useRerank: boolean;

  constructor(
    fts: FTSStore,
    metadata: MetadataStore,
    vectors: VectorStore,
    embedder: EmbeddingProvider,
    reranker: TransformersReranker | null,
    useRerank: boolean,
  ) {
    this.fts = fts;
    this.metadata = metadata;
    this.vectors = vectors;
    this.embedder = embedder;
    this.reranker = reranker;
    this.useRerank = useRerank;
  }

  async search(opts: SearchOptions): Promise<SearchResult[]> {
    const maxResults = opts.maxResults || 10;
    const query = opts.query.trim();
    if (!query) return [];

    // Normalize query
    const normalized = query.replace(/\s+/g, ' ').trim();

    // BM25
    const bm25Results = searchBM25(this.fts, normalized, BM25_TOP_K);
    logger.debug(`BM25 returned ${bm25Results.length} results`);

    // Vector search
    let vectorResults: Array<{ id: string; score: number }> = [];
    try {
      const embedding = await this.embedder.embed([normalized]);
      if (embedding.length > 0 && embedding[0].length > 0) {
        vectorResults = await this.vectors.search(embedding[0], VECTOR_TOP_K);
      }
    } catch (e) {
      logger.debug('Vector search failed:', e);
    }
    logger.debug(`Vector search returned ${vectorResults.length} results`);

    // Merge and deduplicate
    const seen = new Set<string>();
    const merged: Array<{ id: string; score: number }> = [];

    for (const r of bm25Results) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        merged.push(r);
      }
    }

    for (const r of vectorResults) {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        merged.push({ id: r.id, score: r.score * 0.8 });
      } else {
        const existing = merged.find(m => m.id === r.id);
        if (existing) {
          existing.score = Math.max(existing.score, r.score);
        }
      }
    }

    logger.debug(`Merged ${merged.length} unique results`);

    // Rerank
    const reranked = await rerankResults(
      normalized,
      merged,
      this.metadata,
      this.reranker,
      maxResults,
      this.useRerank,
    );

    // Build final results
    const results: SearchResult[] = [];
    for (const r of reranked) {
      if (!r.metadata) continue;

      let matchType: SearchResult['matchType'] = 'hybrid';
      const inBM25 = bm25Results.some(b => b.id === r.id);
      const inVector = vectorResults.some(v => v.id === r.id);
      if (inBM25 && !inVector) matchType = 'keyword';
      else if (!inBM25 && inVector) matchType = 'vector';

      results.push({
        id: r.id,
        file: r.metadata.file,
        language: r.metadata.language,
        symbol: r.metadata.symbol,
        kind: r.metadata.kind,
        startLine: r.metadata.start_line,
        endLine: r.metadata.end_line,
        content: r.metadata.imports + '\n' + r.metadata.exports,
        score: r.score,
        matchType,
      });
    }

    return results.slice(0, maxResults);
  }
}
