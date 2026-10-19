import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { RotateCcw, GitCompare } from 'lucide-react';

const summarise = (nodes, edges) => `${nodes.length} cards · ${edges.length} connectors`;

function compare(version, nodes, edges) {
  const versionNodes = version.node_snapshot || [];
  const versionEdges = version.edge_snapshot || [];
  const before = new Map(versionNodes.map(n => [n.id, n]));
  const after = new Map(nodes.map(n => [n.id, n]));
  let added = 0, removed = 0, changed = 0;
  after.forEach((node, id) => {
    const previous = before.get(id);
    if (!previous) { added += 1; return; }
    const keys = ['name', 'designation', 'department', 'x', 'y', 'width', 'height'];
    if (keys.some(key => JSON.stringify(previous[key]) !== JSON.stringify(node[key]))) changed += 1;
  });
  before.forEach((_, id) => { if (!after.has(id)) removed += 1; });
  return {
    added, removed, changed,
    edgeDelta: edges.length - versionEdges.length,
  };
}

export default function VersionsDialog({ open, chart, versions, loading, currentNodes, currentEdges, onCreate, onRestore, onClose }) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => { if (open) { setName(''); setNote(''); setSelected(null); } }, [open]);

  const create = async () => {
    setBusy(true);
    try { await onCreate(name, note); } finally { setBusy(false); }
  };

  const restore = async (version) => {
    if (!window.confirm(`Restore ${version.version_name || `version ${version.version_no}`}? The current layout will be kept as a new version you can return to.`)) return;
    setBusy(true);
    try { await onCreate(`Before restoring v${version.version_no}`, 'Automatic backup before restore'); await onRestore(version); } finally { setBusy(false); }
  };

  const diff = selected ? compare(selected, currentNodes, currentEdges) : null;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Version history — {chart?.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 rounded-md border p-2.5">
          <p className="text-[11px] font-semibold text-muted-foreground">Save a named version</p>
          <div className="flex gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Version name (e.g. Issued for review)" className="h-8 text-xs" />
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note" className="h-8 text-xs" />
            <Button size="sm" className="h-8" onClick={create} disabled={busy}>Save version</Button>
          </div>
        </div>

        <div className="space-y-1.5">
          {loading && <p className="text-[11px] text-muted-foreground">Loading versions…</p>}
          {versions.map(version => (
            <div key={version.id} className={`rounded-md border p-2 ${selected?.id === version.id ? 'border-primary' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <button type="button" className="text-left min-w-0" onClick={() => setSelected(version)}>
                  <p className="text-xs font-medium truncate">
                    v{version.version_no} · {version.version_name || 'Version'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {summarise(version.node_snapshot || [], version.edge_snapshot || [])} · {version.created_by_name || version.created_by_email || 'unknown'}
                    {version.created_date ? ` · ${new Date(version.created_date).toLocaleString()}` : ''}
                  </p>
                  {version.note && <p className="text-[10px] text-muted-foreground italic">{version.note}</p>}
                </button>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => setSelected(version)}>
                    <GitCompare className="w-3 h-3 mr-1" /> Compare
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={() => restore(version)} disabled={busy}>
                    <RotateCcw className="w-3 h-3 mr-1" /> Restore
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {!loading && !versions.length && (
            <p className="text-[11px] text-muted-foreground">No versions saved yet. Publishing a chart also saves a version.</p>
          )}
        </div>

        {diff && (
          <div className="rounded-md border p-2.5 text-[11px] space-y-0.5">
            <p className="font-semibold">Compared with the current layout</p>
            <p>{diff.added} card(s) added since this version</p>
            <p>{diff.removed} card(s) no longer on the chart</p>
            <p>{diff.changed} card(s) changed (name, detail or position)</p>
            <p>{diff.edgeDelta === 0 ? 'Same number of connectors' : `${Math.abs(diff.edgeDelta)} connector(s) ${diff.edgeDelta > 0 ? 'added' : 'removed'}`}</p>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}