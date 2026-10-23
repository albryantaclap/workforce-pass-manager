import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Check, Search, Plus } from 'lucide-react';
import ChartThumbnail from '@/components/orgchart/ChartThumbnail';

const shortDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
};

const select = 'h-7 w-full rounded-md border bg-background px-2 text-[11px]';

export default function InsertChartPicker({
  charts, meta, selected, onToggle, onSelectAll, onClear, blocked, loading,
}) {
  const [query, setQuery] = useState('');
  const [project, setProject] = useState('');
  const [department, setDepartment] = useState('');
  const [status, setStatus] = useState('');

  const projects = useMemo(
    () => [...new Set(charts.map(c => c.project_name).filter(Boolean))].sort(),
    [charts]
  );
  const departments = useMemo(() => {
    const all = new Set();
    charts.forEach(c => (meta[c.id]?.departments || []).forEach(d => all.add(d)));
    return [...all].sort();
  }, [charts, meta]);

  const visible = useMemo(() => charts.filter((c) => {
    if (query && !(c.name || '').toLowerCase().includes(query.toLowerCase())) return false;
    if (project && c.project_name !== project) return false;
    if (status && (c.status || 'draft') !== status) return false;
    if (department && !(meta[c.id]?.departments || []).includes(department)) return false;
    return true;
  }), [charts, query, project, status, department, meta]);

  const selectable = visible.filter(c => !blocked.has(c.id));

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search chart name"
          className="h-8 pl-7 text-[11px]"
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        <select value={project} onChange={(e) => setProject(e.target.value)} className={select}>
          <option value="">All projects</option>
          {projects.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className={select}>
          <option value="">All departments</option>
          {departments.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={select}>
          <option value="">Any status</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
        </select>
      </div>

      <div className="flex items-center justify-between text-[10px]">
        <span className="text-muted-foreground">{selected.length} selected · {visible.length} shown</span>
        <div className="flex gap-1">
          <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-muted" onClick={() => onSelectAll(selectable.map(c => c.id))}>
            Select all
          </button>
          <button type="button" className="rounded border px-1.5 py-0.5 hover:bg-muted" onClick={onClear}>Clear</button>
        </div>
      </div>

      <div className="max-h-[46vh] overflow-y-auto space-y-1 pr-1">
        {loading && <p className="text-[11px] text-muted-foreground p-2">Loading saved charts…</p>}
        {!loading && !visible.length && (
          <p className="text-[11px] text-muted-foreground p-2">No other saved charts match these filters.</p>
        )}
        {visible.map((item) => {
          const info = meta[item.id] || {};
          const isBlocked = blocked.has(item.id);
          const isSelected = selected.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              disabled={isBlocked}
              onClick={() => onToggle(item.id)}
              className={`w-full text-left rounded-md border p-1.5 flex gap-2 transition-colors ${
                isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted'
              } ${isBlocked ? 'opacity-50' : ''}`}
            >
              <div className={`mt-0.5 w-4 h-4 shrink-0 rounded border flex items-center justify-center ${isSelected ? 'bg-primary border-primary text-primary-foreground' : 'bg-background'}`}>
                {isSelected && <Check className="w-3 h-3" />}
              </div>
              <ChartThumbnail nodes={info.nodes || []} width={86} height={54} />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-medium truncate">{item.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.project_name || 'Corporate'}
                  {(info.departments || []).length ? ` · ${info.departments.slice(0, 2).join(', ')}` : ''}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {item.status || 'draft'} · updated {shortDate(item.last_edited_at || item.updated_date)} · {info.nodeCount ?? 0} cards · {info.edgeCount ?? 0} connectors
                </p>
                {isBlocked && <p className="text-[9px] text-amber-600">Would create a circular reference</p>}
              </div>
            </button>
          );
        })}
      </div>

      {!charts.length && !loading && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Plus className="w-3 h-3" /> Save another chart first, then it can be inserted here.
        </p>
      )}
    </div>
  );
}