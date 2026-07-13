import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function StatusChangeModal({ open, onClose, emp, newStatus, onConfirm }) {
  const today = new Date().toISOString().split('T')[0];
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [reason, setReason] = useState('');

  if (!emp) return null;

  const isInactive = newStatus === 'Inactive';
  const isDemobilized = newStatus === 'Demobilized';
  const isActive = newStatus === 'Active';
  const prevStatus = emp.personnel_status || 'Active';

  const dateLabel = isDemobilized ? 'Demobilization Date' : 'Inactive Date / Status Effective Date';
  const title = isDemobilized ? 'Demobilize Personnel' : isInactive ? 'Set Personnel as Inactive' : 'Reactivate Personnel';

  const handleConfirm = () => {
    onConfirm({ emp, newStatus, effectiveDate, lastWorkingDate, reason });
    onClose();
    setEffectiveDate(today);
    setLastWorkingDate('');
    setReason('');
  };

  const handleClose = () => {
    onClose();
    setEffectiveDate(today);
    setLastWorkingDate('');
    setReason('');
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="rounded-lg bg-muted/40 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Employee:</span>
              <strong>{emp.name}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Status:</span>
              <span className="font-medium">{prevStatus}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">New Status:</span>
              <span className={`font-bold ${isActive ? 'text-green-600' : isDemobilized ? 'text-orange-600' : 'text-red-600'}`}>
                {newStatus}
              </span>
            </div>
          </div>

          {!isActive && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">{dateLabel} *</Label>
                <Input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Last Working Date <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="date" value={lastWorkingDate} onChange={e => setLastWorkingDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Reason / Remarks <span className="text-muted-foreground">(optional)</span></Label>
                <Input placeholder="Enter reason..." value={reason} onChange={e => setReason(e.target.value)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Cancel</Button>
          <Button
            onClick={handleConfirm}
            disabled={!isActive && !effectiveDate}
            className={isActive ? 'bg-green-600 hover:bg-green-700' : isDemobilized ? 'bg-orange-600 hover:bg-orange-700' : 'bg-red-600 hover:bg-red-700'}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}