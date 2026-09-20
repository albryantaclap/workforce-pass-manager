import React, { useState } from 'react';
import { SlidersHorizontal, ChevronDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

/**
 * Collapsible filter panel for Inventory pages.
 * Follows the same visual pattern as the Workforce Management FilterToolbar.
 */
export function InventoryFilterPanel({ activeCount = 0, onClear, totalFiltered, totalAll, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50/50 rounded-t-xl cursor-pointer"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-500" />
          <span className="text-sm font-semibold text-slate-700">FILTERS</span>
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 rounded-full leading-none">
              {activeCount} Active
            </span>
          )}
        </div>
        <div className="flex items-center gap-3" onClick={e => e.stopPropagation()}>
          {activeCount > 0 && totalFiltered !== undefined && totalAll !== undefined && (
            <span className="text-xs text-muted-foreground">
              <strong className="text-foreground">{totalFiltered.toLocaleString()}</strong> / {totalAll.toLocaleString()} records
            </span>
          )}
          {activeCount > 0 && (
            <button onClick={onClear} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive font-medium">
              <X className="w-3 h-3" /> Clear Filters
            </button>
          )}
          <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', open && 'rotate-180')} />
        </div>
      </div>
      {open && <div className="px-4 py-3">{children}</div>}
    </div>
  );
}

export function FilterField({ label, children, className }) {
  return (
    <div className={cn('space-y-1', className)}>
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

export function FilterDateRange({ from, to, onFrom, onTo }) {
  return (
    <div className="flex items-center gap-1.5">
      <Input type="date" value={from} onChange={e => onFrom(e.target.value)} className="text-xs h-8 min-w-0" />
      <span className="text-[10px] text-muted-foreground flex-shrink-0">to</span>
      <Input type="date" value={to} onChange={e => onTo(e.target.value)} className="text-xs h-8 min-w-0" />
    </div>
  );
}

export function FilterNumberRange({ min, max, onMin, onMax }) {
  return (
    <div className="flex items-center gap-1.5">
      <Input type="number" value={min} onChange={e => onMin(e.target.value)} placeholder="Min" className="text-xs h-8 min-w-0" />
      <span className="text-[10px] text-muted-foreground flex-shrink-0">to</span>
      <Input type="number" value={max} onChange={e => onMax(e.target.value)} placeholder="Max" className="text-xs h-8 min-w-0" />
    </div>
  );
}