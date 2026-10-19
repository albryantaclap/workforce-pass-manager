import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Download, AlertTriangle } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import AttendanceKpiCards from './AttendanceKpiCards';
import AttendanceFilterBar from './AttendanceFilterBar';
import ScannedByCell from './ScannedByCell';
import ManualEntryDialog from './ManualEntryDialog';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import { useRbac } from '@/lib/useRbac';
import { useAuth } from '@/lib/AuthContext';
import { useDebounce } from '@/hooks/useDebounce';
import { useAttendanceEmployees } from '@/hooks/useAttendanceEmployees';
import {
  formatTimeShort, formatDateShort, formatMinutes, getDurationColor,
  STATUS_COLORS, isSplitEffective, getSplitPunchStatuses, calculateAttendanceState,
  getFirstIn, getFinalOut, resolveShift, getRecordSequenceIssue,
} from '@/lib/attendanceEngine';
import { softDeleteAttendance } from '@/lib/attendanceService';

const PAGE_SIZES = [20, 50, 100, 200];

export default function TimeEntries({
  settings, shifts, assignments, holidays,
  selectedDate, setSelectedDate, filters, setFilters,
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { can } = useRbac();
  const canEditEntry = can('attendance.entries.edit');
  const canDeleteEntry = can('attendance.entries.delete');
  const canExportEntry = can('attendance.entries.export');
  const [showAbsent, setShowAbsent] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [manualOpen, setManualOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Debounce search to avoid a backend request on every keystroke
  const debouncedSearch = useDebounce(filters.search, 350);

  // Server-side paginated time entries from the backend function.
  // Only the current page is fetched, plus KPIs for the entire filtered set.
  // No artificial Absent rows are created in the browser — the backend
  // calculates absent/present status at the query level.
  const { data, isLoading, error } = useQuery({
    queryKey: ['time-entries', {
      date: selectedDate,
      search: debouncedSearch,
      company: filters.company, department: filters.department,
      designation: filters.designation, manager: filters.manager,
      branch: filters.branch, dirIndir: filters.dirIndir,
      status: filters.status, showAbsent,
      page, pageSize,
    }],
    queryFn: () => base44.functions.invoke('getTimeEntries', {
      date: selectedDate,
      filters: {
        search: debouncedSearch || '',
        company: filters.company || '',
        department: filters.department || '',
        designation: filters.designation || '',
        manager: filters.manager || '',
        branch: filters.branch || '',
        dirIndir: filters.dirIndir || '',
      },
      showAbsent,
      status: filters.status || '',
      page: page + 1, // backend is 1-based
      pageSize,
    }),
    enabled: !!selectedDate,
  });

  const result = data?.data || {};
  const rows = result.rows || [];
  const total = result.total || 0;
  const totalPages = result.totalPages || 1;
  const kpis = result.kpis;

  // Lazy-load all employees only when the Manual Entry dialog is open
  const { data: allEmployees = [] } = useAttendanceEmployees(manualOpen);

  // Quick date filters
  const quickDate = (type) => {
    const today = new Date();
    if (type === 'today') setSelectedDate(today.toLocaleDateString('en-CA'));
    else if (type === 'yesterday') {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      setSelectedDate(d.toLocaleDateString('en-CA'));
    } else if (type === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      d.setDate(d.getDate() - day);
      setSelectedDate(d.toLocaleDateString('en-CA'));
    } else if (type === 'month') {
      setSelectedDate(new Date(today.getFullYear(), today.getMonth(), 1).toLocaleDateString('en-CA'));
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    try {
      await softDeleteAttendance(deleteConfirm.id, deleteConfirm.reason || 'Deleted from Time Entries', user);
      toast({ title: 'Attendance record deleted (soft delete).' });
      setDeleteConfirm(null);
      // Invalidate only the affected attendance queries (not the entire module)
      qc.invalidateQueries({ queryKey: ['time-entries'] });
      qc.invalidateQueries({ queryKey: ['attendance-dashboard'] });
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  // Export the current page's attendance data to CSV.
  const exportCSV = () => {
    const headers = ['Employee', 'Designation', 'QID', 'PID', 'Company', 'Dept', 'Branch', 'Date', 'First In', 'First Out', 'Second In', 'Final Out', 'Duration (min)', 'Overtime (min)', 'Status', 'Scanned By', 'Site Location', 'First In By', 'First Out By', 'Second In By', 'Final Out By'];
    const csvRows = rows.map(({ emp, att }) => {
      const shift = resolveShift(emp, assignments, shifts, settings);
      let status;
      if (att) {
        const state = calculateAttendanceState(att, shift, settings, holidays, new Date());
        status = state.effectiveStatus;
      } else {
        status = 'Absent';
      }
      return [
        emp.name || '', emp.position_application || '', emp.qid_no || '', emp.pid || '',
        emp.company || '', emp.department || '', emp.current_location || '',
        selectedDate,
        att?.first_in_at || att?.check_in_at || '', att?.first_out_at || '',
        att?.second_in_at || '', att ? getFinalOut(att) : '',
        att?.duration_minutes || 0, att?.overtime_minutes || 0, status,
        att?.scanned_by?.label || '—',
        att?.site_location || '',
        att?.scanned_by?.names?.first_in || '', att?.scanned_by?.names?.first_out || '',
        att?.scanned_by?.names?.second_in || '', att?.scanned_by?.names?.final_out || '',
      ];
    });
    const csv = [headers, ...csvRows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `time-entries-${selectedDate}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  // Render a single punch cell.
  const renderPunch = (value, punchKey, splitOn, statuses) => {
    if (value) return <span className="text-muted-foreground">{formatTimeShort(value)}</span>;
    if (splitOn && statuses) {
      const s = statuses[punchKey];
      if (s === 'waiting') return <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-amber-50 text-amber-600 border-amber-200">Waiting</span>;
      if (s === 'missed') return <span className="inline-flex px-1.5 py-0.5 rounded-full text-[9px] font-semibold border bg-red-50 text-red-600 border-red-200">Missed</span>;
      if (s === 'not_required') return <span className="text-slate-300">—</span>;
    }
    return <span className="text-slate-300">—</span>;
  };

  return (
    <div className="space-y-4">
      <AttendanceFilterBar filters={filters} setFilters={setFilters} />
      <AttendanceKpiCards kpis={kpis} />

      {/* Quick date filters + actions */}
      <Card className="p-3">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Quick Range</span>
            {['today', 'yesterday', 'week', 'month'].map(q => (
              <Button key={q} size="sm" variant="outline"
                onClick={() => quickDate(q)}
                className="h-7 text-xs capitalize">
                {q === 'week' ? 'This Week' : q === 'month' ? 'This Month' : q === 'today' ? 'Today' : 'Yesterday'}
              </Button>
            ))}
            <div className="flex items-center gap-1 ml-2">
              <Input
                type="date"
                value={selectedDate}
                onChange={e => { setSelectedDate(e.target.value); setPage(0); }}
                className="w-36"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input type="checkbox" checked={showAbsent} onChange={e => { setShowAbsent(e.target.checked); setPage(0); }}
                className="rounded" />
              Show Absent Employees
            </label>
            {canExportEntry && (
              <Button size="sm" variant="outline" onClick={exportCSV} className="h-8">
                <Download className="w-3.5 h-3.5" /> Export
              </Button>
            )}
            {canEditEntry && (
              <Button size="sm" onClick={() => { setEditRecord(null); setManualOpen(true); }} className="h-8">
                <Plus className="w-3.5 h-3.5" /> Manual Entry
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-2.5 border-b border-border flex items-center justify-between bg-muted/30">
          <span className="text-sm font-semibold text-foreground">
            Time Entries <span className="text-muted-foreground font-normal">· {total} records</span>
          </span>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows per page</span>
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              className="h-7 rounded-md border border-input bg-transparent px-1 text-xs">
              {PAGE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto table-scroll-x">
          <table className="w-full text-xs table-list-view">
            <thead className="bg-muted/50 border-b border-border">
              <tr className="text-left text-muted-foreground">
                <th className="px-3 py-2 font-semibold">EMPLOYEE</th>
                <th className="px-3 py-2 font-semibold">DESIGNATION</th>
                <th className="px-3 py-2 font-semibold">QID</th>
                <th className="px-3 py-2 font-semibold">PID</th>
                <th className="px-3 py-2 font-semibold">COMPANY</th>
                <th className="px-3 py-2 font-semibold">DEPT</th>
                <th className="px-3 py-2 font-semibold">BRANCH</th>
                <th className="px-3 py-2 font-semibold">DATE</th>
                <th className="px-3 py-2 font-semibold">FIRST IN</th>
                <th className="px-3 py-2 font-semibold">FIRST OUT</th>
                <th className="px-3 py-2 font-semibold">SECOND IN</th>
                <th className="px-3 py-2 font-semibold">FINAL OUT</th>
                <th className="px-3 py-2 font-semibold">DURATION</th>
                <th className="px-3 py-2 font-semibold">O.T.</th>
                <th className="px-3 py-2 font-semibold">STATUS</th>
                <th className="px-3 py-2 font-semibold">SCANNED BY</th>
                <th className="px-3 py-2 font-semibold">SITE LOCATION</th>
                {(canEditEntry || canDeleteEntry) && <th className="px-3 py-2 font-semibold text-right">ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={(canEditEntry || canDeleteEntry) ? 18 : 17} className="text-center py-8 text-muted-foreground">Loading...</td></tr>
              ) : error ? (
                <tr><td colSpan={(canEditEntry || canDeleteEntry) ? 18 : 17} className="text-center py-8 text-red-600">
                  Failed to load. <button onClick={() => qc.invalidateQueries({ queryKey: ['time-entries'] })} className="underline">Retry</button>
                </td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={(canEditEntry || canDeleteEntry) ? 18 : 17} className="px-3 py-8 text-center text-muted-foreground">
                  No attendance records for the selected date and filters.
                </td></tr>
              ) : rows.map(({ emp, att }) => {
                const shift = resolveShift(emp, assignments, shifts, settings);
                let status;
                if (att) {
                  const state = calculateAttendanceState(att, shift, settings, holidays, new Date());
                  status = state.effectiveStatus;
                } else {
                  status = 'Absent';
                }
                const splitEffective = isSplitEffective(shift, selectedDate);
                const splitStatuses = splitEffective ? getSplitPunchStatuses(att, shift, new Date()) : null;
                // Flags a stored record whose punches break the sequence for the shift
                // that applies (e.g. a FINAL OUT with FIRST OUT / SECOND IN missing).
                // Nothing is rewritten — the Admin repairs it through Edit Attendance.
                const sequenceIssue = att ? getRecordSequenceIssue(att, shift) : null;
                const colors = STATUS_COLORS[status] || STATUS_COLORS['Absent'];
                return (
                  <tr key={emp.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size="sm" />
                        <div>
                          <p className="font-medium text-foreground">{emp.name}</p>
                          <p className="text-[10px] text-muted-foreground">{emp.id?.slice(-6)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{emp.position_application || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{emp.qid_no || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{emp.pid || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{emp.company || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{emp.department || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{emp.current_location || '—'}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDateShort(selectedDate)}</td>
                    <td className="px-3 py-2">{renderPunch(getFirstIn(att), 'FIRST_IN', splitEffective, splitStatuses)}</td>
                    <td className="px-3 py-2">{renderPunch(att?.first_out_at, 'FIRST_OUT', splitEffective, splitStatuses)}</td>
                    <td className="px-3 py-2">{renderPunch(att?.second_in_at, 'SECOND_IN', splitEffective, splitStatuses)}</td>
                    <td className="px-3 py-2">{renderPunch(getFinalOut(att), 'FINAL_OUT', splitEffective, splitStatuses)}</td>
                    <td className={cn('px-3 py-2 font-medium', getDurationColor(att?.duration_minutes))}>
                      {formatMinutes(att?.duration_minutes)}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatMinutes(att?.overtime_minutes)}</td>
                    <td className="px-3 py-2">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border', colors.bg, colors.text, colors.border)}>
                        <span className={cn('w-1.5 h-1.5 rounded-full', colors.dot)} />
                        {status}
                      </span>
                      {sequenceIssue && (
                        <span
                          title={sequenceIssue}
                          className="inline-flex items-center gap-0.5 ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold border bg-amber-50 text-amber-700 border-amber-200 cursor-help"
                        >
                          <AlertTriangle className="w-3 h-3" /> Sequence
                        </span>
                      )}
                    </td>
                    {/* WHO scanned/punched — one name, "Multiple" (hover for the
                        per-punch breakdown) or — when nothing was ever stored */}
                    <td className="px-3 py-2"><ScannedByCell scannedBy={att?.scanned_by} /></td>
                    {/* The branch the supervisor selected at the scanner (never the camp) */}
                    <td className="px-3 py-2 text-muted-foreground">{att?.site_location || '—'}</td>
                    {(canEditEntry || canDeleteEntry) && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {att && (
                            <>
                              {canEditEntry && (
                                // Bind the dialog to THIS row only: the attendance record id
                                // and the employee (personnel) id — never a name or the search text.
                                <button onClick={() => {
                                  setEditRecord({
                                    ...att,
                                    personnel_id: emp.id,
                                    employee_name: emp.name,
                                    company: emp.company,
                                    attendance_date: att.attendance_date || selectedDate,
                                  });
                                  setManualOpen(true);
                                }}
                                  className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                                  <Edit2 className="w-3 h-3" />
                                </button>
                              )}
                              {canDeleteEntry && (
                                <button onClick={() => setDeleteConfirm({ id: att.id, reason: '' })}
                                  className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Delete">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Page {page + 1} of {totalPages} · {total} total entries
            </span>
            <div className="flex items-center gap-1">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="h-7">
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="h-7">
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Duration legend */}
      <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
        <span className="font-semibold uppercase">Duration Colors</span>
        <span className="text-red-600">less than 5h</span>
        <span className="text-emerald-600">5-10h</span>
        <span className="text-blue-600">more than 10h</span>
      </div>

      {/* Manual Entry Dialog — lazy-loads employees only when open */}
      {manualOpen && (
        <ManualEntryDialog
          open={manualOpen}
          onClose={() => { setManualOpen(false); setEditRecord(null); }}
          employees={allEmployees}
          settings={settings}
          shifts={shifts}
          assignments={assignments}
          selectedDate={selectedDate}
          editRecord={editRecord}
          onSaved={() => {
            // Invalidate only the affected attendance queries
            qc.invalidateQueries({ queryKey: ['time-entries'] });
            qc.invalidateQueries({ queryKey: ['attendance-dashboard'] });
            setManualOpen(false); setEditRecord(null);
          }}
        />
      )}

      {/* Delete confirmation */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setDeleteConfirm(null)}>
          <Card className="p-5 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-semibold text-foreground mb-2">Delete Attendance Record</h3>
            <p className="text-sm text-muted-foreground mb-3">
              This will soft-delete the record. It can be restored later. Please provide a reason.
            </p>
            <Input
              placeholder="Deletion reason (required)"
              value={deleteConfirm.reason}
              onChange={e => setDeleteConfirm({ ...deleteConfirm, reason: e.target.value })}
            />
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" size="sm" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" onClick={handleDelete} disabled={!deleteConfirm.reason?.trim()}>
                Delete
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}