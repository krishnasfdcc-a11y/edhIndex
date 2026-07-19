import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { GraphService } from './service.js';

const NODE_COLORS: Record<string, string> = {
  workspace: '#ffd700', folder: '#8bc34a', file: '#64b5f6',
  module: '#ce93d8', class: '#ff7043', interface: '#4dd0e1',
  enum: '#ffb74d', function: '#81c784', method: '#aed581',
  variable: '#e0e0e0',
};

const NODE_SHAPES: Record<string, string> = {
  workspace: 'ellipse', folder: 'roundrectangle', file: 'roundrectangle',
  class: 'diamond', interface: 'diamond', enum: 'hexagon',
  function: 'triangle', method: 'triangle',
};

function prepareGraphJSON(rootPath: string) {
  const svc = new GraphService(rootPath);
  const data = svc.getGraphData();
  const nodeIds = new Set(data.nodes.map(n => n.id));
  const validEdges = data.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  const nodesJson = JSON.stringify(data.nodes.map(n => ({
    data: {
      id: n.id, label: n.label, type: n.type,
      lang: n.language, file: n.file,
      startLine: n.startLine, endLine: n.endLine,
      color: NODE_COLORS[n.type] || '#888',
      shape: NODE_SHAPES[n.type] || 'ellipse',
    },
  })));
  const edgesJson = JSON.stringify(validEdges.map(e => ({
    data: { id: e.id, source: e.source, target: e.target, type: e.type },
  })));
  svc.close();
  return { nodesJson, edgesJson };
}

export function writeViewerFile(rootPath: string, outputPath: string) {
  const { nodesJson, edgesJson } = prepareGraphJSON(rootPath);
  const html = generateViewerHTML(nodesJson, edgesJson, rootPath);
  writeFileSync(outputPath, html, 'utf-8');
  return outputPath;
}

export async function startGraphServer(rootPath: string, port: number = 0): Promise<{ port: number; close: () => void }> {
  const svc = new GraphService(rootPath);
  const data = svc.getGraphData();
  const nodeIds = new Set(data.nodes.map(n => n.id));
  const validEdges = data.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  const nodesJson = JSON.stringify(data.nodes.map(n => ({
    data: {
      id: n.id, label: n.label, type: n.type,
      lang: n.language, file: n.file,
      startLine: n.startLine, endLine: n.endLine,
      color: NODE_COLORS[n.type] || '#888',
      shape: NODE_SHAPES[n.type] || 'ellipse',
    },
  })));
  const edgesJson = JSON.stringify(validEdges.map(e => ({
    data: { id: e.id, source: e.source, target: e.target, type: e.type },
  })));

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    const path = url.pathname;

    res.setHeader('Access-Control-Allow-Origin', '*');

    if (path === '/api/graph') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
      return;
    }

    if (path === '/api/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(svc.getStats()));
      return;
    }

    if (path === '/api/search') {
      const q = url.searchParams.get('q') || '';
      const results = q ? svc.searchNodes(q) : [];
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(results.slice(0, 30)));
      return;
    }

    if (path.startsWith('/api/node/')) {
      const id = decodeURIComponent(path.slice(10));
      const node = svc.getNode(id);
      if (!node) { res.writeHead(404); res.end('Not found'); return; }
      const neighbors = svc.getNeighbors(id);
      const children = svc.getChildren(id);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ node, neighbors, children }));
      return;
    }

    // Serve graph viewer HTML
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(generateViewerHTML(nodesJson, edgesJson, rootPath));
  });

  return new Promise((resolve) => {
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const actualPort = typeof addr === 'object' && addr ? addr.port : port;
      resolve({ port: actualPort, close: () => { svc.close(); server.close(); } });
    });
  });
}

function generateViewerHTML(nodesJson: string, edgesJson: string, rootPath: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>EDHIndex Knowledge Graph</title>
<script src="https://unpkg.com/cytoscape/dist/cytoscape.min.js"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--bg:#0d1117;--surface:#161b22;--surface2:#21262d;--text:#c9d1d9;--text2:#8b949e;--border:#30363d;--accent:#58a6ff}
body.light{--bg:#f6f8fa;--surface:#fff;--surface2:#f0f0f0;--text:#24292f;--text2:#656d76;--border:#d0d7de;--accent:#0969da}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;background:var(--bg);color:var(--text);overflow:hidden;height:100vh}
#cy{position:absolute;top:0;left:0;right:0;bottom:0}
#error-box{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:99;background:#1a1a2e;border:1px solid #f33;border-radius:12px;padding:24px;max-width:500px;display:none;color:#f88;font-size:14px;text-align:center}
#error-box h3{margin-bottom:8px}
#error-box .detail{font-size:12px;color:#999;margin-top:8px;word-break:break-all}
#topbar{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:20;display:flex;gap:6px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:6px 12px;backdrop-filter:blur(12px);box-shadow:0 4px 24px rgba(0,0,0,.4)}
#topbar input{padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-size:13px;width:200px;outline:none;transition:border-color .15s}
#topbar input:focus{border-color:var(--accent)}
#topbar select{padding:5px 8px;border:1px solid var(--border);border-radius:6px;background:var(--surface2);color:var(--text);font-size:12px;cursor:pointer;outline:none}
#topbar button{border:none;border-radius:6px;padding:6px 10px;font-size:12px;cursor:pointer;background:var(--surface2);color:var(--text);transition:all .15s;display:flex;align-items:center;gap:4px}
#topbar button:hover{background:var(--accent);color:#fff}
#topbar .title{color:var(--text);font-weight:600;font-size:13px;margin-right:4px}
#topbar .sub{color:var(--text2);font-size:11px;margin-right:8px}
#panel{position:fixed;right:16px;top:68px;width:300px;max-height:calc(100vh - 90px);z-index:20;background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:16px;overflow-y:auto;box-shadow:0 8px 32px rgba(0,0,0,.5);display:none;font-size:13px}
#panel h3{font-size:15px;margin-bottom:10px;color:var(--accent);display:flex;align-items:center;gap:6px}
#panel .tag{font-size:10px;padding:2px 6px;border-radius:4px;background:var(--surface2);color:var(--text2);margin-left:auto}
#panel .row{display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid var(--surface2);font-size:12px}
#panel .row:last-child{border-bottom:none}
#panel .lbl{color:var(--text2);flex-shrink:0}
#panel .val{color:var(--text);text-align:right;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#panel .section{font-size:11px;color:var(--text2);margin-top:10px;margin-bottom:4px;text-transform:uppercase;letter-spacing:.5px}
#panel .tag-list{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
#panel .tag-list span{padding:2px 6px;border-radius:4px;background:var(--surface2);font-size:11px;color:var(--text)}
#panel .tag-list .dim{opacity:.5}
#close-panel{position:absolute;top:8px;right:10px;border:none;background:none;color:var(--text2);cursor:pointer;font-size:16px;padding:4px}
#close-panel:hover{color:var(--text)}
#search-results{position:fixed;top:52px;left:50%;transform:translateX(-50%);z-index:19;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:4px 0;max-height:260px;overflow-y:auto;width:320px;display:none;box-shadow:0 8px 24px rgba(0,0,0,.4)}
#search-results div{padding:7px 12px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:8px;transition:background .1s}
#search-results div:hover{background:var(--surface2)}
#search-results .dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
#legend{position:fixed;left:16px;bottom:20px;z-index:20;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;font-size:11px;box-shadow:0 4px 16px rgba(0,0,0,.3);display:flex;flex-direction:column;gap:3px}
#legend .row{display:flex;align-items:center;gap:6px}
#legend .dot{width:10px;height:10px;border-radius:50%;flex-shrink:0}
#stats{position:fixed;right:16px;bottom:20px;z-index:20;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:8px 12px;font-size:11px;text-align:right;color:var(--text2);box-shadow:0 4px 16px rgba(0,0,0,.3)}
.empty{color:var(--text2);text-align:center;padding:20px;font-size:12px}
</style>
</head>
<body>
<div id="error-box"><h3>⚠ Failed to render graph</h3><p id="error-msg">Cytoscape.js library failed to load.</p><p class="detail" id="error-detail"></p></div>
<div id="cy"></div>
<div id="topbar">
  <span class="title">KG</span><span class="sub">${rootPath}</span>
  <input id="search" type="text" placeholder="Search graph..." spellcheck="false">
  <select id="layout-select">
    <option value="cose">Force</option>
    <option value="breadthfirst">Hierarchy</option>
    <option value="circle">Circle</option>
    <option value="grid">Grid</option>
    <option value="concentric">Concentric</option>
  </select>
  <button id="btn-fit">⤢ Fit</button>
  <button id="btn-theme">🌓</button>
</div>
<div id="search-results"></div>
<div id="panel"><button id="close-panel">✕</button><h3 id="panel-title">Node</h3><div id="panel-body"></div></div>
<div id="legend"></div>
<div id="stats"></div>

<script>
const elements = { nodes: ${nodesJson}, edges: ${edgesJson} };
function showError(msg, detail) {
  const box = document.getElementById('error-box');
  box.style.display = 'block';
  document.getElementById('error-msg').textContent = msg;
  if (detail) document.getElementById('error-detail').textContent = detail;
}
if (typeof cytoscape === 'undefined') {
  showError('Cytoscape.js library failed to load. Check your internet connection and refresh.');
} else { try {
const types = [...new Set(elements.nodes.map(n => n.data.type))];
const colors = ${JSON.stringify(NODE_COLORS)};

// Legend
const legend = document.getElementById('legend');
const typeOrder = ['workspace','folder','file','module','class','interface','enum','function','method'];
for (const t of typeOrder) {
  if (colors[t]) {
    const r = document.createElement('div'); r.className = 'row';
    r.innerHTML = '<span class="dot" style="background:'+colors[t]+'"></span>'+t.charAt(0).toUpperCase()+t.slice(1);
    legend.appendChild(r);
  }
}

const cy = cytoscape({
  container: document.getElementById('cy'),
  elements,
  style: [
    { selector: 'node', style: {
      'background-color': 'data(color)',
      'label': 'data(label)',
      'color': '#8b949e',
      'font-size': '10px',
      'text-valign': 'bottom',
      'text-halign': 'center',
      'text-margin-y': 4,
      'width': 22, 'height': 22,
      'border-width': 1, 'border-color': '#fff', 'border-opacity': 0.15,
      'transition-property': 'background-color, border-color, opacity',
      'transition-duration': 200,
    }},
    { selector: 'edge', style: {
      'width': 1.2, 'line-color': '#30363d',
      'target-arrow-color': '#30363d',
      'target-arrow-shape': 'triangle', 'arrow-scale': 0.5,
      'curve-style': 'bezier', 'opacity': 0.5,
    }},
    { selector: 'edge[type = "imports"]', style: { 'line-color': '#4dd0e1', 'target-arrow-color': '#4dd0e1', 'opacity': 0.7 }},
    { selector: 'edge[type = "exports"]', style: { 'line-color': '#ffb74d', 'target-arrow-color': '#ffb74d', 'opacity': 0.7 }},
    { selector: 'edge[type = "defines"]', style: { 'line-color': '#81c784', 'opacity': 0.35, 'width': 0.8 }},
    { selector: 'edge[type = "contains"]', style: { 'line-color': '#555', 'opacity': 0.2, 'width': 0.6, 'target-arrow-shape': 'none' }},
    { selector: 'node[type = "folder"]', style: { 'shape': 'round-rectangle', 'background-color': '#8bc34a' }},
    { selector: 'node[type = "file"]', style: { 'shape': 'round-rectangle', 'background-color': '#64b5f6' }},
    { selector: 'node[type = "class"]', style: { 'shape': 'diamond', 'width': 28, 'height': 28 }},
    { selector: 'node[type = "interface"]', style: { 'shape': 'diamond', 'width': 24, 'height': 24, 'background-color': '#4dd0e1' }},
    { selector: 'node[type = "function"]', style: { 'shape': 'round-triangle', 'width': 20, 'height': 20 }},
    { selector: 'node[type = "method"]', style: { 'shape': 'round-triangle', 'width': 16, 'height': 16 }},
    { selector: 'node[type = "enum"]', style: { 'shape': 'hexagon', 'background-color': '#ffb74d' }},
    { selector: 'node:selected', style: { 'border-width': 3, 'border-color': '#ffd700', 'border-opacity': 1, 'label': 'data(label)', 'color': '#ffd700', 'font-weight': 'bold' }},
    { selector: 'node.highlight', style: { 'border-width': 2, 'border-color': '#ffd700', 'border-opacity': 0.7 }},
    { selector: 'edge.highlight', style: { 'opacity': 0.8, 'width': 2, 'line-color': '#ffd700' }},
    { selector: '.faded', style: { 'opacity': 0.15 }},
  ],
  wheelSensitivity: 0.3,
  minZoom: 0.1,
  maxZoom: 4,
});

// Layouts — all built into cytoscape core, no external deps
const layouts = {
  cose: { name: 'cose', animate: true, animationDuration: 500, nodeRepulsion: () => 12000, idealEdgeLength: () => 100, gravity: 0.08, numIter: 1000 },
  breadthfirst: { name: 'breadthfirst', animate: true, animationDuration: 500, directed: true, spacingFactor: 1.2 },
  circle: { name: 'circle', animate: true, animationDuration: 500 },
  grid: { name: 'grid', animate: true, animationDuration: 500 },
  concentric: { name: 'concentric', animate: true, animationDuration: 500, concentric: n => n.degree() },
};

function runLayout(name) {
  const opts = layouts[name] || layouts.cose;
  cy.layout(opts).run();
}

document.getElementById('layout-select').value = 'cose';
setTimeout(() => runLayout('cose'), 100);

document.getElementById('layout-select').addEventListener('change', e => runLayout(e.target.value));
document.getElementById('btn-fit').addEventListener('click', () => cy.fit(undefined, 50));

// Theme
let dark = true;
document.getElementById('btn-theme').addEventListener('click', () => {
  dark = !dark;
  document.body.classList.toggle('light', !dark);
  cy.style().selector('node').style('color', dark ? '#8b949e' : '#57606a').update();
});

// Search
const search = document.getElementById('search');
const results = document.getElementById('search-results');
search.addEventListener('input', () => {
  const q = search.value.trim().toLowerCase();
  if (!q) { results.style.display = 'none'; return; }
  const matches = cy.nodes().filter(n => n.data('label').toLowerCase().includes(q) || n.data('file').toLowerCase().includes(q));
  if (!matches.length) { results.innerHTML = '<div class="empty">No matches</div>'; results.style.display = 'block'; return; }
  const top = matches.slice(0, 25);
  results.innerHTML = top.map(n =>
    '<div data-id="'+n.id()+'"><span class="dot" style="background:'+n.data('color')+'"></span>'+n.data('label')+' <span style="color:#8b949e;font-size:10px">'+n.data('type')+'</span></div>'
  ).join('');
  results.style.display = 'block';
});

results.addEventListener('click', e => {
  const div = e.target.closest('[data-id]');
  if (!div) return;
  const n = cy.getElementById(div.dataset.id);
  if (n.length) {
    cy.fit(n, 80);
    n.select();
    showNodeDetails(n);
    results.style.display = 'none';
    search.value = n.data('label');
  }
});

document.addEventListener('click', e => { if (!e.target.closest('#topbar')) results.style.display = 'none'; });

// Node details
const panel = document.getElementById('panel');
const panelBody = document.getElementById('panel-body');
const panelTitle = document.getElementById('panel-title');
document.getElementById('close-panel').addEventListener('click', () => panel.style.display = 'none');

cy.on('tap', 'node', e => showNodeDetails(e.target));
cy.on('tap', () => {
  const s = cy.$('node:selected');
  if (s.length && panel.style.display !== 'none') showNodeDetails(s[0]);
});

function showNodeDetails(n) {
  if (!n) return;
  const d = n.data();
  panel.style.display = 'block';
  panelTitle.innerHTML = d.label + ' <span class="tag">'+d.type+'</span>';
  const connected = n.connectedEdges().map(e => {
    const t = e.source().id() === n.id() ? e.target() : e.source();
    return { id: t.id(), label: t.data('label'), type: e.data('type'), ttype: t.data('type') };
  });
  const children = n.outgoers('node');
  const parents = n.incomers('node');
  let html = '';
  html += '<div class="section">Properties</div>';
  if (d.lang) html += row('Language', d.lang);
  html += row('File', d.file || '—');
  if (d.startLine || d.endLine) html += row('Lines', d.startLine + ' – ' + d.endLine);
  if (connected.filter(e => e.type === 'imports').length) {
    html += '<div class="section">Imports ('+connected.filter(e => e.type === 'imports').length+')</div>';
    html += '<div class="tag-list">'+connected.filter(e => e.type === 'imports').slice(0, 10).map(e => '<span>'+e.label+'</span>').join('')+'</div>';
  }
  if (connected.filter(e => e.type === 'imports' && e.ttype === 'file').length > 10) {
    html += '<div class="tag-list"><span class="dim">+'+(connected.filter(e => e.type === 'imports').length - 10)+' more</span></div>';
  }
  if (children.length) {
    html += '<div class="section">Children ('+children.length+')</div>';
    html += '<div class="tag-list">'+children.slice(0, 15).map(c => '<span>'+c.data('label')+'</span>').join('')+'</div>';
    if (children.length > 15) html += '<div class="tag-list"><span class="dim">+'+(children.length-15)+' more</span></div>';
  }
  if (connected.length) {
    html += '<div class="section">Connections ('+connected.length+')</div>';
    const groups = {};
    connected.forEach(c => { groups[c.type] = groups[c.type] || []; groups[c.type].push(c.label); });
    for (const [type, labels] of Object.entries(groups)) {
      html += '<div style="margin-top:4px"><span style="font-size:11px;color:#8b949e">'+type+':</span></div>';
      html += '<div class="tag-list">'+labels.slice(0, 5).map(l => '<span>'+l+'</span>').join('')+'</div>';
    }
  }
  panelBody.innerHTML = html;
}

function row(lbl, val) {
  return '<div class="row"><span class="lbl">'+lbl+'</span><span class="val">'+val+'</span></div>';
}

// Highlight connected on hover
cy.on('mouseover', 'node', e => {
  const n = e.target;
  const conn = n.connectedEdges();
  const connNodes = conn.connectedNodes();
  cy.elements().addClass('faded');
  n.removeClass('faded');
  conn.removeClass('faded');
  connNodes.removeClass('faded');
  conn.addClass('highlight');
  connNodes.addClass('highlight');
});

cy.on('mouseout', 'node', () => cy.elements().removeClass('faded highlight'));

// Stats
const nc = cy.nodes().length;
const ec = cy.edges().length;
document.getElementById('stats').innerHTML = '<div>'+nc+' nodes</div><div>'+ec+' edges</div>';

// Keyboard
document.addEventListener('keydown', e => {
  if (e.key === '/' && !e.target.matches('input,textarea')) { e.preventDefault(); search.focus(); }
  if (e.key === 'Escape') { panel.style.display = 'none'; results.style.display = 'none'; search.blur(); }
  if (e.key === 'f' && !e.target.matches('input,textarea')) cy.fit(undefined, 50);
});
} catch(e) { showError('Graph initialization failed', e.message); } }
</script>
</body>
</html>`;
}
