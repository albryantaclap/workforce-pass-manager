import React, { useState, useMemo } from 'react';
import InventorySubmenuNav from '@/components/common/InventorySubmenuNav';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Pencil, Archive, ArchiveRestore, Upload, Download } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { archiveItem, unarchiveItem, calculateAvailableStock, getStockStatus } from '@/lib/inventoryService';
import { exportItemsExcel } from '@/lib/inventoryExcelExport';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import InventoryItemFormModal from '@/components/inventory/InventoryItemFormModal';
import InventoryImportDialog from '@/components/inventory/InventoryImportDialog';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';
import MultiSelect from '@/components/common/MultiSelect';
import { InventoryFilterPanel, FilterField, FilterNumberRange, FilterDateRange } from '@/components/inventory/InventoryFilterPanel';

export default function InventoryItems() {
  const { items, transactions, getLookupOptions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useCurrentUser();
  const { can } = useRbac();

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [unitFilter, setUnitFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [hasTxnFilter, setHasTxnFilter] = useState('');
  const [minStockMin, setMinStockMin] = useState('');
  const [minStockMax, setMinStockMax] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');
  const [updatedFrom, setUpdatedFrom] = useState('');
  const [updatedTo, setUpdatedTo] = useState('');

  const categories = getLookupOptions('item_category');
  const units = getLookupOptions('unit');

  // Precompute which items have transactions
  const itemTxnMap = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.is_deleted) continue;
      map[t.item_id] = (map[t.item_id] || 0) + 1;
    }
    return map;
  }, [transactions]);

  const refresh = () => {
    queryClient.invalidateQueries(['inventory-items']);
    queryClient.invalidateQueries(['inventory-transactions']);
  };

  const filtered = useMemo(() => {
    let result = items;
    if (!showArchived) result = result.filter(i => !i.is_archived);

    // General search across S.N., Name, Category, Unit
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        (i.item_sn || '').toLowerCase().includes(q) ||
        (i.item_name || '').toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q) ||
        (i.unit || '').toLowerCase().includes(q)
      );
    }

    // Category multi-select
    if (categoryFilter.length > 0) {
      result = result.filter(i => categoryFilter.includes(i.category));
    }

    // Unit multi-select
    if (unitFilter.length > 0) {
      result = result.filter(i => unitFilter.includes(i.unit));
    }

    // Stock status
    if (statusFilter) {
      result = result.filter(i => {
        const available = calculateAvailableStock(transactions, i.id);
        const status = getStockStatus(available, i.min_stock_level);
        if (statusFilter === 'In Stock') return status === 'Available';
        return status === statusFilter;
      });
    }

    // Has transactions
    if (hasTxnFilter) {
      result = result.filter(i => {
        const hasTxn = (itemTxnMap[i.id] || 0) > 0;
        return hasTxnFilter === 'yes' ? hasTxn : !hasTxn;
      });
    }

    // Min stock level range
    if (minStockMin !== '' || minStockMax !== '') {
      result = result.filter(i => {
        const min = i.min_stock_level || 0;
        if (minStockMin !== '' && min < Number(minStockMin)) return false;
        if (minStockMax !== '' && min > Number(minStockMax)) return false;
        return true;
      });
    }

    // Created date range
    if (createdFrom) result = result.filter(i => (i.created_date || '') >= createdFrom);
    if (createdTo) result = result.filter(i => (i.created_date || '') <= createdTo);

    // Updated date range
    if (updatedFrom) result = result.filter(i => (i.updated_date || '') >= updatedFrom);
    if (updatedTo) result = result.filter(i => (i.updated_date || '') <= updatedTo);

    return result.sort((a, b) => (a.item_sn || '').localeCompare(b.item_sn || ''));
  }, [items, transactions, search, showArchived, categoryFilter, unitFilter, statusFilter, hasTxnFilter, minStockMin, minStockMax, createdFrom, createdTo, updatedFrom, updatedTo, itemTxnMap]);

  const allFilterDeps = [search, showArchived, categoryFilter, unitFilter, statusFilter, hasTxnFilter, minStockMin, minStockMax, createdFrom, createdTo, updatedFrom, updatedTo];
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, allFilterDeps);
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  const activeFilterCount = [
    categoryFilter.length > 0,
    unitFilter.length > 0,
    statusFilter !== '',
    hasTxnFilter !== '',
    minStockMin !== '' || minStockMax !== '',
    createdFrom !== '' || createdTo !== '',
    updatedFrom !== '' || updatedTo !== '',
  ].filter(Boolean).length;

  const isFiltered = !!(search || showArchived || activeFilterCount > 0);

  const clearFilters = () => {
    setCategoryFilter([]);
    setUnitFilter([]);
    setStatusFilter('');
    setHasTxnFilter('');
    setMinStockMin('');
    setMinStockMax('');
    setCreatedFrom('');
    setCreatedTo('');
    setUpdatedFrom('');
    setUpdatedTo('');
  };

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
      <InventorySubmenuNav />
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
            placeholder="Search by S.N., name, category, or unit..."
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

      <InventoryFilterPanel
        activeCount={activeFilterCount}
        onClear={clearFilters}
        totalFiltered={filtered.length}
        totalAll={items.filter(i => !i.is_archived).length}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <FilterField label="Category">
            <MultiSelect options={categories.map(c => ({ value: c.value, label: c.label }))} value={categoryFilter} onChange={setCategoryFilter} placeholder="All Categories" />
          </FilterField>
          <FilterField label="Unit / UOM">
            <MultiSelect options={units.map(u => ({ value: u.value, label: u.label }))} value={unitFilter} onChange={setUnitFilter} placeholder="All Units" />
          </FilterField>
          <FilterField label="Stock Status">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All Status</SelectItem>
                <SelectItem value="In Stock">In Stock</SelectItem>
                <SelectItem value="Low Stock">Low Stock</SelectItem>
                <SelectItem value="Out of Stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Has Transactions">
            <Select value={hasTxnFilter} onValueChange={setHasTxnFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All</SelectItem>
                <SelectItem value="yes">Yes — Has Transactions</SelectItem>
                <SelectItem value="no">No — No Transactions</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Min Stock Level">
            <FilterNumberRange min={minStockMin} max={minStockMax} onMin={setMinStockMin} onMax={setMinStockMax} />
          </FilterField>
          <FilterField label="Created Date">
            <FilterDateRange from={createdFrom} to={createdTo} onFrom={setCreatedFrom} onTo={setCreatedTo} />
          </FilterField>
          <FilterField label="Last Updated">
            <FilterDateRange from={updatedFrom} to={updatedTo} onFrom={setUpdatedFrom} onTo={setUpdatedTo} />
          </FilterField>
        </div>
      </InventoryFilterPanel>

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
              {pageData.map(item => {
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
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          totalRecords={filtered.length}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
          isFiltered={isFiltered}
        />
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