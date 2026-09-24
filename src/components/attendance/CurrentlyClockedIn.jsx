import React, { useState, useMemo } from 'react';
import { UserRound, Clock3 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import { formatTimeShort } from '@/lib/attendanceEngine';

// Employees whose session is currently open (clocked in but not clocked out).
// Data is computed server-side by getAttendanceDashboard and passed as props.
export default function CurrentlyClockedIn({ clockedIn = [] }) {
  const [companyFilter, setCompanyFilter] = useState('all');

  const companies = useMemo(() => {
    const set = new Set();
    for (const e of clockedIn) if (e.company) set.add(e.company);
    return [...set].sort();
  }, [clockedIn]);

  const filtered = useMemo(() => {
    if (companyFilter === 'all') return clockedIn;
    return clockedIn.filter(e => e.company === companyFilter);
  }, [clockedIn, companyFilter]);

  return (
    <Card className="p-4 flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Currently Clocked In</h3>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {filtered.length}
          </span>
        </div>
        <select
          value={companyFilter}
          onChange={e => setCompanyFilter(e.target.value)}
          className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
        >
          <option value="all">All Employees</option>
          {companies.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-10 text-center">
          <UserRound className="w-12 h-12 text-slate-300 mb-3" strokeWidth={1.5} />
          <p className="text-sm text-slate-400">No employees currently clocked in</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto table-scroll-y max-h-72 space-y-1.5 pr-1">
          {filtered.map(({ id, name, photo_url, company, since }) => (
            <div key={id} className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-muted/50">
              <PersonnelAvatar name={name} photoUrl={photo_url} size={8} />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-foreground truncate">{name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{company || '—'}</p>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium flex-shrink-0">
                <Clock3 className="w-3 h-3" />
                {formatTimeShort(since)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}