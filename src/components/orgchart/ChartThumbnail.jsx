import React from 'react';
import { exactBounds } from '@/lib/orgChartMerge';

export default function ChartThumbnail({ nodes = [], width = 160, height = 92 }) {
  if (!nodes.length) {
    return (
      <div
        className="rounded border bg-muted/40 flex items-center justify-center text-[9px] text-muted-foreground"
        style={{ width, height }}
      >
        Empty chart
      </div>
    );
  }
  const box = exactBounds(nodes);
  const scale = Math.min((width - 8) / box.w, (height - 8) / box.h);
  const ox = (width - box.w * scale) / 2;
  const oy = (height - box.h * scale) / 2;
  return (
    <svg width={width} height={height} className="rounded border bg-white" aria-hidden="true">
      {nodes.map(n => (
        <rect
          key={n.id}
          x={ox + ((n.x || 0) - box.x) * scale}
          y={oy + ((n.y || 0) - box.y) * scale}
          width={Math.max(1, (n.width || 260) * scale)}
          height={Math.max(1, (n.height || 118) * scale)}
          rx={1.5}
          fill={n.background_color || n.accent_color || '#cbd5e1'}
          opacity={n.node_kind === 'text' || n.node_kind === 'note' ? 0.45 : 0.85}
        />
      ))}
    </svg>
  );
}