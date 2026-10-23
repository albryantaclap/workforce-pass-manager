import React from 'react';
import { exactBounds } from '@/lib/orgChartMerge';

// Shows where the incoming charts will land, next to the cards already on the canvas.
export default function InsertPlacementPreview({ destNodes = [], bundles = [], offsets = [], width = 520, height = 180 }) {
  const ghostNodes = bundles.flatMap((bundle, index) => {
    const offset = offsets[index] || { x: 0, y: 0 };
    return (bundle.nodes || []).map(n => ({
      ...n,
      x: (n.x || 0) + offset.x,
      y: (n.y || 0) + offset.y,
      __ghost: true,
    }));
  });
  const all = [...destNodes.map(n => ({ ...n, __ghost: false })), ...ghostNodes];
  if (!all.length) {
    return <div className="rounded-md border bg-muted/30 text-[10px] text-muted-foreground p-3">Nothing to place yet.</div>;
  }
  const box = exactBounds(all);
  const scale = Math.min((width - 16) / box.w, (height - 16) / box.h);
  const ox = (width - box.w * scale) / 2;
  const oy = (height - box.h * scale) / 2;
  const groupBoxes = bundles.map((bundle, index) => {
    const offset = offsets[index] || { x: 0, y: 0 };
    const shifted = (bundle.nodes || []).map(n => ({ ...n, x: (n.x || 0) + offset.x, y: (n.y || 0) + offset.y }));
    return { key: bundle.chart?.id || index, box: exactBounds(shifted), name: bundle.chart?.name || '' };
  });

  return (
    <svg width={width} height={height} className="rounded-md border bg-muted/20">
      {groupBoxes.map(group => (
        <g key={group.key}>
          <rect
            x={ox + (group.box.x - box.x) * scale - 3}
            y={oy + (group.box.y - box.y) * scale - 3}
            width={group.box.w * scale + 6}
            height={group.box.h * scale + 6}
            rx={4}
            fill="none"
            stroke="#254dd0"
            strokeDasharray="4 3"
            strokeWidth={1}
          />
          <text
            x={ox + (group.box.x - box.x) * scale}
            y={oy + (group.box.y - box.y) * scale - 6}
            fontSize={8}
            fill="#254dd0"
          >
            {group.name}
          </text>
        </g>
      ))}
      {all.map(n => (
        <rect
          key={`${n.id}-${n.__ghost ? 'g' : 'd'}`}
          x={ox + ((n.x || 0) - box.x) * scale}
          y={oy + ((n.y || 0) - box.y) * scale}
          width={Math.max(1, (n.width || 260) * scale)}
          height={Math.max(1, (n.height || 118) * scale)}
          rx={1.5}
          fill={n.__ghost ? '#254dd0' : '#cbd5e1'}
          opacity={n.__ghost ? 0.55 : 0.5}
        />
      ))}
    </svg>
  );
}