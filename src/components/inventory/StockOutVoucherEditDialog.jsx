import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, Paperclip } from 'lucide-react';
import StockOutVoucherLines from '@/components/inventory/StockOutVoucherLines';
import { uploadInventoryFile } from '@/lib/inventoryService';
import { saveStockOutVoucher } from '@/lib/stockOutVoucher';
import { useToast } from '@/components/ui/use-toast';

const lineFromRecord = (l) => ({
  key: l.id,
  id: l.id,
  item_id: l.item_id || '', item_sn: l.item_sn || '', item_name: l.item_name || '', unit: l.unit || '',
  quantity: String(l.quantity_abs ?? ''), remarks: l.remarks || '',
  employee_id: l.employee_id || '', employee_name: l.employee_name || '', pid: l.pid || '',
  company: l.company || '', department: l.department || '', designation: l.designation || '',
});

/**
 * Edit a whole store issue voucher — its header fields and every item line,
 * including the employee each line is issued to. Stock only moves by the
 * difference: a reduced line returns units, an increased line takes more, a
 * removed line returns everything, and an added line joins the SAME voucher.
 * The recorded history is never deleted or recreated — every change is written
 * to the line's audit trail with who, when and why.
 */
export default function StockOutVoucherEditDialog({ open, onClose, onSaved, group, employees = [], transactions = [], sites = [], stores = [], user }) {
  const [header, setHeader] = useState(null);
  const [lines, setLines] = useState([]);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !group) return;
    setHeader({
      document_id: group.documentId || '',
      transaction_date: group.date || new Date().toISOString().slice(0, 10),
      iv_no: group.documentNo || '',
      site: group.site || '',
      store: group.store || '',
      remarks: group.remarks || '',
      voucher_file_url: group.fileUrl || '',
    });
    setLines((group.lines || []).map(lineFromRecord));
    setReason('');
    setSaving(false);
    setUploading(false);
  }, [open, group]);

  if (!open || !group || !header) return null;

  const setField = (patch) => setHeader(h => ({ ...h, ...patch }));

  const originalLines = group.lines || [];
  // The ledger without this voucher: availability already has its original
  // movement taken out, so a correction never counts the same units twice.
  const voucherIds = new Set(originalLines.map(l => l.id));
  const ledger = transactions.filter(t => !t.is_deleted && !voucherIds.has(t.id));

  const requestedByItem = new Map();
  lines.forEach(l => {
    if (l.item_id) requestedByItem.set(l.item_id, (requestedByItem.get(l.item_id) || 0) + Number(l.quantity || 0));
  });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      setField({ voucher_file_url: await uploadInventoryFile(file) });
      toast({ title: 'Store voucher replaced' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (saving) return;
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (!l.item_id) { toast({ title: `Line ${i + 1}: select an item`, variant: 'destructive' }); return; }
      if (!Number(l.quantity) || Number(l.quantity) <= 0) { toast({ title: `Line ${i + 1}: enter a quantity`, variant: 'destructive' }); return; }
      if (!l.employee_id) { toast({ title: `Line ${i + 1}: select the employee ${l.item_sn} is issued to`, variant: 'destructive' }); return; }
    }
    setSaving(true);
    try {
      const result = await saveStockOutVoucher({
        header,
        originalLines,
        lines,
        reason,
        user,
      });
      toast({
        title: 'Issue voucher updated',
        description: [
          result.updated ? `${result.updated} line${result.updated === 1 ? '' : 's'} corrected` : null,
          result.added ? `${result.added} added` : null,
          result.removed ? `${result.removed} removed` : null,
        ].filter(Boolean).join(' · ') || 'No change was needed',
      });
      onSaved?.();
      onClose();
    } catch (e) {
      toast({ title: e.message || 'Failed to update the voucher', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);
  const employeesOnVoucher = [...new Set(lines.map(l => l.employee_id).filter(Boolean))].length;
  const removed = originalLines.filter(l => !lines.some(x => x.id === l.id));
  const added = lines.filter(l => !l.id);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Issue Voucher{group.documentNo ? ` — ${group.documentNo}` : ''}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-slate-50/60 px-3 py-2 text-xs space-y-0.5">
            <p>
              <span className="text-muted-foreground">Recorded:</span>{' '}
              {group.date} · {originalLines.length} line{originalLines.length === 1 ? '' : 's'} ·{' '}
              {[...new Set(originalLines.map(l => l.employee_name).filter(Boolean))].length || 0} employee
              {[...new Set(originalLines.map(l => l.employee_name).filter(Boolean))].length === 1 ? '' : 's'}
            </p>
            <p><span className="text-muted-foreground">Issued by:</span> {group.createdBy || '—'}</p>
            <p className="text-[11px] text-amber-700 flex items-start gap-1 pt-0.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              Every line is edited on its own. Quantity changes move the difference only (5 → 3 returns 2 to stock),
              removed lines return their units, and added lines stay under this same voucher — no second voucher is created.
            </p>
          </div>

          {/* ── Voucher header ── */}
          <div className="rounded-md border bg-slate-50/60 p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={header.transaction_date}
                  onChange={e => setField({ transaction_date: e.target.value })} />
              </div>
              <div>
                <Label>I/V No.</Label>
                <Input value={header.iv_no} onChange={e => setField({ iv_no: e.target.value })} />
              </div>
              <div>
                <Label>Site</Label>
                <Select value={header.site} onValueChange={v => setField({ site: v })}>
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    {(sites || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Store</Label>
                <Select value={header.store} onValueChange={v => setField({ store: v })}>
                  <SelectTrigger><SelectValue placeholder="Select store" /></SelectTrigger>
                  <SelectContent>
                    {(stores || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-4">
                <Label>Remarks</Label>
                <Input value={header.remarks} onChange={e => setField({ remarks: e.target.value })}
                  placeholder="Document-level remarks" />
              </div>
            </div>

            <div>
              <Label>Store Voucher</Label>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*,application/pdf" onChange={handleUpload}
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
                {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                {header.voucher_file_url && (
                  <a href={header.voucher_file_url} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Current voucher
                  </a>
                )}
              </div>
            </div>
          </div>

          {/* ── Item lines, each with its own employee ── */}
          <StockOutVoucherLines
            lines={lines}
            onChange={setLines}
            employees={employees}
            ledger={ledger}
          />

          {(removed.length > 0 || added.length > 0) && (
            <p className="text-[11px] text-muted-foreground">
              {removed.length > 0 && `${removed.length} recorded line${removed.length === 1 ? '' : 's'} will be removed and its units returned to stock. `}
              {added.length > 0 && `${added.length} new line${added.length === 1 ? '' : 's'} will be added to this voucher.`}
            </p>
          )}

          <div>
            <Label>Reason for the change (optional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Why this recorded issue is being corrected" />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {lines.length} line{lines.length === 1 ? '' : 's'} · total quantity {totalQty} · {employeesOnVoucher} employee
            {employeesOnVoucher === 1 ? '' : 's'} — edited by {user?.full_name || user?.email || 'you'}
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