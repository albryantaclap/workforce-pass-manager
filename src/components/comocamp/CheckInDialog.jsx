import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatTime, formatDateOnly } from '@/lib/attendanceUtils';

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function CheckInDialog({ open, emp, onConfirm, onClose }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!emp) return null;
  const iso = now.toISOString();

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check in {emp.name}?</DialogTitle>
          <DialogDescription>Record a new check-in session for this personnel.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm py-2">
          <Row label="Employee" value={emp.name} />
          <Row label="Company" value={emp.company || '—'} />
          <Row label="Work Location" value={emp.current_location || '—'} />
          <Row label="Date" value={formatDateOnly(iso)} />
          <Row label="Time" value={formatTime(iso)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(emp, now)}>Confirm Check-in</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}