import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Search, Users } from 'lucide-react';

/**
 * Server-side personnel search across the entire Master List (Active, Onboarding,
 * Inactive and Demobilized). Searches by Full Name, QID, PID, Company and Employee
 * ID. Results stream from the server (not a loaded page), so matches are found
 * anywhere in the database. Selecting a person opens their complete renewal history.
 */
export default function RenewalPersonnelSearch({ onSelect }) {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const query = useMemo(() => {
    if (!debounced) return {};
    const or = [
      { name: { $regex: debounced, $options: 'i' } },
      { qid_no: { $regex: debounced, $options: 'i' } },
      { pid: { $regex: debounced, $options: 'i' } },
      { company: { $regex: debounced, $options: 'i' } },
    ];
    if (debounced.length >= 6) or.push({ id: debounced });
    return { $or: or };
  }, [debounced]);

  const { data, isFetching } = useQuery({
    queryKey: ['renewalPersonnelSearch', debounced],
    queryFn: () => base44.entities.Employee.filter(query, { sort: 'name', limit: 30 }),
    enabled: debounced.length > 0,
    staleTime: 15000,
  });
  const results = data?.items || [];

  const pick = (emp) => {
    onSelect(emp);
    setSearch('');
    setDebounced('');
    setOpen(false);
  };

  return (
    <div className="relative" ref={boxRef}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Search personnel by name, QID, PID, company or Employee ID to view their complete renewal history…"
        className="w-full pl-9 pr-4 h-9 rounded-md border border-input bg-white text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      />
      {open && debounced && (
        <div className="absolute z-30 mt-1 w-full bg-white border rounded-lg shadow-lg max-h-80 overflow-auto">
          {isFetching && results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground">Searching…</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Users className="w-3.5 h-3.5" /> No personnel found.
            </div>
          ) : results.map((e) => (
            <button key={e.id} type="button" onClick={() => pick(e)} className="w-full text-left px-3 py-2 hover:bg-muted/40 border-b last:border-b-0">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{e.name || '—'}</span>
                <span className="text-[10px] text-muted-foreground">{e.personnel_status || 'Unassigned'}</span>
              </div>
              <div className="text-[10px] text-muted-foreground font-mono">
                {e.company || '—'}{e.qid_no ? ` · QID ${e.qid_no}` : ''}{e.pid ? ` · PID ${e.pid}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}