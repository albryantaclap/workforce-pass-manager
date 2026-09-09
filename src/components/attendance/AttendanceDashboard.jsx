import React, { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import AttendanceKpiCards from './AttendanceKpiCards';
import AttendanceFilterBar from './AttendanceFilterBar';
import {
  isWorkingDay, isHoliday, STATUS_COLORS,
} from '@/lib/attendanceEngine';

export default function AttendanceDashboard({
  employees, attendanceByPersonnel, settings, shifts, assignments, holidays,
  selectedDate, filters, setFilters,
}) {
  // Attendance by company (for bar chart)
  const byCompany = useMemo(() => {
    const map = new Map();
    for (const emp of employees) {
      const co = emp.company || 'Unknown';
      if (!map.has(co)) map.set(co, { company: co, total: 0, present: 0, absent: 0, late: 0 });
      const entry = map.get(co);
      entry.total++;
      const att = attendanceByPersonnel.get(emp.id);
      const status = att?.attendance_status || (att ? 'Present' : 'Absent');
      if (['Present', 'Late', 'Half Day', 'Missing Check-out', 'Incomplete'].includes(status)) entry.present++;
      if (status === 'Absent') entry.absent++;
      if (status === 'Late') entry.late++;
    }
    return [...map.values()].sort((a, b) => b.present - a.present).slice(0, 12);
  }, [employees, attendanceByPersonnel]);

  // Status distribution
  const statusDist = useMemo(() => {
    const dist = {};
    for (const emp of employees) {
      const att = attendanceByPersonnel.get(emp.id);
      const holiday = isHoliday(selectedDate, holidays);
      const workingDay = isWorkingDay(selectedDate, settings);
      const status = att?.attendance_status || (att ? 'Present' : (holiday ? 'Holiday' : (workingDay ? 'Absent' : 'Rest Day')));
      dist[status] = (dist[status] || 0) + 1;
    }
    return dist;
  }, [employees, attendanceByPersonnel, settings, holidays, selectedDate]);

  const maxCompanyTotal = Math.max(...byCompany.map(c => c.total), 1);

  return (
    <div className="space-y-4">
      <AttendanceFilterBar filters={filters} setFilters={setFilters} employees={employees} />
      <AttendanceKpiCards
        employees={employees}
        attendanceByPersonnel={attendanceByPersonnel}
        settings={settings}
        holidays={holidays}
        selectedDate={selectedDate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status distribution */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Attendance Status Distribution</h3>
          <div className="space-y-2">
            {Object.entries(statusDist).sort((a, b) => b[1] - a[1]).map(([status, count]) => {
              const colors = STATUS_COLORS[status] || STATUS_COLORS['Absent'];
              const pct = employees.length > 0 ? (count / employees.length) * 100 : 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <div className="w-28 text-xs font-medium text-foreground flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                    {status}
                  </div>
                  <div className="flex-1 h-6 bg-muted rounded-md overflow-hidden">
                    <div className={`h-full ${colors.bg} ${colors.text} text-[10px] font-semibold flex items-center px-2`}
                      style={{ width: `${Math.max(pct, 2)}%` }}>
                      {count}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Present vs Absent by Company */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Attendance by Company</h3>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {byCompany.map(c => (
              <div key={c.company} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground truncate">{c.company}</span>
                  <span className="text-muted-foreground">{c.present}/{c.total} present</span>
                </div>
                <div className="flex h-4 rounded-md overflow-hidden bg-muted">
                  <div className="bg-emerald-500" style={{ width: `${(c.present / c.total) * 100}%` }} />
                  <div className="bg-red-400" style={{ width: `${(c.absent / c.total) * 100}%` }} />
                </div>
              </div>
            ))}
            {byCompany.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-8">No data for the current filters.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}