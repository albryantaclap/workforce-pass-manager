import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function CheckOutDialog({ open, emp, record, onConfirm, onClose }) {
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    const now = new Date();
    setDateStr(toDateStr(now));
    setTimeStr(toTimeStr(now));
    setError('');
  }, [open]);

  const outAt = useMemo(() => buildDateTime(dateStr, timeStr), [dateStr, timeStr]);

  if (!emp || !record) return null;

  const checkInDate = record.check_in_at ? new Date(record.check_in_at) : null;
  const duration = outAt && checkInDate ? calcDuration(record.check_in_at, outAt.toISOString()) : 0;

  const handleConfirm = () => {
    if (!dateStr || !timeStr) { setError('Check-out Date and Time are required.'); return; }
    const at = buildDateTime(dateStr, timeStr);
    if (!at) { setError('Invalid date or time.'); return; }
    if (checkInDate && at <= checkInDate) {
      setError('Check-out date and time must be later than the Check-in date and time.');
      return;
    }
    onConfirm(record, at);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check out {emp.name}?</DialogTitle>
          <DialogDescription>This will close the open check-in session. Adjust the check-out date and time if needed — overnight sessions are supported.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm py-2">
          <Row label="Employee" value={emp.name} />
          <Row label="Company" value={emp.company || '—'} />
          <Row label="Work Location" value={emp.current_location || '—'} />
          <div className="border-t pt-2 space-y-2">
            <Row label="Check-in Date" value={checkInDate ? formatDateOnly(record.check_in_at) : '—'} />
            <Row label="Check-in Time" value={checkInDate ? formatTime(record.check_in_at) : '—'} />
          </div>
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Check-out Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={dateStr} onChange={(e) => { setDateStr(e.target.value); setError(''); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Check-out Time <span className="text-destructive">*</span></Label>
              <Input type="time" value={timeStr} onChange={(e) => { setTimeStr(e.target.value); setError(''); }} />
            </div>
          </div>
          <Row label="Duration" value={formatDuration(duration)} />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm Check-out</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}