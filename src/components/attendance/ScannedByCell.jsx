import React from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

// WHO performed the punch(es) on an attendance record.
//   - one name  → the same account performed every punch stored on the record
//   - Multiple  → different accounts handled the punches; hover/click shows the
//                 per-punch breakdown (First In — Supervisor A, …)
//   - —         → no account was ever stored for this record (legacy rows)
export default function ScannedByCell({ scannedBy }) {
  const label = scannedBy?.label || '—';
  const detail = scannedBy?.detail || [];

  if (label !== 'Multiple') {
    return (
      <span className={label === '—' ? 'text-slate-300' : 'text-muted-foreground'}>{label}</span>
    );
  }

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="font-medium text-indigo-600 underline decoration-dotted underline-offset-2 cursor-help"
          >
            Multiple
          </button>
        </TooltipTrigger>
        <TooltipContent side="left" className="text-[11px] leading-relaxed">
          {detail.map((d) => (
            <div key={d.stage}>{d.stage} — {d.name || '—'}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}