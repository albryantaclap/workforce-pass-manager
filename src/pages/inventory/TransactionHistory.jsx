import React, { useState, useMemo } from 'react';
import InventorySubmenuNav from '@/components/common/InventorySubmenuNav';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download, Trash2, Eye } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { groupTransactionsIntoDocuments, deleteDocument } from '@/lib/inventoryService';
import { exportTransactionHistoryExcel } from '@/lib/inventoryExcelExport';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import { useQueryClient } from '@tanstack/react-query';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';
import DocumentDetailsDialog from '@/components/inventory/DocumentDetailsDialog';

const TYPE_STYLE = {
  STOCK_IN: 'bg-green-50 text-green-700',
  STOCK_OUT: 'bg-orange-50 text-orange-700',
  TRANSFER: 'bg-blue-50 text-blue-700',
  RETURN: 'bg-purple-50 text-purple-700',
  ADJUSTMENT: 'bg-slate-100 text-slate-700',
};

export default function TransactionHistory() {
  const { transactions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const user = useCurrentUser();
  const { can } = useRbac();

  const refresh = () => queryClient.invalidateQueries(['inventory-transactions']);

  // One row per document (D/N or I/V) with all of its item lines. Records that
  // hold a single item — including every existing historical record — simply
  // appear as a one-line document.
  const documents = useMemo(() => {
    const groups = groupTransactionsIntoDocuments(transactions);
    const q = search.trim().toLowerCase();
    return groups.filter(g => {
      if (typeFilter && g.type !== typeFilter) return false;
      if (fromDate && (g.date || '') < fromDate) return false;
      if (toDate && (g.date || '') > toDate) return false;
      if (!q) return true;
      return (
        (g.documentNo || '').toLowerCase().includes(q) ||
        (g.supplier || '').toLowerCase().includes(q) ||
        (g.employeeName || '').toLowerCase().includes(q) ||
        g.lines.some(l =>
          (l.item_sn || '').toLowerCase().includes(q) ||
          (l.item_name || '').toLowerCase().includes(q)
        )
      );
    });
  }, [transactions, search, typeFilter, fromDate, toDate]);

  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, [search, typeFilter, fromDate, toDate]);
  const totalPages = Math.max(1, Math.ceil(documents.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = documents.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);
  const isFiltered = !!(search || typeFilter || fromDate || toDate);

  const handleView = (group) => {
    setSelected(group);
    setDialogOpen(true);
  };

  const handleDelete = async (group) => {
    const label = group.documentNo ? `document ${group.documentNo}` : 'this document';
    const reason = prompt(`Reason for removing ${label} (${group.lineCount} item line${group.lineCount === 1 ? '' : 's'})?`);
    if (!reason) return;
    try {
      await deleteDocument(group, user, reason);
      toast({ title: 'Document removed (soft-deleted for audit)' });
      refresh();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  // Detailed export keeps every line together with the D/N or I/V it belongs to.
  const handleExport = () => exportTransactionHistoryExcel(documents.flatMap(g => g.lines));

  return (
    <div className="p-6 space-y-4">
      <InventorySubmenuNav />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Transaction History</h1>
          <p className="text-sm text-muted-foreground mt-1">One row per delivery note or issue voucher — open it to see every item line</p>
        </div>
        {can('inventory.transaction_history.export') && (
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4" /> Export
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by document no., item, supplier or employee..." className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All Types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={null}>All Types</SelectItem>
            <SelectItem value="STOCK_IN">Stock In</SelectItem>
            <SelectItem value="STOCK_OUT">Stock Out</SelectItem>
            <SelectItem value="TRANSFER">Transfer</SelectItem>
            <SelectItem value="RETURN">Return</SelectItem>
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
                <TableHead className="w-32">Document No.</TableHead>
                <TableHead className="w-24">Type</TableHead>
                <TableHead className="w-24">Date</TableHead>
                <TableHead>Employee / Supplier</TableHead>
                <TableHead className="w-24">Site / Store</TableHead>
                <TableHead className="w-20 text-right">No. of Items</TableHead>
                <TableHead className="w-20 text-right">Total Qty</TableHead>
                <TableHead className="w-24">Action</TableHead>
                {can('inventory.stock_in.edit') && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map(g => (
                <TableRow key={g.key} className="hover:bg-slate-50">
                  <TableCell className="font-mono font-semibold">{g.documentNo || '—'}</TableCell>
                  <TableCell>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${TYPE_STYLE[g.type] || 'bg-slate-100 text-slate-700'}`}>
                      {g.type.replace(/_/g, ' ')}
                    </span>
                  </TableCell>
                  <TableCell>{g.date || '—'}</TableCell>
                  <TableCell>
                    {g.type === 'STOCK_OUT' ? (g.employeeName || '—') : (g.supplier || '—')}
                    {g.type === 'STOCK_OUT' && g.pid ? <span className="ml-1 text-[10px] text-muted-foreground font-mono">({g.pid})</span> : null}
                  </TableCell>
                  <TableCell>{g.type === 'STOCK_OUT' ? (g.site || '—') : (g.store || '—')}</TableCell>
                  <TableCell className="text-right font-semibold">{g.lineCount} {g.lineCount === 1 ? 'Item' : 'Items'}</TableCell>
                  <TableCell className="text-right font-bold">{g.totalQty}</TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => handleView(g)}>
                      <Eye className="w-3.5 h-3.5" /> View
                    </Button>
                  </TableCell>
                  {can('inventory.stock_in.edit') && (
                    <TableCell>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(g)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
              {documents.length === 0 && (
                <TableRow>
                  <TableCell colSpan={can('inventory.stock_in.edit') ? 9 : 8} className="text-center py-8 text-muted-foreground">
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
          totalRecords={documents.length}
          rowsPerPage={rowsPerPage}
          onPageChange={setPage}
          onRowsPerPageChange={setRowsPerPage}
          isFiltered={isFiltered}
        />
      </Card>

      <DocumentDetailsDialog open={dialogOpen} onClose={() => setDialogOpen(false)} group={selected} />
    </div>
  );
}