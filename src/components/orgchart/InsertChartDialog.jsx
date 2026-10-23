import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Loader2, Layers } from 'lucide-react';
import InsertChartPicker from '@/components/orgchart/InsertChartPicker';
import InsertPlacementOptions from '@/components/orgchart/InsertPlacementOptions';
import InsertPlacementPreview from '@/components/orgchart/InsertPlacementPreview';
import {
  DEFAULT_GAP, buildInsertion, exactBounds, filterDuplicates, findDuplicates, loadChartBundle, planOffsets, wouldCreateCycle,
} from '@/lib/orgChartMerge';

const loadBundle = (chart) => loadChartBundle(chart);

export default function InsertChartDialog({
  open, onClose, charts, destination, destNodes, selection, anchorPoint, onInsert, canEdit,
}) {
  const [step, setStep] = useState('select');
  const [selected, setSelected] = useState([]);
  const [meta, setMeta] = useState({});
  const [allImports, setAllImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [mode, setMode] = useState('copy');
  const [placement, setPlacement] = useState('side_by_side');
  const [gap, setGap] = useState(DEFAULT_GAP);
  const [skipDuplicateCharts, setSkipDuplicateCharts] = useState([]);

  const candidates = useMemo(
    () => charts.filter(c => c.id !== destination?.id && !c.is_archived),
    [charts, destination?.id]
  );

  useEffect(() => {
    if (!open) return;
    setStep('select');
    setSelected([]);
    setError('');
    setBusy(false);
    setMode('copy');
    setPlacement('side_by_side');
    setGap(DEFAULT_GAP);
    setSkipDuplicateCharts([]);
    const ids = charts.filter(c => c.id !== destination?.id && !c.is_archived).map(c => c.id);
    if (!ids.length) { setMeta({}); return; }
    let active = true;
    setLoading(true);
    (async () => {
      try {
        const [nodePage, edgePage, importPage] = await Promise.all([
          base44.entities.OrgChartNode.filter({ chart_id: { $in: ids }, is_deleted: { $ne: true } }, { limit: 6000 }),
          base44.entities.OrgChartEdge.filter({ chart_id: { $in: ids }, is_deleted: { $ne: true } }, { limit: 6000 }),
          base44.entities.OrgChartImport.filter({}, { limit: 5000 }),
        ]);
        if (!active) return;
        setAllImports(importPage.items || []);
        const nodesByChart = new Map();
        (nodePage.items || []).forEach((n) => {
          const list = nodesByChart.get(n.chart_id) || [];
          list.push(n);
          nodesByChart.set(n.chart_id, list);
        });
        const edgesByChart = new Map();
        (edgePage.items || []).forEach((e) => {
          edgesByChart.set(e.chart_id, (edgesByChart.get(e.chart_id) || 0) + 1);
        });
        const next = {};
        ids.forEach((id) => {
          const nodes = nodesByChart.get(id) || [];
          next[id] = {
            nodes,
            nodeCount: nodes.length,
            edgeCount: edgesByChart.get(id) || 0,
            departments: [...new Set(nodes.map(n => n.department).filter(Boolean))].sort(),
          };
        });
        setMeta(next);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [open, charts, destination?.id]);

  const blocked = useMemo(() => {
    const set = new Set();
    candidates.forEach((c) => { if (wouldCreateCycle(allImports, destination?.id, c.id)) set.add(c.id); });
    return set;
  }, [candidates, allImports, destination?.id]);

  const selectedCharts = useMemo(
    () => selected.map(id => charts.find(c => c.id === id)).filter(Boolean),
    [selected, charts]
  );

  const bundles = useMemo(
    () => selectedCharts.map(chart => ({ chart, nodes: meta[chart.id]?.nodes || [], edges: [] })),
    [selectedCharts, meta]
  );

  const duplicates = useMemo(
    () => selectedCharts.map(chart => ({
      chart,
      list: findDuplicates(destNodes, meta[chart.id]?.nodes || []),
    })).filter(entry => entry.list.length),
    [selectedCharts, destNodes, meta]
  );

  const offsets = useMemo(() => {
    if (!bundles.length) return [];
    const destBox = exactBounds(destNodes);
    const selectedNodes = destNodes.filter(n => selection.includes(n.id));
    const anchor = selectedNodes.length ? exactBounds(selectedNodes) : null;
    let origin = anchorPoint || { x: 0, y: 0 };
    if (destNodes.length && placement !== 'cursor' && placement !== 'below_manager') {
      origin = { x: destBox.x, y: destBox.y + destBox.h + gap };
    }
    return planOffsets(bundles, placement, { gap, origin, anchor });
  }, [bundles, destNodes, selection, placement, gap, anchorPoint]);

  const toggleSkip = (chartId) => {
    setSkipDuplicateCharts(prev => (prev.includes(chartId) ? prev.filter(id => id !== chartId) : [...prev, chartId]));
  };

  const run = async () => {
    setBusy(true);
    setError('');
    try {
      const loaded = [];
      for (const chart of selectedCharts) {
        const bundle = await loadBundle(chart);
        const skipIds = skipDuplicateCharts.includes(chart.id)
          ? findDuplicates(destNodes, bundle.nodes).map(item => item.employee_id)
          : [];
        loaded.push({
          chart,
          nodes: skipIds.length ? filterDuplicates(bundle.nodes, skipIds) : bundle.nodes,
          edges: bundle.edges,
        });
      }
      const usable = loaded.filter(bundle => bundle.nodes.length);
      if (!usable.length) {
        setError('The selected charts have no cards to insert.');
        return;
      }
      // Offsets are computed from the exact records that will be inserted.
      const destBox = exactBounds(destNodes);
      const selectedNodes = destNodes.filter(n => selection.includes(n.id));
      const anchor = selectedNodes.length ? exactBounds(selectedNodes) : null;
      let origin = anchorPoint || { x: 0, y: 0 };
      if (destNodes.length && placement !== 'cursor' && placement !== 'below_manager') {
        origin = { x: destBox.x, y: destBox.y + destBox.h + gap };
      }
      const finalOffsets = planOffsets(usable, placement, { gap, origin, anchor });
      const result = buildInsertion(usable, { mode, offsets: finalOffsets });
      const saved = await onInsert(result);
      if (saved) onClose();
    } catch (err) {
      setError(err.message || 'The charts could not be inserted.');
    } finally {
      setBusy(false);
    }
  };

  const canContinue = selected.length > 0;

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value && !busy) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Layers className="w-4 h-4" /> Insert existing charts
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              Choose saved charts to add to “{destination?.name || 'this chart'}”. The originals are never changed.
            </p>
            <InsertChartPicker
              charts={candidates}
              meta={meta}
              selected={selected}
              loading={loading}
              blocked={blocked}
              onToggle={(id) => setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))}
              onSelectAll={(ids) => setSelected(ids)}
              onClear={() => setSelected([])}
            />
          </div>
        )}

        {step === 'options' && (
          <div className="space-y-3">
            <div className="rounded-md border bg-muted/30 px-2 py-1.5">
              <p className="text-[11px] font-medium">{selectedCharts.map(c => c.name).join(' · ')}</p>
              <p className="text-[10px] text-muted-foreground">
                {selectedCharts.length} chart{selectedCharts.length === 1 ? '' : 's'} · {bundles.reduce((sum, b) => sum + b.nodes.length, 0)} cards
              </p>
            </div>

            <InsertPlacementOptions
              mode={mode}
              setMode={setMode}
              placement={placement}
              setPlacement={setPlacement}
              gap={gap}
              setGap={setGap}
            />

            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Placement preview</p>
              <InsertPlacementPreview destNodes={destNodes} bundles={bundles} offsets={offsets} />
              <p className="text-[10px] text-muted-foreground mt-1">
                Blue cards are the charts being inserted. Each one arrives as its own group you can drag, rename or detach.
              </p>
            </div>

            {duplicates.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50/60 p-2 space-y-1.5">
                <p className="text-[11px] font-semibold flex items-center gap-1 text-amber-800">
                  <AlertTriangle className="w-3.5 h-3.5" /> Duplicate personnel found
                </p>
                {duplicates.map(({ chart, list }) => (
                  <div key={chart.id} className="space-y-1">
                    <p className="text-[10px] text-amber-900">
                      {chart.name}: {list.length} person{list.length === 1 ? '' : 's'} already on this chart — {list.slice(0, 6).map(d => d.name || d.pid).join(', ')}{list.length > 6 ? '…' : ''}
                    </p>
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => { if (skipDuplicateCharts.includes(chart.id)) toggleSkip(chart.id); }}
                        className={`px-2 py-0.5 rounded-full border text-[10px] ${!skipDuplicateCharts.includes(chart.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
                      >
                        Keep both cards
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (!skipDuplicateCharts.includes(chart.id)) toggleSkip(chart.id); }}
                        className={`px-2 py-0.5 rounded-full border text-[10px] ${skipDuplicateCharts.includes(chart.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background'}`}
                      >
                        Skip duplicates
                      </button>
                    </div>
                  </div>
                ))}
                <p className="text-[9px] text-amber-800">
                  Cards are never merged automatically — one person can legitimately hold more than one chart role.
                </p>
              </div>
            )}

            {error && <p className="text-[11px] text-red-600">{error}</p>}
          </div>
        )}

        <DialogFooter className="gap-1.5">
          {step === 'options' && (
            <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setStep('select')} disabled={busy}>
              <ArrowLeft className="w-3 h-3 mr-1" /> Back
            </Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={onClose} disabled={busy}>Cancel</Button>
          {step === 'select' ? (
            <Button size="sm" className="h-7 text-[11px]" disabled={!canContinue || !canEdit} onClick={() => setStep('options')}>
              Continue
            </Button>
          ) : (
            <Button size="sm" className="h-7 text-[11px]" disabled={busy || !canEdit} onClick={run}>
              {busy ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Inserting…</> : `Insert ${selectedCharts.length} chart${selectedCharts.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}