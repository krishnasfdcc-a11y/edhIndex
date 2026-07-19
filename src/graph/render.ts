import type { GraphNode, GraphEdge } from './types.js';

const NODE_COLORS: Record<string, string> = {
  workspace: '#ffd700', folder: '#8bc34a', file: '#64b5f6',
  module: '#ce93d8', class: '#ff7043', interface: '#4dd0e1',
  enum: '#ffb74d', function: '#81c784', method: '#aed581',
  variable: '#e0e0e0',
};

export function renderGraphSVG(nodes: GraphNode[], edges: GraphEdge[], width = 800, height = 600): string {
  const maxNodes = 200;
  const visNodes = nodes.slice(0, maxNodes);
  const nodeIds = new Set(visNodes.map(n => n.id));
  const visEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

  // Simple circular layout
  const cx = width / 2, cy = height / 2;
  const radius = Math.min(cx, cy) - 60;
  const positioned = visNodes.map((n, i) => {
    const angle = (i / visNodes.length) * Math.PI * 2 - Math.PI / 2;
    return {
      ...n,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      r: 4,
      color: NODE_COLORS[n.type] || '#888',
    };
  });
  const nodeMap = new Map(positioned.map(n => [n.id, n]));

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" style="background:#0d1117">
<defs>
  <filter id="glow"><feGaussianBlur stdDeviation="2" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<rect width="${width}" height="${height}" fill="#0d1117"/>
<text x="20" y="28" fill="#8b949e" font-size="13" font-family="sans-serif">EDHIndex Knowledge Graph — ${nodes.length} nodes, ${edges.length} edges</text>`;

  for (const e of visEdges) {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    if (!s || !t) continue;
    const opacity = e.type === 'imports' ? 0.6 : e.type === 'contains' ? 0.2 : 0.35;
    const color = e.type === 'imports' ? '#4dd0e1' : e.type === 'exports' ? '#ffb74d' : '#555';
    svg += `<line x1="${s.x}" y1="${s.y}" x2="${t.x}" y2="${t.y}" stroke="${color}" stroke-width="1" stroke-opacity="${opacity}"/>`;
  }

  for (const n of positioned) {
    svg += `<circle cx="${n.x}" cy="${n.y}" r="${n.r}" fill="${n.color}" opacity="0.9" filter="url(#glow)"><title>${escapeXml(n.label)} (${n.type})\n${n.file}</title></circle>`;
  }

  // Legend
  const types = ['workspace', 'folder', 'file', 'module', 'class', 'interface', 'enum', 'function', 'method'];
  let ly = height - 30 * types.length - 10;
  for (const t of types) {
    const c = NODE_COLORS[t];
    if (!c) continue;
    svg += `<circle cx="18" cy="${ly}" r="4" fill="${c}"/><text x="28" y="${ly + 4}" fill="#8b949e" font-size="10" font-family="sans-serif">${t.charAt(0).toUpperCase() + t.slice(1)}</text>`;
    ly += 18;
  }

  svg += '</svg>';
  return svg;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
