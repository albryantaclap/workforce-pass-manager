import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DocumentLineItems, { blankLine } from '@/components/inventory/DocumentLineItems';
import { createInventoryDocument, uploadInventoryFile } from '@/lib/inventoryService';
import { useWarrantySetting } from '@/hooks/useWarrantySetting';
import { useToast } from '@/components/ui/use-toast';

const emptyHeader = () => ({
  transaction_date: new Date().toISOString().slice(0, 10),
  iv_no: '', site: '', store: '', remarks: '', voucher_file_url: '',
});

/**
 * Issue Stock Out — one store issue voucher (I/V No.) with any number of item
 * lines. Every line names the employee (Name / PID / QID) it is issued to, so a
 * single voucher can serve several employees, and the same item may appear on
 * more than one line. The voucher's total per item is validated against
 * available stock before anything is written.
 */
export default function StockOutFormModal({ open, onClose, onSaved, sites, stores, employees = [], transactions = [], warranties = [], user }) {
  const warningDays = useWarrantySetting();
  const [header, setHeader] = useState(emptyHeader());
  const [lines, setLines] = useState([blankLine()]);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setHeader(emptyHeader());
      setLines([blankLine()]);
      setSaving(false);
    }
  }, [open]);

  const setField = (patch) => setHeader(h => ({ ...h, ...patch }));

  const handleVoucherUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const file_url = await uploadInventoryFile(file);
      setField({ voucher_file_url: file_url });
      toast({ title: 'Store voucher uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);

  /** First problem found on any line — the voucher is only saved when clean. */
  const lineProblem = () => {
    for (let i = 0; i < lines.length; i += 1) {
      const l = lines[i];
      if (!l.item_id) return `Line ${i + 1}: select an item`;
      if (!Number(l.quantity) || Number(l.quantity) <= 0) return `Line ${i + 1}: enter a quantity`;
      if (!l.employee_id) return `Line ${i + 1}: select the employee ${l.item_sn} is issued to`;
    }
    return null;
  };

  const handleSubmit = async () => {
    if (saving) return;
    const problem = lineProblem();
    if (problem) {
      toast({ title: problem, variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await createInventoryDocument({
        document: {
          document_type: 'STOCK_OUT',
          document_date: header.transaction_date,
          document_no: header.iv_no,
          site: header.site,
          store: header.store,
          remarks: header.remarks,
          file_url: header.voucher_file_url,
        },
        lines,
      }, user);
      toast({
        title: `${lines.length} item line${lines.length === 1 ? '' : 's'} issued${header.iv_no ? ` under I/V ${header.iv_no}` : ''}`,
      });
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
      {/* The line table is the only scrolling area, and dropdown panels may
          extend over it — so this modal itself never clips or scrolls. */}
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col overflow-visible">
        <DialogHeader className="shrink-0">
          <DialogTitle>Issue Stock Out — Store Issue Voucher</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 flex flex-col gap-4">
          {/* ── Voucher header (shared by every line) ── */}
          <div className="rounded-md border bg-slate-50/60 p-3 space-y-3 shrink-0">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={header.transaction_date}
                  onChange={e => setField({ transaction_date: e.target.value })} />
              </div>
              <div>
                <Label>I/V No.</Label>
                <Input value={header.iv_no} onChange={e => setField({ iv_no: e.target.value })}
                  placeholder="Store issue voucher no." />
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
              <Label>Store Voucher Upload (optional)</Label>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*,application/pdf" onChange={handleVoucherUpload}
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
                {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                {header.voucher_file_url && <span className="text-xs text-green-600">✓ Uploaded</span>}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground">
              Each item line names the employee receiving it — one voucher can issue different items to different employees.
            </p>
          </div>

          {/* ── Item lines (each with its own employee) ── */}
          <DocumentLineItems
            mode="out"
            lines={lines}
            onChange={setLines}
            employees={employees}
            transactions={transactions}
            warranties={warranties}
            warningDays={warningDays}
            className="flex-1 min-h-0 flex flex-col"
            scrollClassName="flex-1 min-h-0 max-h-none"
          />
        </div>

        <DialogFooter className="shrink-0 flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {lines.length} item{lines.length === 1 ? '' : 's'} · total quantity {totalQty} ·{' '}
            {new Set(lines.map(l => l.employee_id).filter(Boolean)).size || 0} employee
            {new Set(lines.map(l => l.employee_id).filter(Boolean)).size === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Issue Stock'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}