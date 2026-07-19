export interface FileNode {
  id: string;
  label: string;
  language: string;
  chunkCount: number;
  imports: string[];
}

export function parseImportPaths(raw: string): string[] {
  if (!raw) return [];
  const results: string[] = [];
  for (const line of raw.split('\n')) {
    const t = line.trim();
    let m = t.match(/from\s+['"](\..*?)['"]/);
    if (!m) m = t.match(/require\s*\(\s*['"](\..*?)['"]\s*\)/);
    if (!m) m = t.match(/import\s+['"](\..*?)['"]/);
    if (m) results.push(m[1]);
  }
  return results;
}

export function resolveImport(sourceFile: string, importPath: string, indexedFiles: Set<string>): string | null {
  const raw = importPath.replace(/^['"]|['"]$/g, '');
  const dir = sourceFile.includes('/') ? sourceFile.slice(0, sourceFile.lastIndexOf('/')) : '';

  function normalize(base: string, rel: string): string {
    const parts = (base ? base.split('/') : []).concat(rel.split('/'));
    const out: string[] = [];
    for (const p of parts) {
      if (p === '.' || p === '') continue;
      if (p === '..') { out.pop(); continue; }
      out.push(p);
    }
    return out.join('/');
  }

  const full = normalize(dir, raw);

  const candidates = [full];
  for (const jsExt of ['.js', '.jsx']) {
    if (full.endsWith(jsExt)) {
      candidates.push(full.replace(jsExt, ''), full.replace(jsExt, '.ts'), full.replace(jsExt, '.tsx'));
    }
  }

  for (const c of candidates) {
    if (indexedFiles.has(c)) return c;
  }

  for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.mts', '.cts', '.mjs', '.cjs']) {
    if (indexedFiles.has(full + ext)) return full + ext;
  }

  for (const idx of ['index.ts', 'index.tsx', 'index.js', 'index.jsx', '__init__.py', 'index.py']) {
    if (indexedFiles.has(full + '/' + idx)) return full + '/' + idx;
  }

  return null;
}

export interface LayoutNode {
  id: string;
  label: string;
  language: string;
  chunkCount: number;
  x: number;
  y: number;
  color: string;
}

export interface LayoutEdge {
  source: string;
  target: string;
}

const LANG_COLORS: Record<string, string> = {
  ts: '#3178c6',
  js: '#f7df1e',
  py: '#3572A5',
  go: '#00ADD8',
};

function shortenPath(p: string): string {
  if (p.length <= 45) return p;
  return '...' + p.slice(-42);
}

function forceLayout(nodes: LayoutNode[], edges: LayoutEdge[], width: number, height: number) {
  for (const n of nodes) {
    n.x = width * 0.2 + Math.random() * width * 0.6;
    n.y = height * 0.2 + Math.random() * height * 0.6;
  }

  const vx = new Float64Array(nodes.length);
  const vy = new Float64Array(nodes.length);
  const adj = new Map<string, number[]>();
  for (const node of nodes) adj.set(node.id, []);
  for (const e of edges) {
    adj.get(e.source)?.push(edges.indexOf(e));
    adj.get(e.target)?.push(edges.indexOf(e));
  }

  for (let iter = 0; iter < 150; iter++) {
    const cooling = 1 - iter / 150;
    vx.fill(0); vy.fill(0);

    // Repulsion
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[i].x - nodes[j].x;
        let dy = nodes[i].y - nodes[j].y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 1) { dist = 1; dx = 1; }
        const force = 8000 / (dist * dist);
        vx[i] += (dx / dist) * force;
        vy[i] += (dy / dist) * force;
        vx[j] -= (dx / dist) * force;
        vy[j] -= (dy / dist) * force;
      }
    }

    // Attraction along edges
    for (const e of edges) {
      const si = nodes.findIndex(n => n.id === e.source);
      const ti = nodes.findIndex(n => n.id === e.target);
      if (si === -1 || ti === -1) continue;
      const dx = nodes[ti].x - nodes[si].x;
      const dy = nodes[ti].y - nodes[si].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1) continue;
      const force = dist / 80;
      vx[si] += (dx / dist) * force;
      vy[si] += (dy / dist) * force;
      vx[ti] -= (dx / dist) * force;
      vy[ti] -= (dy / dist) * force;
    }

    // Center gravity
    for (let i = 0; i < nodes.length; i++) {
      vx[i] -= (nodes[i].x - width / 2) * 0.005;
      vy[i] -= (nodes[i].y - height / 2) * 0.005;
    }

    // Apply
    for (let i = 0; i < nodes.length; i++) {
      nodes[i].x += vx[i] * cooling;
      nodes[i].y += vy[i] * cooling;
    }
  }

  // Fit to viewport with padding
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const n of nodes) {
    if (n.x < minX) minX = n.x;
    if (n.y < minY) minY = n.y;
    if (n.x > maxX) maxX = n.x;
    if (n.y > maxY) maxY = n.y;
  }
  const pad = 60;
  const scale = Math.min((width - pad * 2) / (maxX - minX || 1), (height - pad * 2) / (maxY - minY || 1));
  for (const n of nodes) {
    n.x = (n.x - minX) * scale + pad;
    n.y = (n.y - minY) * scale + pad;
  }
}

export function generateSVG(rootPath: string, nodes: FileNode[], edges: { source: string; target: string }[]): string {
  const W = 1200, H = 900;

  const layoutNodes: LayoutNode[] = nodes.map(n => ({
    id: n.id, label: shortenPath(n.id), language: n.language,
    chunkCount: n.chunkCount, x: 0, y: 0, color: LANG_COLORS[n.language] || '#888',
  }));

  forceLayout(layoutNodes, edges, W, H);

  const nodeIdSet = new Set(layoutNodes.map(n => n.id));

  let edgeSvgs = '';
  for (const e of edges) {
    const s = layoutNodes.find(n => n.id === e.source);
    const t = layoutNodes.find(n => n.id === e.target);
    if (s && t) {
      edgeSvgs += `<line x1="${s.x.toFixed(1)}" y1="${s.y.toFixed(1)}" x2="${t.x.toFixed(1)}" y2="${t.y.toFixed(1)}" stroke="#555" stroke-width="1.5" stroke-opacity="0.5"/>\n`;
    }
  }

  let nodeSvgs = '';
  for (const n of layoutNodes) {
    const r = Math.max(4, Math.sqrt(n.chunkCount) * 3);
    nodeSvgs += `<circle cx="${n.x.toFixed(1)}" cy="${n.y.toFixed(1)}" r="${r}" fill="${n.color}" stroke="#fff" stroke-width="1" opacity="0.85">`;
    nodeSvgs += `<title>${escapeXml(n.id)}\n${n.language} · ${n.chunkCount} chunks</title>`;
    nodeSvgs += `</circle>\n`;
  }

  let labelSvgs = '';
  for (const n of layoutNodes) {
    const r = Math.max(4, Math.sqrt(n.chunkCount) * 3);
    labelSvgs += `<text x="${n.x.toFixed(1)}" y="${(n.y - r - 4).toFixed(1)}" text-anchor="middle" font-size="9" fill="#ccc" font-family="sans-serif">${escapeXml(n.label)}</text>\n`;
  }

  let legendSvgs = '';
  let ly = H - 80;
  for (const [lang, color] of Object.entries(LANG_COLORS)) {
    legendSvgs += `<circle cx="20" cy="${ly}" r="5" fill="${color}"/><text x="32" y="${ly + 4}" font-size="11" fill="#aaa" font-family="sans-serif">${langLabel(lang)}</text>\n`;
    ly += 18;
  }

  const fileCount = nodes.length;
  const edgeCount = edges.length;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="100%" height="100%" style="background:#1a1a2e">
<style>
  circle { transition: opacity 0.2s; cursor: pointer; }
  circle:hover { opacity: 1 !important; stroke-width: 2 !important; }
  line { transition: opacity 0.2s; }
</style>
<rect x="0" y="0" width="${W}" height="${H}" fill="#1a1a2e"/>
<text x="20" y="30" font-size="16" font-weight="bold" fill="#e0e0e0" font-family="sans-serif">EDHIndex — Dependency Graph</text>
<text x="20" y="48" font-size="11" fill="#666" font-family="sans-serif">${escapeXml(rootPath)}</text>
<text x="${W - 20}" y="30" font-size="12" fill="#888" text-anchor="end" font-family="sans-serif">${fileCount} files · ${edgeCount} edges</text>
<g id="edges">
${edgeSvgs}</g>
<g id="nodes">
${nodeSvgs}</g>
<g id="labels">
${labelSvgs}</g>
<g id="legend">
<rect x="8" y="${H - 110}" width="100" height="${Object.keys(LANG_COLORS).length * 18 + 10}" fill="none"/>
${legendSvgs}</g>
</svg>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function langLabel(lang: string): string {
  const map: Record<string, string> = { ts: 'TypeScript', js: 'JavaScript', py: 'Python', go: 'Go' };
  return map[lang] || lang;
}
