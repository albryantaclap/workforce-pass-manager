import React, { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';

// Multiple employee selection for Manual Attendance Entry.
// Selection is held by personnel id, so it survives every new search and can
// never contain the same person twice. Search keeps the existing fields
// (name, QID, PID, staff no, company, department, designation, branch).
const VISIBLE_LIMIT = 40;

const haystack = (e) => `${e.name || ''} ${e.qid_no || ''} ${e.pid || ''} ${e.staff_no || ''} ${e.company || ''} ${e.department || ''} ${e.position_application || ''} ${e.designation_org_chart || ''} ${e.current_location || ''}`.toLowerCase();

export default function EmployeeMultiPicker({ employees, selected, onChange }) {
  const [search, setSearch] = useState('');

  const selectedIds = useMemo(() => new Set(selected.map((e) => e.id)), [selected]);
  const matched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) => haystack(e).includes(q));
  }, [employees, search]);
  const visible = matched.slice(0, VISIBLE_LIMIT);

  const add = (list) => {
    const map = new Map(selected.map((e) => [e.id, e]));
    list.forEach((e) => { if (!map.has(e.id)) map.set(e.id, e); });
    onChange([...map.values()]);
  };
  const remove = (id) => onChange(selected.filter((e) => e.id !== id));
  const toggle = (emp) => (selectedIds.has(emp.id) ? remove(emp.id) : add([emp]));

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase">Employee</label>

      {/* Selected employees — stays visible while searching for more */}
      <div className="rounded-lg border border-border">
        <div className="flex items-center justify-between px-2 py-1.5 bg-muted/40 border-b border-border">
          <span className="text-xs font-semibold text-foreground">
            Selected Employees ({selected.length})
          </span>
          <button
            type="button"
            onClick={() => onChange([])}
            disabled={!selected.length}
            className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-40"
          >
            Deselect All
          </button>
        </div>
        <div className="max-h-32 overflow-y-auto divide-y divide-border/50">
          {selected.length === 0 ? (
            <p className="px-2 py-2 text-[11px] text-muted-foreground">
              No employee selected yet — search below and tick one or more people.
            </p>
          ) : selected.map((emp) => (
            <div key={emp.id} className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{emp.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {[emp.company, emp.qid_no && `QID ${emp.qid_no}`, emp.pid && `PID ${emp.pid}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(emp.id)}
                className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-red-600 flex-shrink-0"
                title="Remove selected employee"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, QID, PID, staff no, company, department, designation, branch..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Select-all helpers */}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
          onClick={() => add(visible)} disabled={!visible.length}>
          Select All Visible ({visible.length})
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]"
          onClick={() => add(matched)} disabled={!matched.length}>
          Select All Matching ({matched.length})
        </Button>
        <span className="text-[10px] text-muted-foreground ml-auto">
          Showing {visible.length} of {matched.length}
        </span>
      </div>

      {/* Result list */}
      <div className="max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border/50">
        {visible.length === 0 ? (
          <p className="px-2 py-3 text-[11px] text-muted-foreground">No employee matches this search.</p>
        ) : visible.map((emp) => {
          const checked = selectedIds.has(emp.id);
          return (
            <label key={emp.id}
              className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer ${checked ? 'bg-primary/5' : 'hover:bg-muted/50'}`}>
              <input type="checkbox" checked={checked} onChange={() => toggle(emp)} className="rounded flex-shrink-0" />
              <PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size="sm" />
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{emp.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {[emp.company, emp.department, emp.qid_no && `QID ${emp.qid_no}`, emp.pid && `PID ${emp.pid}`].filter(Boolean).join(' · ')}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </div>
  );
}