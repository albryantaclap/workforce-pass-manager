import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

/**
 * Card-style submenu navigation matching the Daily Attendance tab style.
 * Each item: { label, icon, path, gradient, exact? }
 */
export default function SubmenuNav({ items }) {
  const { pathname } = useLocation();

  return (
    <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-1">
      {items.map(item => {
        const Icon = item.icon;
        const isActive = item.exact
          ? pathname === item.path
          : pathname === item.path || pathname.startsWith(item.path + '/');
        return (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              'flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl transition-all duration-200 min-w-[80px] sm:min-w-[96px] shrink-0',
              isActive
                ? 'bg-[#FFD801] shadow-sm'
                : 'hover:bg-muted/50 ring-1 ring-border'
            )}
          >
            <div className={cn(
              'w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br flex items-center justify-center shadow-sm',
              item.gradient
            )}>
              <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <span className={cn(
              'text-[11px] sm:text-xs font-medium text-center leading-tight whitespace-nowrap',
              isActive ? 'text-slate-900' : 'text-muted-foreground'
            )}>
              {item.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}