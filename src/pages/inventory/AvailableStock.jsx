import React, { useState, useMemo } from 'react';
import InventorySubmenuNav from '@/components/common/InventorySubmenuNav';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Eye } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { calculateAvailableStock, calculateStockIn, calculateStockOut, getStockStatus } from '@/lib/inventoryService';
import { exportAvailableStockExcel } from '@/lib/inventoryExcelExport';
import { useRbac } from '@/lib/useRbac';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';
import MultiSelect from '@/components/common/MultiSelect';
import { InventoryFilterPanel, FilterField, FilterNumberRange } from '@/components/inventory/InventoryFilterPanel';
import WarrantyDetailsDialog from '@/components/inventory/WarrantyDetailsDialog';
import { useWarrantySetting } from '@/hooks/useWarrantySetting';
import { indexWarrantiesByItem, summarizeItemWarranty, warrantyStatusClasses } from '@/lib/warranty';

export default function AvailableStock() {
  const { items, transactions, warranties, getLookupOptions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [warrantyItem, setWarrantyItem] = useState(null);
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const warningDays = useWarrantySetting();
  const { can } = useRbac();

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [unitFilter, setUnitFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [availMin, setAvailMin] = useState('');
  const [availMax, setAvailMax] = useState('');
  const [minLevelMin, setMinLevelMin] = useState('');
  const [minLevelMax, setMinLevelMax] = useState('');
  const [hasStockInFilter, setHasStockInFilter] = useState('');
  const [hasStockOutFilter, setHasStockOutFilter] = useState('');

  const categories = getLookupOptions('item_category');
  const units = getLookupOptions('unit');

  // Precompute which items have stock in / stock out
  const hasStockInMap = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.is_deleted) continue;
      if (t.transaction_type === 'STOCK_IN') map[t.item_id] = true;
    }
    return map;
  }, [transactions]);

  const hasStockOutMap = useMemo(() => {
    const map = {};
    for (const t of transactions) {
      if (t.is_deleted) continue;
      if (t.transaction_type === 'STOCK_OUT') map[t.item_id] = true;
    }
    return map;
  }, [transactions]);

  const rows = useMemo(() => {
    let result = items.filter(i => !i.is_archived);

    // Warranty comes from the actual receipts (batches) and serialized assets —
    // never from the Item Master. An item's row summarises its batches; the
    // details dialog lists each receipt/serial with its own warranty.
    const warrantyIndex = indexWarrantiesByItem(warranties);

    result = result.map(item => {
      const stockIn = calculateStockIn(transactions, item.id);
      const stockOut = calculateStockOut(transactions, item.id);
      const available = calculateAvailableStock(transactions, item.id);
      const status = getStockStatus(available, item.min_stock_level);
      const warranty = summarizeItemWarranty(warrantyIndex.get(item.id) || [], warningDays);
      return {
        ...item,
        stockIn, stockOut, available, status, warranty,
        values: [
          item.item_sn, item.item_name, item.unit, stockIn, stockOut, available,
          item.min_stock_level || 0, status, warranty.status, warranty.expiry || '',
        ],
      };
    });

    // General search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.item_sn || '').toLowerCase().includes(q) ||
        (r.item_name || '').toLowerCase().includes(q)
      );
    }

    // Category
    if (categoryFilter.length > 0) {
      result = result.filter(r => categoryFilter.includes(r.category));
    }

    // Unit
    if (unitFilter.length > 0) {
      result = result.filter(r => unitFilter.includes(r.unit));
    }

    // Stock status
    if (statusFilter) {
      result = result.filter(r => r.status === statusFilter);
    }

    // Available quantity range
    if (availMin !== '' || availMax !== '') {
      result = result.filter(r => {
        if (availMin !== '' && r.available < Number(availMin)) return false;
        if (availMax !== '' && r.available > Number(availMax)) return false;
        return true;
      });
    }

    // Min stock level range
    if (minLevelMin !== '' || minLevelMax !== '') {
      result = result.filter(r => {
        const min = r.min_stock_level || 0;
        if (minLevelMin !== '' && min < Number(minLevelMin)) return false;
        if (minLevelMax !== '' && min > Number(minLevelMax)) return false;
        return true;
      });
    }

    // Has stock in
    if (hasStockInFilter) {
      result = result.filter(r => {
        const has = hasStockInMap[r.id];
        return hasStockInFilter === 'yes' ? has : !has;
      });
    }

    // Has stock out
    if (hasStockOutFilter) {
      result = result.filter(r => {
        const has = hasStockOutMap[r.id];
        return hasStockOutFilter === 'yes' ? has : !has;
      });
    }

    return result.sort((a, b) => (a.item_sn || '').localeCompare(b.item_sn || ''));
  }, [items, transactions, warranties, warningDays, search, categoryFilter, unitFilter, statusFilter, availMin, availMax, minLevelMin, minLevelMax, hasStockInFilter, hasStockOutFilter, hasStockInMap, hasStockOutMap]);

  const allFilterDeps = [search, categoryFilter, unitFilter, statusFilter, availMin, availMax, minLevelMin, minLevelMax, hasStockInFilter, hasStockOutFilter];
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, allFilterDeps);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = rows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  const activeFilterCount = [
    categoryFilter.length > 0,
    unitFilter.length > 0,
    statusFilter !== '',
    availMin !== '' || availMax !== '',
    minLevelMin !== '' || minLevelMax !== '',
    hasStockInFilter !== '',
    hasStockOutFilter !== '',
  ].filter(Boolean).length;

  const isFiltered = !!(search || activeFilterCount > 0);

  const clearFilters = () => {
    setCategoryFilter([]);
    setUnitFilter([]);
    setStatusFilter('');
    setAvailMin(''); setAvailMax('');
    setMinLevelMin(''); setMinLevelMax('');
    setHasStockInFilter('');
    setHasStockOutFilter('');
  };

  return (
    <div className="p-6 space-y-4">
      <InventorySubmenuNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Available Stock</h1>
          <p className="text-sm text-muted-foreground mt-1">Dynamically calculated: Available = SUM(Stock In) − SUM(Stock Out)</p>
        </div>
        {can('inventory.available_stock.export') && (
          <Button variant="outline" onClick={() => exportAvailableStockExcel(rows)}>
            <Download className="w-4 h-4" /> Export
          </Button>
        )}
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by S.N. or name..." className="pl-9" />
      </div>

      <InventoryFilterPanel
        activeCount={activeFilterCount}
        onClear={clearFilters}
        totalFiltered={rows.length}
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
                <SelectItem value="Available">In Stock</SelectItem>
                <SelectItem value="Low Stock">Low Stock</SelectItem>
                <SelectItem value="Out of Stock">Out of Stock</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Available Quantity">
            <FilterNumberRange min={availMin} max={availMax} onMin={setAvailMin} onMax={setAvailMax} />
          </FilterField>
          <FilterField label="Min Stock Level">
            <FilterNumberRange min={minLevelMin} max={minLevelMax} onMin={setMinLevelMin} onMax={setMinLevelMax} />
          </FilterField>
          <FilterField label="Has Stock In">
            <Select value={hasStockInFilter} onValueChange={setHasStockInFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All</SelectItem>
                <SelectItem value="yes">Yes — Has Stock In</SelectItem>
                <SelectItem value="no">No — No Stock In</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>
          <FilterField label="Has Stock Out">
            <Select value={hasStockOutFilter} onValueChange={setHasStockOutFilter}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={null}>All</SelectItem>
                <SelectItem value="yes">Yes — Has Stock Out</SelectItem>
                <SelectItem value="no">No — No Stock Out</SelectItem>
              </SelectContent>
            </Select>
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
                <TableHead className="w-20 text-right">Stock In</TableHead>
                <TableHead className="w-20 text-right">Stock Out</TableHead>
                <TableHead className="w-20 text-right">Available</TableHead>
                <TableHead className="w-20 text-right">Min Level</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-32">Warranty Status</TableHead>
                <TableHead className="w-24">Warranty Expiry</TableHead>
                <TableHead className="w-24 text-center">Warranty</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-semibold">{r.item_sn}</TableCell>
                  <TableCell className="font-medium">{r.item_name}</TableCell>
                  <TableCell>{r.unit}</TableCell>
                  <TableCell className="text-right text-green-600">{r.stockIn}</TableCell>
                  <TableCell className="text-right text-orange-600">{r.stockOut}</TableCell>
                  <TableCell className="text-right font-bold">{r.available}</TableCell>
                  <TableCell className="text-right">{r.min_stock_level || 0}</TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${
                      r.status === 'Available' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      r.status === 'Low Stock' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-red-50 text-red-700 border-red-200'
                    }`}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold border ${warrantyStatusClasses(r.warranty.status)}`}>
                      {r.warranty.status}
                    </span>
                    {r.warranty.applicable && (
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {r.warranty.batchCount > 0 ? `${r.warranty.batchCount} batch ` : ''}
                        {r.warranty.serialCount > 0 ? `${r.warranty.serialCount} serial ` : ''}
                        record{r.warranty.batchCount + r.warranty.serialCount === 1 ? '' : 's'}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">{r.warranty.expiry || '—'}</TableCell>
                  <TableCell className="text-center">
                    <Button size="sm" variant="outline" className="h-7 text-xs"
                      onClick={() => { setWarrantyItem(r); setWarrantyOpen(true); }}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
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
          totalRecords={rows.length}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
          isFiltered={isFiltered}
        />
      </Card>

      <WarrantyDetailsDialog
        open={warrantyOpen}
        onClose={() => setWarrantyOpen(false)}
        item={warrantyItem}
        rows={warranties}
        warningDays={warningDays}
      />
    </div>
  );
}