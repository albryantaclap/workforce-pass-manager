import React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';
import { cn } from '@/lib/utils';

/**
 * Pill-styled drop-in replacements for the Radix tab list / trigger — the same
 * look as the Master List tab bar, for pages that use <Tabs> + <TabsContent>.
 * Use inside an existing <Tabs> root together with the shared <TabsContent>.
 */
export function PillTabsList({ className, ...props }) {
  return (
    <TabsPrimitive.List
      className={cn(
        'inline-flex items-stretch overflow-hidden rounded-full border border-border bg-gradient-to-b from-card to-muted/50 shadow-sm',
        className
      )}
      {...props}
    />
  );
}

export function PillTabsTrigger({ value, icon: Icon, iconClass, count, children, className, ...props }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className={cn(
        'group relative flex items-center gap-2 whitespace-nowrap border-l border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors first:border-l-0 hover:bg-muted/60 hover:text-foreground',
        'data-[state=active]:font-semibold data-[state=active]:text-foreground',
        className
      )}
      {...props}
    >
      {Icon && (
        <Icon className={cn('h-4 w-4', iconClass, 'group-data-[state=active]:text-foreground')} />
      )}
      {children}
      {count !== undefined && count !== null && (
        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold leading-none text-muted-foreground group-data-[state=active]:bg-highlight group-data-[state=active]:text-slate-900">
          {typeof count === 'number' ? count.toLocaleString() : count}
        </span>
      )}
      <span className="absolute bottom-0 left-0 right-0 h-[3px] bg-highlight opacity-0 group-data-[state=active]:opacity-100" />
    </TabsPrimitive.Trigger>
  );
}