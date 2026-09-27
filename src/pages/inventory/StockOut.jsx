import React, { useState, useMemo } from 'react';
import InventorySubmenuNav from '@/components/common/InventorySubmenuNav';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Search, Download, AlertTriangle } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { exportStockOutExcel } from '@/lib/inventoryExcelExport';
import { fetchAllEmployees } from '@/lib/inventoryEmployees';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import StockOutFormModal from '@/components/inventory/StockOutFormModal';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';
import MultiSelect from '@/components/common/MultiSelect';
import SearchableSelect from '@/components/common/SearchableSelect';
import { InventoryFilterPanel, FilterField, FilterNumberRange, FilterDateRange } from '@/components/inventory/InventoryFilterPanel';

export default function StockOut() {
  const { items, transactions, warranties, getLookupOptions, isLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const queryClient = useQueryClient();
  const user = useCurrentUser();
  const { can } = useRbac();

  // Filter state
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState([]);
  const [unitFilter, setUnitFilter] = useState([]);
  const [ivNoSearch, setIvNoSearch] = useState('');
  const [siteFilter, setSiteFilter] = useState([]);
  const [storeFilter, setStoreFilter] = useState([]);
  const [pidSearch, setPidSearch] = useState('');
  const [empNameSearch, setEmpNameSearch] = useState('');
  const [qidSearch, setQidSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [designationFilter, setDesignationFilter] = useState([]);
  const [qtyMin, setQtyMin] = useState('');
  const [qtyMax, setQtyMax] = useState('');
  const [issuedByFilter, setIssuedByFilter] = useState('');
  const [remarksSearch, setRemarksSearch] = useState('');

  // Load all employees from Workforce Master List for live join
  const { data: employees = [] } = useQuery({
    queryKey: ['workforce-employees-all'],
    queryFn: fetchAllEmployees,
    staleTime: 30000,
  });

  const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
  const itemMap = useMemo(() => new Map(items.map(i => [i.id, i])), [items]);

  const categories = getLookupOptions('item_category');
  const units = getLookupOptions('unit');
  const sites = getLookupOptions('site');
  const stores = getLookupOptions('store');

  // Employee-derived filter options from Workforce Master List
  const companyOptions = useMemo(() => {
    const set = new Set();
    for (const e of employees) { if (e.company) set.add(e.company); }
    return [...set].sort().map(v => ({ value: v, label: v }));
  }, [employees]);

  const departmentOptions = useMemo(() => {
    const set = new Set();
    for (const e of employees) { if (e.department) set.add(e.department); }
    return [...set].sort().map(v => ({ value: v, label: v }));
  }, [employees]);

  const designationOptions = useMemo(() => {
    const set = new Set();
    for (const e of employees) {
      const d = e.designation_org_chart || e.position_application;
      if (d) set.add(d);
    }
    return [...set].sort().map(v => ({ value: v, label: v }));
  }, [employees]);

  // Issued-by options from distinct created_by_name values
  const issuedByOptions = useMemo(() => {
    const set = new Set();
    for (const t of transactions) {
      if (t.transaction_type !== 'STOCK_OUT' || t.is_deleted) continue;
      const name = t.created_by_name || t.created_by;
      if (name) set.add(name);
    }
    return [...set].sort().map(v => ({ value: v, label: v }));
  }, [transactions]);

  const refresh = () => {
    queryClient.invalidateQueries(['inventory-transactions']);
    queryClient.invalidateQueries(['workforce-employees-all']);
  };

  const filtered = useMemo(() => {
    let result = transactions.filter(t => t.transaction_type === 'STOCK_OUT' && !t.is_deleted);

    // General search using live employee info
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(t => {
        const emp = t.employee_id ? employeeMap.get(t.employee_id) : null;
        const liveName = emp?.name || t.employee_name || '';
        const livePid = emp?.pid || t.pid || '';
        const liveCompany = emp?.company || t.company || '';
        return (
          (t.item_sn || '').toLowerCase().includes(q) ||
          (t.item_name || '').toLowerCase().includes(q) ||
          liveName.toLowerCase().includes(q) ||
          livePid.toLowerCase().includes(q) ||
          liveCompany.toLowerCase().includes(q) ||
          (t.iv_no || '').toLowerCase().includes(q)
        );
      });
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

    // I/V No.
    if (ivNoSearch) {
      const q = ivNoSearch.toLowerCase();
      result = result.filter(t => (t.iv_no || '').toLowerCase().includes(q));
    }

    // Site
    if (siteFilter.length > 0) {
      result = result.filter(t => siteFilter.includes(t.site));
    }

    // Store
    if (storeFilter.length > 0) {
      result = result.filter(t => storeFilter.includes(t.store));
    }

    // PID search (live from employee map)
    if (pidSearch) {
      const q = pidSearch.toLowerCase();
      result = result.filter(t => {
        const emp = t.employee_id ? employeeMap.get(t.employee_id) : null;
        const livePid = emp?.pid || t.pid || '';
        return livePid.toLowerCase().includes(q);
      });
    }

    // Employee name search (live)
    if (empNameSearch) {
      const q = empNameSearch.toLowerCase();
      result = result.filter(t => {
        const emp = t.employee_id ? employeeMap.get(t.employee_id) : null;
        const liveName = emp?.name || t.employee_name || '';
        return liveName.toLowerCase().includes(q);
      });
    }

    // QID search (live from employee map)
    if (qidSearch) {
      const q = qidSearch.toLowerCase();
      result = result.filter(t => {
        const emp = t.employee_id ? employeeMap.get(t.employee_id) : null;
        const liveQid = emp?.qid_no || '';
        return liveQid.toLowerCase().includes(q);
      });
    }

    // Company (live from employee map)
    if (companyFilter.length > 0) {
      result = result.filter(t => {
        const emp = t.employee_id ? employeeMap.get(t.employee_id) : null;
        const liveCompany = emp?.company || t.company || '';
        return companyFilter.includes(liveCompany);
      });
    }

    // Department (live from employee map)
    if (departmentFilter.length > 0) {
      result = result.filter(t => {
        const emp = t.employee_id ? employeeMap.get(t.employee_id) : null;
        const liveDept = emp?.department || t.department || '';
        return departmentFilter.includes(liveDept);
      });
    }

    // Designation (live from employee map)
    if (designationFilter.length > 0) {
      result = result.filter(t => {
        const emp = t.employee_id ? employeeMap.get(t.employee_id) : null;
        const liveDesig = emp?.designation_org_chart || emp?.position_application || t.designation || '';
        return designationFilter.includes(liveDesig);
      });
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

    // Issued by
    if (issuedByFilter) {
      result = result.filter(t => (t.created_by_name || t.created_by) === issuedByFilter);
    }

    // Remarks
    if (remarksSearch) {
      const q = remarksSearch.toLowerCase();
      result = result.filter(t => (t.remarks || '').toLowerCase().includes(q));
    }

    return result.sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || ''));
  }, [transactions, search, dateFrom, dateTo, categoryFilter, unitFilter, ivNoSearch, siteFilter, storeFilter, pidSearch, empNameSearch, qidSearch, companyFilter, departmentFilter, designationFilter, qtyMin, qtyMax, issuedByFilter, remarksSearch, employeeMap, itemMap]);

  const allFilterDeps = [search, dateFrom, dateTo, categoryFilter, unitFilter, ivNoSearch, siteFilter, storeFilter, pidSearch, empNameSearch, qidSearch, companyFilter, departmentFilter, designationFilter, qtyMin, qtyMax, issuedByFilter, remarksSearch];
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, allFilterDeps);
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);

  const activeFilterCount = [
    dateFrom !== '' || dateTo !== '',
    categoryFilter.length > 0,
    unitFilter.length > 0,
    ivNoSearch !== '',
    siteFilter.length > 0,
    storeFilter.length > 0,
    pidSearch !== '',
    empNameSearch !== '',
    qidSearch !== '',
    companyFilter.length > 0,
    departmentFilter.length > 0,
    designationFilter.length > 0,
    qtyMin !== '' || qtyMax !== '',
    issuedByFilter !== '',
    remarksSearch !== '',
  ].filter(Boolean).length;

  const isFiltered = !!(search || activeFilterCount > 0);

  const clearFilters = () => {
    setDateFrom(''); setDateTo('');
    setCategoryFilter([]); setUnitFilter([]);
    setIvNoSearch('');
    setSiteFilter([]); setStoreFilter([]);
    setPidSearch(''); setEmpNameSearch(''); setQidSearch('');
    setCompanyFilter([]); setDepartmentFilter([]); setDesignationFilter([]);
    setQtyMin(''); setQtyMax('');
    setIssuedByFilter('');
    setRemarksSearch('');
  };

  return (
    <div className="p-6 space-y-4">
      <InventorySubmenuNav />
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

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by S.N., name, PID, company, or I/V no..." className="pl-9" />
      </div>

      <InventoryFilterPanel
        activeCount={activeFilterCount}
        onClear={clearFilters}
        totalFiltered={filtered.length}
        totalAll={transactions.filter(t => t.transaction_type === 'STOCK_OUT' && !t.is_deleted).length}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <FilterField label="Date Issued">
            <FilterDateRange from={dateFrom} to={dateTo} onFrom={setDateFrom} onTo={setDateTo} />
          </FilterField>
          <FilterField label="Category">
            <MultiSelect options={categories.map(c => ({ value: c.value, label: c.label }))} value={categoryFilter} onChange={setCategoryFilter} placeholder="All Categories" />
          </FilterField>
          <FilterField label="Unit / UOM">
            <MultiSelect options={units.map(u => ({ value: u.value, label: u.label }))} value={unitFilter} onChange={setUnitFilter} placeholder="All Units" />
          </FilterField>
          <FilterField label="I/V No.">
            <Input value={ivNoSearch} onChange={e => setIvNoSearch(e.target.value)} placeholder="Search I/V No..." className="h-8 text-xs" />
          </FilterField>
          <FilterField label="Site / Location">
            <MultiSelect options={sites.map(s => ({ value: s.value, label: s.label }))} value={siteFilter} onChange={setSiteFilter} placeholder="All Sites" />
          </FilterField>
          <FilterField label="Store">
            <MultiSelect options={stores.map(s => ({ value: s.value, label: s.label }))} value={storeFilter} onChange={setStoreFilter} placeholder="All Stores" />
          </FilterField>
          <FilterField label="PID No.">
            <Input value={pidSearch} onChange={e => setPidSearch(e.target.value)} placeholder="Search PID..." className="h-8 text-xs" />
          </FilterField>
          <FilterField label="Employee Name">
            <Input value={empNameSearch} onChange={e => setEmpNameSearch(e.target.value)} placeholder="Search employee..." className="h-8 text-xs" />
          </FilterField>
          <FilterField label="QID No.">
            <Input value={qidSearch} onChange={e => setQidSearch(e.target.value)} placeholder="Search QID..." className="h-8 text-xs" />
          </FilterField>
          <FilterField label="Company">
            <MultiSelect options={companyOptions} value={companyFilter} onChange={setCompanyFilter} placeholder="All Companies" />
          </FilterField>
          <FilterField label="Department">
            <MultiSelect options={departmentOptions} value={departmentFilter} onChange={setDepartmentFilter} placeholder="All Departments" />
          </FilterField>
          <FilterField label="Designation / Position">
            <MultiSelect options={designationOptions} value={designationFilter} onChange={setDesignationFilter} placeholder="All Designations" />
          </FilterField>
          <FilterField label="Quantity">
            <FilterNumberRange min={qtyMin} max={qtyMax} onMin={setQtyMin} onMax={setQtyMax} />
          </FilterField>
          <FilterField label="Issued By">
            <SearchableSelect value={issuedByFilter} onChange={setIssuedByFilter} options={issuedByOptions} placeholder="All Users" />
          </FilterField>
          <FilterField label="Remarks">
            <Input value={remarksSearch} onChange={e => setRemarksSearch(e.target.value)} placeholder="Search remarks..." className="h-8 text-xs" />
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
              {pageData.map(t => {
                const emp = t.employee_id ? employeeMap.get(t.employee_id) : null;
                const liveName = emp?.name || t.employee_name || '';
                const livePid = emp?.pid || t.pid || '';
                const liveCompany = emp?.company || t.company || '';
                const unmatched = !t.employee_id && t.pid;
                return (
                  <TableRow key={t.id} className={unmatched ? 'bg-amber-50' : ''}>
                    <TableCell>{t.transaction_date}</TableCell>
                    <TableCell className="font-mono font-semibold">{t.item_sn}</TableCell>
                    <TableCell className="font-medium">{t.item_name}</TableCell>
                    <TableCell>{t.unit}</TableCell>
                    <TableCell>{t.iv_no || '—'}</TableCell>
                    <TableCell>{t.site || '—'}</TableCell>
                    <TableCell className="font-mono">{livePid || '—'}</TableCell>
                    <TableCell>
                      {liveName || '—'}
                      {unmatched && (
                        <span className="ml-1 inline-flex items-center gap-0.5 text-[10px] text-amber-600 font-semibold">
                          <AlertTriangle className="w-3 h-3" /> Match Required
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{liveCompany || '—'}</TableCell>
                    <TableCell className="text-right font-bold text-orange-600">-{t.quantity_abs}</TableCell>
                    <TableCell>{t.remarks || '—'}</TableCell>
                  </TableRow>
                );
              })}
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

      <StockOutFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={refresh}
        items={items}
        transactions={transactions}
        warranties={warranties}
        sites={getLookupOptions('site')}
        stores={getLookupOptions('store')}
        user={user}
      />
    </div>
  );
}