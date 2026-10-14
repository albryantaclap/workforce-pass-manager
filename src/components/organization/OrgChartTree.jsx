import React, { useState, useMemo } from 'react';
import { Briefcase, Building2, GitBranch, ChevronRight, ChevronDown, Layers, Maximize2, Minimize2 } from 'lucide-react';

const STATUS_DOT = {
  Active: 'bg-green-500', Planning: 'bg-blue-500', 'On Hold': 'bg-amber-500',
  Completed: 'bg-emerald-500', Closed: 'bg-slate-400', Archived: 'bg-zinc-400',
  Vacant: 'bg-rose-400',
};

export default function OrgChartTree({ projects, units, positions, loading }) {
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = (id) => setCollapsed(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const allIds = useMemo(() => {
    const ids = ['scope-__corporate__'];
    for (const p of projects) ids.push('scope-' + p.id);
    for (const u of units) ids.push('unit-' + u.id);
    return ids;
  }, [projects, units]);

  const expandAll = () => setCollapsed(new Set());
  const collapseAll = () => setCollapsed(new Set(allIds));

  const unitsByProject = useMemo(() => {
    const m = {};
    for (const u of units) {
      if (!u.parent_unit_id) {
        const key = u.project_id || '__corporate__';
        (m[key] = m[key] || []).push(u);
      }
    }
    for (const k in m) m[k].sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || (a.unit_name || '').localeCompare(b.unit_name || ''));
    return m;
  }, [units]);

  const childUnits = useMemo(() => {
    const m = {};
    for (const u of units) {
      if (u.parent_unit_id) (m[u.parent_unit_id] = m[u.parent_unit_id] || []).push(u);
    }
    for (const k in m) m[k].sort((a, b) => (a.display_order || 0) - (b.display_order || 0) || (a.unit_name || '').localeCompare(b.unit_name || ''));
    return m;
  }, [units]);

  const positionsByUnit = useMemo(() => {
    const m = {};
    for (const p of positions) (m[p.unit_id || '__unassigned__'] = m[p.unit_id || '__unassigned__'] || []).push(p);
    return m;
  }, [positions]);

  const positionsByProject = useMemo(() => {
    const m = {};
    for (const p of positions) {
      if (p.project_id && !p.unit_id) (m[p.project_id] = m[p.project_id] || []).push(p);
    }
    return m;
  }, [positions]);

  const corporatePositions = useMemo(() => positions.filter(p => !p.project_id && !p.unit_id), [positions]);

  const renderPosition = (p) => {
    const vacant = Math.max(0, (p.approved_headcount || 0) - (p.filled_headcount || 0));
    return (
      <div key={p.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-orange-50 ring-1 ring-orange-200 hover:ring-orange-400 transition-colors">
        <GitBranch className="w-3.5 h-3.5 text-orange-600 shrink-0" />
        <span className="text-xs font-medium truncate">{p.position_title}</span>
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${STATUS_DOT[p.status] || 'bg-gray-400'}`} title={p.status} />
        <span className="text-[10px] text-muted-foreground ml-auto shrink-0 whitespace-nowrap">
          {p.filled_headcount || 0}/{p.approved_headcount || 0}{vacant > 0 ? ` · ${vacant} vacant` : ''}
        </span>
      </div>
    );
  };

  const renderUnit = (u) => {
    const kids = childUnits[u.id] || [];
    const pos = positionsByUnit[u.id] || [];
    const hasChildren = kids.length > 0 || pos.length > 0;
    const id = 'unit-' + u.id;
    const expanded = !collapsed.has(id);
    return (
      <div key={u.id}>
        <button
          onClick={() => hasChildren && toggle(id)}
          className={`flex items-center gap-2 w-full px-3 py-2 rounded-lg ring-1 ring-emerald-200 bg-emerald-50 text-left transition-colors ${hasChildren ? 'cursor-pointer hover:ring-emerald-400 hover:bg-emerald-100' : 'cursor-default'}`}
        >
          {hasChildren ? (expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-emerald-700" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-emerald-700" />) : <span className="w-3.5 h-3.5 shrink-0" />}
          <Building2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span className="text-xs font-semibold truncate">{u.unit_name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">· {u.unit_type}</span>
        </button>
        {hasChildren && expanded && (
          <div className="ml-4 mt-1 pl-4 border-l-2 border-emerald-200 space-y-1">
            {kids.map(renderUnit)}
            {pos.map(renderPosition)}
          </div>
        )}
      </div>
    );
  };

  const renderScope = (key, label, icon, ring, bg) => {
    const topUnits = unitsByProject[key] || [];
    const projectPositions = key === '__corporate__' ? corporatePositions : (positionsByProject[key] || []);
    const hasChildren = topUnits.length > 0 || projectPositions.length > 0;
    const id = 'scope-' + key;
    const expanded = !collapsed.has(id);
    return (
      <div key={key}>
        <button
          onClick={() => hasChildren && toggle(id)}
          className={`flex items-center gap-2 w-full px-3.5 py-2.5 rounded-lg ring-1 ${ring} ${bg} text-left transition-colors ${hasChildren ? 'cursor-pointer hover:ring-2' : 'cursor-default'}`}
        >
          {hasChildren ? (expanded ? <ChevronDown className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />) : <span className="w-4 h-4 shrink-0" />}
          {icon}
          <span className="text-sm font-bold truncate">{label}</span>
          {hasChildren && <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{topUnits.length + projectPositions.length} items</span>}
        </button>
        {hasChildren && expanded && (
          <div className="ml-4 mt-1 pl-4 border-l-2 border-muted space-y-1">
            {topUnits.map(renderUnit)}
            {projectPositions.map(renderPosition)}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground py-4">Loading organization chart…</p>;
  }
  if (projects.length === 0 && units.length === 0 && positions.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">No organization data yet. Create projects, departments, and positions to see the chart.</p>;
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Briefcase className="w-3 h-3 text-violet-600" /> Project</span>
          <span className="flex items-center gap-1"><Building2 className="w-3 h-3 text-emerald-600" /> Department / Unit</span>
          <span className="flex items-center gap-1"><GitBranch className="w-3 h-3 text-orange-600" /> Position</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={expandAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><Maximize2 className="w-3.5 h-3.5" /> Expand all</button>
          <button onClick={collapseAll} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"><Minimize2 className="w-3.5 h-3.5" /> Collapse all</button>
        </div>
      </div>
      <div className="space-y-1.5">
        {renderScope('__corporate__', 'Corporate / Shared', <Layers className="w-4 h-4 text-slate-600 shrink-0" />, 'ring-slate-200', 'bg-slate-50')}
        {projects.map(p => renderScope(p.id, p.project_name, <Briefcase className="w-4 h-4 text-violet-600 shrink-0" />, 'ring-violet-200', 'bg-violet-50'))}
      </div>
    </div>
  );
}