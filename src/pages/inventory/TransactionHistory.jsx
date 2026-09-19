import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Trash2 } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { deleteTransaction } from '@/lib/inventoryService';
import { exportTransactionHistoryExcel } from '@/lib/inventoryExcelExport';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import { useQueryClient } from '@tanstack/react-query';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';

export default function TransactionHistory() {
  const { items, transactions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useCurrentUser();
  const { can } = useRbac();

  const refresh = () => queryClient.invalidateQueries(['inventory-transactions']);

  const filtered = useMemo(() => {
    let result = transactions;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.item_sn || '').toLowerCase().includes(q) ||
        (t.item_name || '').toLowerCase().includes(q) ||
        (t.employee_name || '').toLowerCase().includes(q) ||
        (t.supplier || '').toLowerCase().includes(q) ||
        (t.dn_no || '').toLowerCase().includes(q) ||
        (t.iv_no || '').toLowerCase().includes(q)
      );
    }
    if (typeFilter) result = result.filter(t => t.transaction_type === typeFilter);
    if (fromDate) result = result.filter(t => t.transaction_date >= fromDate);
    if (toDate) result = result.filter(t => t.transaction_date <= toDate);
    return result.sort((a, b) => (b.created_date || '').localeCompare(a.created_date || ''));
  }, [transactions, search, typeFilter, fromDate, toDate]);

  // Pagination
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, [search, typeFilter, fromDate, toDate]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);
  const isFiltered = !!(search || typeFilter || fromDate || toDate);

  const handleDelete = async (t) => {
    const reason = prompt(`Reason for removing this ${t.transaction_type.replace(/_/g, ' ')} transaction?`);
    if (!reason) return;
    try {
      await deleteTransaction(t.id, user, reason);
      toast({ title: 'Transaction removed (soft-deleted for audit)' });
      refresh();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-sm text-muted-foreground mt-1">Complete audit trail of all stock movements</p>
        </div>
        {can('inventory.transaction_history.export') && (
          <Button variant="outline" onClick={() => exportTransactionHistoryExcel(filtered)}>
            <Download className="w-4 h-4" /> Export
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..." className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Types</SelectItem>
            <SelectItem value="STOCK_IN">Stock In</SelectItem>
            <SelectItem value="STOCK_OUT">Stock Out</SelectItem>
            <SelectItem value="ADJUSTMENT">Adjustment</SelectItem>
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
                <TableHead className="w-24">Date</TableHead>
                <TableHead className="w-20">Type</TableHead>
                <TableHead className="w-24">Item S.N.</TableHead>
                <TableHead>Item</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead className="w-16 text-right">Prev</TableHead>
                <TableHead className="w-16 text-right">New</TableHead>
                <TableHead>Emp/Supplier</TableHead>
                <TableHead className="w-24">Ref No.</TableHead>
                <TableHead className="w-20">Store/Site</TableHead>
                <TableHead>Created By</TableHead>
                <TableHead>Remarks</TableHead>
                {can('inventory.stock_in.edit') && <TableHead className="w-16">Action</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{t.transaction_date}</TableCell>
                  <TableCell>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                      t.transaction_type === 'STOCK_IN' ? 'bg-green-50 text-green-700' :
                      t.transaction_type === 'STOCK_OUT' ? 'bg-orange-50 text-orange-700' :
                      'bg-blue-50 text-blue-700'
                    }`}>
                      {t.transaction_type.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono font-semibold">{t.item_sn}</TableCell>
                  <TableCell className="font-medium">{t.item_name}</TableCell>
                  <TableCell className={`text-right font-bold ${t.transaction_type === 'STOCK_IN' ? 'text-green-600' : 'text-orange-600'}`}>
                    {t.transaction_type === 'STOCK_IN' ? '+' : '-'}{t.quantity_abs}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{t.previous_balance}</TableCell>
                  <TableCell className="text-right font-semibold">{t.new_balance}</TableCell>
                  <TableCell>{t.transaction_type === 'STOCK_IN' ? (t.supplier || '—') : (t.employee_name || '—')}</TableCell>
                  <TableCell>{t.transaction_type === 'STOCK_IN' ? (t.dn_no || t.mrf_no || t.lpo || '—') : (t.iv_no || '—')}</TableCell>
                  <TableCell>{t.transaction_type === 'STOCK_IN' ? (t.store || '—') : (t.site || '—')}</TableCell>
                  <TableCell className="text-xs">{t.created_by_name || t.created_by || '—'}</TableCell>
                  <TableCell>{t.remarks || '—'}</TableCell>
                  {can('inventory.stock_in.edit') && (
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(t)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={can('inventory.stock_in.edit') ? 13 : 12} className="text-center py-8 text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No transactions found.'}
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
    </div>
  );
}