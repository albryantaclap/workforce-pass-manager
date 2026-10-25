import React from 'react';
import { HANDLE_CURSORS, RESIZE_HANDLES } from '@/lib/orgChartResize';

// Anchors are expressed in the object's own box (0 / 50 / 100 %), so the whole
// overlay rotates with the object and never drifts from its edges.
const POSITION = {
  nw: { left: 0, top: 0 },
  n: { left: '50%', top: 0 },
  ne: { left: '100%', top: 0 },
  e: { left: '100%', top: '50%' },
  se: { left: '100%', top: '100%' },
  s: { left: '50%', top: '100%' },
  sw: { left: 0, top: '100%' },
  w: { left: 0, top: '50%' },
};

// Mid-edge handles sit a few pixels outside the box so the card's own connector
// ports (centred on the same edges) stay clickable exactly on the edge.
const OUTSET = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };

export default function ResizeHandles({
  x, y, width, height, rotation = 0, zoom = 1,
  handles = RESIZE_HANDLES, showRotate = false,
  onHandleDown, onRotateDown,
}) {
  const z = zoom || 1;
  const dot = 9 / z;
  const hit = 18 / z;
  const outset = 11 / z;
  const stroke = 1.5 / z;

  const capture = (e) => {
    e.stopPropagation();
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* capture unsupported */ }
  };

  return (
    <div
      data-resize-box
      className="absolute"
      style={{
        left: x,
        top: y,
        width,
        height,
        transform: rotation ? `rotate(${rotation}deg)` : undefined,
        transformOrigin: '50% 50%',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          position: 'absolute', inset: 0,
          border: `${1 / z}px solid rgba(37,77,208,0.85)`,
          pointerEvents: 'none',
        }}
      />

      {handles.map((handle) => {
        const dir = OUTSET[handle] || [0, 0];
        return (
          <div
            key={handle}
            title={`Resize ${handle}`}
            onPointerDown={(e) => { capture(e); onHandleDown?.(handle, e); }}
            onContextMenu={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              ...POSITION[handle],
              width: hit,
              height: hit,
              transform: `translate(calc(-50% + ${dir[0] * outset}px), calc(-50% + ${dir[1] * outset}px))`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: HANDLE_CURSORS[handle] || 'nwse-resize',
              pointerEvents: 'auto',
              touchAction: 'none',
            }}
          >
            <span
              style={{
                width: dot,
                height: dot,
                borderRadius: 9999,
                background: '#ffffff',
                border: `${stroke}px solid #254dd0`,
                boxSizing: 'border-box',
              }}
            />
          </div>
        );
      })}

      {showRotate && (
        <div
          title="Rotate"
          onPointerDown={(e) => { capture(e); onRotateDown?.(e); }}
          onContextMenu={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: '50%',
            top: -30 / z,
            width: hit,
            height: hit,
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'grab',
            pointerEvents: 'auto',
            touchAction: 'none',
          }}
        >
          <span
            style={{
              width: dot,
              height: dot,
              borderRadius: 9999,
              background: '#ffffff',
              border: `${stroke}px solid #0f766e`,
              boxSizing: 'border-box',
            }}
          />
        </div>
      )}
    </div>
  );
}