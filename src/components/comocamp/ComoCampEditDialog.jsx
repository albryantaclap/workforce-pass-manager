import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import StatusBadge from '../common/StatusBadge';
import PidDaysLeftBadge from './PidDaysLeftBadge';
import LocationGridDropdown from './LocationGridDropdown';
import { formatDate } from '@/utils/constants';
import { formatDuration, calcDuration } from '@/lib/attendanceUtils';
import { cn } from '@/lib/utils';

// Local-time helpers — build the selected date/time in the user's timezone so
// the stored ISO matches the exact selection (no UTC drift).
const toDateStr = (d) => (d ? new Date(d).toLocaleDateString('en-CA') : '');
const toTimeStr = (d) => {
  if (!d) return '';
  try { return new Date(d).toTimeString().slice(0, 5); } catch { return ''; }
};
const buildDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const [y, m, day] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const dt = new Date(y, m - 1, day, hh, mm, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
};

const MED_PILLS = {
  'ACCEPTED': { label: 'Accepted', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'WAITING TR APPROVAL': { label: 'Waiting TR', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'RE-ASSESS': { label: 'Re-Assess', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  'REJECTED': { label: 'Rejected', cls: 'bg-red-50 text-red-700 border-red-200' },
};
const TRAIN_PILLS = {
  'DONE': { label: 'Done', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  'ON-GOING': { label: 'On-Going', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  'SCHEDULED': { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'TO BE SCHEDULED': { label: 'To Be Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  'PENDING': { label: 'Pending', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  'ABSENT': { label: 'Absent', cls: 'bg-red-50 text-red-700 border-red-200' },
  'NOT REQUIRED': { label: 'Not Required', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
};
function Pill({ value, map, fallback = '—' }) {
  const v = (value || '').toUpperCase();
  if (!v) return <span className="text-xs text-muted-foreground">{fallback}</span>;
  const p = map[v] || { label: value, cls: 'bg-blue-50 text-blue-700 border-blue-200' };
  return <span className={cn('text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap', p.cls)}>{p.label}</span>;
}

function ReadOnly({ label, value }) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm font-medium truncate">{value || '—'}</div>
    </div>
  );
}

export default function ComoCampEditDialog({
  open, emp, record, attendanceDate, canEdit, locationOptions,
  onClose, onSave,
}) {
  const [locDraft, setLocDraft] = useState('');
  const [contactDraft, setContactDraft] = useState('');
  const [checkInDate, setCheckInDate] = useState('');
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutDate, setCheckOutDate] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !emp) return;
    setLocDraft(emp.current_location || '');
    setContactDraft(emp.contact_details || '');
    setCheckInDate(record?.check_in_at ? toDateStr(record.check_in_at) : (attendanceDate || ''));
    setCheckInTime(record?.check_in_at ? toTimeStr(record.check_in_at) : '');
    setCheckOutDate(record?.check_out_at ? toDateStr(record.check_out_at) : '');
    setCheckOutTime(record?.check_out_at ? toTimeStr(record.check_out_at) : '');
    setReason('');
    setError('');
  }, [open, emp, record, attendanceDate]);

  const hasRecord = !!record;
  const checkInAt = useMemo(() => buildDateTime(checkInDate, checkInTime), [checkInDate, checkInTime]);
  const checkOutAt = useMemo(() => buildDateTime(checkOutDate, checkOutTime), [checkOutDate, checkOutTime]);
  const duration = checkInAt && checkOutAt ? calcDuration(checkInAt.toISOString(), checkOutAt.toISOString()) : 0;
  // All four attendance fields remain editable at all times for authorized
  // attendance editors. View-only users (canEdit = false) see them read-only.
  const checkInEditable = canEdit;
  // Check-out is meaningful only once a check-in exists (recorded or entered
  // in the draft above); it stays editable for any authorized editor.
  const checkOutEditable = canEdit && (!!record?.check_in_at || !!checkInAt);

  if (!emp) return null;

  const handleSave = async () => {
    setError('');
    if (hasRecord && !checkInAt) { setError('Check-in date and time are required.'); return; }
    if (checkInAt && checkOutAt && checkOutAt <= checkInAt) {
      setError('Check-out date and time must be later than the Check-in date and time.');
      return;
    }
    const inChanged = hasRecord && record.check_in_at && checkInAt && checkInAt.toISOString() !== record.check_in_at;
    const outChanged = hasRecord && record.check_out_at ? (!!checkOutAt && checkOutAt.toISOString() !== record.check_out_at) : !!checkOutAt;
    const outCleared = hasRecord && record.check_out_at && !checkOutAt;
    const needsReason = hasRecord && (inChanged || outChanged || outCleared);
    if (needsReason && !reason.trim()) {
      setError('A correction reason is required when modifying existing attendance.');
      return;
    }
    const personnelFields = {};
    if ((locDraft || '').trim() !== (emp.current_location || '').trim()) personnelFields.current_location = (locDraft || '').trim();
    if ((contactDraft || '') !== (emp.contact_details || '')) personnelFields.contact_details = contactDraft || '';
    setSaving(true);
    try {
      await onSave(emp, record, personnelFields, checkInAt, checkOutAt, reason.trim());
      onClose();
    } catch (e) {
      setError(e.message || 'Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const needsReason = hasRecord && (
    (record.check_in_at && checkInAt && checkInAt.toISOString() !== record.check_in_at) ||
    (record.check_out_at ? (!!checkOutAt && checkOutAt.toISOString() !== record.check_out_at) : !!checkOutAt) ||
    (record.check_out_at && !checkOutAt)
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit COMO Camp — {emp.name}</DialogTitle>
          <DialogDescription>
            Compact edit for COMO Camp fields. Location & Contact update the shared personnel record; Camp Check-in / Camp Check-out update the linked camp stay record. This does NOT affect work attendance.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          {/* Read-only personnel fields */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3">
            <ReadOnly label="Name" value={emp.name} />
            <ReadOnly label="Company" value={emp.company} />
            <ReadOnly label="QID No." value={emp.qid_no} />
            <ReadOnly label="PID No." value={emp.pid} />
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Medical</div>
              <div><Pill value={emp.ftw_result} map={MED_PILLS} fallback="New" /></div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Gate Pass</div>
              <div><StatusBadge dateStr={emp.gate_pass_expiry} type="rlic" storedStatus={emp.rlic_status} short /></div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">Training</div>
              <div><Pill value={emp.training_status} map={TRAIN_PILLS} /></div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">PID Status</div>
              <div><StatusBadge dateStr={emp.pid_expiry} type="pid" storedStatus={emp.pid_status} short /></div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">PID Expiry</div>
              <div className="text-sm font-medium">{formatDate(emp.pid_expiry)}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-xs text-muted-foreground">PID Days Left</div>
              <div><PidDaysLeftBadge dateStr={emp.pid_expiry} /></div>
            </div>
          </div>

          {/* Editable: Location & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3 border-t pt-3">
            <div className="space-y-1">
              <Label className="text-xs">Location (Work Location)</Label>
              <LocationGridDropdown
                value={locDraft}
                onChange={(v) => { setLocDraft(v); setError(''); }}
                options={locationOptions}
              />
              <p className="text-[10px] text-muted-foreground">Changing from COMO CAMP removes the employee from this tab; changing back re-adds them.</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Contact</Label>
              <Input
                value={contactDraft}
                onChange={(e) => { setContactDraft(e.target.value); setError(''); }}
                placeholder="Contact / Mobile"
              />
            </div>
          </div>

          {/* Camp Stay (linked via personnel_id) */}
          <div className="border-t pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Camp Check-in Date {!hasRecord && <span className="text-destructive">*</span>}</Label>
                <Input type="date" value={checkInDate} disabled={!checkInEditable}
                  onChange={(e) => { setCheckInDate(e.target.value); setError(''); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Camp Check-in Time {!hasRecord && <span className="text-destructive">*</span>}</Label>
                <Input type="time" value={checkInTime} disabled={!checkInEditable}
                  onChange={(e) => { setCheckInTime(e.target.value); setError(''); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Camp Check-out Date</Label>
                <Input type="date" value={checkOutDate} disabled={!checkOutEditable}
                  onChange={(e) => { setCheckOutDate(e.target.value); setError(''); }} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Camp Check-out Time</Label>
                <Input type="time" value={checkOutTime} disabled={!checkOutEditable}
                  onChange={(e) => { setCheckOutTime(e.target.value); setError(''); }} />
              </div>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-xs text-muted-foreground">Camp Stay Duration</span>
              <span className="text-sm font-medium">{formatDuration(duration)}</span>
            </div>
            {!checkOutAt && (
              <p className="text-[10px] text-muted-foreground">Leave Camp Check-out blank to keep the stay as Inside Camp.</p>
            )}
            {needsReason && (
              <div className="space-y-1">
                <Label className="text-xs">Correction Reason <span className="text-destructive">*</span></Label>
                <Textarea value={reason} onChange={(e) => { setReason(e.target.value); setError(''); }}
                  placeholder="Reason for correcting existing camp stay" rows={2} />
              </div>
            )}
          </div>

          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!canEdit || saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}