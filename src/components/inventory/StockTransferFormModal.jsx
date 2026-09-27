import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelect from '@/components/common/SearchableSelect';
import { createStockTransfer, generateInternalDnNo, uploadInventoryFile, fetchTransactions, calculateAvailableStock, recordAssetMovement } from '@/lib/inventoryService';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';

export default function StockTransferFormModal({ open, onClose, onSaved, items, stores, user }) {
  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().slice(0, 10),
    item_id: '', item_sn: '', item_name: '', unit: '', available: 0,
    from_store: '', to_store: '', quantity: '',
    internal_dn_no: '', remarks: '', dn_file_url: '',
  });
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const { data: transactions = [] } = useQuery({
    queryKey: ['inventory-transactions', { item_id: form.item_id }],
    queryFn: () => form.item_id ? fetchTransactions({ item_id: form.item_id }) : [],
    enabled: !!form.item_id,
    staleTime: 10000,
  });

  useEffect(() => {
    if (form.item_id) {
      const avail = calculateAvailableStock(transactions, form.item_id);
      setForm(f => ({ ...f, available: avail }));
    }
  }, [transactions, form.item_id]);

  useEffect(() => {
    if (open) {
      setForm({
        transaction_date: new Date().toISOString().slice(0, 10),
        item_id: '', item_sn: '', item_name: '', unit: '', available: 0,
        from_store: '', to_store: '', quantity: '',
        internal_dn_no: generateInternalDnNo(), remarks: '', dn_file_url: '',
      });
    }
  }, [open]);

  const handleItemSelect = (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setForm(f => ({
        ...f, item_id: item.id, item_sn: item.item_sn,
        item_name: item.item_name, unit: item.unit,
      }));
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const file_url = await uploadInventoryFile(file);
      setForm(f => ({ ...f, dn_file_url: file_url }));
      toast({ title: 'DN scan uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    if (!form.item_id || !form.quantity || Number(form.quantity) <= 0) {
      toast({ title: 'Item and quantity are required', variant: 'destructive' });
      return;
    }
    if (!form.from_store || !form.to_store) {
      toast({ title: 'From Store and To Store are required', variant: 'destructive' });
      return;
    }
    if (form.from_store === form.to_store) {
      toast({ title: 'From Store and To Store must be different', variant: 'destructive' });
      return;
    }
    if (Number(form.quantity) > form.available) {
      toast({
        title: `Insufficient stock. Available: ${form.available} ${form.unit || ''}`.trim(),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      const transferTxn = await createStockTransfer({
        transaction_date: form.transaction_date,
        item_id: form.item_id,
        quantity: Number(form.quantity),
        from_store: form.from_store,
        to_store: form.to_store,
        internal_dn_no: form.internal_dn_no,
        dn_file_url: form.dn_file_url,
        remarks: form.remarks,
      }, user);
      // A transfer moves the asset and keeps its warranty record intact.
      await recordAssetMovement(transferTxn, 'Transferred', user);
      toast({ title: 'Stock transfer recorded successfully' });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: e.message || 'Failed to save', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const itemOptions = items.filter(i => !i.is_archived).map(i => ({
    value: i.id,
    label: `${i.item_sn} — ${i.item_name}`,
  }));

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stock Transfer (Store to Store)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Date</Label>
            <Input type="date" value={form.transaction_date}
              onChange={e => setForm({ ...form, transaction_date: e.target.value })} />
          </div>
          <div>
            <Label>Item S.N. *</Label>
            <SearchableSelect
              options={itemOptions}
              value={form.item_id}
              onChange={handleItemSelect}
              placeholder="Search by Item S.N. or name..."
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Item Name</Label>
              <Input value={form.item_name} readOnly className="bg-slate-50" />
            </div>
            <div>
              <Label>Unit</Label>
              <Input value={form.unit} readOnly className="bg-slate-50" />
            </div>
            <div>
              <Label>Available</Label>
              <Input value={form.available} readOnly className="bg-amber-50 font-semibold" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>From Store *</Label>
              <Select value={form.from_store} onValueChange={v => setForm({ ...form, from_store: v })}>
                <SelectTrigger><SelectValue placeholder="Select source store" /></SelectTrigger>
                <SelectContent>
                  {(stores || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>To Store *</Label>
              <Select value={form.to_store} onValueChange={v => setForm({ ...form, to_store: v })}>
                <SelectTrigger><SelectValue placeholder="Select destination store" /></SelectTrigger>
                <SelectContent>
                  {(stores || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Internal DN No.</Label>
              <Input value={form.internal_dn_no}
                onChange={e => setForm({ ...form, internal_dn_no: e.target.value })} />
            </div>
            <div>
              <Label>Quantity *</Label>
              <Input type="number" min="1" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>DN Scan Upload (optional)</Label>
            <div className="flex items-center gap-2">
              <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload}
                className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
              {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
              {form.dn_file_url && <span className="text-xs text-green-600">✓ Uploaded</span>}
            </div>
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Submit Transfer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}