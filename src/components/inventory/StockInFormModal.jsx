import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DocumentLineItems, { blankLine } from '@/components/inventory/DocumentLineItems';
import { createInventoryDocument, uploadInventoryFile } from '@/lib/inventoryService';
import { useToast } from '@/components/ui/use-toast';

const emptyHeader = () => ({
  transaction_date: new Date().toISOString().slice(0, 10),
  dn_no: '', mrf_no: '', lpo: '', supplier: '', store: '', remarks: '', dn_file_url: '',
});

/**
 * Record Stock In — one delivery note (D/N) with any number of item lines.
 * Every line is written under the same D/N as one document.
 */
export default function StockInFormModal({ open, onClose, onSaved, stores, suppliers, user }) {
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

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const file_url = await uploadInventoryFile(file);
      setField({ dn_file_url: file_url });
      toast({ title: 'DN scan uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity || 0), 0);

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createInventoryDocument({
        document: {
          document_type: 'STOCK_IN',
          document_date: header.transaction_date,
          document_no: header.dn_no,
          mrf_no: header.mrf_no,
          lpo: header.lpo,
          supplier: header.supplier,
          store: header.store,
          remarks: header.remarks,
          file_url: header.dn_file_url,
        },
        lines,
      }, user);
      toast({
        title: `${lines.length} item line${lines.length === 1 ? '' : 's'} recorded${header.dn_no ? ` under D/N ${header.dn_no}` : ''}`,
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
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Stock In — Delivery Note</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* ── Header ── */}
          <div className="rounded-md border bg-slate-50/60 p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={header.transaction_date}
                  onChange={e => setField({ transaction_date: e.target.value })} />
              </div>
              <div>
                <Label>D/N No.</Label>
                <Input value={header.dn_no} onChange={e => setField({ dn_no: e.target.value })}
                  placeholder="Delivery note no." />
              </div>
              <div>
                <Label>MRF No.</Label>
                <Input value={header.mrf_no} onChange={e => setField({ mrf_no: e.target.value })} />
              </div>
              <div>
                <Label>LPO</Label>
                <Input value={header.lpo} onChange={e => setField({ lpo: e.target.value })} />
              </div>
              <div>
                <Label>Supplier</Label>
                <Select value={header.supplier} onValueChange={v => setField({ supplier: v })}>
                  <SelectTrigger><SelectValue placeholder="Select supplier" /></SelectTrigger>
                  <SelectContent>
                    {(suppliers || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
              <div className="col-span-2">
                <Label>Remarks</Label>
                <Input value={header.remarks} onChange={e => setField({ remarks: e.target.value })}
                  placeholder="Document-level remarks" />
              </div>
            </div>
            <div>
              <Label>DN Scan Upload (optional)</Label>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*,application/pdf" onChange={handleFileUpload}
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
                {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                {header.dn_file_url && <span className="text-xs text-green-600">✓ Uploaded</span>}
              </div>
            </div>
          </div>

          {/* ── Item lines ── */}
          <DocumentLineItems mode="in" lines={lines} onChange={setLines} />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {lines.length} item{lines.length === 1 ? '' : 's'} · total quantity {totalQty}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving ? 'Saving...' : 'Save Stock In'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}