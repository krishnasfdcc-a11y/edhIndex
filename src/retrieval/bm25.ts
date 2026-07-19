import { FTSStore, FTSResult } from '../storage/fts.js';

export function searchBM25(fts: FTSStore, query: string, topK: number): Array<{ id: string; score: number }> {
  const results = fts.searchWithRank(query, topK * 2);
  if (results.length === 0) return [];

  if (results.length === 1) {
    return [{ id: results[0].id, score: 1.0 }];
  }

  const negRanks = results.map(r => -r.rank);
  const minNeg = Math.min(...negRanks);
  const maxNeg = Math.max(...negRanks);
  const range = maxNeg - minNeg;
  if (range === 0) {
    return results.map(r => ({ id: r.id, score: 1.0 }));
  }
  return results.map((r, i) => ({
    id: r.id,
    score: (negRanks[i] - minNeg) / range,
  }));
}
