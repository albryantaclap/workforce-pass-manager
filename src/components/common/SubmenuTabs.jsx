import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Tab bar styled like the main Dashboard's SubmenuNav (yellow active card,
 * gradient icon container), but driven by tab keys + onChange instead of routes.
 * Each tab: { key, label, icon, gradient }
 */
export default function SubmenuTabs({ activeKey, onChange, tabs }) {
  return (
    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1">
      {tabs.map((item) => {
        const Icon = item.icon;
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={cn(
              'flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all duration-200 min-w-[80px] sm:min-w-[96px] shrink-0',
              isActive ? 'bg-[#FFD801] shadow-sm' : 'hover:bg-muted/50 ring-1 ring-border'
            )}
          >
            <div className={cn('w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm', item.gradient)}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className={cn(
              'text-[11px] sm:text-xs font-medium text-center leading-tight whitespace-nowrap',
              isActive ? 'text-slate-900' : 'text-muted-foreground'
            )}>
              {item.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}