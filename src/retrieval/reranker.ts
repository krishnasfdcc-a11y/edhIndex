import { TransformersReranker } from '../embeddings/transformers.js';
import { MetadataStore, ChunkMetadata } from '../storage/metadata.js';
import { logger } from '../logging.js';

export interface RerankedResult {
  id: string;
  score: number;
  metadata: ChunkMetadata | null;
}

export async function rerankResults(
  query: string,
  candidates: Array<{ id: string }>,
  metadataStore: MetadataStore,
  reranker: TransformersReranker | null,
  topK: number,
  useRerank: boolean,
): Promise<RerankedResult[]> {
  if (candidates.length === 0) return [];

  if (!useRerank || !reranker) {
    return candidates.slice(0, topK).map(c => ({
      id: c.id,
      score: 1,
      metadata: metadataStore.getChunk(c.id) || null,
    }));
  }

  const texts: string[] = [];
  const validCandidates: Array<{ id: string }> = [];

  for (const c of candidates) {
    const meta = metadataStore.getChunk(c.id);
    if (meta) {
      texts.push(meta.imports + ' ' + meta.exports + ' ' + (meta.symbol || ''));
      validCandidates.push(c);
    }
  }

  if (texts.length === 0) {
    return candidates.slice(0, topK).map(c => ({
      id: c.id,
      score: 1,
      metadata: metadataStore.getChunk(c.id) || null,
    }));
  }

  try {
    const scores = await reranker.rerank(query, texts);
    const results: RerankedResult[] = scores.slice(0, topK).map(s => ({
      id: validCandidates[s.index].id,
      score: s.score,
      metadata: metadataStore.getChunk(validCandidates[s.index].id) || null,
    }));
    return results;
  } catch (e) {
    logger.debug('Reranking failed, falling back to unranked:', e);
    return validCandidates.slice(0, topK).map(c => ({
      id: c.id,
      score: 1,
      metadata: metadataStore.getChunk(c.id) || null,
    }));
  }
}
