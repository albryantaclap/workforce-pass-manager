import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AlertTriangle } from 'lucide-react';
import ExistingItemSearch from '@/components/inventory/ExistingItemSearch';
import { findDuplicateIssuances, saveHistoricalIssuance, isHistoricalLine } from '@/lib/issuanceHistory';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);

const emptyValues = () => ({
  transaction_date: today(),
  item_id: '',
  quantity: '',
  iv_no: '',
  site: '',
  store: '',
  remarks: '',
});

/**
 * Add a missing historical issuance record or correct an existing one.
 *
 * A historical record documents stock that was already handed over — it is
 * written with quantity 0, so available stock is never deducted again. A line
 * that is a real recorded issue keeps the module's correction rules.
 */
export default function HistoricalIssuanceDialog({ open, onClose, employee, line = null, vouchers = [], onSaved }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [values, setValues] = useState(emptyValues());
  const [item, setItem] = useState(null);
  const [reason, setReason] = useState('');
  const [duplicates, setDuplicates] = useState(null);
  const [saving, setSaving] = useState(false);

  const realMovement = !!line && !isHistoricalLine(line);

  useEffect(() => {
    if (!open) return;
    setDuplicates(null);
    setReason('');
    setSaving(false);
    if (line) {
      setValues({
        transaction_date: line.transaction_date || today(),
        item_id: line.item_id || '',
        quantity: String(line.quantity_abs ?? ''),
        iv_no: line.iv_no || '',
        site: line.site || '',
        store: line.store || '',
        remarks: line.remarks || '',
      });
      setItem({ id: line.item_id, item_sn: line.item_sn, item_name: line.item_name, unit: line.unit });
    } else {
      setValues(emptyValues());
      setItem(null);
    }
  }, [open, line]);

  const setField = (patch) => setValues(v => ({ ...v, ...patch }));

  const handleItem = (picked) => {
    setItem(picked);
    setField({ item_id: picked?.id || '' });
  };

  const submit = async (force = false) => {
    if (saving) return;
    if (!values.item_id) return toast({ title: 'Select the item that was issued', variant: 'destructive' });
    if (!Number(values.quantity) || Number(values.quantity) <= 0) {
      return toast({ title: 'Enter a quantity greater than zero', variant: 'destructive' });
    }
    if (!values.transaction_date) return toast({ title: 'Issuance date is required', variant: 'destructive' });
    if (!reason.trim()) return toast({ title: 'A reason is required', variant: 'destructive' });

    setSaving(true);
    try {
      if (!force) {
        const found = await findDuplicateIssuances({
          employeeId: employee?.id,
          itemId: values.item_id,
          ivNo: values.iv_no,
          transactionDate: values.transaction_date,
          quantity: values.quantity,
          excludeId: line?.id,
        });
        if (found.length) {
          setDuplicates(found);
          return;
        }
      }
      await saveHistoricalIssuance({ line, employee, values, user, reason: reason.trim() });
      toast({ title: line ? 'Historical record corrected' : 'Historical issuance recorded' });
      onSaved?.();
      onClose();
    } catch (error) {
      toast({ title: error.message || 'Could not save the record', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{line ? 'Correct Historical Issuance' : 'Add Historical Issuance'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">
            Recording an issue that already happened to <strong>{employee?.name}</strong>.
            Historical entries document history and do not change available stock.
          </p>

          {realMovement && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-800">
              This line is a real recorded Stock Out. Changing the quantity adjusts available stock by the
              difference, following the existing inventory correction rules.
            </div>
          )}

          <div>
            <Label className="text-xs">Item *</Label>
            <ExistingItemSearch selectedItem={item} onSelectItem={handleItem} onCreateNew={() => {}} showCreateNew={false} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Quantity Issued *</Label>
              <Input
                type="number"
                min="0"
                step="any"
                value={values.quantity}
                onChange={(e) => setField({ quantity: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Issuance Date *</Label>
              <Input
                type="date"
                value={values.transaction_date}
                onChange={(e) => setField({ transaction_date: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">I/V No. (Store Issue Voucher)</Label>
              <Input
                value={values.iv_no}
                onChange={(e) => setField({ iv_no: e.target.value })}
                placeholder="Link an existing voucher"
                className="h-8 text-xs"
              />
              {vouchers.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {vouchers.slice(0, 6).map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setField({ iv_no: v })}
                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 hover:bg-slate-100"
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="text-xs">Store</Label>
              <Input
                value={values.store}
                onChange={(e) => setField({ store: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Site</Label>
              <Input
                value={values.site}
                onChange={(e) => setField({ site: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Remarks</Label>
            <Textarea
              value={values.remarks}
              onChange={(e) => setField({ remarks: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>

          <div>
            <Label className="text-xs">Reason for this change *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Why this historical record is being added or corrected"
              className="text-xs"
            />
          </div>

          {duplicates && (
            <div className="rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
              <p className="flex items-center gap-1 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5" /> Possible duplicate record detected
              </p>
              <ul className="mt-1 space-y-0.5">
                {duplicates.map(d => (
                  <li key={d.id}>
                    {d.item_sn} · {d.transaction_date} · Qty {d.quantity_abs}
                    {d.iv_no ? ` · I/V ${d.iv_no}` : ''} — {d.reason}
                    {d.is_historical ? ' (historical)' : ''}
                  </li>
                ))}
              </ul>
              <p className="mt-1">Saving will not create a stock movement. Review the existing record above.</p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={() => submit(false)} disabled={saving}>
            {saving ? 'Saving…' : line ? 'Save Correction' : 'Save Historical Record'}
          </Button>
          {duplicates && (
            <Button size="sm" variant="destructive" onClick={() => submit(true)} disabled={saving}>
              Save anyway
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}