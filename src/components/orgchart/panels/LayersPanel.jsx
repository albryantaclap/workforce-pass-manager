import React from 'react';
import { Lock, Unlock, Eye, EyeOff, Trash2 } from 'lucide-react';

export default function LayersPanel({ ctx }) {
  const sorted = [...ctx.nodes].sort((a, b) => (b.z_index || 1) - (a.z_index || 1));
  const edges = ctx.edges;

  return (
    <div className="p-3 space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Cards ({ctx.nodes.length})</p>
        <div className="space-y-0.5">
          {sorted.map(node => {
            const selected = ctx.selection.includes(node.id);
            return (
              <div key={node.id} className={`flex items-center gap-1 rounded px-1.5 py-1 ${selected ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                <button
                  type="button"
                  className="flex-1 text-left min-w-0"
                  onClick={() => ctx.setSelection([node.id])}
                >
                  <span className="block text-[11px] truncate">{node.name || node.node_kind}</span>
                  <span className="block text-[9px] text-muted-foreground">
                    z{node.z_index || 1} · {node.node_kind}{node.group_id ? ' · grouped' : ''}
                  </span>
                </button>
                <button
                  type="button"
                  title={node.is_visible === false ? 'Show' : 'Hide'}
                  className="p-1 hover:bg-background rounded"
                  onClick={() => ctx.updateNodes([{ id: node.id, is_visible: node.is_visible === false }])}
                >
                  {node.is_visible === false ? <EyeOff className="w-3 h-3 text-muted-foreground" /> : <Eye className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  title={node.is_locked ? 'Unlock' : 'Lock'}
                  className="p-1 hover:bg-background rounded"
                  onClick={() => ctx.updateNodes([{ id: node.id, is_locked: !node.is_locked }])}
                >
                  {node.is_locked ? <Lock className="w-3 h-3 text-amber-600" /> : <Unlock className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  title="Delete card"
                  className="p-1 hover:bg-background rounded text-red-600"
                  onClick={() => ctx.removeNodes([node.id])}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            );
          })}
          {!sorted.length && <p className="text-[11px] text-muted-foreground">No cards yet.</p>}
        </div>
      </div>

      <div className="border-t pt-3">
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Connectors ({edges.length})</p>
        <div className="space-y-0.5">
          {edges.map(edge => {
            const source = ctx.nodes.find(n => n.id === edge.source_id);
            const target = ctx.nodes.find(n => n.id === edge.target_id);
            return (
              <button
                key={edge.id}
                type="button"
                onClick={() => ctx.setSelectedEdgeId(edge.id)}
                className={`w-full text-left rounded px-1.5 py-1 ${ctx.selectedEdgeId === edge.id ? 'bg-primary/10' : 'hover:bg-muted'}`}
              >
                <span className="block text-[10px] truncate">
                  {source?.name || '—'} → {target?.name || '—'}
                </span>
                <span className="block text-[9px] text-muted-foreground">
                  {edge.relationship_type}{edge.is_official ? ' · official' : ''}
                </span>
              </button>
            );
          })}
          {!edges.length && <p className="text-[11px] text-muted-foreground">No connectors yet.</p>}
        </div>
      </div>
    </div>
  );
}