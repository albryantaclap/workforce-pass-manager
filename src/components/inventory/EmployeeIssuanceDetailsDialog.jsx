import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, Printer, ChevronRight, ChevronDown, Plus, Pencil, Undo2, History } from 'lucide-react';
import { exportEmployeeIssuanceExcel } from '@/lib/inventoryExcelExport';
import { groupTransactionsIntoDocuments } from '@/lib/inventoryService';
import { issuedAssetsFor, warrantyStatus, warrantyStatusClasses } from '@/lib/warranty';
import { useWarrantySetting } from '@/hooks/useWarrantySetting';
import { fetchEmployeeIssuance, buildIssuanceRows, existingVouchers } from '@/lib/issuanceHistory';
import EmployeeStatusBadge from '@/components/inventory/EmployeeStatusBadge';
import HistoricalIssuanceDialog from '@/components/inventory/HistoricalIssuanceDialog';
import HistoricalReturnDialog from '@/components/inventory/HistoricalReturnDialog';

/**
 * Everything issued to one employee (active or inactive) with what came back,
 * what is still outstanding, the return history and the audit trail of every
 * historical entry / correction.
 */
export default function EmployeeIssuanceDetailsDialog({ open, onClose, employee, warranties = [], canEdit = false }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const [issueLine, setIssueLine] = useState(undefined); // undefined = closed, null = new
  const [returnRow, setReturnRow] = useState(null);
  const [auditLine, setAuditLine] = useState(null);
  const warningDays = useWarrantySetting();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['employee-issuance', employee?.id],
    queryFn: () => fetchEmployeeIssuance(employee?.id),
    enabled: !!employee?.id && open,
    staleTime: 10000,
  });

  const issued = data?.issued || [];
  const returns = data?.returns || [];
  const rows = useMemo(() => buildIssuanceRows(issued, returns), [issued, returns]);
  const rowById = useMemo(() => new Map(rows.map(r => [r.line.id, r])), [rows]);
  const vouchers = useMemo(() => groupTransactionsIntoDocuments(issued), [issued]);
  const voucherNumbers = existingVouchers(issued);

  const totalQty = issued.reduce((sum, t) => sum + (t.quantity_abs || 0), 0);
  const totalReturned = rows.reduce((sum, r) => sum + r.returnedQty, 0);
  const totalOutstanding = rows.reduce((sum, r) => sum + r.outstandingQty, 0);
  const distinctItems = new Set(issued.map(t => t.item_id).filter(Boolean)).size;

  if (!employee) return null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['employee-issuance', employee.id] });
    qc.invalidateQueries({ queryKey: ['inventory-transactions'] });
  };

  const toggle = (key) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleExport = () => exportEmployeeIssuanceExcel(employee, issued);

  const handlePrint = () => {
    const printWin = window.open('', '_blank');
    const printRows = rows.map(r => `
      <tr>
        <td>${r.line.transaction_date || ''}</td>
        <td>${r.line.iv_no || ''}</td>
        <td>${r.line.item_sn || ''}</td>
        <td>${r.line.item_name || ''}</td>
        <td>${r.line.unit || ''}</td>
        <td>${r.line.site || ''}</td>
        <td style="text-align:right">${r.line.quantity_abs || 0}</td>
        <td style="text-align:right">${r.returnedQty}</td>
        <td style="text-align:right">${r.outstandingQty}</td>
        <td>${r.line.created_by_name || ''}</td>
        <td>${r.line.remarks || ''}</td>
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
        <div><label>Status</label><br><value>${employee.personnel_status === 'Inactive' || employee.is_active === false ? 'Inactive' : 'Active'}</value></div>
        <div><label>PID No.</label><br><value>${employee.pid || ''}</value></div>
        <div><label>QID No.</label><br><value>${employee.qid_no || ''}</value></div>
        <div><label>Company</label><br><value>${employee.company || ''}</value></div>
        <div><label>Department</label><br><value>${employee.department || ''}</value></div>
        <div><label>Designation</label><br><value>${employee.position_application || employee.designation_org_chart || ''}</value></div>
      </div>
      <h2>Issued Inventory Items</h2>
      <table><thead><tr>
        <th>Date</th><th>I/V No.</th><th>Item S.N.</th><th>Item Name</th><th>Unit</th><th>Site</th>
        <th>Qty</th><th>Returned</th><th>Outstanding</th><th>Issued By</th><th>Remarks</th>
      </tr></thead><tbody>${printRows}</tbody></table>
      <div class="totals">
        Total Different Items Issued: ${distinctItems} | Total Quantity Issued: ${totalQty} |
        Total Returned: ${totalReturned} | Outstanding: ${totalOutstanding}
      </div>
      </body></html>`);
    printWin.document.close();
    printWin.print();
  };

  const itemNameOf = (returnOf) => {
    const line = issued.find(t => t.id === returnOf);
    return line ? `${line.item_sn} — ${line.item_name}` : '—';
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee Issuance Details</DialogTitle>
        </DialogHeader>

        {/* Employee info from Workforce Management */}
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Employee Name</p>
                <p className="flex items-center gap-2 text-sm font-semibold">
                  {employee.name}
                  <EmployeeStatusBadge employee={employee} />
                </p>
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
            <div className="mt-3 pt-3 border-t grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Different Items Issued</p>
                <p className="text-xl font-bold text-blue-600">{distinctItems}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Quantity Issued</p>
                <p className="text-xl font-bold text-orange-600">{totalQty}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Returned</p>
                <p className="text-xl font-bold text-emerald-600">{totalReturned}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="text-xl font-bold text-slate-700">{totalOutstanding}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Issue vouchers — expand to see every item under the same I/V */}
        <Card className="border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 border-b">
            <p className="text-sm font-semibold">
              Issue Vouchers ({vouchers.length}) · {issued.length} item line{issued.length === 1 ? '' : 's'}
            </p>
            <div className="flex gap-2">
              {canEdit && (
                <Button variant="default" size="sm" onClick={() => setIssueLine(null)}>
                  <Plus className="w-3.5 h-3.5" /> Historical Issue
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-3.5 h-3.5" /> Export Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="w-3.5 h-3.5" /> Print / PDF
              </Button>
            </div>
          </div>
          <div className="table-scroll-x max-h-[420px]">
            <Table className="table-list-view">
              <TableHeader>
                <TableRow className="bg-slate-50 sticky top-0">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead className="w-24">I/V No.</TableHead>
                  <TableHead>Item / Voucher / Asset</TableHead>
                  <TableHead className="w-14">Unit</TableHead>
                  <TableHead className="w-14 text-right">Qty</TableHead>
                  <TableHead className="w-16 text-right">Returned</TableHead>
                  <TableHead className="w-20 text-right">Outstanding</TableHead>
                  <TableHead className="w-40">Issued By / Warranties</TableHead>
                  <TableHead className="w-28 text-center">Action</TableHead>
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
                        <TableCell className="text-right">
                          {v.lines.reduce((s, t) => s + (rowById.get(t.id)?.returnedQty || 0), 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          {v.lines.reduce((s, t) => s + (rowById.get(t.id)?.outstandingQty || 0), 0)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {isOpen ? 'Click to collapse' : 'Click to view items'}
                        </TableCell>
                        <TableCell></TableCell>
                      </TableRow>
                      {isOpen && v.lines.map(t => {
                        const row = rowById.get(t.id);
                        // The exact asset(s) issued keep their original warranty record.
                        const assets = issuedAssetsFor(warranties, employee.id, t.item_id, t.iv_no || '');
                        const asset = assets[0];
                        const status = asset ? warrantyStatus(asset.warranty_expiry_date, warningDays) : 'No Warranty';
                        const expiry = assets.map(a => a.warranty_expiry_date).filter(Boolean).sort()[0] || '';
                        const audit = Array.isArray(t.edit_history) ? t.edit_history : [];
                        return (
                          <React.Fragment key={t.id}>
                            <TableRow>
                              <TableCell></TableCell>
                              <TableCell>{t.transaction_date}</TableCell>
                              <TableCell className="font-mono">{t.iv_no || '—'}</TableCell>
                              <TableCell className="pl-4">
                                <span className="font-mono font-semibold">{t.item_sn}</span> — {t.item_name}
                                {t.is_historical ? (
                                  <span className="ml-2 rounded border border-slate-300 bg-slate-100 px-1 text-[9px] font-semibold uppercase text-slate-600">
                                    Historical
                                  </span>
                                ) : null}
                                {asset ? (
                                  <span className="ml-2 text-[10px] font-mono text-blue-700">
                                    Asset: {assets.map(a => a.serial_no).join(', ')}
                                  </span>
                                ) : null}
                              </TableCell>
                              <TableCell>{t.unit}</TableCell>
                              <TableCell className="text-right font-semibold">{t.quantity_abs}</TableCell>
                              <TableCell className="text-right">{row?.returnedQty || 0}</TableCell>
                              <TableCell className="text-right font-semibold">{row?.outstandingQty || 0}</TableCell>
                              <TableCell className="text-[10px]">
                                <span className="block">{t.created_by_name || t.created_by || '—'}</span>
                                {asset ? (
                                  <span className="block">
                                    <span className={`px-1 rounded border font-semibold ${warrantyStatusClasses(status)}`}>{status}</span>
                                    {' '}Exp {expiry || '—'}
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">No warranty</span>
                                )}
                              </TableCell>
                              <TableCell className="text-center">
                                <div className="flex justify-center gap-1">
                                  {canEdit && (
                                    <>
                                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Correct this record"
                                        onClick={() => setIssueLine(t)}>
                                        <Pencil className="w-3 h-3" />
                                      </Button>
                                      <Button size="icon" variant="ghost" className="h-6 w-6" title="Record a return"
                                        onClick={() => setReturnRow(row)}>
                                        <Undo2 className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                  {audit.length > 0 && (
                                    <Button size="icon" variant="ghost" className="h-6 w-6" title="Audit trail"
                                      onClick={() => setAuditLine(auditLine === t.id ? null : t.id)}>
                                      <History className="w-3 h-3" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                            {auditLine === t.id && (
                              <TableRow>
                                <TableCell colSpan={10} className="bg-slate-50/70">
                                  <p className="mb-1 text-[10px] font-semibold uppercase text-slate-500">Audit trail</p>
                                  <ul className="space-y-1 text-[10px] text-slate-700">
                                    {audit.map((entry, idx) => (
                                      <li key={idx} className="border-l-2 border-slate-300 pl-2">
                                        <span className="font-semibold">{entry.change_type || 'Correction'}</span>
                                        {' · '}
                                        {String(entry.edited_at || '').replace('T', ' ').slice(0, 16)}
                                        {' · '}
                                        {entry.edited_by_name || entry.edited_by || '—'}
                                        {entry.reason ? ` · ${entry.reason}` : ''}
                                        {entry.changes?.length ? (
                                          <span className="block text-slate-500">
                                            {entry.changes.map(c => `${c.field}: ${c.from || '—'} → ${c.to || '—'}`).join(' | ')}
                                          </span>
                                        ) : null}
                                      </li>
                                    ))}
                                  </ul>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </React.Fragment>
                  );
                })}
                {!isLoading && vouchers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      No inventory issued to this employee.
                    </TableCell>
                  </TableRow>
                )}
                {isLoading && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-muted-foreground">
                      Loading issuance records…
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Return history */}
        <Card className="border-slate-200">
          <div className="p-3 border-b">
            <p className="text-sm font-semibold">Return History ({returns.length})</p>
          </div>
          <div className="table-scroll-x max-h-[220px]">
            <Table className="table-list-view">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-24">Date</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="w-16 text-right">Qty</TableHead>
                  <TableHead className="w-24">Store</TableHead>
                  <TableHead>Reason / Remarks</TableHead>
                  <TableHead className="w-36">Recorded By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map(r => (
                  <TableRow key={r.id}>
                    <TableCell>{r.transaction_date}</TableCell>
                    <TableCell>{itemNameOf(r.return_of)}</TableCell>
                    <TableCell className="text-right font-semibold">{r.quantity_abs}</TableCell>
                    <TableCell>{r.store || '—'}</TableCell>
                    <TableCell className="text-[10px]">
                      {r.return_reason || '—'}
                      {r.remarks ? <span className="block text-muted-foreground">{r.remarks}</span> : null}
                    </TableCell>
                    <TableCell className="text-[10px]">
                      {r.created_by_name || r.created_by || '—'}
                      {r.is_historical ? <span className="block text-muted-foreground">Historical</span> : null}
                    </TableCell>
                  </TableRow>
                ))}
                {returns.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                      No returns recorded for this employee.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </DialogContent>

      <HistoricalIssuanceDialog
        open={issueLine !== undefined}
        onClose={() => setIssueLine(undefined)}
        employee={employee}
        line={issueLine || null}
        vouchers={voucherNumbers}
        onSaved={refresh}
      />

      <HistoricalReturnDialog
        open={!!returnRow}
        onClose={() => setReturnRow(null)}
        employee={employee}
        line={returnRow?.line || null}
        outstanding={returnRow?.outstandingQty || 0}
        onSaved={refresh}
      />
    </Dialog>
  );
}