import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { createReturn, recordAssetMovement } from '@/lib/inventoryService';
import { useToast } from '@/components/ui/use-toast';

export default function ReturnItemFormModal({ open, onClose, onSaved, originalTxn, stores, user }) {
  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().slice(0, 10),
    quantity: '',
    store: '',
    return_reason: '',
    remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && originalTxn) {
      setForm({
        transaction_date: new Date().toISOString().slice(0, 10),
        quantity: String(originalTxn.quantity_abs || ''),
        store: originalTxn.store || '',
        return_reason: '',
        remarks: '',
      });
    }
  }, [open, originalTxn]);

  if (!originalTxn) return null;

  const handleSubmit = async () => {
    if (!form.quantity || Number(form.quantity) <= 0) {
      toast({ title: 'Return quantity must be greater than 0', variant: 'destructive' });
      return;
    }
    if (Number(form.quantity) > (originalTxn.quantity_abs || 0)) {
      toast({
        title: `Return quantity cannot exceed issued quantity (${originalTxn.quantity_abs} ${originalTxn.unit || ''})`,
        variant: 'destructive',
      });
      return;
    }
    if (!form.return_reason.trim()) {
      toast({ title: 'Return reason is required', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const returnTxn = await createReturn({
        transaction_date: form.transaction_date,
        item_id: originalTxn.item_id,
        quantity: Number(form.quantity),
        store: form.store,
        original_txn_id: originalTxn.id,
        return_reason: form.return_reason,
        pid: originalTxn.pid || '',
        employee_id: originalTxn.employee_id || '',
        employee_name: originalTxn.employee_name || '',
        company: originalTxn.company || '',
        department: originalTxn.department || '',
        designation: originalTxn.designation || '',
        remarks: form.remarks,
      }, user);
      // The returned asset keeps its own warranty record and history.
      await recordAssetMovement(returnTxn, 'Returned', user);
      toast({ title: 'Return recorded successfully' });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: e.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Process Return</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Original transaction info (read-only) */}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Item:</span>
              <span className="font-medium">{originalTxn.item_sn} — {originalTxn.item_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Employee:</span>
              <span className="font-medium">{originalTxn.employee_name || '—'}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Originally Issued:</span>
              <span className="font-medium">{originalTxn.quantity_abs} {originalTxn.unit}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Issue Date:</span>
              <span className="font-medium">{originalTxn.transaction_date}</span>
            </div>
          </div>

          <div>
            <Label>Return Date</Label>
            <Input type="date" value={form.transaction_date}
              onChange={e => setForm({ ...form, transaction_date: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Return Quantity *</Label>
              <Input type="number" min="1" max={originalTxn.quantity_abs || undefined}
                value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
            <div>
              <Label>Return to Store</Label>
              <Select value={form.store} onValueChange={v => setForm({ ...form, store: v })}>
                <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                <SelectContent>
                  {(stores || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Return Reason *</Label>
            <Textarea value={form.return_reason}
              onChange={e => setForm({ ...form, return_reason: e.target.value })}
              rows={2} placeholder="e.g. Item no longer needed, damaged, wrong size..." />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Process Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}