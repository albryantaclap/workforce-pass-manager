import React, { useState, useEffect, useMemo } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
import { toTimeStr } from '@/lib/attendanceUtils';
import { resolvePunchPlan, resolvedDayLabel } from '@/lib/punchSequence';
import { saveManualEntry, saveManualEntryBulk } from '@/lib/attendanceService';
import EmployeeMultiPicker from './EmployeeMultiPicker';
import SiteLocationSelect from './SiteLocationSelect';
import ManualEntryPreview from './ManualEntryPreview';
import ManualEntryResult from './ManualEntryResult';
import {
  resolveShift, getFirstIn, getFinalOut,
  calculateAttendanceState, MANUAL_STATUS_OPTIONS,
  validatePunchSequence, isSplitEffective,
} from '@/lib/attendanceEngine';

const EMPTY_LOCATION = { id: '', name: '', code: '' };

export default function ManualEntryDialog({
  open, onClose, employees, settings, shifts, assignments,
  selectedDate, editRecord, onSaved,
}) {
  const { toast } = useToast();
  const { user } = useAuth();

  // Create mode: many employees share one form. Edit mode: one attendance record.
  const [selectedEmps, setSelectedEmps] = useState([]);
  const [editEmp, setEditEmp] = useState(null);
  const [siteLocation, setSiteLocation] = useState(EMPTY_LOCATION);

  const [date, setDate] = useState(selectedDate || '');
  // Clock times only — each punch's calendar day is calculated automatically.
  const [firstInTime, setFirstInTime] = useState('');
  const [firstOutTime, setFirstOutTime] = useState('');
  const [secondInTime, setSecondInTime] = useState('');
  const [finalOutTime, setFinalOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [statusOverride, setStatusOverride] = useState('');

  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [confirmUnusual, setConfirmUnusual] = useState(false);
  const [storedPunches, setStoredPunches] = useState(null);

  const [stage, setStage] = useState('form'); // form | preview | result
  const [previewRows, setPreviewRows] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [summary, setSummary] = useState(null);
  const [results, setResults] = useState([]);
  const [failedRows, setFailedRows] = useState([]);

  useEffect(() => {
    setStage('form');
    setPreviewRows([]);
    setOverrides({});
    setSummary(null);
    setResults([]);
    setFailedRows([]);

    if (!editRecord) {
      setSelectedEmps([]);
      setEditEmp(null);
      setDate(selectedDate || '');
      setSiteLocation(EMPTY_LOCATION);
      setFirstInTime('');
      setFirstOutTime('');
      setSecondInTime('');
      setFinalOutTime('');
      setReason(''); setRemarks('');
      setStatusOverride('');
      setStoredPunches(null);
      return;
    }

    // Editing an existing row: bind by ID only — the record that was clicked is
    // authoritative, the employee is never looked up by name.
    let cancelled = false;
    setEditEmp(null);
    const load = async () => {
      const empId = editRecord.personnel_id;
      let emp = employees.find((e) => e.id === empId) || null;
      if (!emp && empId) {
        try { emp = await base44.entities.Employee.get(empId); } catch { emp = null; }
      }
      if (cancelled) return;
      setEditEmp(emp || {
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
      setSiteLocation({ id: '', name: rec.site_location || '', code: '' });
      const firstIn = getFirstIn(rec);
      const finalOut = getFinalOut(rec);
      setFirstInTime(toTimeStr(firstIn));
      setFirstOutTime(toTimeStr(rec.first_out_at));
      setSecondInTime(toTimeStr(rec.second_in_at));
      setFinalOutTime(toTimeStr(finalOut));
      setStoredPunches({
        first_in: firstIn || '', first_out: rec.first_out_at || '',
        second_in: rec.second_in_at || '', final_out: finalOut || '',
      });
      setReason(rec.manual_reason || '');
      setRemarks(rec.remarks || '');
      setStatusOverride(rec.manual_status_override || '');
    };
    load();
    return () => { cancelled = true; };
  }, [editRecord, selectedDate]);

  // The employee whose assigned shift drives the live calculation preview: the
  // edited record, or the only selected employee. With several employees each
  // record is calculated with its own shift on the server.
  const calcEmp = editRecord ? editEmp : (selectedEmps.length === 1 ? selectedEmps[0] : null);

  const shift = useMemo(
    () => resolveShift(calcEmp, assignments || [], shifts || [], settings),
    [calcEmp, assignments, shifts, settings]
  );

  // The four clock times entered by the Admin.
  const times = useMemo(() => ({
    first_in: firstInTime, first_out: firstOutTime,
    second_in: secondInTime, final_out: finalOutTime,
  }), [firstInTime, firstOutTime, secondInTime, finalOutTime]);

  // Dates are calculated, not typed: a punch whose time is earlier than the one
  // before it belongs to the next day (cross-midnight shift).
  const plan = useMemo(() => resolvePunchPlan(date, times), [date, times]);

  const liveState = useMemo(() => {
    if (!shift || !date || !calcEmp) return null;
    const rec = {
      attendance_date: date,
      check_in_at: plan.iso.first_in, check_out_at: plan.iso.final_out,
      first_in_at: plan.iso.first_in, first_out_at: plan.iso.first_out,
      second_in_at: plan.iso.second_in, final_out_at: plan.iso.final_out,
      manual_status_override: statusOverride || '',
    };
    return calculateAttendanceState(rec, shift, settings, [], new Date());
  }, [shift, date, calcEmp, plan, statusOverride, settings]);

  // Punch order FIRST IN → FIRST OUT → SECOND IN → FINAL OUT, compared as full
  // datetimes so a cross-midnight sequence stays valid.
  const sequenceCheck = useMemo(() => {
    const rec = {
      attendance_date: date,
      first_in_at: plan.iso.first_in, first_out_at: plan.iso.first_out,
      second_in_at: plan.iso.second_in, final_out_at: plan.iso.final_out,
    };
    return validatePunchSequence(rec, shift, settings, { enforceWindows: true });
  }, [shift, settings, date, plan]);

  useEffect(() => { setConfirmUnusual(false); },
    [firstInTime, firstOutTime, secondInTime, finalOutTime]);

  const splitRules = isSplitEffective(shift, date);
  const shiftLabel = shift
    ? `${shift.id === 'default' ? 'No Assigned Shift' : (shift.shift_name || 'Shift')}${splitRules ? ' · Split-shift punch rules' : ''}`
    : '—';

  const commonTimes = {
    firstIn: firstInTime, firstOut: firstOutTime, secondIn: secondInTime, finalOut: finalOutTime,
  };
  const isoForRow = (row) => {
    const o = overrides[row.id] || {};
    const t = (k, fallback) => (o[k] === undefined ? fallback : o[k]);
    const { iso } = resolvePunchPlan(date, {
      first_in: t('firstIn', firstInTime), first_out: t('firstOut', firstOutTime),
      second_in: t('secondIn', secondInTime), final_out: t('finalOut', finalOutTime),
    });
    return {
      firstInIso: iso.first_in, firstOutIso: iso.first_out,
      secondInIso: iso.second_in, finalOutIso: iso.final_out,
    };
  };

  const validateForm = () => {
    if (!selectedEmps.length) { toast({ title: 'Select at least one employee.', variant: 'destructive' }); return false; }
    if (!date) { toast({ title: 'Please select an attendance date.', variant: 'destructive' }); return false; }
    if (!siteLocation.name) { toast({ title: 'Please select a site location.', variant: 'destructive' }); return false; }
    if (!reason.trim()) { toast({ title: 'A reason is required for manual entry.', variant: 'destructive' }); return false; }
    if (sequenceCheck.blocked.length) {
      toast({ title: 'Cannot process this attendance', description: sequenceCheck.blocked[0], variant: 'destructive' });
      return false;
    }
    return true;
  };

  // ── Preview: find out which selected employees already have attendance ──────
  const handlePreview = async () => {
    if (!validateForm()) return;
    if (sequenceCheck.warnings.length && !confirmUnusual) {
      setConfirmUnusual(true);
      toast({
        title: 'Unusual sequence — please confirm',
        description: `${sequenceCheck.warnings[0]} Press “Preview Entries” again to keep it, or correct the punches.`,
        variant: 'destructive',
      });
      return;
    }
    setChecking(true);
    try {
      const ids = selectedEmps.map((e) => e.id);
      const existing = new Set();
      for (let i = 0; i < ids.length; i += 100) {
        const rows = await base44.entities.AttendanceRecord.filter(
          { personnel_id: { $in: ids.slice(i, i + 100) }, attendance_date: date, is_deleted: { $ne: true } },
          undefined, 500
        );
        (rows || []).forEach((r) => existing.add(r.personnel_id));
      }
      setPreviewRows(selectedEmps.map((emp) => ({
        id: emp.id, emp,
        hasExisting: existing.has(emp.id),
        // Default action: Skip Existing Attendance — never overwrite silently.
        action: existing.has(emp.id) ? 'skip' : 'create',
      })));
      setOverrides({});
      setSummary(null);
      setResults([]);
      setFailedRows([]);
      setStage('preview');
    } catch (e) {
      toast({ title: 'Could not check existing attendance', description: e.message, variant: 'destructive' });
    } finally {
      setChecking(false);
    }
  };

  // ── Save: create / update one record per employee ──────────────────────────
  const saveRows = async (rows) => {
    const entries = rows.map((row) => ({
      personnelId: row.id,
      employeeName: row.emp?.name || row.employeeName || '',
      company: row.emp?.company || '',
      mode: row.action,
      ...isoForRow(row),
    }));
    const data = await saveManualEntryBulk({
      entries,
      attendanceDate: date,
      siteLocation: siteLocation.name,
      reason, remarks,
      manualStatusOverride: statusOverride,
      manualStatusReason: statusOverride ? reason : '',
    });
    const failedIds = new Set((data.results || []).filter((r) => r.status === 'failed').map((r) => r.personnelId));
    setSummary(data.summary || {});
    setResults(data.results || []);
    setFailedRows(rows.filter((r) => failedIds.has(r.id)));
    setStage('result');
    onSaved?.();
    const s = data.summary || {};
    toast({
      title: `${(s.created || 0) + (s.updated || 0)} attendance record(s) saved`,
      description: [
        s.skipped ? `${s.skipped} skipped (existing)` : '',
        s.failed ? `${s.failed} failed` : '',
      ].filter(Boolean).join(' · ') || undefined,
      variant: s.failed ? 'destructive' : undefined,
    });
  };

  const handleSaveBulk = async () => {
    const rows = previewRows.filter((r) => r.action !== 'skip');
    if (!rows.length) {
      toast({ title: 'Nothing to save', description: 'Every selected employee is marked “Skip Existing”.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await saveRows(rows);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleRetryFailed = async () => {
    if (!failedRows.length) return;
    setSaving(true);
    try {
      await saveRows(failedRows);
    } catch (e) {
      toast({ title: 'Retry failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  // ── Save: single record (Edit Attendance) ──────────────────────────────────
  const handleSaveSingle = async () => {
    if (!editEmp) { toast({ title: 'Please select an employee.', variant: 'destructive' }); return; }
    if (!date) { toast({ title: 'Please select an attendance date.', variant: 'destructive' }); return; }

    const enteredIso = plan.iso;
    // Only the punches the Admin actually changed are applied — every other punch
    // keeps the value already stored on the record.
    const sameStamp = (a, b) => (a ? new Date(a).getTime() : 0) === (b ? new Date(b).getTime() : 0);
    const changedPunchKeys = storedPunches
      ? Object.keys(enteredIso).filter((k) => !sameStamp(enteredIso[k], storedPunches[k]))
      : Object.keys(enteredIso);

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
        personnelId: editEmp.id,
        attendanceRecordId: editRecord?.id || '',
        employeeName: editEmp.name,
        company: editEmp.company,
        attendanceDate: date,
        firstInAt: enteredIso.first_in, firstOutAt: enteredIso.first_out,
        secondInAt: enteredIso.second_in, finalOutAt: enteredIso.final_out,
        changedPunchKeys,
        reason, remarks,
        workLocation: editEmp.current_location || '',
        siteLocation: siteLocation.name || '',
        currentUser: user,
        shiftId: shift?.id || '',
        shiftName: shift?.shift_name || '',
        shift,
        manualStatusOverride: statusOverride,
        manualStatusReason: statusOverride ? reason : '',
      });
      toast({ title: 'Attendance updated successfully.' });
      onSaved?.();
      onClose?.();
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const readyCount = previewRows.filter((r) => r.action !== 'skip').length;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-3xl w-full max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">
            {editRecord ? 'Edit Attendance' : 'Manual Attendance Entry'}
            {!editRecord && stage === 'preview' && <span className="text-xs font-normal text-muted-foreground"> · Preview</span>}
            {!editRecord && stage === 'result' && <span className="text-xs font-normal text-muted-foreground"> · Result</span>}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {stage === 'result' ? (
            <ManualEntryResult
              summary={summary} results={results} failedRows={failedRows}
              onRetry={handleRetryFailed} retrying={saving}
            />
          ) : stage === 'preview' ? (
            <ManualEntryPreview
              rows={previewRows}
              date={date}
              siteLocationName={siteLocation.name}
              commonTimes={commonTimes}
              overrides={overrides}
              onActionChange={(id, action) => setPreviewRows((rows) => rows.map((r) => (r.id === id ? { ...r, action } : r)))}
              onOverrideChange={(id, field, value) => setOverrides((o) => ({ ...o, [id]: { ...(o[id] || {}), [field]: value } }))}
              onUpdateAllExisting={() => setPreviewRows((rows) => rows.map((r) => (r.hasExisting ? { ...r, action: 'update' } : r)))}
            />
          ) : (
            <>
              {/* Edit mode: who is being edited — read-only */}
              {editRecord && editEmp && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-lg border border-border bg-muted/30">
                  <ReadOnlyField label="Employee" value={editEmp.name} />
                  <ReadOnlyField label="PID No." value={editEmp.pid} />
                  <ReadOnlyField label="Company" value={editEmp.company} />
                  <ReadOnlyField label="Designation" value={editEmp.position_application || editEmp.designation_org_chart} />
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

              {/* EMPLOYEE — search and select one or many */}
              {!editRecord && (
                <EmployeeMultiPicker employees={employees} selected={selectedEmps} onChange={setSelectedEmps} />
              )}

              {/* SITE LOCATION — applied to every employee in this entry */}
              <SiteLocationSelect value={siteLocation.id} onChange={setSiteLocation} required />

              {/* ATTENDANCE DATE */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Attendance Date</label>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                <p className="text-[10px] text-muted-foreground">The shift-start date. Punches on the next day still belong to this record (cross-midnight support).</p>
              </div>

              {/* PUNCH TIMES — entered once for everyone selected */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <PunchInput label="First Clock In" time={firstInTime} onTime={setFirstInTime}
                  date={date} dayOffset={plan.offsets.first_in} />
                <PunchInput label="First Clock Out" time={firstOutTime} onTime={setFirstOutTime}
                  date={date} dayOffset={plan.offsets.first_out} />
                <PunchInput label="Second Clock In" time={secondInTime} onTime={setSecondInTime}
                  date={date} dayOffset={plan.offsets.second_in} />
                <PunchInput label="Final Clock Out" time={finalOutTime} onTime={setFinalOutTime}
                  date={date} dayOffset={plan.offsets.final_out} />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Dates are calculated automatically — a time earlier than the punch before it rolls to the next day.
              </p>

              {/* STATUS */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Status (manual override)</label>
                  <select
                    value={statusOverride}
                    onChange={(e) => setStatusOverride(e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm"
                  >
                    <option value="">Auto (calculated)</option>
                    {MANUAL_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                  <p className="text-[10px] text-muted-foreground">Override only changes the displayed status — it never fabricates punch timestamps.</p>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground uppercase">Calculated Status</label>
                  <div className="h-9 flex items-center px-3 rounded-md border border-border bg-muted/30 text-sm font-medium text-foreground">
                    {calcEmp
                      ? (liveState ? (statusOverride ? `${liveState.calculatedStatus} (overridden)` : liveState.calculatedStatus) : '—')
                      : (selectedEmps.length > 1 ? 'Calculated per employee' : '—')}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedEmps.length > 1 && !editRecord
                      ? 'Each employee is calculated with their own assigned shift and rules.'
                      : 'System-derived from punches and shift rules; recalculated on save.'}
                  </p>
                </div>
              </div>

              {/* REASON */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">
                  Reason {editRecord ? '(optional)' : '(required)'}
                </label>
                <Input
                  placeholder={editRecord
                    ? 'Optional — e.g. device malfunction, employee forgot to punch'
                    : 'e.g. Device malfunction, employee forgot to punch...'}
                  value={reason} onChange={(e) => setReason(e.target.value)} />
              </div>

              {/* REMARKS */}
              <div className="space-y-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase">Remarks</label>
                <Input placeholder="Optional remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 p-4 border-t border-border">
          {stage === 'result' ? (
            <Button onClick={onClose}>Done</Button>
          ) : stage === 'preview' ? (
            <>
              <Button variant="outline" onClick={() => setStage('form')} disabled={saving}>Back</Button>
              <Button onClick={handleSaveBulk} disabled={saving || !readyCount}>
                {saving ? 'Saving...' : `Save Attendance for ${readyCount} Employee${readyCount === 1 ? '' : 's'}`}
              </Button>
            </>
          ) : editRecord ? (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handleSaveSingle} disabled={saving || sequenceCheck.blocked.length > 0}>
                {saving ? 'Saving...' : (sequenceCheck.warnings.length && confirmUnusual)
                  ? 'Save anyway (unusual sequence)'
                  : 'Update Attendance'}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={handlePreview} disabled={checking || sequenceCheck.blocked.length > 0}>
                {checking ? 'Checking...' : 'Preview Entries'}
              </Button>
            </>
          )}
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

function PunchInput({ label, date, time, onTime, dayOffset }) {
  const rolled = dayOffset !== null && dayOffset !== undefined && dayOffset > 0;
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
      <div className="flex gap-1.5 min-w-0 items-center">
        <Input type="time" value={time} onChange={(e) => onTime(e.target.value)} className="flex-shrink-0" style={{ width: '5.5rem' }} />
        <span
          className={`text-[10px] font-medium px-2 py-1 rounded border whitespace-nowrap ${
            !time
              ? 'text-muted-foreground border-border bg-muted/30'
              : rolled
                ? 'text-amber-700 border-amber-200 bg-amber-50'
                : 'text-emerald-700 border-emerald-200 bg-emerald-50'
          }`}
        >
          {!time
            ? '—'
            : `${resolvedDayLabel(date, dayOffset || 0)}${rolled ? ` (+${dayOffset} day)` : ''}`}
        </span>
      </div>
    </div>
  );
}