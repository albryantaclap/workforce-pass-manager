import React from 'react';
import { legendConfig, visibleEntries } from '@/lib/orgChartLegend';

const SHADOWS = {
  none: 'none',
  sm: '0 1px 2px rgba(15,23,42,0.15)',
  md: '0 4px 10px rgba(15,23,42,0.12)',
  lg: '0 10px 25px rgba(15,23,42,0.18)',
};

// The legend drawn on the canvas and in exports. Same component in both places,
// so the exported legend matches what the user sees while editing.
export default function LegendCard({
  node, selected, canEdit, dimmed, highlightedColor, onEntryClick,
  onPointerDown, onDoubleClick, onContextMenu, interactive = true,
}) {
  const cfg = legendConfig(node);
  const entries = visibleEntries(node);
  const fillNone = node.fill_mode === 'none';
  const borderWidth = Number(node.border_width || 0);
  const radius = Number(node.corner_radius ?? 8);
  const fontSize = Number(node.font_size) || 13;
  const pad = Number(node.padding ?? 14);
  const swatch = Math.max(4, Number(cfg.swatch_size) || 12);
  const gap = cfg.layout === 'compact' ? Math.max(2, (Number(cfg.row_spacing) || 8) / 2) : (Number(cfg.row_spacing) || 8);
  const opacity = node.opacity === undefined || node.opacity === null || node.opacity === ''
    ? 1
    : Math.min(100, Math.max(0, Number(node.opacity))) / 100;

  const listStyle = cfg.layout === 'two_column'
    ? { display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 16, rowGap: gap }
    : cfg.layout === 'horizontal'
      ? { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 16 }
      : { display: 'flex', flexDirection: 'column', gap };

  const clickable = interactive && typeof onEntryClick === 'function';

  return (
    <div
      data-node-id={node.id}
      data-legend-id={node.id}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width || 240,
        height: node.height || 200,
        zIndex: Number.isFinite(Number(node.z_index)) ? Number(node.z_index) : 1,
        transform: node.rotation ? `rotate(${node.rotation}deg)` : undefined,
        opacity: dimmed ? 0.18 : (node.is_visible === false ? 0.25 : opacity),
        pointerEvents: interactive ? undefined : 'none',
      }}
      className="select-none"
      onPointerDown={interactive ? (e) => onPointerDown?.(node, e) : undefined}
      onDoubleClick={interactive ? (e) => { e.stopPropagation(); onDoubleClick?.(node); } : undefined}
      onContextMenu={interactive ? (e) => onContextMenu?.(e, node.id) : undefined}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: fillNone ? 'transparent' : (node.background_color || '#ffffff'),
          border: borderWidth > 0 ? `${borderWidth}px ${node.border_style || 'solid'} ${node.border_color || '#dcdfe5'}` : 'none',
          borderRadius: radius,
          boxShadow: SHADOWS[node.shadow || 'sm'],
          color: node.text_color || '#333333',
          fontFamily: cfg.font_family || undefined,
          overflow: 'visible',
          outline: selected ? '2px solid #254dd0' : 'none',
          outlineOffset: 2,
        }}
      >
        {cfg.show_header && (
          <div
            style={{
              background: cfg.header_color,
              color: cfg.header_text_color,
              padding: '6px 12px',
              fontSize: fontSize + 1,
              fontWeight: 700,
              letterSpacing: '0.01em',
              borderRadius: `${radius}px ${radius}px 0 0`,
              whiteSpace: 'nowrap',
              overflow: 'visible',
            }}
          >
            {node.name || 'Legend'}
          </div>
        )}

        <div style={{ padding: pad, ...listStyle, flex: 1, minHeight: 0 }}>
          {entries.map((entry) => {
            const isActive = highlightedColor && highlightedColor === entry.color;
            const rowStyle = {
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 0,
              background: isActive ? 'rgba(37,77,208,0.10)' : 'transparent',
              borderRadius: 4,
              padding: isActive ? '2px 4px' : 0,
              border: 'none',
              color: 'inherit',
              font: 'inherit',
              textAlign: 'left',
              cursor: clickable ? 'pointer' : 'default',
            };
            const content = (
              <>
                <span
                  style={{
                    width: swatch,
                    height: swatch,
                    flexShrink: 0,
                    background: entry.color,
                    borderRadius: cfg.swatch_shape === 'square' ? 3 : 9999,
                    border: '1px solid rgba(15,23,42,0.12)',
                  }}
                />
                <span style={{ overflowWrap: 'anywhere', lineHeight: 1.35, fontSize, fontWeight: Number(node.font_weight) || 500 }}>
                  {entry.label || entry.color}
                </span>
              </>
            );
            if (!clickable) return <div key={entry.id} style={rowStyle}>{content}</div>;
            return (
              <button
                key={entry.id}
                type="button"
                title={`Highlight objects using ${entry.color}`}
                style={rowStyle}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onEntryClick(entry)}
              >
                {content}
              </button>
            );
          })}

          {!entries.length && (
            <div style={{ fontSize: fontSize - 1, opacity: 0.6, fontStyle: 'italic', whiteSpace: 'nowrap' }}>
              No legend items yet
            </div>
          )}
        </div>
      </div>
    </div>
  );
}