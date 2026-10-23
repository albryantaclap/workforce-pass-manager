import React, { useState } from 'react';
import {
  AlertTriangle, ChevronDown, ChevronUp, Copy, Focus, Layers, Link2, Lock, Maximize2, Pencil,
  RefreshCw, Unlink, Unlock, Trash2,
} from 'lucide-react';

const MODE_LABELS = { copy: 'Copied', linked: 'Linked', snapshot: 'Snapshot' };

const action = 'inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] hover:bg-muted disabled:opacity-40';

export default function ImportedGroupsPanel({ ctx }) {
  const groups = ctx.groups;
  const [collapsed, setCollapsed] = useState(false);
  const list = groups?.list || [];

  if (!groups) return null;

  return (
    <div className="border-t pt-3 space-y-1.5">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCollapsed(prev => !prev)}
          className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground"
        >
          {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          Inserted charts ({list.length})
        </button>
        <button
          type="button"
          disabled={!ctx.canEdit}
          onClick={groups.insert}
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-medium text-primary-foreground disabled:opacity-40"
        >
          <Layers className="w-3 h-3" /> Insert chart
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-1">
          {!list.length && (
            <p className="text-[10px] text-muted-foreground">
              Merge a saved chart here — its cards, connectors and layout are copied exactly.
            </p>
          )}
          {list.map((group) => (
            <div key={group.id} className="rounded-md border p-1.5 space-y-1">
              <div className="flex items-start justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-[11px] font-medium truncate">{group.name}</p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {group.source_chart_name || 'Source chart'} · {MODE_LABELS[group.import_mode] || group.import_mode}
                    {' · '}{group.node_count || 0} cards
                  </p>
                </div>
                {group.is_stale && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[8px] text-amber-800">
                    <AlertTriangle className="w-2.5 h-2.5" /> Update
                  </span>
                )}
                <input
                  type="color"
                  title="Group colour"
                  disabled={!ctx.canEdit}
                  value={group.color || '#254dd0'}
                  onChange={(e) => groups.color(group, e.target.value)}
                  className="w-5 h-5 shrink-0 rounded border"
                />
              </div>

              <div className="flex flex-wrap gap-1">
                <button type="button" className={action} title="Select the whole group" onClick={() => groups.select(group)}>
                  <Focus className="w-2.5 h-2.5" /> Select
                </button>
                <button type="button" className={action} title="Fit group to screen" onClick={() => groups.fit(group)}>
                  <Maximize2 className="w-2.5 h-2.5" /> Fit
                </button>
                <button
                  type="button"
                  className={action}
                  disabled={!ctx.canEdit}
                  title={group.is_locked ? 'Unlock group' : 'Lock group'}
                  onClick={() => groups.lock(group, !group.is_locked)}
                >
                  {group.is_locked ? <Unlock className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                  {group.is_locked ? 'Unlock' : 'Lock'}
                </button>
                <button type="button" className={action} disabled={!ctx.canEdit} title="Expand or collapse the group" onClick={() => groups.collapse(group)}>
                  {group.is_collapsed ? <ChevronDown className="w-2.5 h-2.5" /> : <ChevronUp className="w-2.5 h-2.5" />}
                  {group.is_collapsed ? 'Expand' : 'Collapse'}
                </button>
                <button type="button" className={action} disabled={!ctx.canEdit} title="Rename group" onClick={() => groups.rename(group)}>
                  <Pencil className="w-2.5 h-2.5" /> Rename
                </button>
                <button type="button" className={action} disabled={!ctx.canEdit} title="Duplicate group" onClick={() => groups.duplicate(group)}>
                  <Copy className="w-2.5 h-2.5" /> Duplicate
                </button>
                <button type="button" className={action} disabled={!ctx.canEdit} title="Connect the department to a manager" onClick={() => groups.connect(group)}>
                  <Link2 className="w-2.5 h-2.5" /> Connect
                </button>
                {group.import_mode === 'linked' && !group.is_detached && (
                  <button type="button" className={action} disabled={!ctx.canEdit} title="Refresh from the source chart" onClick={() => groups.update(group)}>
                    <RefreshCw className="w-2.5 h-2.5" /> Update
                  </button>
                )}
                {group.import_mode !== 'copy' && (
                  <button type="button" className={action} disabled={!ctx.canEdit} title="Turn the group into independent editable cards" onClick={() => groups.detach(group)}>
                    <Unlink className="w-2.5 h-2.5" /> {group.import_mode === 'snapshot' ? 'Make editable' : 'Detach'}
                  </button>
                )}
                <button type="button" className={action} disabled={!ctx.canEdit} title="Remove the group from this chart only" onClick={() => groups.ungroup(group)}>
                  Ungroup
                </button>
                <button
                  type="button"
                  className={`${action} text-red-600`}
                  disabled={!ctx.canEdit}
                  title="Remove the group from this chart only"
                  onClick={() => groups.remove(group)}
                >
                  <Trash2 className="w-2.5 h-2.5" /> Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}