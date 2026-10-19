import React from 'react';
import { SHAPES, NODE_KIND_OPTIONS } from '@/lib/orgChartConstants';

function ShapePreview({ shape }) {
  const points = {
    diamond: '50,2 98,50 50,98 2,50',
    hexagon: '22,3 78,3 98,50 78,97 22,97 2,50',
    parallelogram: '22,3 98,3 78,97 2,97',
  }[shape];
  if (points) {
    return (
      <svg width="30" height="20" viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon points={points} fill="#e2e8f0" stroke="#475569" strokeWidth="4" />
      </svg>
    );
  }
  return (
    <div
      style={{
        width: 30, height: 20, background: '#e2e8f0', border: '1.5px solid #475569',
        borderRadius: shape === 'circle' ? '50%' : shape === 'ellipse' ? '50%' : shape === 'cylinder' ? '50% / 16%' : shape === 'rounded' ? 6 : 2,
      }}
    />
  );
}

export default function InsertPanel({ ctx }) {
  return (
    <div className="p-3 space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Cards</p>
        <div className="space-y-1">
          {NODE_KIND_OPTIONS.map(kind => (
            <button
              key={kind.key}
              type="button"
              disabled={!ctx.canEdit}
              onClick={() => ctx.addCard(kind.key)}
              className="w-full text-left rounded-md border px-2.5 py-2 hover:bg-muted disabled:opacity-40"
            >
              <span className="block text-xs font-medium">{kind.label}</span>
              <span className="block text-[10px] text-muted-foreground">{kind.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Shapes</p>
        <div className="grid grid-cols-3 gap-1.5">
          {SHAPES.map(shape => (
            <button
              key={shape.key}
              type="button"
              title={shape.label}
              disabled={!ctx.canEdit}
              onClick={() => ctx.addCard('shape', { shape: shape.key })}
              className="rounded-md border p-2 flex flex-col items-center gap-1 hover:bg-muted disabled:opacity-40"
            >
              <ShapePreview shape={shape.key} />
              <span className="text-[9px] text-muted-foreground">{shape.label}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        New cards are placed at the centre of the view. Drag them anywhere afterwards.
      </p>
    </div>
  );
}