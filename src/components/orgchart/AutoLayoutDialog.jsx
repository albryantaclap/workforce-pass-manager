import React, { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AUTO_LAYOUT_MODES } from '@/lib/orgChartConstants';
import { autoLayout, nodeBounds, nodeSize } from '@/lib/orgChartLayout';

export default function AutoLayoutDialog({ open, nodes, edges, onClose, onApply }) {
  const [mode, setMode] = useState('top_to_bottom');

  useEffect(() => { if (open) setMode('top_to_bottom'); }, [open]);

  const preview = useMemo(() => {
    if (!open || !nodes.length) return null;
    const patches = autoLayout(mode, nodes, edges);
    const positionMap = new Map(patches.map(p => [p.id, { ...nodes.find(n => n.id === p.id), ...p }]));
    const arranged = nodes.map(n => positionMap.get(n.id) || n);
    const bounds = nodeBounds(arranged);
    const scale = Math.min(520 / bounds.w, 300 / bounds.h);
    return { arranged, bounds, scale };
  }, [open, mode, nodes, edges]);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Auto layout</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {AUTO_LAYOUT_MODES.map(item => (
              <button
                key={item.key}
                type="button"
                onClick={() => setMode(item.key)}
                className={`px-2.5 py-1 rounded-full border text-[11px] ${mode === item.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          <div className="rounded-md border bg-muted/20 overflow-hidden" style={{ height: 320 }}>
            {preview && (
              <svg width="100%" height="100%" viewBox={`0 0 560 320`}>
                <g transform={`translate(20,10) scale(${preview.scale}) translate(${-preview.bounds.x} ${-preview.bounds.y})`}>
                  {edges.map(edge => {
                    const source = preview.arranged.find(n => n.id === edge.source_id);
                    const target = preview.arranged.find(n => n.id === edge.target_id);
                    if (!source || !target) return null;
                    const a = nodeSize(source);
                    const b = nodeSize(target);
                    return (
                      <line
                        key={edge.id}
                        x1={source.x + a.w / 2}
                        y1={source.y + a.h}
                        x2={target.x + b.w / 2}
                        y2={target.y}
                        stroke="#94a3b8"
                        strokeWidth={2}
                      />
                    );
                  })}
                  {preview.arranged.map(node => {
                    const size = nodeSize(node);
                    return (
                      <rect
                        key={node.id}
                        x={node.x}
                        y={node.y}
                        width={size.w}
                        height={size.h}
                        rx={8}
                        fill="#ffffff"
                        stroke={node.accent_color || '#254dd0'}
                        strokeWidth={2}
                      />
                    );
                  })}
                </g>
              </svg>
            )}
            {!preview && <p className="p-4 text-[11px] text-muted-foreground">Nothing to arrange yet.</p>}
          </div>

          <p className="text-[10px] text-muted-foreground">
            This is a preview only. Manual positions stay exactly where they are until you apply the layout, and one Undo puts everything back.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onApply(mode); onClose(); }}>Apply layout</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}