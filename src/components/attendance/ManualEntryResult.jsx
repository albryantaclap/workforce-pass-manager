import React from 'react';
import { CheckCircle2, AlertTriangle, RotateCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Per-employee result of a bulk manual attendance save.
export default function ManualEntryResult({ summary, results = [], failedRows = [], onRetry, retrying }) {
  const failed = results.filter((r) => r.status === 'failed');
  const skipped = results.filter((r) => r.status === 'skipped');
  const s = summary || {};
  const created = (s.created || 0) + (s.updated || 0);

  const boxes = [
    { label: 'Selected Employees', value: s.selected || 0, tone: 'text-foreground' },
    { label: 'Successfully Saved', value: created, tone: 'text-emerald-600' },
    { label: 'Skipped Existing', value: s.skipped || 0, tone: 'text-slate-600' },
    { label: 'Failed', value: s.failed || 0, tone: failed.length ? 'text-red-600' : 'text-muted-foreground' },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {boxes.map((b) => (
          <div key={b.label} className="rounded-lg border border-border p-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase">{b.label}</p>
            <p className={`text-xl font-bold ${b.tone}`}>{b.value}</p>
          </div>
        ))}
      </div>

      {(s.updated || 0) > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {s.created || 0} created · {s.updated} existing records updated in the audit history.
        </p>
      )}

      {failed.length > 0 && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-2 space-y-1">
          <p className="text-[11px] font-semibold text-red-700 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Not saved
          </p>
          {failed.map((f) => (
            <p key={f.personnelId} className="text-[11px] text-red-700">
              <span className="font-medium">{f.employeeName || f.personnelId}</span> — {f.error || 'Failed'}
            </p>
          ))}
          {failedRows.length > 0 && (
            <Button size="sm" variant="outline" className="h-7 text-[11px] mt-1" onClick={onRetry} disabled={retrying}>
              <RotateCw className={`w-3 h-3 ${retrying ? 'animate-spin' : ''}`} />
              {retrying ? 'Retrying...' : `Retry failed (${failedRows.length})`}
            </Button>
          )}
        </div>
      )}

      {skipped.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 p-2 space-y-1">
          <p className="text-[11px] font-semibold text-foreground">Skipped — attendance already existed</p>
          {skipped.map((r) => (
            <p key={r.personnelId} className="text-[11px] text-muted-foreground">
              {r.employeeName || r.personnelId}
            </p>
          ))}
        </div>
      )}

      {failed.length === 0 && skipped.length === 0 && created > 0 && (
        <p className="text-[11px] text-emerald-700 flex items-center gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" /> Every selected employee was saved.
        </p>
      )}
    </div>
  );
}