import React, { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';

const fmtDate = (ds) => {
  if (!ds) return '—';
  const d = new Date(ds + 'T00:00:00');
  return isNaN(d.getTime()) ? ds : d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const PUNCH_FIELDS = [
  { key: 'firstIn', label: 'First In' },
  { key: 'firstOut', label: 'First Out' },
  { key: 'secondIn', label: 'Second In' },
  { key: 'finalOut', label: 'Final Out' },
];

// Preview of what will be written before anything is saved.
// Existing attendance is listed as "Skip" by default; the Admin has to pick
// "Update" per row (or with the Update-all button) to replace a record.
export default function ManualEntryPreview({
  rows, date, siteLocationName, commonTimes, overrides, onActionChange, onOverrideChange, onUpdateAllExisting,
}) {
  const [adjusting, setAdjusting] = useState({});
  const timeOf = (row, key) => {
    const v = overrides[row.id]?.[key];
    return v === undefined ? (commonTimes[key] || '') : v;
  };
  const existingCount = rows.filter((r) => r.hasExisting).length;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="px-2 py-0.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold">
            Ready to save: {rows.filter((r) => r.action !== 'skip').length}
          </span>
          <span className="px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-slate-600 font-semibold">
            Skipped: {rows.filter((r) => r.action === 'skip').length}
          </span>
          <span className="px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700 font-semibold">
            Existing: {existingCount}
          </span>
        </div>
        {existingCount > 0 && (
          <button type="button" onClick={onUpdateAllExisting}
            className="text-[11px] text-primary hover:underline">
            Update all existing records
          </button>
        )}
      </div>

      <div className="max-h-64 overflow-auto rounded-lg border border-border">
        <table className="w-full text-[11px]">
          <thead className="bg-muted/50 border-b border-border sticky top-0">
            <tr className="text-left text-muted-foreground">
              <th className="px-2 py-1.5 font-semibold">EMPLOYEE</th>
              <th className="px-2 py-1.5 font-semibold">DATE</th>
              <th className="px-2 py-1.5 font-semibold">SITE LOCATION</th>
              <th className="px-2 py-1.5 font-semibold">FIRST IN</th>
              <th className="px-2 py-1.5 font-semibold">FINAL OUT</th>
              <th className="px-2 py-1.5 font-semibold">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <React.Fragment key={row.id}>
                <tr className="border-b border-border/50">
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <PersonnelAvatar name={row.emp.name} photoUrl={row.emp.photo_url} size="sm" />
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{row.emp.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {[row.emp.company, row.emp.pid && `PID ${row.emp.pid}`].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{fmtDate(date)}</td>
                  <td className="px-2 py-1.5 text-muted-foreground">{siteLocationName || '—'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{timeOf(row, 'firstIn') || '—'}</td>
                  <td className="px-2 py-1.5 text-muted-foreground whitespace-nowrap">{timeOf(row, 'finalOut') || '—'}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      {row.hasExisting ? (
                        <select
                          value={row.action}
                          onChange={(e) => onActionChange(row.id, e.target.value)}
                          className="h-6 rounded border border-input bg-transparent px-1 text-[10px]"
                        >
                          <option value="skip">Skip Existing</option>
                          <option value="update">Update Existing</option>
                        </select>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded border border-emerald-200 bg-emerald-50 text-emerald-700 font-semibold text-[10px]">
                          Create
                        </span>
                      )}
                      <button type="button"
                        onClick={() => setAdjusting((a) => ({ ...a, [row.id]: !a[row.id] }))}
                        className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Adjust this employee's punch times">
                        <SlidersHorizontal className="w-3 h-3" />
                      </button>
                    </div>
                  </td>
                </tr>
                {adjusting[row.id] && (
                  <tr className="border-b border-border/50 bg-muted/20">
                    <td colSpan={6} className="px-2 py-1.5">
                      <div className="flex flex-wrap items-end gap-2">
                        {PUNCH_FIELDS.map((f) => (
                          <div key={f.key} className="space-y-0.5">
                            <label className="text-[9px] font-semibold text-muted-foreground uppercase">{f.label}</label>
                            <input
                              type="time"
                              value={timeOf(row, f.key)}
                              onChange={(e) => onOverrideChange(row.id, f.key, e.target.value)}
                              className="h-7 rounded border border-input bg-white px-1 text-[11px]"
                              style={{ width: '5.5rem' }}
                            />
                          </div>
                        ))}
                        <span className="text-[10px] text-muted-foreground">Applies to this employee only.</span>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}