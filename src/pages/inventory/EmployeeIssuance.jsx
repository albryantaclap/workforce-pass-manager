import React, { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Download } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { searchEmployees } from '@/lib/inventoryService';
import { exportStockOutExcel } from '@/lib/inventoryExcelExport';
import { useRbac } from '@/lib/useRbac';
import { useQuery } from '@tanstack/react-query';

export default function EmployeeIssuance() {
  const { transactions, isLoading } = useInventoryData();
  const [empSearch, setEmpSearch] = useState('');
  const [selectedEmp, setSelectedEmp] = useState(null);
  const { can } = useRbac();

  const { data: empResults = [] } = useQuery({
    queryKey: ['employee-search', empSearch],
    queryFn: () => searchEmployees(empSearch, 15),
    enabled: empSearch.length >= 2,
    staleTime: 10000,
  });

  const issuedItems = useMemo(() => {
    if (!selectedEmp) return [];
    return transactions
      .filter(t => t.transaction_type === 'STOCK_OUT' && t.employee_id === selectedEmp.id)
      .sort((a, b) => (b.transaction_date || '').localeCompare(a.transaction_date || ''));
  }, [transactions, selectedEmp]);

  const totalIssued = issuedItems.reduce((sum, t) => sum + (t.quantity_abs || 0), 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee Issuance</h1>
          <p className="text-sm text-muted-foreground mt-1">View all inventory/materials issued to individual personnel</p>
        </div>
        {selectedEmp && can('inventory.employee_issuance.export') && (
          <Button variant="outline" onClick={() => exportStockOutExcel(issuedItems)}>
            <Download className="w-4 h-4" /> Export
          </Button>
        )}
      </div>

      {/* Employee search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          value={empSearch}
          onChange={e => {
            setEmpSearch(e.target.value);
            if (e.target.value.length < 2) setSelectedEmp(null);
          }}
          placeholder="Search employee by Name, PID, or QID..."
          className="pl-9"
        />
        {empSearch.length >= 2 && empResults.length > 0 && !selectedEmp && (
          <div className="absolute z-50 mt-1 w-full max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
            {empResults.map(emp => (
              <button
                key={emp.id}
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent text-left"
                onClick={() => { setSelectedEmp(emp); setEmpSearch(emp.name); }}
              >
                <span className="truncate flex-1">{emp.name}</span>
                <span className="text-xs text-muted-foreground">
                  {emp.staff_no || emp.pid || emp.qid_no || ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedEmp ? (
        <>
          {/* Employee info card */}
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Employee Name</p>
                  <p className="text-sm font-semibold">{selectedEmp.name}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">PID</p>
                  <p className="text-sm font-mono">{selectedEmp.staff_no || selectedEmp.pid || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  <p className="text-sm">{selectedEmp.company || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Department</p>
                  <p className="text-sm">{selectedEmp.department || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Designation</p>
                  <p className="text-sm">{selectedEmp.position_application || selectedEmp.designation_org_chart || '—'}</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t">
                <p className="text-xs text-muted-foreground">Total Items Issued</p>
                <p className="text-2xl font-bold text-orange-600">{totalIssued} <span className="text-sm font-normal text-muted-foreground">units across {issuedItems.length} transactions</span></p>
              </div>
            </CardContent>
          </Card>

          {/* Issuance table */}
          <Card className="border-slate-200">
            <div className="table-scroll-x">
              <Table className="table-list-view">
                <TableHeader>
                  <TableRow className="bg-slate-50">
                    <TableHead className="w-28">Date</TableHead>
                    <TableHead className="w-24">Item S.N.</TableHead>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="w-16">Unit</TableHead>
                    <TableHead className="w-16 text-right">Qty</TableHead>
                    <TableHead className="w-28">I/V No.</TableHead>
                    <TableHead className="w-20">Site</TableHead>
                    <TableHead>Remarks</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {issuedItems.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>{t.transaction_date}</TableCell>
                      <TableCell className="font-mono font-semibold">{t.item_sn}</TableCell>
                      <TableCell className="font-medium">{t.item_name}</TableCell>
                      <TableCell>{t.unit}</TableCell>
                      <TableCell className="text-right font-bold">{t.quantity_abs}</TableCell>
                      <TableCell>{t.iv_no || '—'}</TableCell>
                      <TableCell>{t.site || '—'}</TableCell>
                      <TableCell>{t.remarks || '—'}</TableCell>
                    </TableRow>
                  ))}
                  {issuedItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No items issued to this employee.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      ) : (
        <Card className="border-slate-200">
          <CardContent className="p-12 text-center">
            <Search className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-muted-foreground">Search for an employee to view their issued inventory.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}