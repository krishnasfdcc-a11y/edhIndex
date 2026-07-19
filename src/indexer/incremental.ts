import { logger } from '../logging.js';
import { ScannedFile } from './file-utils.js';

export interface FileDelta {
  added: ScannedFile[];
  modified: ScannedFile[];
  removed: string[];
  unchanged: ScannedFile[];
}

export function computeFileDelta(
  scanned: Map<string, ScannedFile>,
  existing: Map<string, string>, // relativePath -> hash
): FileDelta {
  const delta: FileDelta = {
    added: [],
    modified: [],
    removed: [],
    unchanged: [],
  };

  for (const [relPath, file] of scanned) {
    const existingHash = existing.get(relPath);
    if (existingHash === undefined) {
      delta.added.push(file);
    } else if (existingHash !== file.hash) {
      delta.modified.push(file);
    } else {
      delta.unchanged.push(file);
    }
  }

  const scannedPaths = new Set(scanned.keys());
  for (const relPath of existing.keys()) {
    if (!scannedPaths.has(relPath)) {
      delta.removed.push(relPath);
    }
  }

  return delta;
}

export interface ChunkDelta {
  added: string[];
  modified: string[];
  removed: string[];
  unchanged: string[];
}

export function computeChunkDelta(
  newChunks: Map<string, string>,
  existingChunks: Map<string, string>,
): ChunkDelta {
  const delta: ChunkDelta = {
    added: [],
    modified: [],
    removed: [],
    unchanged: [],
  };

  for (const [chunkId, hash] of newChunks) {
    const existingHash = existingChunks.get(chunkId);
    if (existingHash === undefined) {
      delta.added.push(chunkId);
    } else if (existingHash !== hash) {
      delta.modified.push(chunkId);
    } else {
      delta.unchanged.push(chunkId);
    }
  }

  const newIds = new Set(newChunks.keys());
  for (const chunkId of existingChunks.keys()) {
    if (!newIds.has(chunkId)) {
      delta.removed.push(chunkId);
    }
  }

  return delta;
}
