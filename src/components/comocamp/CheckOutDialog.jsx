import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { formatTime, calcDuration, formatDuration } from '@/lib/attendanceUtils';

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

export default function CheckOutDialog({ open, emp, record, onConfirm, onClose }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    if (!open) return;
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, [open]);

  if (!emp || !record) return null;
  const outIso = now.toISOString();
  const duration = calcDuration(record.check_in_at, outIso);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Check out {emp.name}?</DialogTitle>
          <DialogDescription>This will close the open check-in session.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm py-2">
          <Row label="Employee" value={emp.name} />
          <Row label="Check-in Time" value={formatTime(record.check_in_at)} />
          <Row label="Check-out Time" value={formatTime(outIso)} />
          <Row label="Duration" value={formatDuration(duration)} />
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onConfirm(record, now)}>Confirm Check-out</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}