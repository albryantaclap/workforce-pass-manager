import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Search, UserPlus, Link2, Loader2, Crosshair } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMPLOYEE_FIELDS = [
  'name', 'position_application', 'designation_org_chart', 'department', 'company',
  'pid', 'qid_no', 'staff_no', 'photo_url', 'email', 'contact_details', 'personnel_status',
];

export default function OrgDataPanel({ ctx }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const search = async () => {
    const term = query.trim();
    if (!term) { setResults([]); setSearched(false); return; }
    setSearching(true);
    try {
      const res = await base44.entities.Employee.filter({
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { pid: term },
          { qid_no: term },
          { staff_no: term },
        ],
      }, { limit: 25, fields: EMPLOYEE_FIELDS });
      setResults(res.items || []);
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

  const onChart = ctx.nodes.filter(n => n.node_kind === 'employee' || n.node_kind === 'position');

  return (
    <div className="p-3 space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Project</p>
        <select
          value={ctx.chart?.project_id || ''}
          onChange={(e) => ctx.onProjectChange(e.target.value)}
          disabled={!ctx.canEdit}
          className="w-full h-8 rounded-md border bg-background px-2 text-xs"
        >
          <option value="">No project (corporate)</option>
          {ctx.projects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
        </select>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Add from Master List</p>
        <div className="flex gap-1.5">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
            placeholder="Name, PID, QID or ID"
            className="h-8 text-xs"
          />
          <Button size="sm" className="h-8 px-2" onClick={search} disabled={searching}>
            {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <div className="mt-2 space-y-1 max-h-64 overflow-y-auto">
          {results.map(emp => (
            <button
              key={emp.id}
              type="button"
              onClick={() => ctx.addEmployeeCard(emp)}
              className="w-full text-left rounded-md border px-2 py-1.5 hover:bg-muted flex items-center gap-2"
            >
              {emp.photo_url
                ? <img src={emp.photo_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                : <span className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-[10px] font-semibold"><UserPlus className="w-3 h-3" /></span>}
              <span className="min-w-0">
                <span className="block text-xs font-medium truncate">{emp.name}</span>
                <span className="block text-[10px] text-muted-foreground truncate">
                  {emp.designation_org_chart || emp.position_application || '—'} {emp.pid ? `· ${emp.pid}` : ''}
                </span>
              </span>
            </button>
          ))}
          {searched && !results.length && !searching && (
            <p className="text-[11px] text-muted-foreground px-1">No personnel matched that search.</p>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1">
          Linked cards always show Master List data. The Master List record itself is never changed.
        </p>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Cards on this chart ({onChart.length})</p>
        <div className="space-y-0.5 max-h-72 overflow-y-auto">
          {onChart.map(n => (
            <button
              key={n.id}
              type="button"
              onClick={() => ctx.focusNode(n.id)}
              className="w-full text-left rounded px-2 py-1 hover:bg-muted flex items-center gap-1.5"
            >
              {n.linked_employee_id
                ? <Link2 className="w-3 h-3 text-emerald-600 shrink-0" />
                : <span className="w-3 h-3 rounded-full bg-muted shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block text-[11px] truncate">{n.name || 'Untitled card'}</span>
                <span className="block text-[10px] text-muted-foreground truncate">{n.designation || n.node_kind}</span>
              </span>
              <Crosshair className="w-3 h-3 text-muted-foreground shrink-0" />
            </button>
          ))}
          {!onChart.length && <p className="text-[11px] text-muted-foreground px-1">No cards yet — add one from the toolbar or a template.</p>}
        </div>
      </div>
    </div>
  );
}