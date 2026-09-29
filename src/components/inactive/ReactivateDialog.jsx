import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HardHat, UserPlus } from 'lucide-react';
import { ACTIVE_ON_SITE, ONBOARDING } from '@/lib/personnelStatus';

const OPTIONS = [
  { value: ACTIVE_ON_SITE, label: ACTIVE_ON_SITE, hint: 'Mobilized and actively working on the project/site.', icon: HardHat },
  { value: ONBOARDING, label: ONBOARDING, hint: 'Returning to the roster, still completing requirements.', icon: UserPlus },
];

/**
 * Reactivate — personnel / project status ONLY.
 *
 * Returns the person to the working roster as Active on Site or Onboarding.
 * Camp accommodation is never touched: a previous demobilization stays in
 * history and the person must use the COMO Camp Check-in flow if they need a
 * camp stay again.
 */
export default function ReactivateDialog({ open, emp, onClose, onConfirm }) {
  const today = new Date().toISOString().split('T')[0];
  const [newStatus, setNewStatus] = useState(ACTIVE_ON_SITE);
  const [effectiveDate, setEffectiveDate] = useState(today);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open) return;
    setNewStatus(ACTIVE_ON_SITE);
    setEffectiveDate(today);
    setReason('');
  }, [open]);

  if (!emp) return null;

  const handleConfirm = () => {
    onConfirm({ emp, newStatus, effectiveDate, reason });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reactivate {emp.name}?</DialogTitle>
          <DialogDescription>
            This changes the personnel / project status only. Camp accommodation stays independent — the person is not checked back into COMO Camp.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">New Personnel Status *</Label>
            <div className="space-y-2">
              {OPTIONS.map(opt => {
                const Icon = opt.icon;
                const selected = newStatus === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setNewStatus(opt.value)}
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
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Effective Date</Label>
            <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason / Remarks <span className="text-muted-foreground">(optional)</span></Label>
            <Input placeholder="Enter reason..." value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={handleConfirm}>Reactivate</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}