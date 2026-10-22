import React, { forwardRef } from 'react';
import NodeCard from '@/components/orgchart/NodeCard';
import ConnectorLayer from '@/components/orgchart/ConnectorLayer';
import { nodeSize } from '@/lib/orgChartLayout';

const noop = () => {};

// Bounding box of everything that must appear in an export: cards, connectors
// (including bend points) plus an outer margin for arrowheads and shadows.
export function exportBounds(nodes = [], edges = [], { padding = 60 } = {}) {
  const visible = nodes.filter(n => n.is_visible !== false);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const add = (x, y) => {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    minX = Math.min(minX, x); minY = Math.min(minY, y);
    maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
  };
  visible.forEach(n => {
    const { w, h } = nodeSize(n);
    add(n.x, n.y);
    add(n.x + w, n.y + h);
  });
  edges.forEach(e => (e.bend_points || []).forEach(p => add(p.x, p.y)));
  if (!Number.isFinite(minX)) return { x: 0, y: 0, w: 1200, h: 800 };
  return {
    x: minX - padding,
    y: minY - padding,
    w: Math.ceil(maxX - minX + padding * 2),
    h: Math.ceil(maxY - minY + padding * 2),
  };
}

// Off-screen copy of the chart drawn at 1:1 world scale with no pan / zoom
// transform and no editing decorations, so cards and connectors rasterise with
// exactly the geometry they have on the canvas.
export default forwardRef(function ExportSurface({ rect, nodes, edges, settings, background = '#ffffff' }, ref) {
  if (!rect) return null;
  const visible = nodes.filter(n => n.is_visible !== false);
  const surfaceBg = rect.transparent ? 'transparent' : background;
  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        top: 0,
        left: -Math.ceil(rect.w) - 400,
        width: Math.ceil(rect.w),
        height: Math.ceil(rect.h),
        overflow: 'hidden',
        background: surfaceBg,
        pointerEvents: 'none',
        zIndex: -1,
      }}
    >
      <div style={{ position: 'absolute', left: -rect.x, top: -rect.y }}>
        <ConnectorLayer
          nodes={visible}
          edges={edges}
          selectedEdgeId={null}
          canEdit={false}
          onSelectEdge={noop}
          onReconnectStart={noop}
          onBendStart={noop}
        />
        {visible.map(node => (
          <NodeCard
            key={node.id}
            node={node}
            settings={settings}
            selected={false}
            multiSelected={false}
            canEdit={false}
            hovered={false}
            onPointerDown={noop}
            onDoubleClick={noop}
            onPortStart={noop}
            onQuickAdd={noop}
            onAction={noop}
            onContextMenu={noop}
          />
        ))}
      </div>
    </div>
  );
});