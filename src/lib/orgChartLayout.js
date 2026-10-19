// Geometry, routing and layout helpers for the Organization Management charts:
// the reporting-tree layout used by the Divisional Org Chart and the manual
// canvas geometry used by the Visual Org Chart Builder.

export const DEFAULT_W = 260;
export const DEFAULT_H = 118;

export const nodeSize = (n) => ({ w: n?.width || DEFAULT_W, h: n?.height || DEFAULT_H });

export function nodeBounds(nodes = []) {
  if (!nodes.length) return { x: 0, y: 0, w: 1200, h: 800 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(n => {
    const { w, h } = nodeSize(n);
    minX = Math.min(minX, n.x);
    minY = Math.min(minY, n.y);
    maxX = Math.max(maxX, n.x + w);
    maxY = Math.max(maxY, n.y + h);
  });
  return { x: minX, y: minY, w: Math.max(200, maxX - minX), h: Math.max(150, maxY - minY) };
}

export function pointOnPort(node, port) {
  const { w, h } = nodeSize(node);
  switch (port) {
    case 'top': return { x: node.x + w / 2, y: node.y };
    case 'bottom': return { x: node.x + w / 2, y: node.y + h };
    case 'left': return { x: node.x, y: node.y + h / 2 };
    case 'right': return { x: node.x + w, y: node.y + h / 2 };
    default: return { x: node.x + w / 2, y: node.y + h / 2 };
  }
}

const autoPort = (from, to, preferVertical) => {
  const dx = (to.x - from.x);
  const dy = (to.y - from.y);
  if (preferVertical ? Math.abs(dy) >= Math.abs(dx) : Math.abs(dx) >= Math.abs(dy)) {
    return dy >= 0 ? 'bottom' : 'top';
  }
  return dx >= 0 ? 'right' : 'left';
};

const opposite = (port) => ({ top: 'top', bottom: 'bottom', left: 'left', right: 'right' }[port] || 'top');

export function edgeAnchors(source, target, sourcePort, targetPort) {
  const sc = pointOnPort(source, 'center');
  const tc = pointOnPort(target, 'center');
  const sPort = sourcePort && sourcePort !== 'auto' ? sourcePort : autoPort(sc, tc, true);
  const tPort = targetPort && targetPort !== 'auto' ? targetPort : opposite(autoPort(tc, sc, true));
  return { start: pointOnPort(source, sPort), end: pointOnPort(target, tPort), sPort, tPort };
}

export function buildEdgePath(start, end, sPort, tPort, style = 'orthogonal', bendPoints = []) {
  if (bendPoints && bendPoints.length) {
    return `M ${start.x} ${start.y} ` + bendPoints.map(p => `L ${p.x} ${p.y}`).join(' ') + ` L ${end.x} ${end.y}`;
  }
  if (style === 'straight') return `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  if (style === 'curved') {
    const vertical = sPort === 'top' || sPort === 'bottom';
    const c1 = vertical
      ? { x: start.x, y: start.y + (end.y - start.y) / 2 }
      : { x: start.x + (end.x - start.x) / 2, y: start.y };
    const c2 = vertical
      ? { x: end.x, y: start.y + (end.y - start.y) / 2 }
      : { x: start.x + (end.x - start.x) / 2, y: end.y };
    return `M ${start.x} ${start.y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${end.x} ${end.y}`;
  }
  const vertical = sPort === 'top' || sPort === 'bottom';
  if (vertical) {
    const mid = (start.y + end.y) / 2;
    return `M ${start.x} ${start.y} L ${start.x} ${mid} L ${end.x} ${mid} L ${end.x} ${end.y}`;
  }
  const mid = (start.x + end.x) / 2;
  return `M ${start.x} ${start.y} L ${mid} ${start.y} L ${mid} ${end.y} L ${end.x} ${end.y}`;
}

export const snapValue = (value, grid) => (grid > 1 ? Math.round(value / grid) * grid : Math.round(value));

// ---------------------------------------------------------------------------
// Alignment / distribution
// ---------------------------------------------------------------------------
export function alignNodes(nodes, ids, mode) {
  const sel = nodes.filter(n => ids.includes(n.id));
  if (sel.length < 2) return [];
  const b = nodeBounds(sel);
  return sel.map(n => {
    const { w, h } = nodeSize(n);
    switch (mode) {
      case 'left': return { id: n.id, x: b.x, y: n.y };
      case 'center': return { id: n.id, x: b.x + b.w / 2 - w / 2, y: n.y };
      case 'right': return { id: n.id, x: b.x + b.w - w, y: n.y };
      case 'top': return { id: n.id, x: n.x, y: b.y };
      case 'middle': return { id: n.id, x: n.x, y: b.y + b.h / 2 - h / 2 };
      case 'bottom': return { id: n.id, x: n.x, y: b.y + b.h - h };
      default: return { id: n.id, x: n.x, y: n.y };
    }
  });
}

export function distributeNodes(nodes, ids, axis) {
  const sel = nodes.filter(n => ids.includes(n.id));
  if (sel.length < 3) return [];
  const key = axis === 'h' ? 'x' : 'y';
  const sorted = [...sel].sort((a, b) => a[key] - b[key]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  const totalSpan = last[key] - first[key];
  const step = totalSpan / (sorted.length - 1);
  return sorted.map((n, i) => (axis === 'h' ? { id: n.id, x: first.x + step * i } : { id: n.id, y: first.y + step * i }));
}

// ---------------------------------------------------------------------------
// Automatic layout (only ever applied on explicit user request)
// ---------------------------------------------------------------------------
function hierarchy(nodes, edges) {
  const ids = nodes.map(n => n.id);
  const parent = new Map();
  const children = new Map();
  edges.forEach(e => {
    if (!e.source_id || !e.target_id || e.source_id === e.target_id) return;
    if (!ids.includes(e.source_id) || !ids.includes(e.target_id)) return;
    if (parent.has(e.target_id)) return;
    parent.set(e.target_id, e.source_id);
    if (!children.has(e.source_id)) children.set(e.source_id, []);
    children.get(e.source_id).push(e.target_id);
  });
  let roots = ids.filter(id => !parent.has(id));
  if (!roots.length) roots = ids.slice(0, 1);
  const depth = new Map();
  const seen = new Set();
  const queue = roots.map(id => { depth.set(id, 0); return id; });
  while (queue.length) {
    const id = queue.shift();
    if (seen.has(id)) continue;
    seen.add(id);
    (children.get(id) || []).forEach(c => {
      if (!depth.has(c)) depth.set(c, (depth.get(id) || 0) + 1);
      queue.push(c);
    });
  }
  let maxDepth = 0;
  depth.forEach(v => { maxDepth = Math.max(maxDepth, v); });
  nodes.forEach(n => { if (!depth.has(n.id)) { depth.set(n.id, maxDepth + 1); maxDepth += 1; } });
  const levels = new Map();
  nodes.forEach(n => {
    const d = depth.get(n.id) || 0;
    if (!levels.has(d)) levels.set(d, []);
    levels.get(d).push(n);
  });
  return { levels, children };
}

const levelRows = (nodes, levels) => {
  const rows = [];
  const maxLevel = Math.max(...[...levels.keys()]);
  for (let i = 0; i <= maxLevel; i += 1) {
    rows.push((levels.get(i) || []).slice().sort((a, b) => (a.x - b.x) || (a.created_date || '').localeCompare(b.created_date || '')));
  }
  return rows.filter(r => r.length);
};

export function autoLayout(mode, nodes, edges) {
  if (!nodes.length) return [];
  const { levels } = hierarchy(nodes, edges);
  const patches = [];
  const sizes = new Map(nodes.map(n => [n.id, nodeSize(n)]));
  const maxW = Math.max(...nodes.map(n => nodeSize(n).w));
  const maxH = Math.max(...nodes.map(n => nodeSize(n).h));
  const gapX = maxW + 60;
  const gapY = maxH + 90;
  const push = (rows, place) => {
    const widest = Math.max(...rows.map(r => r.length));
    rows.forEach((row, r) => {
      row.forEach((n, i) => {
        const { w, h } = sizes.get(n.id);
        const totalW = row.length * gapX;
        const x = 200 + (widest * gapX) / 2 - totalW / 2 + i * gapX + (gapX - w) / 2;
        patches.push({ id: n.id, ...place(x, 120 + r * gapY, w, h, i, r) });
      });
    });
  };

  if (mode === 'compact') {
    const cols = Math.max(1, Math.ceil(Math.sqrt(nodes.length)));
    nodes.forEach((n, i) => {
      const { w, h } = sizes.get(n.id);
      patches.push({ id: n.id, x: 120 + (i % cols) * gapX, y: 120 + Math.floor(i / cols) * gapY, });
      if (!w || !h) return;
    });
    return patches;
  }

  if (mode === 'matrix') {
    const groups = new Map();
    nodes.forEach(n => {
      const key = n.department || n.company || 'Unassigned';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    });
    let col = 0;
    groups.forEach(list => {
      list
        .slice()
        .sort((a, b) => (a.z_index || 1) - (b.z_index || 1))
        .forEach((n, row) => {
          const { w } = sizes.get(n.id);
          patches.push({ id: n.id, x: 140 + col * gapX + (gapX - w) / 2, y: 120 + row * gapY });
        });
      col += 1;
    });
    return patches;
  }

  if (mode === 'divisional') {
    const groups = new Map();
    nodes.forEach(n => {
      const key = n.company || n.department || 'Corporate';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(n);
    });
    let col = 0;
    groups.forEach(list => {
      list.slice().sort((a, b) => (a.x - b.x)).forEach((n, row) => {
        const { w } = sizes.get(n.id);
        patches.push({ id: n.id, x: 140 + col * gapX + (gapX - w) / 2, y: 100 + row * gapY });
      });
      col += 1;
    });
    return patches;
  }

  if (mode === 'radial') {
    const rows = levelRows(nodes, levels);
    const cx = 900;
    const cy = 700;
    rows.forEach((row, level) => {
      const radius = level * Math.max(300, maxW * 1.3);
      row.forEach((n, i) => {
        const angle = (2 * Math.PI * i) / Math.max(1, row.length) - Math.PI / 2;
        const { w, h } = sizes.get(n.id);
        patches.push({
          id: n.id,
          x: cx + radius * Math.cos(angle) - w / 2,
          y: cy + radius * Math.sin(angle) - h / 2,
        });
      });
    });
    return patches;
  }

  const rows = levelRows(nodes, levels);
  if (mode === 'left_to_right' || mode === 'right_to_left') {
    const flip = mode === 'right_to_left';
    rows.forEach((row, level) => {
      row.forEach((n, i) => {
        const { w, h } = sizes.get(n.id);
        const col = flip ? (rows.length - 1 - level) : level;
        patches.push({
          id: n.id,
          x: 120 + col * gapX,
          y: 120 + i * gapY + (level === 0 ? 0 : 0),
          width: w, height: h,
        });
      });
    });
    return patches;
  }
  const upsideDown = mode === 'bottom_to_top';
  const tight = mode === 'tree';
  const rowsToUse = upsideDown ? [...rows].reverse() : rows;
  rowsToUse.forEach((row, r) => {
    const rowIndex = upsideDown ? rows.length - 1 - r : r;
    const widest = Math.max(...rows.map(x => x.length));
    const totalW = row.length * gapX;
    row.forEach((n, i) => {
      const { w, h } = sizes.get(n.id);
      patches.push({
        id: n.id,
        x: 200 + (widest * gapX) / 2 - totalW / 2 + i * gapX + (gapX - w) / 2,
        y: 110 + rowIndex * (tight ? gapY * 0.8 : gapY) - (upsideDown ? 0 : 0),
      });
      if (!w || !h) return;
    });
  });
  return patches;
}

// ---------------------------------------------------------------------------
// Reporting-tree layout used by the Divisional Organization Chart.
// Returns card centres (x), tops (y), the connector list and the canvas size.
// ---------------------------------------------------------------------------
export const LAYOUT = { nodeWidth: 200, nodeHeight: 86, hGap: 26, vGap: 74 };

export function computeLayout(tree, collapsedSet = new Set()) {
  const { nodeWidth, nodeHeight, hGap, vGap } = LAYOUT;
  const positions = new Map();
  const edges = [];
  let cursor = 0;
  let maxDepth = 0;

  const walk = (node, depth) => {
    maxDepth = Math.max(maxDepth, depth);
    const allChildren = node.children || [];
    const visibleChildren = collapsedSet.has(node.id) ? [] : allChildren;
    let x;
    if (visibleChildren.length) {
      const childXs = visibleChildren.map(child => walk(child, depth + 1));
      x = (childXs[0] + childXs[childXs.length - 1]) / 2;
    } else {
      x = cursor + nodeWidth / 2;
      cursor += nodeWidth + hGap;
    }
    positions.set(node.id, {
      x,
      y: depth * (nodeHeight + vGap),
      depth,
      childCount: allChildren.length,
      collapsed: collapsedSet.has(node.id),
    });
    visibleChildren.forEach(child => edges.push({ from: node.id, to: child.id }));
    return x;
  };

  (tree || []).forEach(root => {
    walk(root, 0);
    cursor += hGap;
  });

  return {
    positions,
    edges,
    width: Math.max(cursor, nodeWidth + hGap),
    height: (maxDepth + 1) * (nodeHeight + vGap),
    nodeWidth,
    nodeHeight,
  };
}