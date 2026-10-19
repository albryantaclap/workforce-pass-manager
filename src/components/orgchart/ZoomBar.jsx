import React, { useMemo } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Map, HelpCircle } from 'lucide-react';
import { nodeBounds, nodeSize } from '@/lib/orgChartLayout';

function MiniMap({ nodes, view, containerRef, onJump }) {
  const bounds = useMemo(() => {
    const b = nodeBounds(nodes.filter(n => n.is_visible !== false));
    const pad = 120;
    return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
  }, [nodes]);
  const W = 190;
  const H = 120;
  const scale = Math.min(W / bounds.w, H / bounds.h);
  const rect = containerRef.current?.getBoundingClientRect();
  const viewRect = rect
    ? {
      x: (-view.x / view.zoom - bounds.x) * scale,
      y: (-view.y / view.zoom - bounds.y) * scale,
      w: (rect.width / view.zoom) * scale,
      h: (rect.height / view.zoom) * scale,
    }
    : null;

  return (
    <div className="absolute bottom-4 right-4 z-30 rounded-lg border bg-card/95 shadow-lg p-2" style={{ width: W + 16 }}>
      <div
        className="relative rounded bg-muted/40"
        style={{ width: W, height: H }}
        onClick={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const worldX = (e.clientX - box.left) / scale + bounds.x;
          const worldY = (e.clientY - box.top) / scale + bounds.y;
          onJump(worldX, worldY);
        }}
      >
        <svg width={W} height={H} className="absolute inset-0">
          {nodes.filter(n => n.is_visible !== false).map(n => {
            const size = nodeSize(n);
            return (
              <rect
                key={n.id}
                x={(n.x - bounds.x) * scale}
                y={(n.y - bounds.y) * scale}
                width={Math.max(2, size.w * scale)}
                height={Math.max(2, size.h * scale)}
                rx={1}
                fill={n.accent_color || '#94a3b8'}
                opacity={0.75}
              />
            );
          })}
          {viewRect && (
            <rect
              x={viewRect.x} y={viewRect.y} width={viewRect.w} height={viewRect.h}
              fill="rgba(37,77,208,0.12)" stroke="#254dd0" strokeWidth={1}
            />
          )}
        </svg>
      </div>
    </div>
  );
}

export default function ZoomBar({
  zoom, onZoom, onFit, showMinimap, setShowMinimap, nodes, view, containerRef, onJump, onHelp,
}) {
  const btn = 'p-1.5 rounded hover:bg-muted text-foreground';
  return (
    <>
      <div className="absolute bottom-4 right-4 z-30 flex items-center gap-1 rounded-xl border bg-card/95 backdrop-blur px-2 py-1.5 shadow-lg">
        <button type="button" title="Zoom out" className={btn} onClick={() => onZoom(1 / 1.2)}>
          <ZoomOut className="w-4 h-4" />
        </button>
        <span className="text-xs font-medium w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" title="Zoom in" className={btn} onClick={() => onZoom(1.2)}>
          <ZoomIn className="w-4 h-4" />
        </button>
        <button type="button" title="Fit to screen" className={btn} onClick={onFit}>
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          type="button"
          title="Mini map"
          className={`${btn} ${showMinimap ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}
          onClick={() => setShowMinimap(v => !v)}
        >
          <Map className="w-4 h-4" />
        </button>
        <button type="button" title="Help" className={btn} onClick={onHelp}>
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>
      {showMinimap && (
        <div className="absolute" style={{ bottom: 68, right: 16 }}>
          <MiniMap nodes={nodes} view={view} containerRef={containerRef} onJump={onJump} />
        </div>
      )}
    </>
  );
}