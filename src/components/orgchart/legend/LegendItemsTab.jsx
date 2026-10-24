import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, Eye, EyeOff, Plus, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import { makeEntry, normalizeColor } from '@/lib/orgChartLegend';

const badge = 'rounded bg-muted px-1 py-0.5 text-[9px] text-muted-foreground';

function LabelField({ value, disabled, onCommit }) {
  const [draft, setDraft] = useState(value || '');
  useEffect(() => { setDraft(value || ''); }, [value]);
  return (
    <input
      value={draft}
      disabled={disabled}
      placeholder="Meaning of this color"
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== (value || '')) onCommit(draft); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className="flex-1 min-w-0 h-7 rounded-md border bg-background px-2 text-[11px]"
    />
  );
}

export default function LegendItemsTab({ legend, detected, canEdit, onChangeEntries, onRefresh }) {
  const entries = legend?.legend_config?.entries || [];
  const excluded = legend?.legend_config?.excluded || [];
  const usageOf = (color) => detected.find((d) => d.color === normalizeColor(color))?.count || 0;
  const commit = (nextEntries, nextExcluded = excluded) => onChangeEntries(nextEntries, nextExcluded);

  const update = (id, patch) => commit(entries.map((e) => (e.id === id ? { ...e, ...patch } : e)));
  // Removing an entry whose color is still on the chart also excludes it, so
  // automatic detection never silently puts it back.
  const remove = (id) => {
    const entry = entries.find((e) => e.id === id);
    const color = normalizeColor(entry?.color);
    const stillUsed = color && detected.some((d) => d.color === color);
    commit(
      entries.filter((e) => e.id !== id),
      stillUsed ? [...new Set([...excluded, color])] : excluded,
    );
  };
  const move = (index, dir) => {
    const target = index + dir;
    if (target < 0 || target >= entries.length) return;
    const next = [...entries];
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  const toggleDetected = (row, include) => {
    if (include) commit([...entries, makeEntry(row.color)], excluded.filter((c) => normalizeColor(c) !== row.color));
    else commit(entries.filter((e) => normalizeColor(e.color) !== row.color), [...new Set([...excluded, row.color])]);
  };
  const unused = entries.filter((e) => usageOf(e.color) === 0);

  const scopeText = (legend?.legend_config?.scope || []).length
    ? legend.legend_config.scope.length === 4
      ? 'all supported objects'
      : legend.legend_config.scope.map((k) => ({ cards_bg: 'card backgrounds', cards_border: 'card borders', shapes: 'shapes', connectors: 'connectors' }[k] || k)).join(', ')
    : 'no objects selected';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] text-muted-foreground">
          Detecting colors from {scopeText}. Colors are read from the chart itself, so changing a label never changes a card.
        </p>
        <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] shrink-0" onClick={onRefresh}>
          <RefreshCw className="w-3 h-3 mr-1" /> Refresh
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border p-2">
          <p className="text-[11px] font-semibold mb-1.5">Detected colors ({detected.length})</p>
          <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
            {detected.map((row) => {
              const included = entries.some((e) => normalizeColor(e.color) === row.color);
              const sources = [
                row.cards_bg ? 'bg' : '', row.cards_border ? 'border' : '',
                row.shapes ? 'shape' : '', row.connectors ? 'line' : '',
              ].filter(Boolean).join(' · ');
              return (
                <label key={row.color} className="flex items-center gap-2 rounded border px-2 py-1.5">
                  <input
                    type="checkbox"
                    checked={included}
                    disabled={!canEdit}
                    onChange={(e) => toggleDetected(row, e.target.checked)}
                  />
                  <span className="w-3.5 h-3.5 rounded-full border shrink-0" style={{ background: row.color }} />
                  <span className="font-mono text-[10px]">{row.color}</span>
                  <span className="text-[9px] text-muted-foreground truncate">{sources}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">{row.count}</span>
                </label>
              );
            })}
            {!detected.length && (
              <p className="text-[11px] text-muted-foreground">
                No distinct colors found. Colors are read from card fills, card borders, shapes and connectors.
              </p>
            )}
          </div>
        </div>

        <div className="rounded-lg border p-2">
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] font-semibold">Legend items ({entries.length})</p>
            <div className="flex gap-1">
              <Button
                size="sm" variant="outline" className="h-6 px-1.5 text-[10px]"
                disabled={!canEdit}
                onClick={() => commit([...entries, makeEntry('#94a3b8', 'New legend item')])}
              >
                <Plus className="w-3 h-3 mr-0.5" /> Add
              </Button>
              <Button
                size="sm" variant="outline" className="h-6 px-1.5 text-[10px]"
                disabled={!canEdit}
                title="Replace the list with the colors currently detected in the chart"
                onClick={() => commit(detected.map((d) => makeEntry(d.color)), [])}
              >
                <RotateCcw className="w-3 h-3 mr-0.5" /> Reset
              </Button>
            </div>
          </div>

          <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
            {entries.map((entry, index) => {
              const usage = usageOf(entry.color);
              return (
                <div key={entry.id} className="rounded border p-1.5 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <input
                      type="color"
                      value={normalizeColor(entry.color) || '#94a3b8'}
                      disabled={!canEdit}
                      onChange={(e) => update(entry.id, { color: e.target.value })}
                      className="w-6 h-6 rounded border bg-background"
                      title="Swatch color"
                    />
                    <span className="font-mono text-[10px]">{entry.color}</span>
                    {usage > 0
                      ? <span className={badge}>{usage} object{usage === 1 ? '' : 's'}</span>
                      : <span className="rounded bg-amber-100 px-1 py-0.5 text-[9px] text-amber-700">Unused</span>}
                    <div className="ml-auto flex items-center gap-0.5">
                      <button type="button" className="p-1 rounded hover:bg-muted disabled:opacity-30" title="Move up" disabled={!canEdit || index === 0} onClick={() => move(index, -1)}>
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button type="button" className="p-1 rounded hover:bg-muted disabled:opacity-30" title="Move down" disabled={!canEdit || index === entries.length - 1} onClick={() => move(index, 1)}>
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button type="button" className="p-1 rounded hover:bg-muted" title={entry.visible === false ? 'Show item' : 'Hide item'} disabled={!canEdit} onClick={() => update(entry.id, { visible: entry.visible === false })}>
                        {entry.visible === false ? <EyeOff className="w-3 h-3 text-muted-foreground" /> : <Eye className="w-3 h-3" />}
                      </button>
                      <button type="button" className="p-1 rounded hover:bg-muted text-red-600" title="Remove from legend" disabled={!canEdit} onClick={() => remove(entry.id)}>
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <LabelField value={entry.label} disabled={!canEdit} onCommit={(label) => update(entry.id, { label })} />
                </div>
              );
            })}
            {!entries.length && <p className="text-[11px] text-muted-foreground">No legend items yet. Tick a detected color or add one manually.</p>}
          </div>

          {unused.length > 0 && (
            <Button
              size="sm" variant="ghost" className="h-6 px-1.5 mt-1 text-[10px] text-amber-700"
              disabled={!canEdit}
              onClick={() => commit(entries.filter((e) => usageOf(e.color) > 0))}
            >
              Remove {unused.length} unused item{unused.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}