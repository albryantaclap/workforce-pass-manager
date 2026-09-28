import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, Paperclip } from 'lucide-react';
import ItemLinePicker from '@/components/inventory/ItemLinePicker';
import LineWarrantyFields from '@/components/inventory/LineWarrantyFields';
import { calculateAvailableStock, uploadInventoryFile } from '@/lib/inventoryService';
import { updateTransactionLine } from '@/lib/inventoryCorrections';
import { emptyWarrantyLineFields, warrantyLineFromRows } from '@/lib/warranty';
import { itemDisplayUnit } from '@/lib/inventoryText';
import { useRbac } from '@/lib/useRbac';
import { useToast } from '@/components/ui/use-toast';

/**
 * Correct a recorded Stock In line. Every field of the receipt can be updated,
 * but only the quantity difference moves stock — the delivery is never counted
 * twice, and the warranty already stored for this receipt is updated in place.
 */
export default function StockInEditDialog({
  open, onClose, onSaved, txn, warrantyRows = [], transactions = [],
  documentLines = 1, suppliers = [], stores = [], user,
}) {
  const [form, setForm] = useState(null);
  const [line, setLine] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { can } = useRbac();
  const { toast } = useToast();
  const canEditWarranty = can('inventory.warranty.edit') || can('inventory.warranty.add');

  useEffect(() => {
    if (!open || !txn) return;
    setForm({
      transaction_date: txn.transaction_date || '',
      dn_no: txn.dn_no || '', mrf_no: txn.mrf_no || '', lpo: txn.lpo || '',
      supplier: txn.supplier || '', store: txn.store || '',
      remarks: txn.remarks || '', dn_file_url: txn.dn_file_url || '',
    });
    setLine({
      item_id: txn.item_id || '',
      item_sn: txn.item_sn || '',
      item_name: txn.item_name || '',
      unit: txn.unit || '',
      quantity: String(txn.quantity_abs ?? ''),
      remarks: txn.remarks || '',
      ...emptyWarrantyLineFields(),
      ...warrantyLineFromRows(warrantyRows, {}),
    });
    setReason('');
    setSaving(false);
    setUploading(false);
  }, [open, txn]);

  if (!open || !txn || !form || !line) return null;

  const setField = (patch) => setForm(f => ({ ...f, ...patch }));
  const setLineField = (patch) => setLine(l => ({ ...l, ...patch }));

  const ledgerWithoutLine = transactions.filter(t => t.id !== txn.id);
  const quantity = Math.abs(Number(line.quantity) || 0);
  const availableBefore = calculateAvailableStock(ledgerWithoutLine, txn.item_id);
  const availableAfter = calculateAvailableStock(ledgerWithoutLine, line.item_id) + quantity;

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setField({ dn_file_url: await uploadInventoryFile(file) });
      toast({ title: 'DN scan replaced' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    if (!line.item_id) {
      toast({ title: 'Select an item', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await updateTransactionLine({
        original: txn,
        patch: {
          item_id: line.item_id,
          quantity,
          transaction_date: form.transaction_date,
          dn_no: form.dn_no,
          mrf_no: form.mrf_no,
          lpo: form.lpo,
          supplier: form.supplier,
          store: form.store,
          remarks: form.remarks,
          dn_file_url: form.dn_file_url,
        },
        warranty: canEditWarranty ? line : null,
        reason,
        user,
      });
      toast({
        title: 'Stock In record updated',
        description: `Available stock for ${line.item_sn}: ${availableBefore} → ${availableAfter}`,
      });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: e.message || 'Failed to update the record', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Stock In — {txn.item_sn}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-slate-50/60 px-3 py-2 text-xs space-y-0.5">
            <p>
              <span className="text-muted-foreground">Recorded:</span>{' '}
              {txn.transaction_date} · {txn.item_sn} — {txn.item_name} · {txn.quantity_abs} {txn.unit}
            </p>
            <p><span className="text-muted-foreground">Recorded by:</span> {txn.created_by_name || txn.created_by || '—'}</p>
            {documentLines > 1 && (
              <p className="text-[11px] text-amber-700 flex items-start gap-1 pt-0.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                This line belongs to {form.dn_no ? `D/N ${form.dn_no}` : 'a delivery note'} with {documentLines} lines — the
                D/N no., MRF no., LPO, supplier, store, date and remarks apply to the whole document.
              </p>
            )}
          </div>

          {/* ── Document header ── */}
          <div className="rounded-md border bg-slate-50/60 p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.transaction_date}
                  onChange={e => setField({ transaction_date: e.target.value })} />
              </div>
              <div>
                <Label>D/N No.</Label>
                <Input value={form.dn_no} onChange={e => setField({ dn_no: e.target.value })} />
              </div>
              <div>
                <Label>MRF No.</Label>
                <Input value={form.mrf_no} onChange={e => setField({ mrf_no: e.target.value })} />
              </div>
              <div>
                <Label>LPO</Label>
                <Input value={form.lpo} onChange={e => setField({ lpo: e.target.value })} />
              </div>
              <div>
                <Label>Supplier</Label>
                <Select value={form.supplier} onValueChange={v => setField({ supplier: v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Store</Label>
                <Select value={form.store} onValueChange={v => setField({ store: v })}>
                  <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    {(stores || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Label>Remarks</Label>
                <Input value={form.remarks} onChange={e => setField({ remarks: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>DN Scan</Label>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*,application/pdf" onChange={handleUpload}
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
                {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                {form.dn_file_url && (
                  <a href={form.dn_file_url} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Current scan
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── Item line ── */}
          <div className="rounded-md border p-3 space-y-3">
            <p className="text-sm font-semibold">Item line</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="col-span-2">
                <Label>Item S.N. *</Label>
                <ItemLinePicker
                  item={line.item_id ? { id: line.item_id, item_sn: line.item_sn, item_name: line.item_name, unit: line.unit } : null}
                  onSelect={(item) => setLineField({
                    item_id: item.id,
                    item_sn: item.item_sn || '',
                    item_name: item.item_name || '',
                    unit: itemDisplayUnit(item),
                  })}
                />
              </div>
              <div>
                <Label>Unit</Label>
                <Input value={line.unit || ''} readOnly className="bg-slate-100" />
              </div>
              <div>
                <Label>Quantity *</Label>
                <Input type="number" min="1" value={line.quantity}
                  onChange={e => setLineField({ quantity: e.target.value })} className="text-right" />
              </div>
              <div>
                <Label>Available (before → after)</Label>
                <Input value={`${availableBefore} → ${availableAfter}`} readOnly className="bg-slate-100 text-right" />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              The stock difference is applied on save (10 → 15 adds 5) — no second movement is recorded.
            </p>
          </div>

          {/* ── Warranty already stored for this receipt ── */}
          {canEditWarranty && (
            <div>
              <p className="text-sm font-semibold mb-2">Warranty information</p>
              <LineWarrantyFields line={line} onChange={setLineField} />
            </div>
          )}

          <div>
            <Label>Reason for the change (optional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Why this recorded entry is being corrected" />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Edited by {user?.full_name || user?.email || 'you'} — previous and new values are stored with the record.
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}