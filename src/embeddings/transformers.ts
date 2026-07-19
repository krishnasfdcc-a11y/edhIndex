import { EmbeddingProvider } from './provider.js';
import { MODEL_CONFIGS, RERANKER_MODEL, ModelTier } from '../config/index.js';
import { logger } from '../logging.js';

export class TransformersEmbeddingProvider implements EmbeddingProvider {
  private pipeline: any = null;
  private modelId: string;
  private dims: number;
  private modelTier: ModelTier;
  private loaded = false;

  constructor(tier: ModelTier) {
    this.modelTier = tier;
    const cfg = MODEL_CONFIGS[tier];
    this.modelId = cfg.modelId;
    this.dims = cfg.dimensions;
  }

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      logger.info(`Loading embedding model: ${this.modelId}`);
      const mod = await import('@huggingface/transformers');
      this.pipeline = await mod.pipeline('feature-extraction', this.modelId, {
        progress_callback: (progress: any) => {
          if (progress?.status === 'progress' && progress?.percent !== undefined) {
            logger.verbose(`Model download: ${Math.round(progress.percent)}%`);
          }
        },
      });
      this.loaded = true;
      logger.info(`Embedding model loaded: ${this.modelId}`);
    } catch (e) {
      logger.error('Failed to load embedding model:', e);
      throw e;
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    if (!this.loaded) {
      await this.load();
    }

    const results: number[][] = [];
    for (const text of texts) {
      try {
        const output = await this.pipeline(text, {
          pooling: 'mean',
          normalize: true,
        });
        const embedding = output.tolist ? output.tolist() : output.data || output;
        results.push(Array.isArray(embedding[0]) ? embedding[0] : embedding);
      } catch (e) {
        logger.debug('Embedding failed for text, using zero vector:', e);
        results.push(new Array(this.dims).fill(0));
      }
    }
    return results;
  }

  dimensions(): number {
    return this.dims;
  }

  name(): string {
    return this.modelTier;
  }

  dispose(): void {
    this.pipeline = null;
    this.loaded = false;
  }
}

export class TransformersReranker {
  private pipeline: any = null;
  private loaded = false;

  async load(): Promise<void> {
    if (this.loaded) return;
    try {
      logger.info('Loading reranker model');
      const mod = await import('@huggingface/transformers');
      this.pipeline = await mod.pipeline('text-classification', RERANKER_MODEL, {
        progress_callback: (progress: any) => {
          if (progress?.status === 'progress' && progress?.percent !== undefined) {
            logger.verbose(`Reranker download: ${Math.round(progress.percent)}%`);
          }
        },
      });
      this.loaded = true;
      logger.info('Reranker model loaded');
    } catch (e) {
      logger.error('Failed to load reranker model:', e);
      throw e;
    }
  }

  async rerank(query: string, texts: string[]): Promise<{ index: number; score: number }[]> {
    if (!this.loaded) {
      await this.load();
    }

    const pairs = texts.map(text => ({ text: query, text_pair: text }));

    try {
      const results = await this.pipeline(pairs);
      const scores: { index: number; score: number }[] = [];

      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        const score = result.score !== undefined
          ? (result.label === 'LABEL_1' ? result.score : 1 - result.score)
          : 0;
        scores.push({ index: i, score });
      }

      scores.sort((a, b) => b.score - a.score);
      return scores;
    } catch (e) {
      logger.debug('Reranking failed:', e);
      return texts.map((_, i) => ({ index: i, score: 0 }));
    }
  }

  dispose(): void {
    this.pipeline = null;
    this.loaded = false;
  }
}
