export interface VectorStore {
  insert(vectors: Array<{ id: string; values: number[]; metadata: Record<string, any> }>): Promise<void>;
  delete(ids: string[]): Promise<void>;
  search(query: number[], topK: number): Promise<Array<{ id: string; score: number }>>;
  compact(): Promise<void>;
  count(): Promise<number>;
  close(): Promise<void>;
}
