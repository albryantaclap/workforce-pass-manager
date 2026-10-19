import React, { useMemo } from 'react';
import { buildEdgePath, edgeAnchors } from '@/lib/orgChartLayout';
import { connectorColor } from '@/lib/orgChartConstants';

export default function ConnectorLayer({
  nodes, edges, selectedEdgeId, onSelectEdge, onReconnectStart, onBendStart, canEdit,
}) {
  const byId = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  const arrows = useMemo(
    () => edges.filter(e => e.arrow !== false).map(e => ({ id: e.id, color: e.color || connectorColor(e.relationship_type) })),
    [edges]
  );

  return (
    <svg className="absolute left-0 top-0" style={{ width: 1, height: 1, overflow: 'visible', pointerEvents: 'none' }}>
      <defs>
        {arrows.map(a => (
          <marker
            key={a.id}
            id={`oc-arrow-${a.id}`}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={a.color} />
          </marker>
        ))}
      </defs>
      {edges.map(edge => {
        const source = byId.get(edge.source_id);
        const target = byId.get(edge.target_id);
        if (!source || !target) return null;
        const { start, end, sPort, tPort } = edgeAnchors(source, target, edge.source_port, edge.target_port);
        const d = buildEdgePath(start, end, sPort, tPort, edge.path_style || 'orthogonal', edge.bend_points);
        const color = edge.color || connectorColor(edge.relationship_type);
        const dash = edge.line_style === 'dashed' ? '9 6' : edge.line_style === 'dotted' ? '2 5' : undefined;
        const selected = edge.id === selectedEdgeId;
        const thickness = edge.thickness || 1.5;
        const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
        return (
          <g key={edge.id}>
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
              onPointerDown={(e) => { e.stopPropagation(); onSelectEdge(edge.id); }}
              onDoubleClick={(e) => { e.stopPropagation(); onSelectEdge(edge.id, true); }}
            />
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={selected ? thickness + 1 : thickness}
              strokeDasharray={dash}
              markerEnd={edge.arrow !== false ? `url(#oc-arrow-${edge.id})` : undefined}
            />
            {edge.label && (
              <g>
                <rect
                  x={mid.x - Math.max(28, edge.label.length * 3.6)}
                  y={mid.y - 9}
                  width={Math.max(56, edge.label.length * 7.2)}
                  height={18}
                  rx={4}
                  fill="#ffffff"
                  stroke={`${color}55`}
                />
                <text
                  x={mid.x}
                  y={mid.y + 3}
                  textAnchor="middle"
                  fontSize="10"
                  fill="#334155"
                  fontFamily="Inter, Arial, sans-serif"
                >
                  {edge.label}
                </text>
              </g>
            )}
            {(edge.bend_points || []).map((point, index) => (
              <circle
                key={`${edge.id}-bend-${index}`}
                cx={point.x}
                cy={point.y}
                r={5}
                fill="#ffffff"
                stroke={color}
                strokeWidth={2}
                style={{ pointerEvents: canEdit ? 'auto' : 'none', cursor: 'move' }}
                onPointerDown={(e) => { e.stopPropagation(); onBendStart(edge.id, index, e); }}
              />
            ))}
            {selected && canEdit && (
              <g>
                <circle
                  cx={start.x} cy={start.y} r={6} fill="#ffffff" stroke={color} strokeWidth={2}
                  style={{ pointerEvents: 'auto', cursor: 'crosshair' }}
                  onPointerDown={(e) => { e.stopPropagation(); onReconnectStart(edge.id, 'target', e); }}
                />
                <circle
                  cx={end.x} cy={end.y} r={6} fill="#ffffff" stroke={color} strokeWidth={2}
                  style={{ pointerEvents: 'auto', cursor: 'crosshair' }}
                  onPointerDown={(e) => { e.stopPropagation(); onReconnectStart(edge.id, 'source', e); }}
                />
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}