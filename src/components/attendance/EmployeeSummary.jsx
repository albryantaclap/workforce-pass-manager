import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import AttendanceFilterBar from './AttendanceFilterBar';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';
import { formatMinutes } from '@/lib/attendanceEngine';

export default function EmployeeSummary({
  settings, shifts, assignments, holidays, filters, setFilters,
}) {
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toLocaleDateString('en-CA');
  });
  const [dateTo, setDateTo] = useState(() => new Date().toLocaleDateString('en-CA'));

  // Pagination — resets to page 1 whenever any filter or date changes
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(20, [
    filters.search, filters.company, filters.department, filters.designation,
    filters.manager, filters.branch, filters.dirIndir, filters.status,
    dateFrom, dateTo,
  ]);

  // Server-side paginated + aggregated summary from the backend function.
  // The backend applies: personnel filters → date range → attendance aggregation
  // → status condition → pagination, returning only the rows for the current page.
  const { data, isLoading } = useQuery({
    queryKey: ['employee-summary', {
      search: filters.search, company: filters.company, department: filters.department,
      designation: filters.designation, manager: filters.manager, branch: filters.branch,
      dirIndir: filters.dirIndir, status: filters.status,
      dateFrom, dateTo, page, rowsPerPage,
    }],
    queryFn: () => base44.functions.invoke('getEmployeeSummary', {
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
      status: filters.status || '',
      page: page + 1, // backend is 1-based
      pageSize: rowsPerPage,
    }),
    enabled: !!dateFrom && !!dateTo,
  });

  const result = data?.data || {};
  const summaryRows = result.rows || [];
  const total = result.total || 0;
  const totalPages = result.totalPages || 1;

  return (
    <div className="space-y-4">
      <AttendanceFilterBar filters={filters} setFilters={setFilters} />

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
        <span className="text-xs text-muted-foreground">{total} employees</span>
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
              ) : summaryRows.map((row) => (
                <tr key={row.id} className="border-b border-border/50 hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <PersonnelAvatar name={row.name} photoUrl={row.photo_url} size="sm" />
                      <span className="font-medium text-foreground">{row.name}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{row.position_application || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.qid_no || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.company || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.department || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.current_location || '—'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{row.assigned_manager_name || '—'}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{row.workingDays}</td>
                  <td className="px-3 py-2 text-center font-medium text-emerald-600">{row.present}</td>
                  <td className="px-3 py-2 text-center font-medium text-red-600">{row.absent}</td>
                  <td className="px-3 py-2 text-center font-medium text-amber-600">{row.late}</td>
                  <td className="px-3 py-2 text-center font-medium text-blue-600">{row.leave}</td>
                  <td className="px-3 py-2 text-center text-foreground">{formatMinutes(row.totalMinutes)}</td>
                  <td className="px-3 py-2 text-center text-muted-foreground">{formatMinutes(row.overtimeMinutes)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`font-bold ${row.attPct >= 80 ? 'text-emerald-600' : row.attPct >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {row.attPct}%
                    </span>
                  </td>
                </tr>
              ))}
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