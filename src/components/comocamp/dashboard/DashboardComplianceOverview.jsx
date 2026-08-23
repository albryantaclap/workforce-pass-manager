import React from 'react';

/**
 * Onboarding / compliance overview: overall completion percentage plus
 * a per-stage breakdown of what's missing across the filtered dataset.
 */
export default function DashboardComplianceOverview({ agg, total }) {
  const completionPct = total ? Math.round((agg.fullyComplete / total) * 100) : 0;
  const stages = [
    { label: 'Fully Complete', value: agg.fullyComplete, color: '#10b981' },
    { label: 'Missing Medical', value: agg.missingMed, color: '#f59e0b' },
    { label: 'Missing / Invalid Gate Pass', value: agg.missingGp, color: '#f59e0b' },
    { label: 'Training Incomplete', value: agg.missingTrain, color: '#f59e0b' },
    { label: 'Missing / Invalid PID', value: agg.missingPid, color: '#ef4444' },
  ];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold">Compliance / Completion Overview</h4>
        <div className="text-right">
          <div className="text-2xl font-bold tabular-nums">{completionPct}%</div>
          <div className="text-[10px] text-muted-foreground uppercase">Fully Complete</div>
        </div>
      </div>
      <div className="h-3 bg-muted/60 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: Math.max(1, completionPct) + '%' }} />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {stages.map((s) => (
          <div key={s.label} className="rounded-lg border p-2.5">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] font-medium text-muted-foreground uppercase leading-tight">{s.label}</span>
            </div>
            <p className="text-lg font-bold tabular-nums">{s.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}