import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import DocumentLineItems, { blankLine } from '@/components/inventory/DocumentLineItems';
import { createInventoryDocument, searchEmployees, uploadInventoryFile } from '@/lib/inventoryService';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';

const emptyHeader = () => ({
  transaction_date: new Date().toISOString().slice(0, 10),
  iv_no: '', site: '', store: '', pid: '',
  employee_id: '', employee_name: '', company: '', department: '', designation: '',
  remarks: '', voucher_file_url: '',
});

/**
 * Issue Stock Out — one store issue voucher (I/V No.) with any number of item
 * lines. Every line is written under the same I/V as one document, and all
 * lines are validated against available stock before anything is saved.
 */
export default function StockOutFormModal({ open, onClose, onSaved, sites, stores, transactions = [], user }) {
  const [header, setHeader] = useState(emptyHeader());
  const [lines, setLines] = useState([blankLine()]);
  const [empSearch, setEmpSearch] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
      setHeader(emptyHeader());
      setLines([blankLine()]);
      setEmpSearch('');
      setEmpDropdownOpen(false);
      setSaving(false);
    }
  }, [open]);

  const { data: empResults = [] } = useQuery({
    queryKey: ['employee-search', empSearch],
    queryFn: () => searchEmployees(empSearch, 15),
    enabled: empSearch.length >= 2,
    staleTime: 10000,
  });

  const setField = (patch) => setHeader(h => ({ ...h, ...patch }));

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

  const handleSubmit = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await createInventoryDocument({
        document: {
          document_type: 'STOCK_OUT',
          document_date: header.transaction_date,
          document_no: header.iv_no,
          site: header.site,
          store: header.store,
          pid: header.pid,
          employee_id: header.employee_id,
          employee_name: header.employee_name,
          company: header.company,
          department: header.department,
          designation: header.designation,
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
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Issue Stock Out — Store Issue Voucher</DialogTitle>
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
            </div>

            {/* Employee — from the centralized Workforce personnel database */}
            <div className="relative">
              <Label>Employee (search by Name / PID / QID)</Label>
              <Input
                value={empSearch}
                onChange={e => {
                  setEmpSearch(e.target.value);
                  setEmpDropdownOpen(e.target.value.length >= 2);
                  if (e.target.value.length < 2) {
                    setField({ employee_id: '', employee_name: '', company: '', pid: '' });
                  }
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
                <Input value={header.employee_name} readOnly className="bg-slate-100" />
              </div>
              <div>
                <Label>PID No.</Label>
                <Input value={header.pid} readOnly className="bg-slate-100 font-mono" />
              </div>
              <div>
                <Label>Company</Label>
                <Input value={header.company} readOnly className="bg-slate-100" />
              </div>
              <div>
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
          </div>

          {/* ── Item lines ── */}
          <DocumentLineItems mode="out" lines={lines} onChange={setLines} transactions={transactions} />
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {lines.length} item{lines.length === 1 ? '' : 's'} · total quantity {totalQty}
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