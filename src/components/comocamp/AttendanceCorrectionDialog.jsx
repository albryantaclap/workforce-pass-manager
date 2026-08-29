import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// to datetime-local input value (local time, YYYY-MM-DDTHH:mm)
const toLocalInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().substring(0, 16);
};

export default function AttendanceCorrectionDialog({ open, record, emp, onConfirm, onClose }) {
  const [field, setField] = useState('check_in_at');
  const [newValue, setNewValue] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!open || !record) return;
    setField('check_in_at');
    setNewValue(toLocalInput(record.check_in_at));
    setReason('');
  }, [open, record]);

  if (!record) return null;

  const handleFieldChange = (f) => {
    setField(f);
    setNewValue(toLocalInput(record[f]));
  };

  const originalDisplay = record[field] ? new Date(record[field]).toLocaleString() : '—';

  const handleConfirm = () => {
    if (!newValue || !reason.trim()) return;
    const iso = new Date(newValue).toISOString();
    onConfirm({ record, field, originalValue: record[field] || '', newValue: iso, reason: reason.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Attendance — {emp?.name}</DialogTitle>
          <DialogDescription>Admin correction. Every change is recorded in the audit log.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label className="text-xs">Field</Label>
            <Select value={field} onValueChange={handleFieldChange}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="check_in_at">Check-in Time</SelectItem>
                <SelectItem value="check_out_at">Check-out Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Original Value</Label>
            <div className="text-sm text-muted-foreground mt-1">{originalDisplay}</div>
          </div>
          <div>
            <Label className="text-xs">New Value</Label>
            <Input type="datetime-local" value={newValue} onChange={(e) => setNewValue(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Reason</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason for correction" rows={2} className="mt-1" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={!newValue || !reason.trim()}>Save Correction</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}