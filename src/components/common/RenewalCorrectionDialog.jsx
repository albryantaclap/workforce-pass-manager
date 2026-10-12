import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { correctHistoryEntry } from '@/lib/renewalHistory';

const EDITABLE = [
  { key: 'document_number', label: 'Document No. (PID)', type: 'text', show: 'Project ID' },
  { key: 'issue_date', label: 'Issue / Submitted Date', type: 'date', show: 'both' },
  { key: 'received_date', label: 'Received Date', type: 'date', show: 'Gate Pass' },
  { key: 'expiry_date', label: 'Expiry Date', type: 'date', show: 'both' },
  { key: 'recorded_status', label: 'Recorded Status', type: 'text', show: 'both' },
  { key: 'remarks', label: 'Remarks', type: 'text', show: 'both' },
];

/** Audited admin correction of a single renewal-history entry. */
export default function RenewalCorrectionDialog({ entry, onClose, onSaved }) {
  const { toast } = useToast();
  const [fields, setFields] = useState({});
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    const f = {};
    for (const e of EDITABLE) f[e.key] = entry[e.key] ?? '';
    setFields(f);
    setReason('');
  }, [entry]);

  if (!entry) return null;
  const visible = EDITABLE.filter(e => e.show === 'both' || e.show === entry.document_type);

  const handleSave = async () => {
    if (saving) return;
    if (!reason.trim()) {
      toast({ title: 'A reason is required for a correction', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await correctHistoryEntry({ entryId: entry.id, fields, reason: reason.trim() });
      toast({ title: 'History entry corrected' });
      onSaved?.();
    } catch (e) {
      toast({ title: e.message || 'Correction failed', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!entry} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Correct Renewal #{entry.renewal_no}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Corrections are audited and never create a new renewal.</p>
          {visible.map(e => (
            <div key={e.key}>
              <Label>{e.label}</Label>
              <Input
                type={e.type}
                value={fields[e.key] ?? ''}
                onChange={ev => setFields(f => ({ ...f, [e.key]: ev.target.value }))}
              />
            </div>
          ))}
          <div>
            <Label>Reason for correction</Label>
            <Textarea value={reason} onChange={ev => setReason(ev.target.value)} rows={2} placeholder="Why this historical entry is being corrected" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save Correction'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}