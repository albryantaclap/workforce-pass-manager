import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle, Home, LogOut } from 'lucide-react';
import { formatTime, formatDateOnly, calcDuration, formatDuration } from '@/lib/attendanceUtils';

const toDateStr = (d) => d.toLocaleDateString('en-CA');
const toTimeStr = (d) => d.toTimeString().slice(0, 5);

const buildDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const [y, m, day] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const dt = new Date(y, m - 1, day, hh, mm, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
};

const TYPE_ONLY = 'CAMP_ONLY';
const TYPE_DEMOBILIZE = 'DEMOBILIZE';

const CHECKOUT_TYPES = [
  {
    value: TYPE_ONLY,
    label: 'Camp Check-out Only',
    hint: 'Leaving the accommodation but remains connected to the project. Personnel status is unchanged.',
    icon: Home,
  },
  {
    value: TYPE_DEMOBILIZE,
    label: 'Demobilize from Project',
    hint: 'Leaving the project and COMO Camp. Personnel status becomes Inactive, camp status Demobilized.',
    icon: LogOut,
  },
];

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

/**
 * Camp check-out.
 *
 * mode="checkout"   → used from COMO Camp: the operator chooses the check-out type.
 * mode="demobilize" → used from the Inactive list for somebody still inside camp:
 *                     demobilization is the only option.
 *
 * A normal camp check-out never changes the personnel status. Demobilizing sets
 * the personnel status to Inactive and the camp status to Demobilized, and is
 * always confirmed first. Neither path touches work attendance.
 */
export default function CheckOutDialog({ open, emp, record, mode = 'checkout', onConfirm, onClose }) {
  const demobilizeOnly = mode === 'demobilize';
  const [type, setType] = useState(TYPE_ONLY);
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setType(demobilizeOnly ? TYPE_DEMOBILIZE : TYPE_ONLY);
    setDateStr(toDateStr(now));
    setTimeStr(toTimeStr(now));
    setReason('');
    setConfirming(false);
    setError('');
  }, [open, demobilizeOnly]);

  const outAt = useMemo(() => buildDateTime(dateStr, timeStr), [dateStr, timeStr]);

  if (!emp || !record) return null;

  const checkInDate = record.check_in_at ? new Date(record.check_in_at) : null;
  const duration = outAt && checkInDate ? calcDuration(record.check_in_at, outAt.toISOString()) : 0;
  const demobilize = demobilizeOnly || type === TYPE_DEMOBILIZE;

  const handleSubmit = () => {
    if (!dateStr || !timeStr) { setError('Camp Check-out Date and Time are required.'); return; }
    const at = buildDateTime(dateStr, timeStr);
    if (!at) { setError('Invalid date or time.'); return; }
    if (checkInDate && at <= checkInDate) {
      setError('Camp Check-out date and time must be later than the Camp Check-in date and time.');
      return;
    }
    if (demobilize && !reason.trim()) {
      setError('A reason is required to demobilize from the project.');
      return;
    }
    if (demobilize) { setConfirming(true); return; }
    onConfirm(record, at, { demobilize: false, reason: '' });
  };

  const handleConfirmDemobilize = () => {
    onConfirm(record, buildDateTime(dateStr, timeStr), { demobilize: true, reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{demobilizeOnly ? `Demobilize ${emp.name} from COMO Camp?` : `Camp Check-out ${emp.name}?`}</DialogTitle>
          <DialogDescription>
            This closes the current camp stay. Overnight stays are supported. This does NOT affect work attendance.
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2 text-sm">
              <div className="flex items-center gap-2 font-semibold text-amber-800">
                <AlertTriangle className="w-4 h-4" /> Confirm Demobilization
              </div>
              <p className="text-amber-900">
                <strong>{emp.name}</strong> will be demobilized: camp check-out recorded, personnel status set to
                <strong> Inactive</strong> and camp status set to <strong>Demobilized</strong>. Everything else —
                documents, QID, PID, medical, gate pass, training and camp history — is preserved, and the record stays
                in the Inactive list.
              </p>
              <div className="border-t border-amber-200 pt-2 space-y-1">
                <Row label="Camp Check-out" value={`${formatDateOnly(buildDateTime(dateStr, timeStr)?.toISOString())} ${timeStr}`} />
                <Row label="Reason" value={reason} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)}>Back</Button>
              <Button className="bg-orange-600 hover:bg-orange-700" onClick={handleConfirmDemobilize}>Confirm Demobilization</Button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-3 text-sm py-2">
              <div className="rounded-lg bg-muted/40 p-3 space-y-1.5">
                <Row label="Employee" value={emp.name} />
                <Row label="Company" value={emp.company || '—'} />
                <Row label="Work Location" value={emp.current_location || '—'} />
              </div>

              {!demobilizeOnly && (
                <div className="space-y-2">
                  <Label className="text-xs">Check-out Type *</Label>
                  {CHECKOUT_TYPES.map(opt => {
                    const Icon = opt.icon;
                    const selected = type === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => { setType(opt.value); setError(''); }}
                        className={`w-full text-left flex items-start gap-2.5 rounded-lg border p-3 transition-colors ${selected ? 'border-primary bg-accent' : 'border-border hover:bg-muted/50'}`}
                      >
                        <Icon className={`w-4 h-4 mt-0.5 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span>
                          <span className="block text-sm font-medium">{opt.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{opt.hint}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {demobilizeOnly && (
                <div className="rounded-lg border border-orange-200 bg-orange-50 p-3 text-[12px] text-orange-800">
                  {emp.name} is still recorded inside COMO Camp. Demobilizing will check them out of the camp, keep
                  their personnel status <strong>Inactive</strong> and mark the camp status <strong>Demobilized</strong>.
                </div>
              )}

              <div className="border-t pt-2 space-y-1">
                <Row label="Camp Check-in Date" value={checkInDate ? formatDateOnly(record.check_in_at) : '—'} />
                <Row label="Camp Check-in Time" value={checkInDate ? formatTime(record.check_in_at) : '—'} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Camp Check-out Date <span className="text-destructive">*</span></Label>
                  <Input type="date" value={dateStr} onChange={(e) => { setDateStr(e.target.value); setError(''); }} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Camp Check-out Time <span className="text-destructive">*</span></Label>
                  <Input type="time" value={timeStr} onChange={(e) => { setTimeStr(e.target.value); setError(''); }} />
                </div>
              </div>

              <Row label="Camp Stay Duration" value={formatDuration(duration)} />

              {demobilize && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Reason for Demobilization <span className="text-destructive">*</span></Label>
                  <Textarea
                    rows={2}
                    className="resize-y"
                    placeholder="e.g. End of contract, released by supplier, resigned..."
                    value={reason}
                    onChange={(e) => { setReason(e.target.value); setError(''); }}
                  />
                </div>
              )}

              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button className={demobilize ? 'bg-orange-600 hover:bg-orange-700' : ''} onClick={handleSubmit}>
                {demobilize ? 'Demobilize from Project' : 'Confirm Camp Check-out'}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}