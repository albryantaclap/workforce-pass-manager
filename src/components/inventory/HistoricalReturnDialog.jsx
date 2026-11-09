import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { saveHistoricalReturn, isHistoricalLine } from '@/lib/issuanceHistory';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Record a return against an issued line.
 *
 * A historical issue is returned historically (no stock movement). A line that
 * was a real issue puts the units back into available stock through the
 * existing Return Items rules.
 */
export default function HistoricalReturnDialog({ open, onClose, employee, line, outstanding = 0, onSaved }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [values, setValues] = useState({ transaction_date: today(), quantity: '', store: '', remarks: '' });
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const realMovement = !!line && !isHistoricalLine(line);

  useEffect(() => {
    if (!open) return;
    setValues({ transaction_date: today(), quantity: '', store: line?.store || '', remarks: '' });
    setReason('');
    setSaving(false);
  }, [open, line]);

  const setField = (patch) => setValues(v => ({ ...v, ...patch }));

  const submit = async () => {
    if (saving) return;
    if (!Number(values.quantity) || Number(values.quantity) <= 0) {
      return toast({ title: 'Enter a returned quantity greater than zero', variant: 'destructive' });
    }
    if (!values.transaction_date) return toast({ title: 'Return date is required', variant: 'destructive' });
    if (!reason.trim()) return toast({ title: 'A reason is required', variant: 'destructive' });

    setSaving(true);
    try {
      await saveHistoricalReturn({ line, employee, values, user, reason: reason.trim() });
      toast({ title: 'Return recorded' });
      onSaved?.();
      onClose();
    } catch (error) {
      toast({ title: error.message || 'Could not record the return', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Record Item Return</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded border border-slate-200 bg-slate-50 p-2 text-[11px] text-slate-700">
            <p className="font-semibold">{line?.item_sn} — {line?.item_name}</p>
            <p>
              Issued {line?.quantity_abs || 0} {line?.unit || ''} on {line?.transaction_date}
              {line?.iv_no ? ` · I/V ${line.iv_no}` : ''} · Outstanding {outstanding}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            {realMovement
              ? 'This line is a real recorded Stock Out — the returned units go back into available stock.'
              : 'This is a historical issue — recording the return documents history and does not change available stock.'}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Returned Quantity *</Label>
              <Input
                type="number"
                min="0"
                max={outstanding}
                step="any"
                value={values.quantity}
                onChange={(e) => setField({ quantity: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <Label className="text-xs">Return Date *</Label>
              <Input
                type="date"
                value={values.transaction_date}
                onChange={(e) => setField({ transaction_date: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">Store</Label>
              <Input
                value={values.store}
                onChange={(e) => setField({ store: e.target.value })}
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
            <Label className="text-xs">Reason for the return *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : 'Save Return'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}