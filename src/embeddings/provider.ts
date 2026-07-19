export interface EmbeddingProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions(): number;
  name(): string;
  load(): Promise<void>;
  dispose(): void;
}

export type EmbeddingModelId = 'light' | 'balanced' | 'max';
