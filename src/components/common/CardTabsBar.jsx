import React from 'react';
import { cn } from '@/lib/utils';

/**
 * Square-card tab bar: a horizontal row of rounded square cards.
 * Inactive = white card, light border, colored icon, dark label.
 * Active = yellow card, purple icon container with white icon.
 */
export default function CardTabsBar({ activeKey, onChange, tabs }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = tab.key === activeKey;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => onChange(tab.key)}
            className={cn(
              'group flex flex-col items-center justify-center gap-2 rounded-2xl p-3 aspect-square transition-all',
              active
                ? 'bg-[#fce15c] shadow-sm'
                : 'bg-white border border-[#e0e0e0] hover:border-[#fce15c] hover:shadow-sm'
            )}
          >
            <div className={cn('flex items-center justify-center rounded-xl w-10 h-10', active && 'bg-[#8a4efc]')}>
              <Icon className={cn('w-6 h-6', active ? 'text-white' : tab.color || 'text-slate-500')} />
            </div>
            <span className={cn(
              'text-[11px] font-medium text-center leading-tight line-clamp-2',
              active ? 'text-[#333333]' : 'text-[#4a4a4a]'
            )}>
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}