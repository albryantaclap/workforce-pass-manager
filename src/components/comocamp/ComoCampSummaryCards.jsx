import React, { useMemo } from 'react';
import { Users, Stethoscope, ShieldCheck, GraduationCap, BadgeCheck, Clock, XCircle } from 'lucide-react';
import { computePassStatus } from '@/utils/constants';
import { cn } from '@/lib/utils';

/**
 * Compact summary cards for the COMO Camp page.
 * All counts respect the currently active filters (operates on the
 * already-filtered `data` array passed in).
 *
 * "Valid" totals include "Soon" because Soon is still an active/valid pass.
 */
export default function ComoCampSummaryCards({ data }) {
  const stats = useMemo(() => {
    const total = data.length;
    const medAccepted = data.filter(e => (e.ftw_result || '').toUpperCase() === 'ACCEPTED').length;

    const gpValid = data.filter(e => {
      const s = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
      return s === 'VALID RLIC PASS' || s === 'SOON TO EXPIRE';
    }).length;

    const trainDone = data.filter(e => (e.training_status || '').toUpperCase() === 'DONE').length;

    const pidValid = data.filter(e => {
      const s = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
      return s === 'VALID PID PASS' || s === 'SOON TO EXPIRE';
    }).length;

    const pidSoon = data.filter(e => computePassStatus(e.pid_expiry, 'pid', e.pid_status) === 'SOON TO EXPIRE').length;
    const pidExpired = data.filter(e => computePassStatus(e.pid_expiry, 'pid', e.pid_status) === 'EXPIRED PID PASS').length;

    return { total, medAccepted, gpValid, trainDone, pidValid, pidSoon, pidExpired };
  }, [data]);

  const cards = [
    { label: 'Total COMO Camp', value: stats.total, icon: Users, cls: 'text-blue-700 bg-blue-50' },
    { label: 'Medical Accepted', value: stats.medAccepted, icon: Stethoscope, cls: 'text-emerald-700 bg-emerald-50' },
    { label: 'Gate Pass Valid / Soon', value: stats.gpValid, icon: ShieldCheck, cls: 'text-emerald-700 bg-emerald-50' },
    { label: 'Training Done', value: stats.trainDone, icon: GraduationCap, cls: 'text-emerald-700 bg-emerald-50' },
    { label: 'PID Valid / Soon', value: stats.pidValid, icon: BadgeCheck, cls: 'text-emerald-700 bg-emerald-50' },
    { label: 'PID Soon', value: stats.pidSoon, icon: Clock, cls: 'text-amber-700 bg-amber-50' },
    { label: 'PID Expired', value: stats.pidExpired, icon: XCircle, cls: 'text-red-700 bg-red-50' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        return (
          <div key={c.label} className="rounded-xl border bg-card p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide leading-tight">{c.label}</span>
              <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center', c.cls)}>
                <Icon className="w-3.5 h-3.5" />
              </span>
            </div>
            <p className="text-2xl font-bold mt-1.5">{c.value}</p>
          </div>
        );
      })}
    </div>
  );
}