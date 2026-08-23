import React from 'react';
import {
  Users, Stethoscope, ShieldCheck, GraduationCap, BadgeCheck, Clock, XCircle,
  AlertTriangle, FileClock, Loader, CalendarClock, RefreshCw, Ban,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Enhanced KPI cards — existing summary cards plus the additional
 * reporting KPIs. All values come from the single aggregation pass.
 */
export default function DashboardKpiCards({ kpi, firstCardLabel }) {
  const cards = [
    { label: firstCardLabel, value: kpi.total, icon: Users, cls: 'text-blue-700 bg-blue-50' },
    { label: 'Medical Accepted', value: kpi.medAccepted, icon: Stethoscope, cls: 'text-emerald-700 bg-emerald-50' },
    { label: 'Medical Pending / Not Accepted', value: kpi.medPending, icon: AlertTriangle, cls: 'text-amber-700 bg-amber-50' },
    { label: 'Gate Pass Valid / Soon', value: kpi.gpValid, icon: ShieldCheck, cls: 'text-emerald-700 bg-emerald-50' },
    { label: 'Gate Pass Under Process / No Pass', value: kpi.gpUnderProcess + kpi.gpNoPass, icon: FileClock, cls: 'text-amber-700 bg-amber-50' },
    { label: 'Training Done', value: kpi.trainDone, icon: GraduationCap, cls: 'text-emerald-700 bg-emerald-50' },
    { label: 'Training On-Going', value: kpi.trainOnGoing, icon: Loader, cls: 'text-blue-700 bg-blue-50' },
    { label: 'Training Pending / To Be Scheduled', value: kpi.trainPending, icon: CalendarClock, cls: 'text-amber-700 bg-amber-50' },
    { label: 'PID Valid / Soon', value: kpi.pidValid, icon: BadgeCheck, cls: 'text-emerald-700 bg-emerald-50' },
    { label: 'PID Soon', value: kpi.pidSoon, icon: Clock, cls: 'text-amber-700 bg-amber-50' },
    { label: 'PID Expired', value: kpi.pidExpired, icon: XCircle, cls: 'text-red-700 bg-red-50' },
    { label: 'PID Renewal Under Process', value: kpi.pidRenewal, icon: RefreshCw, cls: 'text-blue-700 bg-blue-50' },
    { label: 'No PID', value: kpi.noPid, icon: Ban, cls: 'text-slate-600 bg-slate-100' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">{c.label}</span>
              <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center', c.cls)}>
                <Icon className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-2xl font-bold mt-1.5 tabular-nums">{c.value}</p>
          </div>
        );
      })}
    </div>
  );
}