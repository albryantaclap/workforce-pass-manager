import React, { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Plus, Edit2, Trash2, Eye, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import AttendanceKpiCards from './AttendanceKpiCards';
import AttendanceFilterBar from './AttendanceFilterBar';
import ManualEntryDialog from './ManualEntryDialog';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import { usePermissions } from '@/lib/usePermissions';
import { useAuth } from '@/lib/AuthContext';
import {
  formatTimeShort, formatDateShort, formatMinutes, getDurationColor,
  STATUS_COLORS, isWorkingDay, isHoliday, getFirstIn, getFinalOut,
  resolveShift, isSplitEffective, getSplitPunchStatuses, calculateAttendanceState,
} from '@/lib/attendanceEngine';
import { saveManualEntry, softDeleteAttendance } from '@/lib/attendanceService';

const PAGE_SIZES = [20, 50, 100, 200];

export default function TimeEntries({
  employees, attendanceByPersonnel, settings, shifts, assignments, holidays,
  selectedDate, setSelectedDate, filters, setFilters, refetchAtt,
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { canEdit } = usePermissions();
  const [showAbsent, setShowAbsent] = useState(true);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [manualOpen, setManualOpen] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Build table rows: employees with their attendance for the selected date
  const rows = useMemo(() => {
    const holiday = isHoliday(selectedDate, holidays);
    const workingDay = isWorkingDay(selectedDate, settings);
    return employees.map(emp => {
      const att = attendanceByPersonnel.get(emp.id) || null;
      const shift = resolveShift(emp, assignments, shifts, settings);
      let status;
      if (att) {
        const state = calculateAttendanceState(att, shift, settings, holidays, new Date());
        status = state.effectiveStatus;
      } else {
        status = holiday ? 'Holiday' : (workingDay ? 'Absent' : 'Rest Day');
      }
      const splitEffective = isSplitEffective(shift, selectedDate);
      const splitStatuses = splitEffective ? getSplitPunchStatuses(att, shift, new Date()) : null;
      return { emp, att, status, splitEffective, splitStatuses };
    }).filter(row => {
      if (!showAbsent && !row.att) return false;
      return true;
    });
  }, [employees, attendanceByPersonnel, settings, holidays, selectedDate, showAbsent, assignments, shifts]);

  const paginatedRows = useMemo(() => {
    const start = page * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const totalPages = Math.ceil(rows.length / pageSize);

  // Quick date filters
  const quickDate = (type) => {
    const today = new Date();
    if (type === 'today') setSelectedDate(today.toLocaleDateString('en-CA'));
    else if (type === 'yesterday') {
      const d = new Date(today); d.setDate(d.getDate() - 1);
      setSelectedDate(d.toLocaleDateString('en-CA'));
    } else if (type === 'week') {
      // This week start
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
      refetchAtt?.();
    } catch (e) {
      toast({ title: 'Delete failed', description: e.message, variant: 'destructive' });
    }
  };

  // Render a single punch cell. Done punches show the time; for split-shift
  // employees, not-yet-done punches show "Waiting" until their window passes,
  // then "Missed" — never "Missed" while the shift is still in progress.
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
      <AttendanceFilterBar filters={filters} setFilters={setFilters} employees={employees} />
      <AttendanceKpiCards
        employees={employees}
        attendanceByPersonnel={attendanceByPersonnel}
        settings={settings}
        holidays={holidays}
        selectedDate={selectedDate}
      />

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
            {canEdit && (
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
            Time Entries <span className="text-muted-foreground font-normal">· {rows.length} records</span>
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
                {canEdit && <th className="px-3 py-2 font-semibold text-right">ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map(({ emp, att, status, splitEffective, splitStatuses }) => {
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
                    </td>
                    {canEdit && (
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-1">
                          {att && (
                            <>
                              <button onClick={() => { setEditRecord(att); setManualOpen(true); }}
                                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                                <Edit2 className="w-3 h-3" />
                              </button>
                              <button onClick={() => setDeleteConfirm({ id: att.id, reason: '' })}
                                className="p-1 rounded hover:bg-red-50 text-muted-foreground hover:text-red-600" title="Delete">
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {paginatedRows.length === 0 && (
                <tr>
                  <td colSpan={canEdit ? 16 : 15} className="px-3 py-8 text-center text-muted-foreground">
                    No attendance records for the selected date and filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-4 py-2.5 border-t border-border flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              Page {page + 1} of {totalPages} · {rows.length} total entries
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

      {/* Manual Entry Dialog */}
      {manualOpen && (
        <ManualEntryDialog
          open={manualOpen}
          onClose={() => { setManualOpen(false); setEditRecord(null); }}
          employees={employees}
          settings={settings}
          shifts={shifts}
          assignments={assignments}
          selectedDate={selectedDate}
          editRecord={editRecord}
          onSaved={() => { refetchAtt?.(); setManualOpen(false); setEditRecord(null); }}
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