import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Printer, FileBarChart } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { calculateAvailableStock, calculateStockIn, calculateStockOut, getStockStatus } from '@/lib/inventoryService';
import {
  exportItemsExcel, exportStockInExcel, exportStockOutExcel,
  exportAvailableStockExcel, exportTransactionHistoryExcel,
} from '@/lib/inventoryExcelExport';
import { useRbac } from '@/lib/useRbac';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';

const REPORT_TYPES = [
  { key: 'summary', label: 'Inventory Summary' },
  { key: 'stock_in', label: 'Stock In Report' },
  { key: 'stock_out', label: 'Stock Out Report' },
  { key: 'available', label: 'Available Stock Report' },
  { key: 'employee_issuance', label: 'Employee Issuance Report' },
  { key: 'supplier', label: 'Supplier Receipt Report' },
  { key: 'store', label: 'Store Stock Report' },
  { key: 'low_stock', label: 'Low Stock Report' },
  { key: 'transactions', label: 'Transaction History' },
];

export default function InventoryReports() {
  const { items, transactions, getLookupOptions, isLoading } = useInventoryData();
  const [reportType, setReportType] = useState('summary');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [storeFilter, setStoreFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const { can } = useRbac();

  const categories = getLookupOptions('item_category');
  const suppliers = getLookupOptions('supplier');
  const stores = getLookupOptions('store');
  const sites = getLookupOptions('site');

  const filteredTxns = useMemo(() => {
    let result = transactions;
    if (fromDate) result = result.filter(t => t.transaction_date >= fromDate);
    if (toDate) result = result.filter(t => t.transaction_date <= toDate);
    if (itemFilter) result = result.filter(t => t.item_id === itemFilter);
    if (supplierFilter) result = result.filter(t => t.supplier === supplierFilter);
    if (storeFilter) result = result.filter(t => t.store === storeFilter);
    if (siteFilter) result = result.filter(t => t.site === siteFilter);
    if (typeFilter) result = result.filter(t => t.transaction_type === typeFilter);
    return result;
  }, [transactions, fromDate, toDate, itemFilter, supplierFilter, storeFilter, siteFilter, typeFilter]);

  const reportData = useMemo(() => {
    switch (reportType) {
      case 'stock_in':
        return filteredTxns.filter(t => t.transaction_type === 'STOCK_IN');
      case 'stock_out':
      case 'employee_issuance':
        return filteredTxns.filter(t => t.transaction_type === 'STOCK_OUT');
      case 'supplier':
        return filteredTxns.filter(t => t.transaction_type === 'STOCK_IN' && (!supplierFilter || t.supplier === supplierFilter));
      case 'store':
        return filteredTxns.filter(t => t.store && (!storeFilter || t.store === storeFilter));
      case 'transactions':
        return filteredTxns;
      case 'low_stock': {
        return items
          .filter(i => !i.is_archived)
          .map(i => {
            const available = calculateAvailableStock(transactions, i.id);
            const status = getStockStatus(available, i.min_stock_level);
            return { ...i, available, status };
          })
          .filter(i => i.status !== 'Available')
          .filter(i => !categoryFilter || i.category === categoryFilter);
      }
      case 'available': {
        return items
          .filter(i => !i.is_archived)
          .filter(i => !categoryFilter || i.category === categoryFilter)
          .map(i => {
            const stockIn = calculateStockIn(filteredTxns, i.id);
            const stockOut = calculateStockOut(filteredTxns, i.id);
            const available = calculateAvailableStock(transactions, i.id);
            const status = getStockStatus(available, i.min_stock_level);
            return {
              ...i, stockIn, stockOut, available, status,
              values: [i.item_sn, i.item_name, i.unit, stockIn, stockOut, available, i.min_stock_level || 0, status],
            };
          });
      }
      case 'summary':
      default: {
        return items
          .filter(i => !i.is_archived)
          .filter(i => !categoryFilter || i.category === categoryFilter)
          .map(i => {
            const stockIn = calculateStockIn(filteredTxns, i.id);
            const stockOut = calculateStockOut(filteredTxns, i.id);
            const available = calculateAvailableStock(transactions, i.id);
            return {
              ...i, stockIn, stockOut, available,
              status: getStockStatus(available, i.min_stock_level),
            };
          });
      }
    }
  }, [reportType, filteredTxns, items, transactions, categoryFilter, supplierFilter, storeFilter]);

  // Pagination — display only; exports use the full reportData, not pageData
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, [reportType, fromDate, toDate, itemFilter, categoryFilter, supplierFilter, storeFilter, siteFilter, typeFilter]);
  const totalPages = Math.max(1, Math.ceil(reportData.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = reportData.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);
  const isFiltered = !!(fromDate || toDate || itemFilter || categoryFilter || supplierFilter || storeFilter || siteFilter || typeFilter);

  const handleExport = () => {
    switch (reportType) {
      case 'stock_in':
      case 'supplier':
        exportStockInExcel(reportData); break;
      case 'stock_out':
      case 'employee_issuance':
        exportStockOutExcel(reportData); break;
      case 'available':
      case 'low_stock':
        exportAvailableStockExcel(reportData); break;
      case 'transactions':
        exportTransactionHistoryExcel(reportData); break;
      default:
        exportItemsExcel(reportData);
    }
  };

  const handlePrint = () => window.print();

  const showFilters = (keys) => keys.some(k => reportType === k);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Reports</h1>
          <p className="text-sm text-muted-foreground mt-1">Generate and export inventory reports</p>
        </div>
        <div className="flex gap-2">
          {can('inventory.reports.export') && (
            <Button variant="outline" onClick={handleExport}>
              <Download className="w-4 h-4" /> Export Excel
            </Button>
          )}
          {can('inventory.reports.print') && (
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4" /> Print
            </Button>
          )}
        </div>
      </div>

      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileBarChart className="w-4 h-4" /> Report Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground">Report Type</label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPORT_TYPES.map(r => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">From Date</label>
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">To Date</label>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {showFilters(['stock_in', 'supplier', 'store', 'summary', 'transactions']) && (
              <div>
                <label className="text-xs text-muted-foreground">Supplier</label>
                <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Suppliers</SelectItem>
                    {suppliers.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showFilters(['stock_in', 'stock_out', 'store', 'summary', 'transactions']) && (
              <div>
                <label className="text-xs text-muted-foreground">Store</label>
                <Select value={storeFilter} onValueChange={setStoreFilter}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Stores</SelectItem>
                    {stores.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {showFilters(['stock_out', 'employee_issuance', 'transactions']) && (
              <div>
                <label className="text-xs text-muted-foreground">Site</label>
                <Select value={siteFilter} onValueChange={setSiteFilter}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Sites</SelectItem>
                    {sites.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {reportType === 'transactions' && (
              <div>
                <label className="text-xs text-muted-foreground">Transaction Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>All Types</SelectItem>
                    <SelectItem value="STOCK_IN">Stock In</SelectItem>
                    <SelectItem value="STOCK_OUT">Stock Out</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Report Preview */}
      <Card className="border-slate-200">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">
            {REPORT_TYPES.find(r => r.key === reportType)?.label} — {reportData.length} records
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="table-scroll-x max-h-[500px]">
            <Table className="table-list-view">
              <TableHeader>
                <TableRow className="bg-slate-50 sticky top-0">
                  {reportType === 'summary' || reportType === 'available' || reportType === 'low_stock' ? (
                    <>
                      <TableHead>Item S.N.</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Stock In</TableHead>
                      <TableHead className="text-right">Stock Out</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead>Status</TableHead>
                    </>
                  ) : (
                    <>
                      <TableHead>Date</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Item S.N.</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Supplier/Employee</TableHead>
                      <TableHead>Ref No.</TableHead>
                    </>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {reportType === 'summary' || reportType === 'available' || reportType === 'low_stock' ? (
                  pageData.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.item_sn}</TableCell>
                      <TableCell>{r.item_name}</TableCell>
                      <TableCell>{r.unit}</TableCell>
                      <TableCell className="text-right text-green-600">{r.stockIn}</TableCell>
                      <TableCell className="text-right text-orange-600">{r.stockOut}</TableCell>
                      <TableCell className="text-right font-bold">{r.available}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          r.status === 'Available' ? 'bg-emerald-50 text-emerald-700' :
                          r.status === 'Low Stock' ? 'bg-amber-50 text-amber-700' :
                          'bg-red-50 text-red-700'
                        }`}>{r.status}</span>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  pageData.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{t.transaction_date}</TableCell>
                      <TableCell>
                        <span className={`text-[10px] font-bold ${t.transaction_type === 'STOCK_IN' ? 'text-green-600' : 'text-orange-600'}`}>
                          {t.transaction_type.replace(/_/g, ' ')}
                        </span>
                      </TableCell>
                      <TableCell className="font-mono">{t.item_sn}</TableCell>
                      <TableCell>{t.item_name}</TableCell>
                      <TableCell className="text-right font-bold">{t.transaction_type === 'STOCK_IN' ? '+' : '-'}{t.quantity_abs}</TableCell>
                      <TableCell>{t.transaction_type === 'STOCK_IN' ? (t.supplier || '—') : (t.employee_name || '—')}</TableCell>
                      <TableCell>{t.transaction_type === 'STOCK_IN' ? (t.dn_no || '—') : (t.iv_no || '—')}</TableCell>
                    </TableRow>
                  ))
                )}
                {reportData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {isLoading ? 'Loading...' : 'No data for selected filters.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            totalRecords={reportData.length}
            rowsPerPage={rowsPerPage}
            onPageChange={setPage}
            onRowsPerPageChange={setRowsPerPage}
            isFiltered={isFiltered}
          />
        </CardContent>
      </Card>
    </div>
  );
}