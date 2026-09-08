import React, { useMemo } from 'react';
import { Users, LogIn, LogOut, DoorOpen, UserMinus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getAttendanceStatus, ATT_STATUS } from '@/lib/attendanceUtils';

// COMO Camp attendance KPI strip. Uses the LATEST session (across all dates)
// for Checked In / Checked Out / Currently Inside, and the selected-date
// session set for "Not Checked In" (no session on the selected date).
// This matches the Master List row display while keeping the daily
// attendance tracking meaningful.
export default function AttendanceKpiCards({ data, latestByPersonnel, daySessionIds, onCard }) {
  const stats = useMemo(() => {
    let checkedIn = 0, checkedOut = 0;
    for (const e of data) {
      const st = getAttendanceStatus(latestByPersonnel.get(e.id));
      if (st === ATT_STATUS.CHECKED_IN) checkedIn++;
      else if (st === ATT_STATUS.CHECKED_OUT) checkedOut++;
    }
    const notCheckedIn = data.filter(e => !daySessionIds.has(e.id)).length;
    return {
      total: data.length,
      checkedIn,
      checkedOut,
      inside: checkedIn,
      notCheckedIn,
    };
  }, [data, latestByPersonnel, daySessionIds]);

  const cards = [
    { id: 'attTotal', label: 'Total Personnel', value: stats.total, icon: Users, cls: 'bg-slate-50 text-slate-700 border-slate-200' },
    { id: 'attCheckedIn', label: 'Checked In', value: stats.checkedIn, icon: LogIn, cls: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'attCheckedOut', label: 'Checked Out', value: stats.checkedOut, icon: LogOut, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { id: 'attInside', label: 'Currently Inside', value: stats.inside, icon: DoorOpen, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'attNotCheckedIn', label: 'Not Checked In', value: stats.notCheckedIn, icon: UserMinus, cls: 'bg-red-50 text-red-700 border-red-200' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(c => {
        const Icon = c.icon;
        const interactive = !!onCard;
        return (
          <button
            key={c.id}
            type="button"
            disabled={!interactive}
            onClick={interactive ? () => onCard(c.id) : undefined}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition-shadow',
              c.cls,
              interactive && 'hover:shadow-md cursor-pointer',
              !interactive && 'cursor-default'
            )}
          >
            <div className="p-2 rounded-lg bg-white/60"><Icon className="w-4 h-4" /></div>
            <div>
              <div className="text-xl font-bold leading-none">{c.value}</div>
              <div className="text-[10px] font-medium mt-1 opacity-80">{c.label}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}