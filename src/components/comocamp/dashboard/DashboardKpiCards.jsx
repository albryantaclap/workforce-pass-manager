import React from 'react';
import {
  Users, ShieldCheck, GraduationCap, Loader, CalendarClock,
  BadgeCheck, XCircle, MapPin, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Simplified KPI strip — 9 cards.
 * Counts come from the single aggregation pass (live Master List data).
 * Cards are optional click-to-filter quick actions via onCard(id).
 */
export default function DashboardKpiCards({ kpi, firstCardLabel, onCard }) {
  const cards = [
    { id: 'total', label: firstCardLabel, value: kpi.total, icon: Users, cls: 'text-blue-700 bg-blue-50' },
    { id: 'gpValid', label: 'Gate Pass Valid / Soon', value: kpi.gpValid, icon: ShieldCheck, cls: 'text-emerald-700 bg-emerald-50' },
    { id: 'trainDone', label: 'Training Done', value: kpi.trainDone, icon: GraduationCap, cls: 'text-emerald-700 bg-emerald-50' },
    { id: 'trainOnGoing', label: 'Training On-Going', value: kpi.trainOnGoing, icon: Loader, cls: 'text-blue-700 bg-blue-50' },
    { id: 'trainPending', label: 'Training Pending / To Be Scheduled', value: kpi.trainPending, icon: CalendarClock, cls: 'text-amber-700 bg-amber-50' },
    { id: 'pidValid', label: 'PID Valid / Soon', value: kpi.pidValid, icon: BadgeCheck, cls: 'text-emerald-700 bg-emerald-50' },
    { id: 'pidExpired', label: 'PID Expired', value: kpi.pidExpired, icon: XCircle, cls: 'text-red-700 bg-red-50' },
    { id: 'outside', label: 'Outside', value: kpi.outside, icon: MapPin, cls: 'text-amber-700 bg-amber-50' },
    { id: 'comoCamp', label: 'COMO Camp', value: kpi.comoCamp, icon: Building2, cls: 'text-blue-700 bg-blue-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        const clickable = !!onCard;
        const Comp = clickable ? 'button' : 'div';
        return (
          <Comp
            key={c.id}
            type={clickable ? 'button' : undefined}
            onClick={clickable ? () => onCard(c.id) : undefined}
            className={cn(
              'rounded-xl border bg-card p-3 shadow-sm text-left',
              clickable && 'hover:shadow-md hover:border-primary/40 cursor-pointer transition-all'
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">{c.label}</span>
              <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', c.cls)}>
                <Icon className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-2xl font-bold mt-1.5 tabular-nums">{c.value}</p>
          </Comp>
        );
      })}
    </div>
  );
}