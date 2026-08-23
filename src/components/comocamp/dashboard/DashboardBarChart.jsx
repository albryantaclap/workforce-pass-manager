import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Lightweight horizontal bar chart (no chart lib) with optional click-to-drill.
 */
export default function DashboardBarChart({ items, onClick, emptyLabel = 'No data', maxItems }) {
  if (!items || items.length === 0) {
    return <div className="text-xs text-muted-foreground py-8 text-center">{emptyLabel}</div>;
  }
  const list = maxItems ? items.slice(0, maxItems) : items;
  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
      {list.map((it) => {
        const pct = Math.max(2, (it.value / max) * 100);
        const clickable = !!onClick;
        const Comp = clickable ? 'button' : 'div';
        return (
          <Comp
            key={it.key}
            onClick={clickable ? () => onClick(it.key) : undefined}
            className={cn('w-full flex items-center gap-2 text-left', clickable && 'group hover:opacity-90')}
          >
            <span className="w-40 shrink-0 truncate text-[11px] font-medium" title={it.label}>{it.label}</span>
            <div className="flex-1 h-5 bg-muted/60 rounded overflow-hidden">
              <div
                className="h-full rounded transition-all"
                style={{ width: pct + '%', backgroundColor: it.color || '#3b82f6' }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-xs font-semibold tabular-nums">{it.value}</span>
          </Comp>
        );
      })}
    </div>
  );
}