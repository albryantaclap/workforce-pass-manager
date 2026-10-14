// Pure hierarchical tree layout engine for the Divisional Org Chart.
// Positions parent nodes centered above their children; siblings laid out
// left-to-right with equal slot widths. No coordinates are hardcoded.

export const LAYOUT = {
  nodeWidth: 214,
  nodeHeight: 112,
  hGap: 30,
  vGap: 78,
};

export function computeLayout(roots, collapsedSet) {
  const { nodeWidth, nodeHeight, hGap, vGap } = LAYOUT;
  const unit = nodeWidth + hGap; // width per leaf slot
  const levelH = nodeHeight + vGap;
  const positions = new Map();
  const edges = [];
  let cursor = 0;
  let maxDepth = 0;

  function layout(node, depth) {
    maxDepth = Math.max(maxDepth, depth);
    const isCollapsed = collapsedSet.has(node.id);
    const children = node.children || [];
    if (isCollapsed || children.length === 0) {
      const x = cursor + nodeWidth / 2;
      cursor += unit;
      positions.set(node.id, {
        x,
        y: depth * levelH,
        collapsed: isCollapsed && children.length > 0,
        childCount: children.length,
      });
      return x;
    }
    const centers = children.map((c) => {
      edges.push({ from: node.id, to: c.id });
      return layout(c, depth + 1);
    });
    const cx = (centers[0] + centers[centers.length - 1]) / 2;
    positions.set(node.id, { x: cx, y: depth * levelH, collapsed: false, childCount: children.length });
    return cx;
  }

  for (const r of roots) layout(r, 0);

  const width = cursor;
  const height = (maxDepth + 1) * levelH;
  return { positions, edges, width, height, nodeWidth, nodeHeight, vGap, levelH };
}