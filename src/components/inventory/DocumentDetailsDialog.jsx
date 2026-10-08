import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText, Printer } from 'lucide-react';
import { printVoucher } from '@/lib/voucherPrint';

const TYPE_LABEL = {
  STOCK_IN: 'Stock In — Delivery Note',
  STOCK_OUT: 'Stock Out — Store Issue Voucher',
  TRANSFER: 'Stock Transfer',
  RETURN: 'Return',
};

/**
 * Shows one document (D/N or I/V) together with every item line saved under it.
 * One issue voucher may serve several employees, so each line shows who received
 * it, and the whole voucher can be printed as a single sheet.
 */
export default function DocumentDetailsDialog({ open, onClose, group }) {
  if (!group) return null;
  const isOut = group.type === 'STOCK_OUT';
  const employees = [...new Set((group.lines || []).map(l => l.employee_name).filter(Boolean))];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {TYPE_LABEL[group.type] || 'Stock Document'}
            {group.documentNo ? ` — ${group.documentNo}` : ''}
          </DialogTitle>
        </DialogHeader>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">{isOut ? 'I/V No.' : 'D/N No.'}</p>
                <p className="text-sm font-mono font-semibold">{group.documentNo || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Date</p>
                <p className="text-sm">{group.date || '—'}</p>
              </div>
              {isOut ? (
                <div>
                  <p className="text-xs text-muted-foreground">Employees</p>
                  <p className="text-sm">
                    {employees.length === 0 ? '—' : employees.length === 1 ? employees[0] : `${employees.length} employees`}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xs text-muted-foreground">Supplier</p>
                  <p className="text-sm">{group.supplier || '—'}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">{isOut ? 'Site' : 'Store'}</p>
                <p className="text-sm">{isOut ? (group.site || '—') : (group.store || '—')}</p>
              </div>
              {isOut && (
                <div>
                  <p className="text-xs text-muted-foreground">Store</p>
                  <p className="text-sm">{group.store || '—'}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Recorded By</p>
                <p className="text-sm">{group.createdBy || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Items / Total Qty</p>
                <p className="text-sm font-semibold">{group.lineCount} item{group.lineCount === 1 ? '' : 's'} · {group.totalQty}</p>
              </div>
            </div>
            {group.fileUrl && (
              <a href={group.fileUrl} target="_blank" rel="noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
                <FileText className="w-3.5 h-3.5" /> View uploaded {isOut ? 'store voucher' : 'delivery note'}
              </a>
            )}
          </CardContent>
        </Card>

        <div className="rounded-md border table-scroll-x">
          <Table className="table-list-view">
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead className="w-8">#</TableHead>
                <TableHead className="w-24">Item S.N.</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead className="w-16">Unit</TableHead>
                <TableHead className="w-16 text-right">Qty</TableHead>
                {isOut && <TableHead>Employee</TableHead>}
                {isOut && <TableHead className="w-24">PID No.</TableHead>}
                {isOut && <TableHead className="w-28">Company</TableHead>}
                <TableHead className="w-16 text-right">Prev</TableHead>
                <TableHead className="w-16 text-right">New</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {group.lines.map((t, idx) => (
                <TableRow key={t.id}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell className="font-mono font-semibold">{t.item_sn}</TableCell>
                  <TableCell className="font-medium">{t.item_name}</TableCell>
                  <TableCell>{t.unit}</TableCell>
                  <TableCell className={`text-right font-bold ${isOut ? 'text-orange-600' : 'text-green-600'}`}>
                    {isOut ? '-' : '+'}{t.quantity_abs}
                  </TableCell>
                  {isOut && <TableCell>{t.employee_name || '—'}</TableCell>}
                  {isOut && <TableCell className="font-mono">{t.pid || '—'}</TableCell>}
                  {isOut && <TableCell>{t.company || '—'}</TableCell>}
                  <TableCell className="text-right text-muted-foreground">{t.previous_balance}</TableCell>
                  <TableCell className="text-right font-semibold">{t.new_balance}</TableCell>
                  <TableCell>{t.remarks || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {group.lineCount} line{group.lineCount === 1 ? '' : 's'} · total quantity {group.totalQty}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={() => printVoucher(group)}>
              <Printer className="w-4 h-4" /> Print voucher
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}