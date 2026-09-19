import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export default function InventoryItemFormModal({ open, onClose, onSaved, item, units, categories, user }) {
  const isEdit = !!item;
  const [form, setForm] = useState({
    item_sn: '', item_name: '', unit: '', category: '',
    min_stock_level: 0, remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (item) {
      setForm({
        item_sn: item.item_sn || '',
        item_name: item.item_name || '',
        unit: item.unit || '',
        category: item.category || '',
        min_stock_level: item.min_stock_level || 0,
        remarks: item.remarks || '',
      });
    } else {
      setForm({ item_sn: '', item_name: '', unit: '', category: '', min_stock_level: 0, remarks: '' });
    }
    setError('');
  }, [item, open]);

  const handleSubmit = async () => {
    if (!form.item_sn.trim() || !form.item_name.trim() || !form.unit.trim()) {
      setError('Item S.N., Item Name, and Unit are required.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const { createItem, updateItem } = await import('@/lib/inventoryService');
      const payload = {
        ...form,
        min_stock_level: Number(form.min_stock_level) || 0,
        updated_by: user?.email || '',
      };
      if (isEdit) {
        await updateItem(item.id, payload);
      } else {
        await createItem(payload);
      }
      onSaved?.();
      onClose();
    } catch (e) {
      setError(e.message || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Inventory Item' : 'Add Inventory Item'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Item S.N. *</Label>
            <Input value={form.item_sn} onChange={e => setForm({ ...form, item_sn: e.target.value })}
              placeholder="e.g. GSOQ-001" disabled={isEdit} />
          </div>
          <div>
            <Label>Item Name / Description *</Label>
            <Input value={form.item_name} onChange={e => setForm({ ...form, item_name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unit / UOM *</Label>
              <Select value={form.unit} onValueChange={v => setForm({ ...form, unit: v })}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {(units || []).map(u => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                <SelectContent>
                  {(categories || []).map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Minimum Stock Level</Label>
            <Input type="number" min="0" value={form.min_stock_level}
              onChange={e => setForm({ ...form, min_stock_level: e.target.value })} />
          </div>
          <div>
            <Label>Remarks</Label>
            <Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })}
              rows={2} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? 'Saving...' : isEdit ? 'Update' : 'Add Item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}