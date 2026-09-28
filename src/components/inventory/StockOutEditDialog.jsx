import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Info, Paperclip, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import ItemLinePicker from '@/components/inventory/ItemLinePicker';
import { calculateAvailableStock, searchEmployees, uploadInventoryFile } from '@/lib/inventoryService';
import { updateTransactionLine } from '@/lib/inventoryCorrections';
import { useToast } from '@/components/ui/use-toast';

/**
 * Correct a recorded Stock Out line — item, quantity, I/V no., the employee the
 * units are issued to, site, store, date and remarks. Only the difference moves
 * stock, the employee stays linked to their Workforce personnel record, and the
 * quantity can never exceed what is actually available.
 */
export default function StockOutEditDialog({
  open, onClose, onSaved, txn, transactions = [], documentLines = 1,
  sites = [], stores = [], user,
}) {
  const [form, setForm] = useState(null);
  const [line, setLine] = useState(null);
  const [empSearch, setEmpSearch] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!open || !txn) return;
    setForm({
      transaction_date: txn.transaction_date || '',
      iv_no: txn.iv_no || '', site: txn.site || '', store: txn.store || '',
      pid: txn.pid || '', employee_id: txn.employee_id || '', employee_name: txn.employee_name || '',
      company: txn.company || '', department: txn.department || '', designation: txn.designation || '',
      remarks: txn.remarks || '', voucher_file_url: txn.voucher_file_url || '',
    });
    setLine({
      item_id: txn.item_id || '', item_sn: txn.item_sn || '',
      item_name: txn.item_name || '', unit: txn.unit || '',
      quantity: String(txn.quantity_abs ?? ''), remarks: txn.remarks || '',
    });
    setEmpSearch(txn.employee_name ? `${txn.employee_name} — PID: ${txn.pid || ''}` : '');
    setEmpDropdownOpen(false);
    setReason('');
    setSaving(false);
    setUploading(false);
  }, [open, txn]);

  const { data: empResults = [] } = useQuery({
    queryKey: ['employee-search', empSearch],
    queryFn: () => searchEmployees(empSearch, 15),
    enabled: open && empSearch.length >= 2,
    staleTime: 10000,
  });

  if (!open || !txn || !form || !line) return null;

  const setField = (patch) => setForm(f => ({ ...f, ...patch }));
  const setLineField = (patch) => setLine(l => ({ ...l, ...patch }));

  const handleEmployeeSelect = (emp) => {
    setField({
      pid: String(emp.pid || ''),
      employee_id: emp.id,
      employee_name: emp.name,
      company: emp.company || '',
      department: emp.department || '',
      designation: emp.position_application || emp.designation_org_chart || '',
    });
    setEmpSearch(`${emp.name} — PID: ${emp.pid || ''}`);
    setEmpDropdownOpen(false);
  };

  const ledgerWithoutLine = transactions.filter(t => t.id !== txn.id);
  const quantity = Math.abs(Number(line.quantity) || 0);
  const availableForTarget = calculateAvailableStock(ledgerWithoutLine, line.item_id);
  const availableAfter = availableForTarget - quantity;
  const availableAtStart = calculateAvailableStock(ledgerWithoutLine, txn.item_id);
  const over = quantity > availableForTarget;

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
    if (!line.item_id) {
      toast({ title: 'Select an item', variant: 'destructive' });
      return;
    }
    if (!form.employee_id) {
      toast({ title: 'Select the employee the items are issued to', variant: 'destructive' });
      return;
    }
    if (over) {
      toast({ title: `Only ${availableForTarget} ${line.unit || ''} available for this item`, variant: 'destructive' });
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
          iv_no: form.iv_no,
          site: form.site,
          store: form.store,
          pid: form.pid,
          employee_id: form.employee_id,
          employee_name: form.employee_name,
          company: form.company,
          department: form.department,
          designation: form.designation,
          remarks: form.remarks,
          voucher_file_url: form.voucher_file_url,
        },
        reason,
        user,
      });
      toast({
        title: 'Stock Out record updated',
        description: `Available stock for ${line.item_sn}: ${availableAtStart} → ${availableAfter}`,
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
          <DialogTitle>Edit Stock Out — {txn.item_sn}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border bg-slate-50/60 px-3 py-2 text-xs space-y-0.5">
            <p>
              <span className="text-muted-foreground">Recorded:</span>{' '}
              {txn.transaction_date} · {txn.item_sn} — {txn.item_name} · {txn.quantity_abs} {txn.unit}
              {txn.employee_name ? ` → ${txn.employee_name}` : ''}
            </p>
            <p><span className="text-muted-foreground">Issued by:</span> {txn.created_by_name || txn.created_by || '—'}</p>
            {documentLines > 1 && (
              <p className="text-[11px] text-amber-700 flex items-start gap-1 pt-0.5">
                <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                This line belongs to {form.iv_no ? `I/V ${form.iv_no}` : 'an issue voucher'} with {documentLines} lines — the
                I/V no., employee, site, store, date and remarks apply to the whole document.
              </p>
            )}
          </div>

          {/* ── Voucher header ── */}
          <div className="rounded-md border bg-slate-50/60 p-3 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Date</Label>
                <Input type="date" value={form.transaction_date}
                  onChange={e => setField({ transaction_date: e.target.value })} />
              </div>
              <div>
                <Label>I/V No.</Label>
                <Input value={form.iv_no} onChange={e => setField({ iv_no: e.target.value })} />
              </div>
              <div>
                <Label>Site</Label>
                <Select value={form.site} onValueChange={v => setField({ site: v })}>
                  <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                  <SelectContent>
                    {(sites || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
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
            </div>

            {/* Employee — kept linked to the Workforce personnel record */}
            <div className="relative">
              <Label>Employee (search by Name / PID / QID)</Label>
              <Input
                value={empSearch}
                onChange={e => {
                  setEmpSearch(e.target.value);
                  setEmpDropdownOpen(e.target.value.length >= 2);
                }}
                onFocus={() => empSearch.length >= 2 && setEmpDropdownOpen(true)}
                placeholder="Type at least 2 characters..."
              />
              {empDropdownOpen && empResults.length > 0 && (
                <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                  {empResults.map(emp => (
                    <button
                      key={emp.id}
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                      onClick={() => handleEmployeeSelect(emp)}
                    >
                      <span className="truncate flex-1">{emp.name}</span>
                      <span className="text-xs text-muted-foreground">
                        PID: {emp.pid || ''} {emp.company ? `• ${emp.company}` : ''}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <Label>Employee Name</Label>
                <Input value={form.employee_name} readOnly className="bg-slate-100" />
              </div>
              <div>
                <Label>PID No.</Label>
                <Input value={form.pid} readOnly className="bg-slate-100 font-mono" />
              </div>
              <div>
                <Label>Company</Label>
                <Input value={form.company} readOnly className="bg-slate-100" />
              </div>
              <div>
                <Label>Remarks</Label>
                <Input value={form.remarks} onChange={e => setField({ remarks: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Store Voucher</Label>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*,application/pdf" onChange={handleUpload}
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
                {uploading && <span className="text-xs text-muted-foreground">Uploading...</span>}
                {form.voucher_file_url && (
                  <a href={form.voucher_file_url} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Current voucher
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
                    item_id: item.id, item_sn: item.item_sn || '',
                    item_name: item.item_name || '', unit: item.unit || '',
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
                  onChange={e => setLineField({ quantity: e.target.value })}
                  className={`text-right ${over ? 'border-red-400' : ''}`} />
              </div>
              <div>
                <Label>Available (before → after)</Label>
                <Input value={`${availableAtStart} → ${availableAfter}`} readOnly className="bg-slate-100 text-right" />
              </div>
            </div>
            {over ? (
              <p className="text-[11px] font-semibold text-red-600 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Only {availableForTarget} {line.unit || ''} available for this item.
              </p>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                The difference is returned to stock on save (5 → 3 gives 2 back) — no second movement is recorded.
              </p>
            )}
          </div>

          <div>
            <Label>Reason for the change (optional)</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)}
              placeholder="Why this recorded issue is being corrected" />
          </div>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            Edited by {user?.full_name || user?.email || 'you'} — previous and new values are stored with the record.
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || over}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}