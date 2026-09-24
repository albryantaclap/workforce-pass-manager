import React from 'react';
import { Card } from '@/components/ui/card';

// Grid of department cards showing present/total ratio with a progress bar.
// Data is computed server-side by getAttendanceDashboard and passed as props.
export default function DepartmentSnapshot({ departments = [] }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">Department Snapshot</h3>
        <span className="text-xs text-muted-foreground">{departments.length} departments</span>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {departments.map(({ dept, total, present }) => {
          const pct = total > 0 ? Math.round((present / total) * 100) : 0;
          return (
            <div key={dept} className="rounded-lg border border-border bg-card p-3 space-y-2">
              <p className="text-xs font-semibold text-foreground truncate" title={dept}>{dept}</p>
              <p className="text-lg font-bold text-foreground leading-none">
                {present}<span className="text-sm font-normal text-muted-foreground">/{total}</span>
              </p>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{pct}% present</p>
            </div>
          );
        })}
        {departments.length === 0 && (
          <p className="col-span-full text-xs text-muted-foreground text-center py-8">
            No employees for the current filters.
          </p>
        )}
      </div>
    </Card>
  );
}