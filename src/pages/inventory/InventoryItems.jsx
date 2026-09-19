import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Archive, ArchiveRestore, Upload, Download, Eye } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { archiveItem, unarchiveItem, fetchTransactions, calculateAvailableStock, getStockStatus } from '@/lib/inventoryService';
import { exportItemsExcel } from '@/lib/inventoryExcelExport';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import InventoryItemFormModal from '@/components/inventory/InventoryItemFormModal';
import InventoryImportDialog from '@/components/inventory/InventoryImportDialog';

export default function InventoryItems() {
  const { items, transactions, getLookupOptions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useCurrentUser();
  const { can } = useRbac();

  const refresh = () => {
    queryClient.invalidateQueries(['inventory-items']);
    queryClient.invalidateQueries(['inventory-transactions']);
  };

  const filtered = useMemo(() => {
    let result = items;
    if (!showArchived) result = result.filter(i => !i.is_archived);
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        (i.item_sn || '').toLowerCase().includes(q) ||
        (i.item_name || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
      );
    }
    return result.sort((a, b) => (a.item_sn || '').localeCompare(b.item_sn || ''));
  }, [items, search, showArchived]);

  const handleArchive = async (item) => {
    if (!confirm(`Archive item "${item.item_sn} — ${item.item_name}"? It will be hidden from active lists but retained for history.`)) return;
    try {
      await archiveItem(item.id, user?.email);
      toast({ title: 'Item archived' });
      refresh();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const handleUnarchive = async (item) => {
    try {
      await unarchiveItem(item.id, user?.email);
      toast({ title: 'Item restored' });
      refresh();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const getAvailable = (itemId) => calculateAvailableStock(transactions, itemId);
  const getStatus = (item) => getStockStatus(getAvailable(item.id), item.min_stock_level);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Items</h1>
          <p className="text-sm text-muted-foreground mt-1">Master list of all inventory items</p>
        </div>
        <div className="flex gap-2">
          {can('inventory.items.import') && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload className="w-4 h-4" /> Import
            </Button>
          )}
          {can('inventory.items.export') && (
            <Button variant="outline" onClick={() => exportItemsExcel(filtered)}>
              <Download className="w-4 h-4" /> Export
            </Button>
          )}
          {can('inventory.items.add') && (
            <Button onClick={() => { setEditItem(null); setModalOpen(true); }}>
              <Plus className="w-4 h-4" /> Add Item
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by S.N., name, or category..."
            className="pl-9"
          />
        </div>
        <Button
          variant={showArchived ? 'default' : 'outline'}
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Showing Archived' : 'Show Archived'}
        </Button>
      </div>

      <Card className="border-slate-200">
        <div className="table-scroll-x">
          <Table className="table-list-view">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-24">Item S.N.</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead className="w-16">Unit</TableHead>
                <TableHead className="w-28">Category</TableHead>
                <TableHead className="w-20 text-right">Min Stock</TableHead>
                <TableHead className="w-20 text-right">Available</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => {
                const available = getAvailable(item.id);
                const status = getStatus(item);
                return (
                  <TableRow key={item.id} className={item.is_archived ? 'opacity-50' : ''}>
                    <TableCell className="font-mono font-semibold">{item.item_sn}</TableCell>
                    <TableCell className="font-medium">{item.item_name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{item.category || '—'}</TableCell>
                    <TableCell className="text-right">{item.min_stock_level || 0}</TableCell>
                    <TableCell className="text-right font-bold">{available}</TableCell>
                    <TableCell>
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                        status === 'Available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                        status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                        'bg-red-50 text-red-700 border-red-200'
                      }`}>
                        {status}
                      </span>
                      {item.is_archived && <span className="ml-1 text-[10px] text-muted-foreground">(Archived)</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {can('inventory.items.edit') && !item.is_archived && (
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => { setEditItem(item); setModalOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {item.is_archived ? (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUnarchive(item)}>
                            <ArchiveRestore className="w-3.5 h-3.5" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleArchive(item)}>
                            <Archive className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No items found.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <InventoryItemFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        item={editItem}
        units={getLookupOptions('unit')}
        categories={getLookupOptions('item_category')}
        user={user}
      />
      <InventoryImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={refresh}
        user={user}
      />
    </div>
  );
}