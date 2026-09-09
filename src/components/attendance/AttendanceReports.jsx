import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AttendanceFilterBar from './AttendanceFilterBar';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import {
  isWorkingDay, isHoliday, calculateDurationFromRecord,
  formatMinutes, formatTimeShort, formatDateShort, STATUS_COLORS,
} from '@/lib/attendanceEngine';

const REPORT_TYPES = [
  { key: 'daily', label: 'Daily Attendance' },
  { key: 'monthly', label: 'Monthly Attendance' },
  { key: 'late', label: 'Late Report' },
  { key: 'absent', label: 'Absent Report' },
  { key: 'missing', label: 'Missing Check-out Report' },
  { key: 'overtime', label: 'Overtime Report' },
];

export default function AttendanceReports({
  employees, settings, shifts, assignments, holidays, filters, setFilters,
}) {
  const [reportType, setReportType] = useState('daily');
  const [dateFrom, setDateFrom] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString('en-CA'));

  const { data: allRecords = [], isLoading } = useQuery({
    queryKey: ['attendance', 'report', dateFrom, dateTo],
    queryFn: () => base44.entities.AttendanceRecord.filter(
      { is_deleted: { $ne: true } }, '-attendance_date', 100000
    ),
  });

  const filteredRecords = useMemo(() => {
    return allRecords.filter(r => {
      if (dateFrom && r.attendance_date < dateFrom) return false;
      if (dateTo && r.attendance_date > dateTo) return false;
      return true;
    });
  }, [allRecords, dateFrom, dateTo]);

  // Build report rows
  const reportRows = useMemo(() => {
    const empMap = new Map(employees.map(e => [e.id, e]));
    return filteredRecords.map(r => {
      const emp = empMap.get(r.personnel_id);
      return { record: r, emp: emp || { name: r.employee_name, company: r.company } };
    }).filter(({ emp }) => {
      if (!emp) return true;
      if (filters.company && emp.company !== filters.company) return false;
      if (filters.department && emp.department !== filters.department) return false;
      if (filters.branch && emp.current_location !== filters.branch) return false;
      return true;
    }).filter(({ record }) => {
      if (reportType === 'late') return record.attendance_status === 'Late' || record.is_late;
      if (reportType === 'absent') return record.attendance_status === 'Absent';
      if (reportType === 'missing') return record.attendance_status === 'Missing Check-out' || record.attendance_status === 'Incomplete';
      if (reportType === 'overtime') return (record.overtime_minutes || 0) > 0;
      return true;
    });
  }, [filteredRecords, employees, reportType, filters]);

  const exportCSV = () => {
    const headers = ['Employee', 'Company', 'Department', 'Date', 'First In', 'First Out', 'Second In', 'Final Out', 'Duration (min)', 'Overtime (min)', 'Status', 'Source'];
    const rows = reportRows.map(({ r, emp }) => [
      emp?.name || r.employee_name, emp?.company || r.company, emp?.department || '',
      r.attendance_date, formatTimeShort(r.first_in_at), formatTimeShort(r.first_out_at),
      formatTimeShort(r.second_in_at), formatTimeShort(r.final_out_at),
      r.duration_minutes || 0, r.overtime_minutes || 0, r.attendance_status || '', r.source || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `attendance-${reportType}-${dateFrom}_to_${dateTo}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <AttendanceFilterBar filters={filters} setFilters={setFilters} employees={employees} />

      {/* Report type + date range */}
      <Card className="p-3 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Report Type</span>
          {REPORT_TYPES.map(rt => (
            <Button key={rt.key} size="sm" variant={reportType === rt.key ? 'default' : 'outline'}
              onClick={() => setReportType(rt.key)} className="h-7 text-xs">
              {rt.label}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground uppercase">Date Range</span>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          <span className="text-xs text-muted-foreground">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          <Button size="sm" variant="outline" onClick={exportCSV} className="h-7 ml-auto">
            Export CSV
          </Button>
        </div>
      </Card>

      {/* Report table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="text-sm font-semibold text-foreground">
            {REPORT_TYPES.find(r => r.key === reportType)?.label} · {reportRows.length} records
          </span>
        </div>
        <div className="overflow-x-auto table-scroll-x">
          <table className="w-full text-xs table-list-view">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">EMPLOYEE</th>
                <th className="px-3 py-2 font-semibold">COMPANY</th>
                <th className="px-3 py-2 font-semibold">DEPT</th>
                <th className="px-3 py-2 font-semibold">DATE</th>
                <th className="px-3 py-2 font-semibold">FIRST IN</th>
                <th className="px-3 py-2 font-semibold">FIRST OUT</th>
                <th className="px-3 py-2 font-semibold">SECOND IN</th>
                <th className="px-3 py-2 font-semibold">FINAL OUT</th>
                <th className="px-3 py-2 font-semibold">DURATION</th>
                <th className="px-3 py-2 font-semibold">O.T.</th>
                <th className="px-3 py-2 font-semibold">STATUS</th>
                <th className="px-3 py-2 font-semibold">SOURCE</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : reportRows.length === 0 ? (
                <tr><td colSpan={12} className="text-center py-8 text-muted-foreground">No records for the selected report and filters.</td></tr>
              ) : reportRows.map(({ record: r, emp }) => {
                const colors = STATUS_COLORS[r.attendance_status] || STATUS_COLORS['Absent'];
                return (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PersonnelAvatar name={emp?.name || r.employee_name} photoUrl={emp?.photo_url} size="sm" />
                        <span className="font-medium text-foreground">{emp?.name || r.employee_name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{emp?.company || r.company || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{emp?.department || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateShort(r.attendance_date)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTimeShort(r.first_in_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTimeShort(r.first_out_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTimeShort(r.second_in_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTimeShort(r.final_out_at)}</td>
                    <td className="px-3 py-2 text-foreground">{formatMinutes(r.duration_minutes)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatMinutes(r.overtime_minutes)}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${colors.bg} ${colors.text} ${colors.border}`}>
                        {r.attendance_status || '—'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{r.source || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}