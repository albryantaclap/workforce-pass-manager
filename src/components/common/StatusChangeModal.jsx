import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ACTIVE_ON_SITE, ONBOARDING, INACTIVE, DEMOBILIZED,
  PERSONNEL_STATUS_CONFIG, normalizeStatus,
} from '@/lib/personnelStatus';

const TITLES = {
  [ACTIVE_ON_SITE]: 'Set Personnel as Active on Site',
  [ONBOARDING]: 'Set Personnel as Onboarding',
  [INACTIVE]: 'Set Personnel as Inactive',
  [DEMOBILIZED]: 'Demobilize Personnel',
};

/**
 * Confirmation dialog for every personnel status change.
 * Inactive / Demobilized also capture the effective date, last working date and
 * reason, since those are the statuses that carry removal details.
 */
export default function StatusChangeModal({ open, onClose, emp, newStatus, onConfirm }) {
  const today = new Date().toISOString().split('T')[0];
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [lastWorkingDate, setLastWorkingDate] = useState('');
  const [reason, setReason] = useState('');

  if (!emp || !newStatus) return null;

  const config = PERSONNEL_STATUS_CONFIG[newStatus] || PERSONNEL_STATUS_CONFIG[ACTIVE_ON_SITE];
  const isDemobilized = newStatus === DEMOBILIZED;
  const isInactive = newStatus === INACTIVE;
  const needsDetails = isInactive || isDemobilized;
  const prevStatus = normalizeStatus(emp.personnel_status, emp.is_active);

  const dateLabel = isDemobilized ? 'Demobilization Date' : 'Inactive Date / Status Effective Date';

  const reset = () => {
    setEffectiveDate(today);
    setLastWorkingDate('');
    setReason('');
  };

  const handleConfirm = () => {
    onConfirm({ emp, newStatus, effectiveDate, lastWorkingDate, reason });
    onClose();
    reset();
  };

  const handleClose = () => {
    onClose();
    reset();
  };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TITLES[newStatus] || 'Change Personnel Status'}</DialogTitle>
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
              <span className={`font-bold ${config.text}`}>{newStatus}</span>
            </div>
            {config.description && (
              <p className="text-xs text-muted-foreground pt-1 border-t border-border/60">{config.description}</p>
            )}
          </div>

          {needsDetails && (
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
            disabled={needsDetails && !effectiveDate}
            className={config.solid}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}