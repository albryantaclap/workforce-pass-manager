import React, { useState, useMemo } from 'react';
import InventorySubmenuNav from '@/components/common/InventorySubmenuNav';
import PrintPageButton from '@/components/inventory/PrintPageButton';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Download } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { exportStockInExcel } from '@/lib/inventoryExcelExport';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import StockInFormModal from '@/components/inventory/StockInFormModal';
import StockInEditDialog from '@/components/inventory/StockInEditDialog';
import TransactionActions from '@/components/inventory/TransactionActions';
import WarrantyDetailsDialog from '@/components/inventory/WarrantyDetailsDialog';
import { warrantiesForTransaction } from '@/lib/inventoryCorrections';
import { useWarrantySetting } from '@/hooks/useWarrantySetting';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';
import MultiSelect from '@/components/common/MultiSelect';
import SearchableSelect from '@/components/common/SearchableSelect';
import { InventoryFilterPanel, FilterField, FilterNumberRange, FilterDateRange } from '@/components/inventory/InventoryFilterPanel';

export default function StockIn() {
  const { items, transactions, warranties, getLookupOptions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTxn, setEditTxn] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [warrantyTxn, setWarrantyTxn] = useState(null);
  const [warrantyOpen, setWarrantyOpen] = useState(false);
  const warningDays = useWarrantySetting();
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { can } = useRbac();

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [unitFilter, setUnitFilter] = useState([]);
  const [dnNoSearch, setDnNoSearch] = useState('');
  const [mrfNoSearch, setMrfNoSearch] = useState('');
  const [lpoSearch, setLpoSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState([]);
  const [storeFilter, setStoreFilter] = useState([]);
  const [qtyMin, setQtyMin] = useState('');
  const [qtyMax, setQtyMax] = useState('');
  const [recordedByFilter, setRecordedByFilter] = useState('');
  const [remarksSearch, setRemarksSearch] = useState('');
  const [createdFrom, setCreatedFrom] = useState('');
  const [createdTo, setCreatedTo] = useState('');

  const categories = getLookupOptions('item_category');
  const units = getLookupOptions('unit');
  const suppliers = getLookupOptions('supplier');
  const stores = getLookupOptions('store');

  // Build item map for category join
  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  // Build recorded-by options from distinct created_by_name values
  const recordedByOptions = useMemo(() => {
    const set = new Set();
    for (const t of transactions) {
      if (t.transaction_type !== 'STOCK_IN' || t.is_deleted) continue;
      const name = t.created_by_name || t.created_by;
      if (name) set.add(name);
    }
    return [...set].sort().map(v => ({ value: v, label: v }));
  }, [transactions]);

  const refresh = () => queryClient.invalidateQueries(['inventory-transactions']);

  const filtered = useMemo(() => {
    let result = transactions.filter(t => t.transaction_type === 'STOCK_IN' && !t.is_deleted);

    // General search
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.item_sn || '').toLowerCase().includes(q) ||
        (t.item_name || '').toLowerCase().includes(q) ||
        (t.dn_no || '').toLowerCase().includes(q) ||
        (t.supplier || '').toLowerCase().includes(q)
      );
    }

    // Date range
    if (dateFrom) result = result.filter(t => t.transaction_date >= dateFrom);
    if (dateTo) result = result.filter(t => t.transaction_date <= dateTo);

    // Category (join via item map)
    if (categoryFilter.length > 0) {
      result = result.filter(t => {
        const item = itemMap.get(t.item_id);
        return item && categoryFilter.includes(item.category);
      });
    }

    // Unit
    if (unitFilter.length > 0) {
      result = result.filter(t => unitFilter.includes(t.unit));
    }

    // D/N No.
    if (dnNoSearch) {
      const q = dnNoSearch.toLowerCase();
      result = result.filter(t => (t.dn_no || '').toLowerCase().includes(q));
    }

    // MRF No.
    if (mrfNoSearch) {
      const q = mrfNoSearch.toLowerCase();
      result = result.filter(t => (t.mrf_no || '').toLowerCase().includes(q));
    }

    // LPO
    if (lpoSearch) {
      const q = lpoSearch.toLowerCase();
      result = result.filter(t => (t.lpo || '').toLowerCase().includes(q));
    }

    // Supplier
    if (supplierFilter.length > 0) {
      result = result.filter(t => supplierFilter.includes(t.supplier));
    }

    // Store
    if (storeFilter.length > 0) {
      result = result.filter(t => storeFilter.includes(t.store));
    }

    // Quantity range
    if (qtyMin !== '' || qtyMax !== '') {
      result = result.filter(t => {
        const qty = t.quantity_abs || 0;
        if (qtyMin !== '' && qty < Number(qtyMin)) return false;
        if (qtyMax !== '' && qty > Number(qtyMax)) return false;
        return true;
      });
    }

    // Recorded by
    if (recordedByFilter) {
      result = result.filter(t => (t.created_by_name || t.created_by) === recordedByFilter);
    }

    // Remarks
    if (remarksSearch) {
      const q = remarksSearch.toLowerCase();
      result = result.filter(t => (t.remarks || '').toLowerCase().includes(q));
    }

    // Created date range
    if (createdFrom) result = result.filter(t => (t.created_date || '') >= createdFrom);
    if (createdTo) result = result.filter(t => (t.created_date || '') <= createdTo);

    return result.sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || ''));
  }, [transactions, search, dateFrom, dateTo, categoryFilter, unitFilter, dnNoSearch, mrfNoSearch, lpoSearch, supplierFilter, storeFilter, qtyMin, qtyMax, recordedByFilter, remarksSearch, createdFrom, createdTo, itemMap]);

  const allFilterDeps = [search, dateFrom, dateTo, categoryFilter, unitFilter, dnNoSearch, mrfNoSearch, lpoSearch, supplierFilter, storeFilter, qtyMin, qtyMax, recordedByFilter, remarksSearch, createdFrom, createdTo];
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, allFilterDeps);
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  const activeFilterCount = [
    dateFrom !== '' || dateTo !== '',
    categoryFilter.length > 0,
    unitFilter.length > 0,
    dnNoSearch !== '',
    mrfNoSearch !== '',
    lpoSearch !== '',
    supplierFilter.length > 0,
    storeFilter.length > 0,
    qtyMin !== '' || qtyMax !== '',
    recordedByFilter !== '',
    remarksSearch !== '',
    createdFrom !== '' || createdTo !== '',
  ].filter(Boolean).length;

  const isFiltered = !!(search || activeFilterCount > 0);

  const clearFilters = () => {
    setDateFrom(''); setDateTo('');
    setCategoryFilter([]); setUnitFilter([]);
    setDnNoSearch(''); setMrfNoSearch(''); setLpoSearch('');
    setSupplierFilter([]); setStoreFilter([]);
    setQtyMin(''); setQtyMax('');
    setRecordedByFilter('');
    setRemarksSearch('');
    setCreatedFrom(''); setCreatedTo('');
  };

  return (
    <div className="p-6 space-y-4">
      <InventorySubmenuNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock In</h1>
          <p className="text-sm text-muted-foreground mt-1">Record received stock — adds to available inventory</p>
        </div>
        <div className="flex gap-2">
          <PrintPageButton title="Stock In" />
          {can('inventory.stock_in.export') && (
            <Button variant="outline" onClick={() => exportStockInExcel(filtered)}>
              <Download className="w-4 h-4" /> Export
            </Button>
          )}
          {can('inventory.stock_in.add') && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" /> Record Stock In
            </Button>
          )}
        </div>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by S.N., name, D/N no., or supplier..." className="pl-9" />
      </div>

      <InventoryFilterPanel
        activeCount={activeFilterCount}
        onClear={clearFilters}
        totalFiltered={filtered.length}
        totalAll={transactions.filter(t => t.transaction_type === 'STOCK_IN' && !t.is_deleted).length}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <FilterField label="Date Received">
            <FilterDateRange from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
          </FilterField>
          <FilterField label="Category">
            <MultiSelect options={categories.map(c => ({ value: c.value, label: c.label }))} value={categoryFilter} onChange={setCategoryFilter} placeholder="All Categories" />
          </FilterField>
          <FilterField label="Unit / UOM">
            <MultiSelect options={units.map(u => ({ value: u.value, label: u.label }))} value={unitFilter} onChange={setUnitFilter} placeholder="All Units" />
          </FilterField>
          <FilterField label="D/N No.">
            <Input value={dnNoSearch} onChange={e => setDnNoSearch(e.target.value)} placeholder="Search D/N No..." className="h-8 text-xs" />
          </FilterField>
          <FilterField label="MRF No.">
            <Input value={mrfNoSearch} onChange={e => setMrfNoSearch(e.target.value)} placeholder="Search MRF No..." className="h-8 text-xs" />
          </FilterField>
          <FilterField label="LPO">
            <Input value={lpoSearch} onChange={e => setLpoSearch(e.target.value)} placeholder="Search LPO..." className="h-8 text-xs" />
          </FilterField>
          <FilterField label="Supplier">
            <MultiSelect options={suppliers.map(s => ({ value: s.value, label: s.label }))} value={supplierFilter} onChange={setSupplierFilter} placeholder="All Suppliers" />
          </FilterField>
          <FilterField label="Store">
            <MultiSelect options={stores.map(s => ({ value: s.value, label: s.label }))} value={storeFilter} onChange={setStoreFilter} placeholder="All Stores" />
          </FilterField>
          <FilterField label="Quantity">
            <FilterNumberRange min={qtyMin} max={qtyMax} onMin={setQtyMin} onMax={setQtyMax} />
          </FilterField>
          <FilterField label="Recorded By">
            <SearchableSelect value={recordedByFilter} onChange={setRecordedByFilter} options={recordedByOptions} placeholder="All Users" />
          </FilterField>
          <FilterField label="Remarks">
            <Input value={remarksSearch} onChange={e => setRemarksSearch(e.target.value)} placeholder="Search remarks..." className="h-8 text-xs" />
          </FilterField>
          <FilterField label="Created Date">
            <FilterDateRange from={createdFrom} to={createdTo} onFrom={setCreatedFrom} onTo={setCreatedTo} />
          </FilterField>
        </div>
      </InventoryFilterPanel>

      <Card className="border-slate-200">
        <div className="table-scroll-x">
          <Table className="table-list-view">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-28">Date</TableHead>
                <TableHead className="w-24">Item S.N.</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead className="w-16">Unit</TableHead>
                <TableHead className="w-28">D/N No.</TableHead>
                <TableHead className="w-28">MRF No.</TableHead>
                <TableHead className="w-24">LPO</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="w-20">Store</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead>Remarks</TableHead>
                <TableHead className="w-28">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{t.transaction_date}</TableCell>
                  <TableCell className="font-mono font-semibold">{t.item_sn}</TableCell>
                  <TableCell className="font-medium">{t.item_name}</TableCell>
                  <TableCell>{t.unit}</TableCell>
                  <TableCell>{t.dn_no || '—'}</TableCell>
                  <TableCell>{t.mrf_no || '—'}</TableCell>
                  <TableCell>{t.lpo || '—'}</TableCell>
                  <TableCell>{t.supplier || '—'}</TableCell>
                  <TableCell>{t.store || '—'}</TableCell>
                  <TableCell className="text-right font-bold text-green-600">+{t.quantity_abs}</TableCell>
                  <TableCell>{t.remarks || '—'}</TableCell>
                  <TableCell>
                    <TransactionActions
                      showWarranty={can('inventory.warranty.view')}
                      showEdit={can('inventory.stock_in.edit')}
                      onWarranty={() => { setWarrantyTxn(t); setWarrantyOpen(true); }}
                      onEdit={() => { setEditTxn(t); setEditOpen(true); }}
                    />
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} className="text-center py-8 text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No stock in records found.'}
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

      <StockInFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        items={items}
        stores={getLookupOptions('store')}
        suppliers={getLookupOptions('supplier')}
        user={user}
      />

      {/* Edit the recorded line — reverses and re-applies, so only the difference moves stock */}
      <StockInEditDialog
        open={editOpen}
        onClose={() => setEditOpen(false)}
        onSaved={refresh}
        txn={editTxn}
        warrantyRows={editTxn ? warrantiesForTransaction(warranties, editTxn) : []}
        transactions={transactions}
        documentLines={editTxn?.document_id ? transactions.filter(t => t.document_id === editTxn.document_id && !t.is_deleted).length : 1}
        suppliers={getLookupOptions('supplier')}
        stores={getLookupOptions('store')}
        user={user}
      />

      {/* Warranty of the exact receipt (or serialized asset) in the clicked row */}
      <WarrantyDetailsDialog
        open={warrantyOpen}
        onClose={() => setWarrantyOpen(false)}
        item={warrantyTxn ? (itemMap.get(warrantyTxn.item_id) || { id: warrantyTxn.item_id, item_sn: warrantyTxn.item_sn, item_name: warrantyTxn.item_name }) : null}
        rows={warrantyTxn ? warrantiesForTransaction(warranties, warrantyTxn) : []}
        warningDays={warningDays}
      />
    </div>
  );
}