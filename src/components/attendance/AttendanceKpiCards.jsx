import React, { useMemo } from 'react';
import { Users, UserCheck, UserX, Clock, TrendingUp, LogIn, LogOut, Activity, AlertCircle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  isWorkingDay, isHoliday, calculateDailyStatus, STATUS_COLORS,
} from '@/lib/attendanceEngine';

// KPI cards for the Daily Attendance dashboard. All cards respect active filters.
export default function AttendanceKpiCards({ employees, attendanceByPersonnel, settings, holidays, selectedDate }) {
  const stats = useMemo(() => {
    const holiday = isHoliday(selectedDate, holidays);
    const workingDay = isWorkingDay(selectedDate, settings);
    let present = 0, absent = 0, late = 0, checkedIn = 0, checkedOut = 0;
    let currentlyWorking = 0, missingCheckout = 0, onLeave = 0, restDay = 0;

    for (const emp of employees) {
      const att = attendanceByPersonnel.get(emp.id);
      const status = att?.attendance_status || (att ? 'Present' : (holiday ? 'Holiday' : (workingDay ? 'Absent' : 'Rest Day')));

      if (status === 'Present') present++;
      else if (status === 'Late') { present++; late++; }
      else if (status === 'Absent') absent++;
      else if (status === 'Missing Check-out') { present++; missingCheckout++; }
      else if (status === 'Incomplete') { present++; missingCheckout++; }
      else if (status === 'Half Day') { present++; }
      else if (status === 'On Leave') onLeave++;
      else if (status === 'Rest Day') restDay++;
      else if (status === 'Holiday') restDay++;

      if (att?.first_in_at && !att?.final_out_at) { checkedIn++; currentlyWorking++; }
      if (att?.final_out_at) checkedOut++;
    }

    const expected = employees.length - onLeave - restDay;
    const rate = expected > 0 ? Math.round((present / expected) * 100) : 0;

    return {
      total: employees.length,
      present, absent, late,
      checkedIn, checkedOut, currentlyWorking,
      missingCheckout, onLeave, restDay,
      rate, expected,
    };
  }, [employees, attendanceByPersonnel, settings, holidays, selectedDate]);

  const cards = [
    { label: 'Total Employees', value: stats.total, icon: Users, color: 'text-slate-600', bg: 'bg-slate-100' },
    { label: 'Present Today', value: stats.present, icon: UserCheck, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'Absent Today', value: stats.absent, icon: UserX, color: 'text-red-600', bg: 'bg-red-50' },
    { label: 'Late Arrivals', value: stats.late, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Attendance Rate', value: `${stats.rate}%`, icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Checked In', value: stats.checkedIn, icon: LogIn, color: 'text-teal-600', bg: 'bg-teal-50' },
    { label: 'Checked Out', value: stats.checkedOut, icon: LogOut, color: 'text-indigo-600', bg: 'bg-indigo-50' },
    { label: 'Currently Working', value: stats.currentlyWorking, icon: Activity, color: 'text-cyan-600', bg: 'bg-cyan-50' },
    { label: 'Missing Check-out', value: stats.missingCheckout, icon: AlertCircle, color: 'text-orange-600', bg: 'bg-orange-50' },
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