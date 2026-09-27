import React, { useMemo, useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, ArrowUpDown, ShieldOff } from 'lucide-react';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';
import PrintReportButton from '@/components/common/PrintReportButton';
import { exportWarrantyReportExcel } from '@/lib/inventoryExcelExport';
import {
  WARRANTY_STATUS, WARRANTY_STATUS_OPTIONS, warrantyStatus, warrantyStatusClasses,
} from '@/lib/warranty';
import { itemDisplayName, itemDisplayUnit } from '@/lib/inventoryText';

const COLUMNS = [
  { key: 'item_sn', label: 'Item S.N.' },
  { key: 'item_name', label: 'Item Name' },
  { key: 'category', label: 'Category' },
  { key: 'serial_no', label: 'Serial / Asset No.' },
  { key: 'supplier', label: 'Supplier' },
  { key: 'document_no', label: 'D/N No.' },
  { key: 'stock_in_date', label: 'Stock In Date' },
  { key: 'warranty_start_date', label: 'Warranty Start' },
  { key: 'warranty_period', label: 'Warranty Period' },
  { key: 'warranty_expiry_date', label: 'Warranty Expiry' },
  { key: 'status', label: 'Warranty Status' },
  { key: 'current_location', label: 'Current Location' },
  { key: 'issued_to', label: 'Issued To' },
  { key: 'company', label: 'Company' },
  { key: 'warranty_ref_no', label: 'Warranty Reference' },
];

const SORTABLE = new Set([
  'item_sn', 'item_name', 'category', 'serial_no', 'supplier', 'document_no',
  'stock_in_date', 'warranty_start_date', 'warranty_expiry_date', 'status',
  'current_location', 'issued_to', 'company',
]);

function SortHead({ col, sort, onSort }) {
  const active = sort.key === col.key;
  return (
    <TableHead>
      {SORTABLE.has(col.key) ? (
        <button type="button" onClick={() => onSort(col.key)}
          className={`flex items-center gap-1 hover:underline ${active ? 'font-bold' : ''}`}
          title={`Sort by ${col.label}`}>
          {col.label}
          <ArrowUpDown className={`w-3 h-3 ${active ? 'opacity-100' : 'opacity-40'}`} />
        </button>
      ) : col.label}
    </TableHead>
  );
}

/**
 * Warranty Report — every receipt's warranty (batch level) and every serialized
 * asset, plus receipts saved without warranty so nothing is hidden. Statuses are
 * calculated live from the expiry date against the configured warning window.
 */
export default function WarrantyReport({ transactions = [], items = [], warranties = [], getLookupOptions, warningDays = 30, initialStatus = '', can }) {
  const [search, setSearch] = useState('');
  const [itemSn, setItemSn] = useState('');
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('');
  const [supplier, setSupplier] = useState('');
  const [dnNo, setDnNo] = useState('');
  const [location, setLocation] = useState('');
  const [serial, setSerial] = useState('');
  const [employee, setEmployee] = useState('');
  const [company, setCompany] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [expiryFrom, setExpiryFrom] = useState('');
  const [expiryTo, setExpiryTo] = useState('');
  const [status, setStatus] = useState(initialStatus || '');
  const [sort, setSort] = useState({ key: 'warranty_expiry_date', dir: 'asc' });

  useEffect(() => { setStatus(initialStatus || ''); }, [initialStatus]);

  const categories = getLookupOptions('item_category');
  const suppliers = getLookupOptions('supplier');
  const stores = getLookupOptions('store');

  const rows = useMemo(() => {
    const itemMap = new Map(items.map(i => [i.id, i]));
    const byBatch = new Map();
    for (const w of warranties) {
      if (w.is_deleted || w.warranty_applicable === false) continue;
      if (!byBatch.has(w.batch_txn_id)) byBatch.set(w.batch_txn_id, []);
      byBatch.get(w.batch_txn_id).push(w);
    }

    const all = [];
    for (const t of transactions) {
      if (t.is_deleted || t.transaction_type !== 'STOCK_IN') continue;
      const item = itemMap.get(t.item_id) || {};
      const base = {
        item_sn: t.item_sn || '',
        item_name: itemDisplayName({ item_name: t.item_name || item.item_name }),
        category: item.category || '',
        supplier: t.supplier || '',
        document_no: t.dn_no || t.mrf_no || t.lpo || '',
        stock_in_date: t.transaction_date || '',
        store: t.store || '',
        unit: itemDisplayUnit({ unit: t.unit || item.unit }),
      };
      const attached = byBatch.get(t.id) || [];
      if (!attached.length) {
        all.push({
          ...base,
          id: `now-${t.id}`,
          serial_no: '',
          warranty_start_date: '',
          warranty_period: '—',
          warranty_expiry_date: '',
          status: WARRANTY_STATUS.NONE,
          current_location: t.store || '',
          issued_to: '',
          company: '',
          warranty_ref_no: '',
        });
        continue;
      }
      for (const w of attached) {
        all.push({
          ...base,
          id: w.id,
          serial_no: w.serial_no || '',
          warranty_start_date: w.warranty_start_date || '',
          warranty_period: w.warranty_period ? `${w.warranty_period} ${w.warranty_period_unit || ''}` : '—',
          warranty_expiry_date: w.warranty_expiry_date || '',
          status: warrantyStatus(w.warranty_expiry_date, warningDays),
          current_location: w.current_location || w.store || t.store || '',
          issued_to: w.issued_to_name || '',
          company: w.issued_company || '',
          warranty_ref_no: w.warranty_ref_no || '',
        });
      }
    }

    const q = search.trim().toLowerCase();
    let result = all.filter(r => {
      if (status && r.status !== status) return false;
      if (category && r.category !== category) return false;
      if (supplier && r.supplier !== supplier) return false;
      if (location && (r.current_location || r.store) !== location) return false;
      if (expiryFrom && (r.warranty_expiry_date || '') < expiryFrom) return false;
      if (expiryTo && (r.warranty_expiry_date || '') > expiryTo) return false;
      if (startFrom && (r.warranty_start_date || '') < startFrom) return false;
      if (itemSn && !(r.item_sn || '').toLowerCase().includes(itemSn.toLowerCase())) return false;
      if (itemName && !(r.item_name || '').toLowerCase().includes(itemName.toLowerCase())) return false;
      if (dnNo && !(r.document_no || '').toLowerCase().includes(dnNo.toLowerCase())) return false;
      if (serial && !(r.serial_no || '').toLowerCase().includes(serial.toLowerCase())) return false;
      if (employee && !(r.issued_to || '').toLowerCase().includes(employee.toLowerCase())) return false;
      if (company && !(r.company || '').toLowerCase().includes(company.toLowerCase())) return false;
      if (q) {
        const hay = [r.item_sn, r.item_name, r.serial_no, r.document_no, r.supplier, r.issued_to, r.warranty_ref_no, r.category]
          .join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const dir = sort.dir === 'asc' ? 1 : -1;
    result = [...result].sort((a, b) =>
      String(a[sort.key] || '').localeCompare(String(b[sort.key] || '')) * dir
    );
    return result;
  }, [transactions, items, warranties, warningDays, search, itemSn, itemName, category, supplier, dnNo, location, serial, employee, company, startFrom, expiryFrom, expiryTo, status, sort]);

  const filterDeps = [search, itemSn, itemName, category, supplier, dnNo, location, serial, employee, company, startFrom, expiryFrom, expiryTo, status];
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, filterDeps);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = rows.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);
  const isFiltered = filterDeps.some(Boolean);

  const appliedFilters = [
    status && `Status: ${status}`,
    category && `Category: ${category}`,
    supplier && `Supplier: ${supplier}`,
    location && `Location: ${location}`,
    dnNo && `D/N: ${dnNo}`,
    serial && `Serial: ${serial}`,
    employee && `Issued To: ${employee}`,
    company && `Company: ${company}`,
    expiryFrom && `Expiry from: ${expiryFrom}`,
    expiryTo && `Expiry to: ${expiryTo}`,
    startFrom && `Start from: ${startFrom}`,
    search && `Search: ${search}`,
  ].filter(Boolean);

  const toggleSort = (key) => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="border-slate-200">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            <div className="xl:col-span-2">
              <label className="text-xs text-muted-foreground">Search</label>
              <Input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Item, serial, D/N, supplier, reference..." />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Item S.N.</label>
              <Input value={itemSn} onChange={e => setItemSn(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Item Name</label>
              <Input value={itemName} onChange={e => setItemName(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Serial / Asset No.</label>
              <Input value={serial} onChange={e => setSerial(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Categories" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Categories</SelectItem>
                  {categories.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Supplier</label>
              <Select value={supplier} onValueChange={setSupplier}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Suppliers" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Suppliers</SelectItem>
                  {suppliers.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">D/N No.</label>
              <Input value={dnNo} onChange={e => setDnNo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Site / Location</label>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Locations" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All Locations</SelectItem>
                  {stores.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Warranty Status</label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="All Statuses" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>All</SelectItem>
                  {WARRANTY_STATUS_OPTIONS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Expiry From</label>
              <Input type="date" value={expiryFrom} onChange={e => setExpiryFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Expiry To</label>
              <Input type="date" value={expiryTo} onChange={e => setExpiryTo(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Warranty Start (from)</label>
              <Input type="date" value={startFrom} onChange={e => setStartFrom(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Employee / Issued To</label>
              <Input value={employee} onChange={e => setEmployee(e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Company</label>
              <Input value={company} onChange={e => setCompany(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {can?.('inventory.warranty.export') && (
              <Button variant="outline" size="sm" onClick={() => exportWarrantyReportExcel(rows)}>
                <Download className="w-4 h-4" /> Export Excel
              </Button>
            )}
            {can?.('inventory.warranty.print') && (
              <PrintReportButton
                records={rows}
                columns={COLUMNS.map(c => ({ key: c.key, label: c.label }))}
                title="GSO Qatar — Inventory Warranty Report"
                subtitle={`${rows.length} warranty record(s) · Expiring-soon window: ${warningDays} days`}
                appliedFilters={appliedFilters}
                totalFiltered={rows.length}
              />
            )}
            <span className="text-xs text-muted-foreground ml-auto">
              {rows.length} record{rows.length === 1 ? '' : 's'} · showing warranty per receipt and per serialized asset
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card className="border-slate-200">
        <div className="table-scroll-x max-h-[560px]">
          <Table className="table-list-view">
            <TableHeader>
              <TableRow className="bg-slate-50 sticky top-0">
                {COLUMNS.map(c => <SortHead key={c.key} col={c} sort={sort} onSort={toggleSort} />)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map(r => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono font-semibold">{r.item_sn}</TableCell>
                  <TableCell className="font-medium">{r.item_name}</TableCell>
                  <TableCell>{r.category || '—'}</TableCell>
                  <TableCell className="font-mono">{r.serial_no || <span className="italic text-muted-foreground">Batch</span>}</TableCell>
                  <TableCell>{r.supplier || '—'}</TableCell>
                  <TableCell className="font-mono">{r.document_no || '—'}</TableCell>
                  <TableCell>{r.stock_in_date || '—'}</TableCell>
                  <TableCell>{r.warranty_start_date || '—'}</TableCell>
                  <TableCell>{r.warranty_period}</TableCell>
                  <TableCell className="font-semibold">{r.warranty_expiry_date || '—'}</TableCell>
                  <TableCell>
                    <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${warrantyStatusClasses(r.status)}`}>
                      {r.status}
                    </span>
                  </TableCell>
                  <TableCell>{r.current_location || '—'}</TableCell>
                  <TableCell>{r.issued_to || '—'}</TableCell>
                  <TableCell>{r.company || '—'}</TableCell>
                  <TableCell>{r.warranty_ref_no || '—'}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="text-center py-10 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <ShieldOff className="w-8 h-8 text-muted-foreground/30" />
                      No warranty records match the current filters.
                    </div>
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