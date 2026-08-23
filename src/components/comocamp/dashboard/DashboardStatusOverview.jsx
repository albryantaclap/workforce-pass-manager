import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Compact status breakdown: label, count, percentage, colored bar.
 * Clicking a row optionally drills down into the personnel table.
 */
export default function DashboardStatusOverview({ items, total, onClick }) {
  if (!items || items.length === 0) {
    return <div className="text-xs text-muted-foreground py-8 text-center">No data</div>;
  }
  return (
    <div className="space-y-2.5">
      {items.map((it) => {
        const pct = total ? Math.round((it.value / total) * 100) : 0;
        const clickable = !!onClick;
        const Comp = clickable ? 'button' : 'div';
        return (
          <Comp
            key={it.key}
            onClick={clickable ? () => onClick(it) : undefined}
            className={cn('w-full text-left', clickable && 'group hover:opacity-90')}
          >
            <div className="flex items-center justify-between text-xs mb-1">
              <span className="font-medium">{it.label}</span>
              <span className="text-muted-foreground tabular-nums">
                {it.value} <span className="text-[10px]">({pct}%)</span>
              </span>
            </div>
            <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: Math.max(1, pct) + '%', backgroundColor: it.color || '#3b82f6' }}
              />
            </div>
          </Comp>
        );
      })}
    </div>
  );
}