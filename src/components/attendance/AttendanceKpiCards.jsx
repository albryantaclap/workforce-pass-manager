import React from 'react';
import { Users, UserCheck, UserX, Clock, TrendingUp, LogIn, LogOut, Activity, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// KPI cards for the Daily Attendance dashboard and Time Entries tab.
// KPIs are computed server-side by the backend function and passed as props.
// Shows a skeleton while loading (kpis is null/undefined).
export default function AttendanceKpiCards({ kpis }) {
  if (!kpis) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="h-[72px] rounded-xl bg-muted/40 animate-pulse" />
        ))}
      </div>
    );
  }

  const cards = [
    { label: 'Total Employees', value: kpis.total, icon: Users, color: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'Present Today', value: kpis.present, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Absent Today', value: kpis.absent, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Late Arrivals', value: kpis.late, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Attendance Rate', value: `${kpis.rate}%`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Checked In', value: kpis.checkedIn, icon: LogIn, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Checked Out', value: kpis.checkedOut, icon: LogOut, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Currently Working', value: kpis.currentlyWorking, icon: Activity, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Missing Check-out', value: kpis.missingCheckout, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
      {cards.map(c => (
        <Card key={c.label} className="p-3 hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-2">
            <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', c.bg)}>
              <c.icon className={cn('w-4 h-4', c.color)} />
            </div>
          </div>
          <p className="text-2xl font-bold text-foreground">{c.value}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{c.label}</p>
        </Card>
      ))}
    </div>
  );
}