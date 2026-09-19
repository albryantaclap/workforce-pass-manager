import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertCircle, Info } from 'lucide-react';
import ExistingItemSearch from '@/components/inventory/ExistingItemSearch';
import { createItem, updateItem, fetchItemBySn, findSimilarItems } from '@/lib/inventoryService';

export default function InventoryItemFormModal({ open, onClose, onSaved, item, units, categories, user }) {
  const isExternalEdit = !!item; // Edit mode triggered from the items list
  const [selectedExisting, setSelectedExisting] = useState(null); // Selected from search dropdown
  const [similarItems, setSimilarItems] = useState([]);
  const [form, setForm] = useState({
    item_sn: '', item_name: '', unit: '', category: '',
    min_stock_level: 0, remarks: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // The active item being edited (from parent prop or selected from dropdown)
  const activeItem = item || selectedExisting;
  const isEdit = !!activeItem;

  useEffect(() => {
    if (item) {
      setSelectedExisting(null);
      setForm({
        item_sn: item.item_sn || '',
        item_name: item.item_name || '',
        unit: item.unit || '',
        category: item.category || '',
        min_stock_level: item.min_stock_level || 0,
        remarks: item.remarks || '',
      });
    } else {
      setSelectedExisting(null);
      setForm({ item_sn: '', item_name: '', unit: '', category: '', min_stock_level: 0, remarks: '' });
    }
    setError('');
    setSimilarItems([]);
  }, [item, open]);

  const handleSelectExisting = (existingItem) => {
    setSelectedExisting(existingItem);
    setForm({
      item_sn: existingItem.item_sn || '',
      item_name: existingItem.item_name || '',
      unit: existingItem.unit || '',
      category: existingItem.category || '',
      min_stock_level: existingItem.min_stock_level || 0,
      remarks: existingItem.remarks || '',
    });
    setError('');
    setSimilarItems([]);
  };

  const handleCreateNew = () => {
    setSelectedExisting(null);
    setForm({ item_sn: '', item_name: '', unit: '', category: '', min_stock_level: 0, remarks: '' });
    setError('');
    setSimilarItems([]);
  };

  const handleSubmit = async () => {
    if (!form.item_sn.trim() || !form.item_name.trim() || !form.unit.trim()) {
      setError('Item S.N., Item Name, and Unit are required.');
      return;
    }

    setSaving(true);
    setError('');
    setSimilarItems([]);

    try {
      const payload = {
        ...form,
        min_stock_level: Number(form.min_stock_level) || 0,
        updated_by: user?.email || '',
      };

      if (isEdit && activeItem) {
        // Update existing item (from parent prop or selected from dropdown)
        // Does NOT create a new record or affect stock quantities
        await updateItem(activeItem.id, payload);
        onSaved?.();
        onClose();
      } else {
        // Creating new — check duplicate S.N. (block)
        const existingBySn = await fetchItemBySn(form.item_sn.trim());
        if (existingBySn) {
          setError('Item already exists. Please select the existing item instead of creating a duplicate.');
          setSaving(false);
          return;
        }

        // Check similar item names (warn)
        const similar = await findSimilarItems(form.item_name.trim());
        if (similar.length > 0) {
          setSimilarItems(similar);
          setSaving(false);
          return; // Show warning — user must confirm or select an existing item
        }

        await createItem(payload);
        onSaved?.();
        onClose();
      }
    } catch (e) {
      setError(e.message || 'Failed to save item.');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmCreateAnyway = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = {
        ...form,
        min_stock_level: Number(form.min_stock_level) || 0,
        updated_by: user?.email || '',
      };
      await createItem(payload);
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
          <DialogTitle>
            {isEdit ? (isExternalEdit ? 'Edit Inventory Item' : 'Edit Selected Item') : 'Add Inventory Item'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Existing Item Search — only in Add mode */}
          {!isExternalEdit && (
            <div>
              <Label>Existing Item / Search Item</Label>
              <ExistingItemSearch
                selectedItem={selectedExisting}
                onSelectItem={handleSelectExisting}
                onCreateNew={handleCreateNew}
              />
              {selectedExisting && (
                <div className="flex items-start gap-1.5 mt-1.5">
                  <Info className="h-3 w-3 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Editing existing item — no new record will be created and stock quantities are unaffected.
                  </p>
                </div>
              )}
            </div>
          )}

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

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-red-50 border border-red-200">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Similar items warning */}
          {similarItems.length > 0 && (
            <div className="p-3 rounded-md bg-amber-50 border border-amber-200 space-y-2">
              <p className="text-sm font-medium text-amber-800">
                Similar items already exist. Consider selecting one instead:
              </p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {similarItems.map(si => (
                  <button
                    key={si.id}
                    type="button"
                    onClick={() => handleSelectExisting(si)}
                    className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-left hover:bg-amber-100 outline-none"
                  >
                    <span className="font-medium">{si.item_sn}</span>
                    {' — '}
                    {si.item_name}
                  </button>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={handleConfirmCreateAnyway} disabled={saving}>
                  Create Anyway
                </Button>
              </div>
            </div>
          )}
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