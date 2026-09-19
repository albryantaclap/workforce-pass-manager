import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Download } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { exportStockOutExcel } from '@/lib/inventoryExcelExport';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import StockOutFormModal from '@/components/inventory/StockOutFormModal';

export default function StockOut() {
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
    let result = transactions.filter(t => t.transaction_type === 'STOCK_OUT');
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t =>
        (t.item_sn || '').toLowerCase().includes(q) ||
        (t.item_name || '').toLowerCase().includes(q) ||
        (t.employee_name || '').toLowerCase().includes(q) ||
        (t.pid || '').toLowerCase().includes(q) ||
        (t.iv_no || '').toLowerCase().includes(q)
      );
    }
    if (fromDate) result = result.filter(t => t.transaction_date >= fromDate);
    if (toDate) result = result.filter(t => t.transaction_date <= toDate);
    return result.sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || ''));
  }, [transactions, search, fromDate, toDate]);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Stock Out</h1>
          <p className="text-sm text-muted-foreground mt-1">Issue stock to employees — deducts from available inventory</p>
        </div>
        <div className="flex gap-2">
          {can('inventory.stock_out.export') && (
            <Button variant="outline" onClick={() => exportStockOutExcel(filtered)}>
              <Download className="w-4 h-4" /> Export
            </Button>
          )}
          {can('inventory.stock_out.issue') && (
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="w-4 h-4" /> Issue Stock
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
                <TableHead className="w-28">I/V No.</TableHead>
                <TableHead className="w-20">Site</TableHead>
                <TableHead className="w-24">PID</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead className="w-28">Company</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(t => (
                <TableRow key={t.id}>
                  <TableCell>{t.transaction_date}</TableCell>
                  <TableCell className="font-mono font-semibold">{t.item_sn}</TableCell>
                  <TableCell className="font-medium">{t.item_name}</TableCell>
                  <TableCell>{t.unit}</TableCell>
                  <TableCell>{t.iv_no || '—'}</TableCell>
                  <TableCell>{t.site || '—'}</TableCell>
                  <TableCell className="font-mono">{t.pid || '—'}</TableCell>
                  <TableCell>{t.employee_name || '—'}</TableCell>
                  <TableCell>{t.company || '—'}</TableCell>
                  <TableCell className="text-right font-bold text-orange-600">-{t.quantity_abs}</TableCell>
                  <TableCell>{t.remarks || '—'}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-8 text-muted-foreground">
                    {isLoading ? 'Loading...' : 'No stock out records found.'}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <StockOutFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        items={items}
        sites={getLookupOptions('site')}
        stores={getLookupOptions('store')}
        user={user}
      />
    </div>
  );
}