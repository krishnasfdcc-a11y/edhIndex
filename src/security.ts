import { realpathSync } from 'node:fs';
import { resolve, relative, normalize, sep } from 'node:path';

export function isSubPath(parent: string, child: string): boolean {
  const rel = relative(parent, child);
  return !rel.startsWith('..') && !isAbsolutePath(rel);
}

function isAbsolutePath(p: string): boolean {
  return sep === '/' ? p.startsWith('/') : /^[a-zA-Z]:[/\\]/.test(p);
}

export function sanitizePath(root: string, requestedPath: string): string | null {
  const resolved = resolve(root, requestedPath);
  const normalized = normalize(resolved);

  if (!isSubPath(root, normalized)) {
    return null;
  }

  return normalized;
}

export function resolveSafePath(root: string, requestedPath: string): string | null {
  const sanitized = sanitizePath(root, requestedPath);
  if (!sanitized) return null;

  try {
    const real = realpathSync(sanitized);
    if (!isSubPath(root, real)) {
      return null;
    }
    return real;
  } catch {
    return sanitized;
  }
}

export function checkSymlinkSafety(root: string, targetPath: string): boolean {
  try {
    const real = realpathSync(targetPath);
    return isSubPath(root, real);
  } catch {
    return true;
  }
}
