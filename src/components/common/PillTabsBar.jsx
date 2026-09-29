import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Horizontal pill tab bar — the Master List tab style, for pages whose tabs are
 * plain buttons driven by local state. Purely presentational: the page keeps
 * ownership of the active tab, the counts and the filtering logic.
 *
 * tabs: [{ key, label, icon?, color?, count?, disabled? }]
 */
export default function PillTabsBar({ tabs, activeKey, onChange, className, size = 'default' }) {
  const compact = size === 'compact';
  return (
    <div className={cn('w-full overflow-x-auto', className)}>
      <div className="inline-flex items-stretch overflow-hidden rounded-full border border-border bg-gradient-to-b from-card to-muted/50 shadow-sm">
        {tabs.map((tab, index) => {
          const Icon = tab.icon;
          const isActive = activeKey === tab.key;
          return (
            <div key={tab.key} className="flex items-stretch">
              {index > 0 && <span className="h-7 w-px self-center bg-border" />}
              <button
                type="button"
                onClick={() => onChange(tab.key)}
                disabled={tab.disabled}
                title={tab.title}
                className={cn(
                  'relative flex items-center gap-2 whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                  compact ? 'px-3 py-2 text-xs' : 'px-4 py-2.5 text-sm',
                  isActive
                    ? 'font-semibold text-foreground'
                    : 'font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                )}
              >
                {Icon && (
                  <Icon className={cn(compact ? 'h-3.5 w-3.5' : 'h-4 w-4', isActive ? 'text-foreground' : tab.color)} />
                )}
                {tab.label}
                {tab.count !== undefined && tab.count !== null && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-[11px] font-bold leading-none',
                      isActive ? 'bg-highlight text-slate-900' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    {typeof tab.count === 'number' ? tab.count.toLocaleString() : tab.count}
                  </span>
                )}
                {isActive && <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-highlight" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}