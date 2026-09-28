import React, { useState, useMemo } from 'react';
import InventorySubmenuNav from '@/components/common/InventorySubmenuNav';
import PrintPageButton from '@/components/inventory/PrintPageButton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Eye, PackageX } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { fetchAllEmployees, buildIssuanceStatsMap } from '@/lib/inventoryEmployees';
import { useRbac } from '@/lib/useRbac';
import { useQuery } from '@tanstack/react-query';
import EmployeeIssuanceDetailsDialog from '@/components/inventory/EmployeeIssuanceDetailsDialog';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import Pagination from '@/components/inventory/Pagination';
import { usePagination } from '@/hooks/usePagination';

export default function EmployeeIssuance() {
  const { transactions, warranties, isLoading: txnsLoading } = useInventoryData();
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [desigFilter, setDesigFilter] = useState('');
  const { page, setPage, rowsPerPage, setRowsPerPage } = usePagination(50, [search, companyFilter, deptFilter, desigFilter]);
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { can } = useRbac();

  // Load all employees from centralized Workforce Master List
  const { data: employees = [], isLoading: empsLoading } = useQuery({
    queryKey: ['workforce-employees-all'],
    queryFn: fetchAllEmployees,
    staleTime: 30000,
  });

  // Build issuance stats map from transactions (single pass, no N+1)
  const issuanceStats = useMemo(() => buildIssuanceStatsMap(transactions), [transactions]);

  // Extract filter options from employees
  const companies = useMemo(() => {
    const set = new Set();
    employees.forEach(e => { if (e.company) set.add(e.company); });
    return Array.from(set).sort();
  }, [employees]);

  const departments = useMemo(() => {
    const set = new Set();
    employees.forEach(e => { if (e.department) set.add(e.department); });
    return Array.from(set).sort();
  }, [employees]);

  const designations = useMemo(() => {
    const set = new Set();
    employees.forEach(e => {
      const d = e.position_application || e.designation_org_chart;
      if (d) set.add(d);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filter employees
  const filtered = useMemo(() => {
    let result = employees;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        String(e.pid || '').toLowerCase().includes(q) ||
        String(e.qid_no || '').toLowerCase().includes(q) ||
        (e.company || '').toLowerCase().includes(q)
      );
    }
    if (companyFilter) result = result.filter(e => e.company === companyFilter);
    if (deptFilter) result = result.filter(e => e.department === deptFilter);
    if (desigFilter) {
      result = result.filter(e =>
        (e.position_application || e.designation_org_chart) === desigFilter
      );
    }
    return result.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  }, [employees, search, companyFilter, deptFilter, desigFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages - 1);
  const pageData = filtered.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage);
  const isFiltered = !!(search || companyFilter || deptFilter || desigFilter);

  const handleView = (emp) => {
    setSelectedEmp(emp);
    setDialogOpen(true);
  };

  return (
    <div className="p-6 space-y-4">
      <InventorySubmenuNav />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Employee Issuance</h1>
          <p className="text-sm text-muted-foreground mt-1">View all inventory/materials issued to individual personnel</p>
        </div>
        <PrintPageButton title="Employee Issuance" />
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by Name, PID, QID, or Company..."
            className="pl-9"
          />
        </div>
        <Select value={companyFilter} onValueChange={v => setCompanyFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Companies" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Companies</SelectItem>
            {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={v => setDeptFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="All Departments" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={desigFilter} onValueChange={v => setDesigFilter(v === 'all' ? '' : v)}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All Designations" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Designations</SelectItem>
            {designations.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span><strong className="text-foreground">{filtered.length}</strong> employees</span>
        <span>•</span>
        <span><strong className="text-foreground">{Array.from(issuanceStats.values()).filter(s => s.totalQty > 0).length}</strong> with issued items</span>
      </div>

      {/* Employee table — all personnel from Workforce Master List */}
      <Card className="border-slate-200">
        <div className="table-scroll-x">
          <Table className="table-list-view">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-10 text-center">Photo</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead className="w-28">QID No.</TableHead>
                <TableHead className="w-24">PID No.</TableHead>
                <TableHead className="w-28">Company</TableHead>
                <TableHead className="w-24">Department</TableHead>
                <TableHead className="w-32">Designation</TableHead>
                <TableHead className="w-24 text-right">Items Issued</TableHead>
                <TableHead className="w-24 text-right">Total Qty</TableHead>
                <TableHead className="w-20 text-center">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageData.map(emp => {
                const stats = issuanceStats.get(emp.id) || { itemCount: 0, totalQty: 0 };
                return (
                  <TableRow key={emp.id}>
                    <TableCell className="p-2 text-center">
                      <PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size={8} />
                    </TableCell>
                    <TableCell className="font-medium">{emp.name}</TableCell>
                    <TableCell className="font-mono">{emp.qid_no || '—'}</TableCell>
                    <TableCell className="font-mono">{emp.pid || '—'}</TableCell>
                    <TableCell>{emp.company || '—'}</TableCell>
                    <TableCell>{emp.department || '—'}</TableCell>
                    <TableCell>{emp.position_application || emp.designation_org_chart || '—'}</TableCell>
                    <TableCell className="text-right">
                      {stats.itemCount > 0 ? (
                        <span className="font-semibold">{stats.itemCount}</span>
                      ) : (
                        <span className="text-muted-foreground italic">No inventory issued</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {stats.totalQty > 0 ? (
                        <span className="font-bold text-orange-600">{stats.totalQty}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => handleView(emp)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pageData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    {empsLoading || txnsLoading ? (
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin" />
                        Loading personnel...
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <PackageX className="w-8 h-8 text-muted-foreground/30" />
                        No employees match the current filters.
                      </div>
                    )}
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

      <EmployeeIssuanceDetailsDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        employee={selectedEmp}
        transactions={transactions}
        warranties={warranties}
      />
    </div>
  );
}