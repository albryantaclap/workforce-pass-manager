import React, { useState, useMemo } from 'react';
import { Search, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import { cn } from '@/lib/utils';

// Multi-select of active Master List personnel to assign to a shift.
// Uses the existing AttendanceShiftAssignment (assignment_type='employee')
// relationship — no disconnected duplicate employee list.
export default function ShiftAssignEmployees({ employees, selectedIds, setSelectedIds }) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!employees) return [];
    const active = employees.filter(
      (e) => e.personnel_status === 'Active' && e.is_active !== false
    );
    if (!search) return active;
    const q = search.toLowerCase();
    return active.filter((e) =>
      `${e.name || ''} ${e.id || ''} ${e.qid_no || ''} ${e.pid || ''} ${e.staff_no || ''} ${e.company || ''} ${e.department || ''} ${e.position_application || ''} ${e.current_location || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [employees, search]);

  const toggle = (id) =>
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const selectAll = () =>
    setSelectedIds((prev) =>
      Array.from(new Set([...prev, ...filtered.map((e) => e.id)]))
    );

  const clear = () => setSelectedIds([]);

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-foreground">Assign Employees</p>
          <p className="text-[11px] text-muted-foreground">
            Select active personnel from the Master List to assign this shift to.
          </p>
        </div>
        <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
          {selectedIds.length} selected
        </span>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, employee ID, QID, PID, company, department, position, branch..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={selectAll}
          className="px-2 py-1 rounded-md border border-border bg-card hover:bg-muted"
        >
          Select All (filtered)
        </button>
        <button
          onClick={clear}
          className="px-2 py-1 rounded-md border border-border bg-card hover:bg-muted"
        >
          Clear
        </button>
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border/50">
        {filtered.slice(0, 200).map((emp) => {
          const sel = selectedIds.includes(emp.id);
          return (
            <button
              key={emp.id}
              onClick={() => toggle(emp.id)}
              className={cn(
                'w-full flex items-center gap-2 p-2 text-left hover:bg-muted',
                sel && 'bg-emerald-50'
              )}
            >
              <div
                className={cn(
                  'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                  sel ? 'bg-emerald-600 border-emerald-600' : 'border-border'
                )}
              >
                {sel && <Check className="w-3 h-3 text-white" />}
              </div>
              <PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{emp.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {emp.id?.slice(-6)} · {emp.company || '—'} · {emp.department || '—'} · {emp.position_application || '—'}
                </p>
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="p-4 text-center text-sm text-muted-foreground">
            No employees match.
          </p>
        )}
      </div>
    </div>
  );
}