import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AttendanceFilterBar from './AttendanceFilterBar';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';
import TimesheetExportDialog from './TimesheetExportDialog';
import PdfByEmployeeDialog from './PdfByEmployeeDialog';
import WeeklyPdfDialog from './WeeklyPdfDialog';
import PersonalWorkingRecordDialog from './PersonalWorkingRecordDialog';
import { FileSpreadsheet, FileText, CalendarRange, ClipboardList, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import {
  formatMinutes, formatTimeShort, formatDateShort, STATUS_COLORS,
  getFirstIn, getFinalOut,
} from '@/lib/attendanceEngine';

const REPORT_TYPES = [
  { key: 'daily', label: 'Daily Attendance' },
  { key: 'monthly', label: 'Monthly Attendance' },
  { key: 'weekly', label: 'Weekly Attendance' },
  { key: 'late', label: 'Late Report' },
  { key: 'absent', label: 'Absent Report' },
  { key: 'missing', label: 'Missing Check-out Report' },
  { key: 'overtime', label: 'Overtime Report' },
  { key: 'timesheet', label: 'Timesheet' },
  { key: 'pdf_by_employee', label: 'PDF by Employee' },
  { key: 'pwr', label: 'Personal Working Record' },
];

// Monday of the week containing the given YYYY-MM-DD (or today if omitted).
const mondayOf = (ds) => {
  const d = ds ? new Date(ds + 'T00:00:00') : new Date();
  const daysSinceMon = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - daysSinceMon);
  return d.toLocaleDateString('en-CA');
};
const shiftDays = (ds, delta) => {
  const d = new Date(ds + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString('en-CA');
};
const fmtPeriodLabel = (from, to) => {
  const f = new Date(from + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const t = new Date(to + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  return `${f} – ${t}`;
};

export default function AttendanceReports({
  employees, settings, shifts, assignments, holidays, filters, setFilters,
}) {
  const [reportType, setReportType] = useState('daily');
  const [dateFrom, setDateFrom] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString('en-CA'));
  const [showTimesheet, setShowTimesheet] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [showWeekly, setShowWeekly] = useState(false);
  const [showPwr, setShowPwr] = useState(false);
  const [exporting, setExporting] = useState(false);

  const monthStart = (ds) => {
    const d = ds ? new Date(ds + 'T00:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString('en-CA');
  };
  const monthEnd = (ds) => {
    const d = ds ? new Date(ds + 'T00:00:00') : new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toLocaleDateString('en-CA');
  };

  const handleReportType = (key) => {
    setReportType(key);
    if (key === 'weekly') {
      const mon = mondayOf();
      setDateFrom(mon);
      setDateTo(shiftDays(mon, 6));
    } else if (key === 'monthly') {
      setDateFrom(monthStart());
      setDateTo(monthEnd());
    }
  };

  const goPrevWeek = () => { setDateFrom(d => shiftDays(d, -7)); setDateTo(d => shiftDays(d, -7)); };
  const goNextWeek = () => { setDateFrom(d => shiftDays(d, 7)); setDateTo(d => shiftDays(d, 7)); };
  const goThisWeek = () => { const mon = mondayOf(); setDateFrom(mon); setDateTo(shiftDays(mon, 6)); };

  // Pagination — resets to page 1 when any filter, date, or report type changes
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(20, [
    filters.search, filters.company, filters.department, filters.designation,
    filters.manager, filters.branch, filters.dirIndir, filters.status,
    dateFrom, dateTo, reportType,
  ]);

  // Server-side paginated report data for the table
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-report', {
      search: filters.search, company: filters.company, department: filters.department,
      designation: filters.designation, manager: filters.manager, branch: filters.branch,
      dirIndir: filters.dirIndir, status: filters.status,
      dateFrom, dateTo, reportType, page, rowsPerPage,
    }],
    queryFn: () => base44.functions.invoke('getAttendanceReport', {
      filters: {
        search: filters.search || '',
        company: filters.company || '',
        department: filters.department || '',
        designation: filters.designation || '',
        manager: filters.manager || '',
        branch: filters.branch || '',
        dirIndir: filters.dirIndir || '',
      },
      dateFrom,
      dateTo,
      reportType,
      status: filters.status || '',
      page: page + 1, // backend is 1-based
      pageSize: rowsPerPage,
    }),
    enabled: !!dateFrom && !!dateTo,
  });

  const result = data?.data || {};
  const reportRows = result.rows || [];
  const total = result.total || 0;
  const totalPages = result.totalPages || 1;

  // All attendance records — loaded lazily only when a PDF dialog is open
  const pdfDialogOpen = showTimesheet || showPdf || showWeekly || showPwr;
  const { data: allRecords = [] } = useQuery({
    queryKey: ['attendance', 'report-all', dateFrom, dateTo],
    queryFn: () => base44.entities.AttendanceRecord.filter(
      { is_deleted: { $ne: true } }, '-attendance_date', 100000
    ),
    enabled: pdfDialogOpen,
  });

  // CSV export — fetches ALL matching records from the backend (not just the current page)
  const exportCSV = async () => {
    setExporting(true);
    try {
      const res = await base44.functions.invoke('getAttendanceReport', {
        filters: {
          search: filters.search || '',
          company: filters.company || '',
          department: filters.department || '',
          designation: filters.designation || '',
          manager: filters.manager || '',
          branch: filters.branch || '',
          dirIndir: filters.dirIndir || '',
        },
        dateFrom,
        dateTo,
        reportType,
        status: filters.status || '',
        exportAll: true,
      });
      const allRows = res.data?.rows || [];
      const headers = ['Employee', 'Company', 'Department', 'Date', 'First In', 'First Out', 'Second In', 'Final Out', 'Duration (min)', 'Overtime (min)', 'Status', 'Source'];
      const rows = allRows.map(({ record: r, emp }) => [
        emp?.name || r.employee_name, emp?.company || r.company, emp?.department || '',
        r.attendance_date, formatTimeShort(getFirstIn(r)), formatTimeShort(r.first_out_at),
        formatTimeShort(r.second_in_at), formatTimeShort(getFinalOut(r)),
        r.duration_minutes || 0, r.overtime_minutes || 0, r.attendance_status || '', r.source || '',
      ]);
      const csv = [headers, ...rows].map(row => row.map(c => `"${c}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `attendance-${reportType}-${dateFrom}_to_${dateTo}.csv`;
      a.click(); URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
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
              onClick={() => handleReportType(rt.key)} className="h-7 text-xs">
              {rt.label}
            </Button>
          ))}
        </div>
        {reportType === 'weekly' ? (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Week</span>
            <div className="inline-flex items-center rounded-full border border-border bg-white">
              <button onClick={goPrevWeek} className="px-2 py-1 text-muted-foreground hover:bg-muted rounded-l-full" title="Previous week"><ChevronLeft className="w-4 h-4" /></button>
              <span className="px-2 text-xs font-medium text-foreground whitespace-nowrap">{fmtPeriodLabel(dateFrom, dateTo)}</span>
              <button onClick={goNextWeek} className="px-2 py-1 text-muted-foreground hover:bg-muted rounded-r-full" title="Next week"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <Button size="sm" variant="ghost" onClick={goThisWeek} className="h-7 text-xs">This Week</Button>
            <span className="text-xs font-semibold text-muted-foreground uppercase ml-2">From</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            <button onClick={() => setShowWeekly(true)}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium text-white ml-auto"
              style={{ background: '#5c53f5', borderColor: '#5c53f5' }}>
              <CalendarRange className="w-4 h-4" /> Export Weekly PDF
            </button>
          </div>
        ) : reportType === 'timesheet' ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Monthly matrix timesheet — one row per employee, two columns per day (punch + Total H), with summary.</p>
            <button onClick={() => setShowTimesheet(true)}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-4 py-1.5 text-sm font-medium text-emerald-700 hover:bg-emerald-100">
              <FileSpreadsheet className="w-4 h-4" /> Timesheet
            </button>
          </div>
        ) : reportType === 'pdf_by_employee' ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Individual employee attendance timesheet — one PDF page per employee.</p>
            <button onClick={() => setShowPdf(true)}
              className="inline-flex items-center gap-2 rounded-full border border-rose-300 bg-rose-50 px-4 py-1.5 text-sm font-medium text-rose-700 hover:bg-rose-100">
              <FileText className="w-4 h-4" /> PDF by Employee
            </button>
          </div>
        ) : reportType === 'pwr' ? (
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Personal Working Record — A4 portrait form per employee, with split-shift punches and signature lines.</p>
            <button onClick={() => setShowPwr(true)}
              className="inline-flex items-center gap-2 rounded-full border border-indigo-300 bg-indigo-50 px-4 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100">
              <ClipboardList className="w-4 h-4" /> Personal Working Record
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Date Range</span>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
            <span className="text-xs text-muted-foreground">to</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
            <Button size="sm" variant="outline" onClick={exportCSV} disabled={exporting} className="h-7 ml-auto">
              <Download className="w-3.5 h-3.5" />
              {exporting ? 'Exporting...' : 'Export CSV'}
            </Button>
          </div>
        )}
      </Card>

      <TimesheetExportDialog
        open={showTimesheet} onOpenChange={setShowTimesheet}
        employees={employees} records={allRecords} settings={settings} shifts={shifts} assignments={assignments} holidays={holidays}
        baseFilters={filters}
      />
      <PdfByEmployeeDialog
        open={showPdf} onOpenChange={setShowPdf}
        employees={employees} records={allRecords} settings={settings} shifts={shifts} assignments={assignments} holidays={holidays}
        baseFilters={filters}
      />
      <WeeklyPdfDialog
        open={showWeekly} onOpenChange={setShowWeekly}
        employees={employees} records={allRecords} settings={settings} shifts={shifts} assignments={assignments} holidays={holidays}
        baseFilters={filters}
      />
      <PersonalWorkingRecordDialog
        open={showPwr} onOpenChange={setShowPwr}
        employees={employees} records={allRecords}
      />

      {/* Report table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border bg-muted/30">
          <span className="text-sm font-semibold text-foreground">
            {REPORT_TYPES.find(r => r.key === reportType)?.label} · {total} records
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
                    <td className="px-3 py-2 text-muted-foreground">{formatTimeShort(getFirstIn(r))}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTimeShort(r.first_out_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTimeShort(r.second_in_at)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatTimeShort(getFinalOut(r))}</td>
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
        <Pagination
          page={page}
          totalPages={totalPages}
          totalRecords={total}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
          isFiltered={Object.values(filters).some(v => v)}
        />
      </Card>
    </div>
  );
}