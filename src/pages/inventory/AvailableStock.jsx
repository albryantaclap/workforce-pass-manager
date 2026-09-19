import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { calculateAvailableStock, calculateStockIn, calculateStockOut, getStockStatus } from '@/lib/inventoryService';
import { exportAvailableStockExcel } from '@/lib/inventoryExcelExport';
import { useRbac } from '@/lib/useRbac';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';

export default function AvailableStock() {
  const { items, transactions, getLookupOptions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const { can } = useRbac();

  const categories = getLookupOptions('item_category');

  const rows = useMemo(() => {
    let result = items.filter(i => !i.is_archived);

    // Date-filtered transactions for stock in/out calculations
    let filteredTxns = transactions;
    if (fromDate) filteredTxns = filteredTxns.filter(t => t.transaction_date >= fromDate);
    if (toDate) filteredTxns = filteredTxns.filter(t => t.transaction_date <= toDate);

    result = result.map(item => {
      const stockIn = calculateStockIn(filteredTxns, item.id);
      const stockOut = calculateStockOut(filteredTxns, item.id);
      const available = calculateAvailableStock(transactions, item.id); // Always use all txns for current available
      const status = getStockStatus(available, item.min_stock_level);
      return {
        ...item,
        stockIn, stockOut, available, status,
        values: [item.item_sn, item.item_name, item.unit, stockIn, stockOut, available, item.min_stock_level || 0, status],
      };
    });

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.item_sn || '').toLowerCase().includes(q) ||
        (r.item_name || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter) result = result.filter(r => r.category === categoryFilter);
    if (statusFilter) result = result.filter(r => r.status === statusFilter);

    return result.sort((a, b) => (a.item_sn || '').localeCompare(b.item_sn || ''));
  }, [items, transactions, search, categoryFilter, statusFilter, fromDate, toDate]);

  // Pagination
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, [search, categoryFilter, statusFilter, fromDate, toDate]);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = rows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);
  const isFiltered = !!(search || categoryFilter || statusFilter || fromDate || toDate);

  return (
    <div className="p-6 space-y-4">
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

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="All Categories" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Status</SelectItem>
            <SelectItem value="Available">Available</SelectItem>
            <SelectItem value="Low Stock">Low Stock</SelectItem>
            <SelectItem value="Out of Stock">Out of Stock</SelectItem>
          </SelectContent>
        </Select>
        <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-auto" />
        <span className="text-xs text-muted-foreground">to</span>
        <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-auto" />
      </div>

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
                </TableRow>
              ))}
              {rows.length === 0 && (
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
          totalRecords={rows.length}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
          isFiltered={isFiltered}
        />
      </Card>
    </div>
  );
}