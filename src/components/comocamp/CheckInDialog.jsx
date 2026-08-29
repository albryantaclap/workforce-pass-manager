import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

// Local-time helpers — construct dates in the user's timezone so the stored
// ISO timestamp represents the exact date/time the user selected (no UTC drift).
const toDateStr = (d) => d.toLocaleDateString('en-CA'); // YYYY-MM-DD
const toTimeStr = (d) => d.toTimeString().slice(0, 5);   // HH:MM (24h)

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

export default function CheckInDialog({ open, emp, onConfirm, onClose }) {
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

  if (!emp) return null;

  const handleConfirm = () => {
    if (!dateStr || !timeStr) { setError('Check-in Date and Time are required.'); return; }
    const at = buildDateTime(dateStr, timeStr);
    if (!at) { setError('Invalid date or time.'); return; }
    onConfirm(emp, at);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check in {emp.name}?</DialogTitle>
          <DialogDescription>Record a new check-in session. Adjust the date and time if needed — defaults to now.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm py-2">
          <Row label="Employee" value={emp.name} />
          <Row label="Company" value={emp.company || '—'} />
          <Row label="Work Location" value={emp.current_location || '—'} />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="space-y-1">
              <Label className="text-xs">Check-in Date <span className="text-destructive">*</span></Label>
              <Input type="date" value={dateStr} onChange={(e) => { setDateStr(e.target.value); setError(''); }} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Check-in Time <span className="text-destructive">*</span></Label>
              <Input type="time" value={timeStr} onChange={(e) => { setTimeStr(e.target.value); setError(''); }} />
            </div>
          </div>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm}>Confirm Check-in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}