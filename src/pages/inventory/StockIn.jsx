import React, { useState, useMemo } from 'react';
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
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';

export default function StockIn() {
  const { items, transactions, getLookupOptions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { can } = useRbac();

  const refresh = () => queryClient.invalidateQueries(['inventory-transactions']);

  const filtered = useMemo(() => {
    let result = transactions.filter(t => t.transaction_type === 'STOCK_IN');
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.item_sn || '').toLowerCase().includes(q) ||
        (t.item_name || '').toLowerCase().includes(q) ||
        (t.dn_no || '').toLowerCase().includes(q) ||
        (t.supplier || '').toLowerCase().includes(q)
      );
    }
    if (fromDate) result = result.filter(t => t.transaction_date >= fromDate);
    if (toDate) result = result.filter(t => t.transaction_date <= toDate);
    return result.sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || ''));
  }, [transactions, search, fromDate, toDate]);

  // Pagination
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, [search, fromDate, toDate]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);
  const isFiltered = !!(search || fromDate || toDate);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock In</h1>
          <p className="text-sm text-muted-foreground mt-1">Record received stock — adds to available inventory</p>
        </div>
        <div className="flex gap-2">
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-auto" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-auto" />
      </div>

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
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
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
    </div>
  );
}