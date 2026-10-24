// Object layering for the Visual Chart Builder.
//
// Every card carries a numeric z_index. Cards at z_index <= 0 live in the
// background band, painted behind the connector layer, so a large shape sent to
// the back never hides reporting lines. Everything else sits above the
// connectors. Values are kept dense (…-2 -1 | 1 2 …) so ordering is stable.

export const DEFAULT_Z = 1;

export const zOf = (node) => {
  const value = Number(node?.z_index);
  return Number.isFinite(value) ? value : DEFAULT_Z;
};

export const isBackgroundNode = (node) => zOf(node) <= 0;

// Painter's order: background band first, then the foreground band.
export const sortByLayer = (nodes = []) => [...nodes].sort((a, b) => zOf(a) - zOf(b) || (a.id < b.id ? -1 : 1));

const moveBlock = (order, selected, mode) => {
  const block = order.filter(n => selected.has(n.id));
  const rest = order.filter(n => !selected.has(n.id));
  if (mode === 'front') return [...rest, ...block];
  if (mode === 'back') return [...block, ...rest];
  const next = order.slice();
  if (mode === 'forward') {
    for (let i = next.length - 2; i >= 0; i -= 1) {
      if (selected.has(next[i].id) && !selected.has(next[i + 1].id)) {
        [next[i], next[i + 1]] = [next[i + 1], next[i]];
      }
    }
    return next;
  }
  if (mode === 'backward') {
    for (let i = 1; i < next.length; i += 1) {
      if (selected.has(next[i].id) && !selected.has(next[i - 1].id)) {
        [next[i], next[i - 1]] = [next[i - 1], next[i]];
      }
    }
    return next;
  }
  return null;
};

// Returns the z_index patches for one layer action.
// mode: 'front' | 'forward' | 'backward' | 'back'
export function reorderNodes(nodes, ids, mode) {
  const selected = new Set(ids || []);
  if (!nodes?.length || !selected.size) return [];
  const order = sortByLayer(nodes);
  const next = moveBlock(order, selected, mode);
  if (!next) return [];

  const background = new Set(order.filter(isBackgroundNode).map(n => n.id));
  const block = order.filter(n => selected.has(n.id));
  // The background band is the contiguous run of z <= 0 objects at the bottom,
  // so its position in the order is the band boundary.
  const bgCount = order.filter(isBackgroundNode).length;
  const position = new Map(next.map((n, i) => [n.id, i]));
  if (mode === 'front') block.forEach(n => background.delete(n.id));
  if (mode === 'back') block.forEach(n => background.add(n.id));
  if (mode === 'forward' && Math.max(...block.map(n => position.get(n.id))) >= bgCount) {
    block.forEach(n => background.delete(n.id));
  }
  if (mode === 'backward' && Math.min(...block.map(n => position.get(n.id))) < bgCount) {
    block.forEach(n => background.add(n.id));
  }

  const back = next.filter(n => background.has(n.id));
  const front = next.filter(n => !background.has(n.id));
  const before = new Map(nodes.map(n => [n.id, zOf(n)]));
  return [
    ...back.map((n, i) => ({ id: n.id, z_index: i - back.length })),
    ...front.map((n, i) => ({ id: n.id, z_index: i + 1 })),
  ].filter(patch => before.get(patch.id) !== patch.z_index);
}

// Shape/card transparency + border helpers shared by the canvas and exports.
export const isFillNone = (node) => node?.fill_mode === 'none';
export const borderStyleOf = (node) => node?.border_style || 'solid';
export const strokeDashOf = (node) => {
  const style = borderStyleOf(node);
  return style === 'dashed' ? '7 5' : style === 'dotted' ? '2 3' : undefined;
};
export const opacityOf = (node) => {
  const raw = node?.opacity;
  if (raw === undefined || raw === null || raw === '') return 1;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) / 100 : 1;
};