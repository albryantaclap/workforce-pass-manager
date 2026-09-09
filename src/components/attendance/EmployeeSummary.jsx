import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import AttendanceFilterBar from './AttendanceFilterBar';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import {
  isWorkingDay, isHoliday, calculateDurationFromRecord, calculateOvertime,
  formatMinutes, STATUS_COLORS,
} from '@/lib/attendanceEngine';

export default function EmployeeSummary({
  employees, settings, shifts, assignments, holidays, filters, setFilters,
}) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toLocaleDateString('en-CA');
  });
  const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString('en-CA'));

  // Fetch all attendance records for the date range
  const { data: allAttendance = [], isLoading } = useQuery({
    queryKey: ['attendance', 'range', dateFrom, dateTo],
    queryFn: () => base44.entities.AttendanceRecord.filter(
      { is_deleted: { $ne: true } }, '-attendance_date', 100000
    ),
    enabled: !!dateFrom && !!dateTo,
  });

  // Filter attendance to date range
  const rangeAttendance = useMemo(() => {
    return allAttendance.filter(r => {
      if (dateFrom && r.attendance_date < dateFrom) return false;
      if (dateTo && r.attendance_date > dateTo) return false;
      return true;
    });
  }, [allAttendance, dateFrom, dateTo]);

  // Group by personnel
  const attendanceByPersonnel = useMemo(() => {
    const m = new Map();
    for (const r of rangeAttendance) {
      if (!m.has(r.personnel_id)) m.set(r.personnel_id, []);
      m.get(r.personnel_id).push(r);
    }
    return m;
  }, [rangeAttendance]);

  // Build summary rows
  const summaryRows = useMemo(() => {
    // Generate working days in range
    const days = [];
    const [fy, fm, fd] = dateFrom.split('-').map(Number);
    const [ty, tm, td] = dateTo.split('-').map(Number);
    const start = new Date(fy, fm - 1, fd);
    const end = new Date(ty, tm - 1, td);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const ds = d.toLocaleDateString('en-CA');
      if (isWorkingDay(ds, settings) && !isHoliday(ds, holidays)) days.push(ds);
    }

    return employees.map(emp => {
      const records = attendanceByPersonnel.get(emp.id) || [];
      let present = 0, absent = 0, late = 0, leave = 0, totalMinutes = 0, overtimeMinutes = 0;
      for (const r of records) {
        const status = r.attendance_status || 'Present';
        if (status === 'Present' || status === 'Late' || status === 'Half Day' || status === 'Missing Check-out') present++;
        if (status === 'Late') late++;
        if (status === 'Absent') absent++;
        if (status === 'On Leave') leave++;
        totalMinutes += calculateDurationFromRecord(r);
        overtimeMinutes += r.overtime_minutes || calculateOvertime(calculateDurationFromRecord(r), settings);
      }
      // Absent = working days with no record
      const daysWithRecord = new Set(records.map(r => r.attendance_date)).size;
      absent = Math.max(0, days.length - daysWithRecord - leave);
      const attPct = days.length > 0 ? Math.round((present / days.length) * 100) : 0;
      return {
        emp, workingDays: days.length, present, absent, late, leave,
        totalHours: totalMinutes, overtime: overtimeMinutes, attPct,
      };
    });
  }, [employees, attendanceByPersonnel, dateFrom, dateTo, settings, holidays]);

  return (
    <div className="space-y-4">
      <AttendanceFilterBar filters={filters} setFilters={setFilters} employees={employees} />

      {/* Date range */}
      <Card className="p-3 flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-muted-foreground uppercase">Summary Period</span>
        <div className="flex items-center gap-1">
          <label className="text-xs text-muted-foreground">From</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-muted-foreground">To</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
        </div>
        <span className="text-xs text-muted-foreground">{summaryRows.length} employees</span>
      </Card>

      {/* Summary table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto table-scroll-x">
          <table className="w-full text-xs table-list-view">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">EMPLOYEE</th>
                <th className="px-3 py-2 font-semibold">DESIGNATION</th>
                <th className="px-3 py-2 font-semibold">QID</th>
                <th className="px-3 py-2 font-semibold">COMPANY</th>
                <th className="px-3 py-2 font-semibold">DEPT</th>
                <th className="px-3 py-2 font-semibold">BRANCH</th>
                <th className="px-3 py-2 font-semibold">MANAGER</th>
                <th className="px-3 py-2 font-semibold text-center">WORK DAYS</th>
                <th className="px-3 py-2 font-semibold text-center">PRESENT</th>
                <th className="px-3 py-2 font-semibold text-center">ABSENT</th>
                <th className="px-3 py-2 font-semibold text-center">LATE</th>
                <th className="px-3 py-2 font-semibold text-center">LEAVE</th>
                <th className="px-3 py-2 font-semibold text-center">TOTAL HRS</th>
                <th className="px-3 py-2 font-semibold text-center">O.T.</th>
                <th className="px-3 py-2 font-semibold text-center">ATT %</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={15} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : summaryRows.length === 0 ? (
                <tr><td colSpan={15} className="text-center py-8 text-muted-foreground">No employees for the current filters.</td></tr>
              ) : summaryRows.map(({ emp, workingDays, present, absent, late, leave, totalHours, overtime, attPct }) => (
                <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size="sm" />
                      <span className="font-medium text-foreground">{emp.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{emp.position_application || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{emp.qid_no || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{emp.company || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{emp.department || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{emp.current_location || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{emp.assigned_manager_name || '—'}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{workingDays}</td>
                  <td className="px-3 py-2 text-center font-medium text-emerald-600">{present}</td>
                  <td className="px-3 py-2 text-center font-medium text-red-600">{absent}</td>
                  <td className="px-3 py-2 text-center font-medium text-amber-600">{late}</td>
                  <td className="px-3 py-2 text-center font-medium text-blue-600">{leave}</td>
                  <td className="px-3 py-2 text-center text-foreground">{formatMinutes(totalHours)}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{formatMinutes(overtime)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`font-bold ${attPct >= 80 ? 'text-emerald-600' : attPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {attPct}%
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}