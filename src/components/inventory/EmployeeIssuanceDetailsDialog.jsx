import React, { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Printer, ChevronRight, ChevronDown } from 'lucide-react';
import { exportEmployeeIssuanceExcel } from '@/lib/inventoryExcelExport';
import { groupTransactionsIntoDocuments } from '@/lib/inventoryService';
import { issuedAssetsFor, warrantyStatus, warrantyStatusClasses } from '@/lib/warranty';
import { useWarrantySetting } from '@/hooks/useWarrantySetting';

export default function EmployeeIssuanceDetailsDialog({ open, onClose, employee, transactions, warranties = [] }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const warningDays = useWarrantySetting();

  const issuedItems = useMemo(() => {
    if (!employee) return [];
    return transactions.filter(t => t.transaction_type === 'STOCK_OUT' && !t.is_deleted && t.employee_id === employee.id);
  }, [transactions, employee]);

  // One row per store issue voucher (I/V), each expandable to its item lines.
  const vouchers = useMemo(() => groupTransactionsIntoDocuments(issuedItems), [issuedItems]);

  const totalQty = issuedItems.reduce((sum, t) => sum + (t.quantity_abs || 0), 0);
  const distinctItems = new Set(issuedItems.map(t => t.item_id).filter(Boolean)).size;

  if (!employee) return null;

  const toggle = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExport = () => exportEmployeeIssuanceExcel(employee, issuedItems);

  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    const rows = issuedItems.map(t => `
      <tr>
        <td>${t.transaction_date || ''}</td>
        <td>${t.iv_no || ''}</td>
        <td>${t.item_sn || ''}</td>
        <td>${t.item_name || ''}</td>
        <td>${t.unit || ''}</td>
        <td>${t.site || ''}</td>
        <td style="text-align:right">${t.quantity_abs || 0}</td>
        <td>${t.remarks || ''}</td>
      </tr>`).join('');

    printWin.document.write(`
      <html><head><title>Employee Issuance — ${employee.name}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { font-size: 18px; } h2 { font-size: 14px; margin-top: 20px; }
        .info { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin: 10px 0 20px; }
        .info div { border: 1px solid #ddd; padding: 8px; border-radius: 4px; }
        .info label { font-size: 10px; color: #666; } .info value { font-size: 12px; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; }
        th { background: #1e293b; color: white; padding: 6px; text-align: left; }
        td { border: 1px solid #ddd; padding: 5px; }
        .totals { margin-top: 10px; font-weight: bold; }
      </style></head><body>
      <h1>Employee Issuance Details</h1>
      <div class="info">
        <div><label>Employee Name</label><br><value>${employee.name || ''}</value></div>
        <div><label>PID No.</label><br><value>${employee.pid || ''}</value></div>
        <div><label>QID No.</label><br><value>${employee.qid_no || ''}</value></div>
        <div><label>Company</label><br><value>${employee.company || ''}</value></div>
        <div><label>Department</label><br><value>${employee.department || ''}</value></div>
        <div><label>Designation</label><br><value>${employee.position_application || employee.designation_org_chart || ''}</value></div>
      </div>
      <h2>Issued Inventory Items</h2>
      <table><thead><tr>
        <th>Date</th><th>I/V No.</th><th>Item S.N.</th><th>Item Name</th><th>Unit</th><th>Site</th><th>Qty</th><th>Remarks</th>
      </tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">Total Different Items Issued: ${distinctItems} | Total Quantity Issued: ${totalQty}</div>
      </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee Issuance Details</DialogTitle>
        </DialogHeader>

        {/* Employee info from Workforce Management */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Employee Name</p>
                <p className="text-sm font-semibold">{employee.name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">PID No.</p>
                <p className="text-sm font-mono">{employee.pid || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">QID No.</p>
                <p className="text-sm font-mono">{employee.qid_no || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Company</p>
                <p className="text-sm">{employee.company || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Department</p>
                <p className="text-sm">{employee.department || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Designation</p>
                <p className="text-sm">{employee.position_application || employee.designation_org_chart || '—'}</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t flex gap-6">
              <div>
                <p className="text-xs text-muted-foreground">Total Different Items Issued</p>
                <p className="text-xl font-bold text-blue-600">{distinctItems}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Quantity Issued</p>
                <p className="text-xl font-bold text-orange-600">{totalQty}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issue vouchers — expand to see every item under the same I/V */}
        <Card className="border-slate-200">
          <div className="flex items-center justify-between p-3 border-b">
            <p className="text-sm font-semibold">
              Issue Vouchers ({vouchers.length}) · {issuedItems.length} item line{issuedItems.length === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" /> Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </Button>
            </div>
          </div>
          <div className="table-scroll-x max-h-[400px]">
            <Table className="table-list-view">
              <TableHeader>
                <TableRow className="bg-slate-50 sticky top-0">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-28">Date</TableHead>
                  <TableHead className="w-24">I/V No.</TableHead>
                  <TableHead>Item / Voucher / Asset</TableHead>
                  <TableHead className="w-16">Unit</TableHead>
                  <TableHead className="w-16 text-right">Qty</TableHead>
                  <TableHead className="w-72">Warranty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vouchers.map(v => {
                  const isOpen = expanded.has(v.key);
                  return (
                    <React.Fragment key={v.key}>
                      <TableRow className="bg-slate-50/60 cursor-pointer" onClick={() => toggle(v.key)}>
                        <TableCell>
                          {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </TableCell>
                        <TableCell>{v.date}</TableCell>
                        <TableCell className="font-mono font-semibold">{v.documentNo || '—'}</TableCell>
                        <TableCell className="font-medium">
                          {v.lineCount} item{v.lineCount === 1 ? '' : 's'} in this voucher
                          {v.site ? <span className="text-muted-foreground"> · {v.site}</span> : null}
                        </TableCell>
                        <TableCell className="text-muted-foreground">—</TableCell>
                        <TableCell className="text-right font-bold">{v.totalQty}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{isOpen ? 'Click to collapse' : 'Click to view items'}</TableCell>
                      </TableRow>
                      {isOpen && v.lines.map(t => {
                        // The exact asset(s) issued keep their original warranty record.
                        const assets = issuedAssetsFor(warranties, employee.id, t.item_id, t.iv_no || '');
                        const asset = assets[0];
                        const status = asset ? warrantyStatus(asset.warranty_expiry_date, warningDays) : 'No Warranty';
                        const expiry = assets.map(a => a.warranty_expiry_date).filter(Boolean).sort()[0] || '';
                        return (
                          <TableRow key={t.id}>
                            <TableCell></TableCell>
                            <TableCell>{t.transaction_date}</TableCell>
                            <TableCell className="font-mono">{t.iv_no || '—'}</TableCell>
                            <TableCell className="pl-4">
                              <span className="font-mono font-semibold">{t.item_sn}</span> — {t.item_name}
                              {asset ? (
                                <span className="ml-2 text-[10px] font-mono text-blue-700">
                                  Asset: {assets.map(a => a.serial_no).join(', ')}
                                </span>
                              ) : null}
                            </TableCell>
                            <TableCell>{t.unit}</TableCell>
                            <TableCell className="text-right font-semibold">{t.quantity_abs}</TableCell>
                            <TableCell>
                              {asset ? (
                                <span className="flex flex-wrap items-center gap-2 text-[10px]">
                                  <span className={`px-1.5 py-0.5 rounded border font-semibold ${warrantyStatusClasses(status)}`}>
                                    {status}
                                  </span>
                                  <span>Expiry: <strong>{expiry || '—'}</strong></span>
                                  <span className="text-muted-foreground">Ref: {asset.warranty_ref_no || '—'}</span>
                                  <span className="text-muted-foreground">D/N: {asset.document_no || '—'}</span>
                                </span>
                              ) : (
                                <span className="text-[10px] text-muted-foreground">
                                  No warranty recorded for this receipt{t.remarks ? ` · ${t.remarks}` : ''}
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                {vouchers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No inventory issued to this employee.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </DialogContent>
    </Dialog>
  );
}