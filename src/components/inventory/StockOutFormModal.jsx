import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import SearchableSelect from '@/components/common/SearchableSelect';
import { createStockOut, fetchTransactions, calculateAvailableStock, searchEmployees } from '@/lib/inventoryService';
import { useToast } from '@/components/ui/use-toast';
import { useQuery } from '@tanstack/react-query';

export default function StockOutFormModal({ open, onClose, onSaved, items, sites, stores, user }) {
  const [form, setForm] = useState({
    transaction_date: new Date().toISOString().slice(0, 10),
    item_id: '', item_sn: '', item_name: '', unit: '', available: 0,
    iv_no: '', site: '', store: '', pid: '',
    employee_id: '', employee_name: '', company: '', department: '', designation: '',
    quantity: '', remarks: '',
  });
  const [empSearch, setEmpSearch] = useState('');
  const [empDropdownOpen, setEmpDropdownOpen] = useState(false);
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
        iv_no: '', site: '', store: '', pid: '',
        employee_id: '', employee_name: '', company: '', department: '', designation: '',
        quantity: '', remarks: '',
      });
      setEmpSearch('');
      setEmpDropdownOpen(false);
    }
  }, [open]);

  const { data: empResults = [] } = useQuery({
    queryKey: ['employee-search', empSearch],
    queryFn: () => searchEmployees(empSearch, 15),
    enabled: empSearch.length >= 2,
    staleTime: 10000,
  });

  const handleItemSelect = (itemId) => {
    const item = items.find(i => i.id === itemId);
    if (item) {
      setForm(f => ({
        ...f, item_id: item.id, item_sn: item.item_sn,
        item_name: item.item_name, unit: item.unit,
      }));
    }
  };

  const handleEmployeeSelect = (emp) => {
    setForm(f => ({
      ...f,
      pid: String(emp.pid || ''),
      employee_id: emp.id,
      employee_name: emp.name,
      company: emp.company || '',
      department: emp.department || '',
      designation: emp.position_application || emp.designation_org_chart || '',
    }));
    setEmpSearch(`${emp.name} — PID: ${emp.pid || ''}`);
    setEmpDropdownOpen(false);
  };

  const handleSubmit = async () => {
    if (!form.item_id || !form.quantity || Number(form.quantity) <= 0) {
      toast({ title: 'Item and quantity are required', variant: 'destructive' });
      return;
    }
    if (Number(form.quantity) > form.available) {
      toast({
        title: `Insufficient stock. Available quantity: ${form.available} ${form.unit || ''}`.trim(),
        variant: 'destructive',
      });
      return;
    }
    setSaving(true);
    try {
      await createStockOut({
        transaction_date: form.transaction_date,
        item_id: form.item_id,
        quantity: Number(form.quantity),
        iv_no: form.iv_no, site: form.site, store: form.store,
        pid: form.pid, employee_id: form.employee_id,
        employee_name: form.employee_name, company: form.company,
        department: form.department, designation: form.designation,
        remarks: form.remarks,
      }, user);
      toast({ title: 'Stock Out recorded successfully' });
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
          <DialogTitle>Issue Stock Out</DialogTitle>
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
              <Label>I/V No.</Label>
              <Input value={form.iv_no} onChange={e => setForm({ ...form, iv_no: e.target.value })} />
            </div>
            <div>
              <Label>Site</Label>
              <Select value={form.site} onValueChange={v => setForm({ ...form, site: v })}>
                <SelectTrigger><SelectValue placeholder="Select site" /></SelectTrigger>
                <SelectContent>
                  {(sites || []).map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* Employee search — async dropdown */}
          <div className="relative">
            <Label>Employee (search by Name / PID / QID)</Label>
            <Input
              value={empSearch}
              onChange={e => {
                setEmpSearch(e.target.value);
                setEmpDropdownOpen(e.target.value.length >= 2);
                if (e.target.value.length < 2) {
                  setForm(f => ({ ...f, employee_id: '', employee_name: '', company: '', pid: '' }));
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Employee Name</Label>
              <Input value={form.employee_name} readOnly className="bg-slate-50" />
            </div>
            <div>
              <Label>Company</Label>
              <Input value={form.company} readOnly className="bg-slate-50" />
            </div>
          </div>
          <div>
            <Label>Quantity *</Label>
            <Input type="number" min="1" value={form.quantity}
              onChange={e => setForm({ ...form, quantity: e.target.value })} />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : 'Issue Stock'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}