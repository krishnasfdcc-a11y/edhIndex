export type ProgressPhase = 'scanning' | 'embedding' | 'building_fts' | 'ready';

export interface ProgressEvent {
  phase: ProgressPhase;
  current?: number;
  total?: number;
  percent?: number;
  message?: string;
}

export type ProgressCallback = (event: ProgressEvent) => void;

const listeners: Set<ProgressCallback> = new Set();

export function onProgress(cb: ProgressCallback): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function emitProgress(event: ProgressEvent) {
  for (const cb of listeners) {
    try {
      cb(event);
    } catch {
      // swallow
    }
  }
}
