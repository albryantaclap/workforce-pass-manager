import React, { useState, useEffect, useMemo } from 'react';
import { X, Search, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import { toDateStr, toTimeStr, buildDateTime } from '@/lib/attendanceUtils';
import { saveManualEntry } from '@/lib/attendanceService';
import {
  resolveShift, getFirstIn, getFinalOut,
  calculateAttendanceState, MANUAL_STATUS_OPTIONS,
  validatePunchSequence, isSplitEffective,
} from '@/lib/attendanceEngine';

export default function ManualEntryDialog({
  open, onClose, employees, settings, shifts, assignments,
  selectedDate, editRecord, onSaved,
}) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [date, setDate] = useState(selectedDate || '');
  const [firstInDate, setFirstInDate] = useState('');
  const [firstInTime, setFirstInTime] = useState('');
  const [firstOutDate, setFirstOutDate] = useState('');
  const [firstOutTime, setFirstOutTime] = useState('');
  const [secondInDate, setSecondInDate] = useState('');
  const [secondInTime, setSecondInTime] = useState('');
  const [finalOutDate, setFinalOutDate] = useState('');
  const [finalOutTime, setFinalOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [statusOverride, setStatusOverride] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmUnusual, setConfirmUnusual] = useState(false);

  useEffect(() => {
    if (!editRecord) {
      setSelectedEmp(null);
      setDate(selectedDate || '');
      setFirstInDate(''); setFirstInTime('');
      setFirstOutDate(''); setFirstOutTime('');
      setSecondInDate(''); setSecondInTime('');
      setFinalOutDate(''); setFinalOutTime('');
      setReason(''); setRemarks('');
      setStatusOverride('');
      return;
    }
    // Editing an existing row: bind by ID only. The row's employee id and attendance
    // record id are authoritative — the employee is never looked up by name and the
    // search text is never used. The exact record that was clicked is loaded.
    let cancelled = false;
    setSelectedEmp(null);
    const load = async () => {
      const empId = editRecord.personnel_id;
      let emp = employees.find(e => e.id === empId) || null;
      if (!emp && empId) {
        try { emp = await base44.entities.Employee.get(empId); } catch { emp = null; }
      }
      if (cancelled) return;
      setSelectedEmp(emp || {
        id: empId, name: editRecord.employee_name || '', company: editRecord.company || '',
      });

      let rec = editRecord;
      if (editRecord.id) {
        try {
          const full = await base44.entities.AttendanceRecord.get(editRecord.id);
          if (full) rec = full;
        } catch { /* keep the row values as a fallback */ }
      }
      if (cancelled) return;
      setDate(rec.attendance_date || editRecord.attendance_date || selectedDate || '');
      const firstIn = getFirstIn(rec);
      const finalOut = getFinalOut(rec);
      setFirstInDate(toDateStr(firstIn)); setFirstInTime(toTimeStr(firstIn));
      setFirstOutDate(toDateStr(rec.first_out_at)); setFirstOutTime(toTimeStr(rec.first_out_at));
      setSecondInDate(toDateStr(rec.second_in_at)); setSecondInTime(toTimeStr(rec.second_in_at));
      setFinalOutDate(toDateStr(finalOut)); setFinalOutTime(toTimeStr(finalOut));
      setReason(rec.manual_reason || '');
      setRemarks(rec.remarks || '');
      setStatusOverride(rec.manual_status_override || '');
    };
    load();
    return () => { cancelled = true; };
  }, [editRecord, selectedDate]);

  const filteredEmps = useMemo(() => {
    if (!empSearch) return employees.slice(0, 20);
    const q = empSearch.toLowerCase();
    return employees.filter(e =>
      `${e.name} ${e.qid_no || ''} ${e.pid || ''} ${e.staff_no || ''} ${e.company || ''} ${e.department || ''} ${e.position_application || ''} ${e.current_location || ''}`.toLowerCase().includes(q)
    ).slice(0, 20);
  }, [employees, empSearch]);

  const shift = useMemo(
    () => resolveShift(selectedEmp, assignments || [], shifts || [], settings),
    [selectedEmp, assignments, shifts, settings]
  );

  // Live calculated-status preview from the current punch inputs.
  const liveState = useMemo(() => {
    if (!shift || !date || !selectedEmp) return null;
    const toIso = (d, t) => { const dt = buildDateTime(d, t); return dt ? dt.toISOString() : ''; };
    const rec = {
      attendance_date: date,
      check_in_at: toIso(firstInDate, firstInTime), check_out_at: toIso(finalOutDate, finalOutTime),
      first_in_at: toIso(firstInDate, firstInTime), first_out_at: toIso(firstOutDate, firstOutTime),
      second_in_at: toIso(secondInDate, secondInTime), final_out_at: toIso(finalOutDate, finalOutTime),
      manual_status_override: statusOverride || '',
    };
    return calculateAttendanceState(rec, shift, settings, [], new Date());
  }, [shift, date, selectedEmp, firstInDate, firstInTime, firstOutDate, firstOutTime, secondInDate, secondInTime, finalOutDate, finalOutTime, statusOverride, settings]);

  // Authoritative punch-sequence check — the same rule the server enforces on save:
  // FIRST IN → FIRST OUT → SECOND IN → FINAL OUT, compared as FULL datetimes so a
  // cross-midnight sequence (FIRST OUT 22:50 → SECOND IN 00:55 next day) is valid.
  // blocked = must be corrected; warnings = unusual but allowed, confirm before saving.
  const sequenceCheck = useMemo(() => {
    const toIso = (d, t) => { const dt = buildDateTime(d, t); return dt ? dt.toISOString() : ''; };
    const rec = {
      attendance_date: date,
      first_in_at: toIso(firstInDate, firstInTime), first_out_at: toIso(firstOutDate, firstOutTime),
      second_in_at: toIso(secondInDate, secondInTime), final_out_at: toIso(finalOutDate, finalOutTime),
    };
    return validatePunchSequence(rec, shift, settings, { enforceWindows: true });
  }, [shift, settings, date, firstInDate, firstInTime, firstOutDate, firstOutTime, secondInDate, secondInTime, finalOutDate, finalOutTime]);

  // Any change to a punch re-arms the "unusual sequence" confirmation.
  useEffect(() => { setConfirmUnusual(false); },
    [firstInDate, firstInTime, firstOutDate, firstOutTime, secondInDate, secondInTime, finalOutDate, finalOutTime]);

  // No assigned shift is shown honestly — the Default Shift is only named when the
  // employee is actually assigned to a shift called that.
  const splitRules = isSplitEffective(shift, date);
  const shiftLabel = shift
    ? `${shift.id === 'default' ? 'No Assigned Shift' : (shift.shift_name || 'Shift')}${splitRules ? ' · Split-shift punch rules' : ''}`
    : '—';

  const handleSave = async () => {
    if (!selectedEmp) { toast({ title: 'Please select an employee.', variant: 'destructive' }); return; }
    if (!date) { toast({ title: 'Please select an attendance date.', variant: 'destructive' }); return; }
    // A reason is only required when creating a brand-new manual entry; correcting
    // the punches of an existing attendance record does not force one.
    if (!editRecord && !reason.trim()) { toast({ title: 'A reason is required for manual entry.', variant: 'destructive' }); return; }

    const firstIn = buildDateTime(firstInDate, firstInTime);
    const firstOut = buildDateTime(firstOutDate, firstOutTime);
    const secondIn = buildDateTime(secondInDate, secondInTime);
    const finalOut = buildDateTime(finalOutDate, finalOutTime);

    if (sequenceCheck.blocked.length) {
      toast({ title: 'Cannot process this attendance', description: sequenceCheck.blocked[0], variant: 'destructive' });
      return;
    }
    if (sequenceCheck.warnings.length && !confirmUnusual) {
      setConfirmUnusual(true);
      toast({
        title: 'Unusual sequence — please confirm',
        description: `${sequenceCheck.warnings[0]} Press “Save anyway” to keep it, or correct the punches.`,
        variant: 'destructive',
      });
      return;
    }

    setSaving(true);
    try {
      await saveManualEntry({
        personnelId: selectedEmp.id,
        // The exact attendance record that was opened — the backend verifies it belongs
        // to this employee before updating it.
        attendanceRecordId: editRecord?.id || '',
        employeeName: selectedEmp.name,
        company: selectedEmp.company,
        attendanceDate: date,
        firstInAt: firstIn, firstOutAt: firstOut,
        secondInAt: secondIn, finalOutAt: finalOut,
        reason, remarks,
        workLocation: selectedEmp.current_location || '',
        currentUser: user,
        shiftId: shift?.id || '',
        shiftName: shift?.shift_name || '',
        shift,
        manualStatusOverride: statusOverride,
        manualStatusReason: statusOverride ? reason : '',
      });
      toast({ title: editRecord ? 'Attendance updated successfully.' : 'Manual attendance entry saved.' });
      onSaved?.();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-3xl w-full max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{editRecord ? 'Edit Attendance' : 'Manual Attendance Entry'}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* Who is being edited — read-only, so an Admin never edits the wrong person */}
          {selectedEmp && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-lg border border-border bg-muted/30">
              <ReadOnlyField label="Employee" value={selectedEmp.name} />
              <ReadOnlyField label="PID No." value={selectedEmp.pid} />
              <ReadOnlyField label="Company" value={selectedEmp.company} />
              <ReadOnlyField label="Designation" value={selectedEmp.position_application || selectedEmp.designation_org_chart} />
              <ReadOnlyField label="Shift" value={shiftLabel} />
            </div>
          )}

          {/* Sequence validation — the punch order is authoritative */}
          {sequenceCheck.blocked.length > 0 && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-red-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Cannot process this attendance
              </p>
              {sequenceCheck.blocked.map((m, i) => (
                <p key={i} className="text-[11px] text-red-700 leading-relaxed">{m}</p>
              ))}
            </div>
          )}
          {sequenceCheck.blocked.length === 0 && sequenceCheck.warnings.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-700 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Unusual sequence — review before saving
              </p>
              {sequenceCheck.warnings.map((m, i) => (
                <p key={i} className="text-[11px] text-amber-700 leading-relaxed">{m}</p>
              ))}
            </div>
          )}

          {/* Employee selection */}
          {!editRecord && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Employee</label>
              {selectedEmp ? (
                <div className="flex items-center justify-between p-2 rounded-lg border border-border bg-muted/30">
                  <div className="flex items-center gap-2">
                    <PersonnelAvatar name={selectedEmp.name} photoUrl={selectedEmp.photo_url} size="sm" />
                    <div>
                      <p className="text-sm font-medium">{selectedEmp.name}</p>
                      <p className="text-xs text-muted-foreground">{selectedEmp.company} · {selectedEmp.qid_no || '—'}</p>
                    </div>
                  </div>
                  <button onClick={() => setSelectedEmp(null)} className="text-xs text-muted-foreground hover:text-foreground">Change</button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input placeholder="Search by name, QID, PID, staff no, company, department, position, branch..."
                      value={empSearch} onChange={e => setEmpSearch(e.target.value)} className="pl-9" autoFocus />
                  </div>
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-border">
                    {filteredEmps.map(emp => (
                      <button key={emp.id} onClick={() => setSelectedEmp(emp)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-muted text-left border-b border-border/50 last:border-0">
                        <PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size="sm" />
                        <div>
                          <p className="text-sm font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.company} · {emp.qid_no || '—'}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Attendance Date */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Attendance Date</label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">The shift-start date. Punches on the next day still belong to this record (cross-midnight support).</p>
          </div>

          {/* Punch inputs — responsive, no clipping */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <PunchInput label="First Clock In" date={firstInDate} time={firstInTime}
              onDate={setFirstInDate} onTime={setFirstInTime} />
            <PunchInput label="First Clock Out" date={firstOutDate} time={firstOutTime}
              onDate={setFirstOutDate} onTime={setFirstOutTime} />
            <PunchInput label="Second Clock In" date={secondInDate} time={secondInTime}
              onDate={setSecondInDate} onTime={setSecondInTime} />
            <PunchInput label="Final Clock Out" date={finalOutDate} time={finalOutTime}
              onDate={setFinalOutDate} onTime={setFinalOutTime} />
          </div>

          {/* Status */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Status (manual override)</label>
              <select
                value={statusOverride}
                onChange={e => setStatusOverride(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Auto (calculated)</option>
                {MANUAL_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <p className="text-[10px] text-muted-foreground">Override only changes the displayed status — it never fabricates punch timestamps.</p>
            </div>
            <div className="space-y-1">
              <label className="text-xs font-semibold text-muted-foreground uppercase">Calculated Status</label>
              <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/30 text-sm font-medium text-foreground">
                {liveState ? (statusOverride ? `${liveState.calculatedStatus} (overridden)` : liveState.calculatedStatus) : '—'}
              </div>
              <p className="text-[10px] text-muted-foreground">System-derived from punches and shift rules; recalculated on save.</p>
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Reason {editRecord ? '(optional)' : '(required)'}</label>
            <Input placeholder={editRecord ? 'Optional — e.g. device malfunction, employee forgot to punch' : 'e.g. Device malfunction, employee forgot to punch...'}
              value={reason} onChange={e => setReason(e.target.value)} />
          </div>

          {/* Remarks */}
          <div className="space-y-1">
            <label className="text-xs font-semibold text-muted-foreground uppercase">Remarks</label>
            <Input placeholder="Optional remarks" value={remarks} onChange={e => setRemarks(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || sequenceCheck.blocked.length > 0}>
            {saving ? 'Saving...' : (sequenceCheck.warnings.length && confirmUnusual)
              ? 'Save anyway (unusual sequence)'
              : editRecord ? 'Update Attendance' : 'Save Entry'}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function ReadOnlyField({ label, value }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase">{label}</p>
      <p className="text-xs font-medium text-foreground truncate" title={value || '—'}>{value || '—'}</p>
    </div>
  );
}

function PunchInput({ label, date, time, onDate, onTime }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
      <div className="flex gap-1.5 min-w-0">
        <Input type="date" value={date} onChange={e => onDate(e.target.value)} className="min-w-0 flex-1" style={{ width: 'auto' }} />
        <Input type="time" value={time} onChange={e => onTime(e.target.value)} className="flex-shrink-0" style={{ width: '5rem' }} />
      </div>
    </div>
  );
}