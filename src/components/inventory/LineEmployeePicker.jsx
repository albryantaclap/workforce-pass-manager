import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, UserRound, X } from 'lucide-react';
import AnchoredDropdown from '@/components/common/AnchoredDropdown';

/**
 * The employee one issue line is handed to — searched against the Workforce
 * Master List by Name, PID (staff no.) or QID. The roster is passed in by the
 * host page (already loaded for its filters), so a line never fires its own
 * employee query. Results are rendered in a portal (see AnchoredDropdown) so the
 * table's scroll container can never clip them.
 */
export default function LineEmployeePicker({ employees = [], value, onSelect, onClear, placeholder = 'Search Name / PID / QID' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [cursor, setCursor] = useState(0);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  const close = () => { setOpen(false); setSearch(''); };

  useEffect(() => { if (open && inputRef.current) inputRef.current.focus(); }, [open]);

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (q.length < 2) return [];
    return employees
      .filter(e => [e.name, e.pid, e.staff_no, e.qid_no, e.company]
        .some(v => String(v || '').toLowerCase().includes(q)))
      .slice(0, 20);
  }, [employees, search]);

  const pick = (emp) => {
    onSelect?.(emp);
    close();
    setCursor(0);
  };

  const handleKey = (e) => {
    if (!open || !results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); pick(results[Math.min(cursor, results.length - 1)]); }
  };

  const selected = !!value?.employee_id;

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-1">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
          <input
            ref={inputRef}
            value={search}
            onChange={e => { setSearch(e.target.value); setCursor(0); setOpen(e.target.value.trim().length >= 2); }}
            onFocus={() => setOpen(search.trim().length >= 2)}
            onKeyDown={handleKey}
            placeholder={selected ? value.employee_name : placeholder}
            className="h-8 w-full rounded-md border border-input bg-white pl-6 pr-2 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
        {selected && (
          <button
            type="button"
            title="Clear employee"
            onClick={() => { onClear?.(); setSearch(''); }}
            className="h-6 w-6 shrink-0 rounded text-slate-400 hover:text-red-500 hover:bg-slate-100"
          >
            <X className="w-3.5 h-3.5 mx-auto" />
          </button>
        )}
      </div>

      <AnchoredDropdown anchorRef={boxRef} open={open} onClose={close} width={340}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-xs text-muted-foreground">
              {search.trim().length < 2 ? 'Type at least 2 characters' : 'No matching employee found'}
            </div>
          ) : results.map((emp, idx) => (
            <button
              key={emp.id}
              type="button"
              onMouseEnter={() => setCursor(idx)}
              onClick={() => pick(emp)}
              className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs ${idx === cursor ? 'bg-accent' : 'hover:bg-accent'}`}
            >
              <UserRound className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate flex-1">{emp.name}</span>
              <span className="shrink-0 text-[10px] text-muted-foreground">
                PID: {emp.pid || emp.staff_no || '—'}{emp.company ? ` • ${emp.company}` : ''}
              </span>
            </button>
          ))}
        </div>
      </AnchoredDropdown>
    </div>
  );
}