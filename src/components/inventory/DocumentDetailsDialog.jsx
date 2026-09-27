import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileText } from 'lucide-react';

const TYPE_LABEL = {
  STOCK_IN: 'Stock In — Delivery Note',
  STOCK_OUT: 'Stock Out — Store Issue Voucher',
  TRANSFER: 'Stock Transfer',
  RETURN: 'Return',
};

/**
 * Shows one document (D/N or I/V) together with every item line saved under it.
 */
export default function DocumentDetailsDialog({ open, onClose, group }) {
  if (!group) return null;
  const isOut = group.type === 'STOCK_OUT';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <div>
                <p className="text-xs text-muted-foreground">{isOut ? 'Employee' : 'Supplier'}</p>
                <p className="text-sm">{isOut ? (group.employeeName || '—') : (group.supplier || '—')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{isOut ? 'PID No.' : 'Store'}</p>
                <p className={`text-sm ${isOut ? 'font-mono' : ''}`}>{isOut ? (group.pid || '—') : (group.store || '—')}</p>
              </div>
              {isOut && (
                <div>
                  <p className="text-xs text-muted-foreground">Company</p>
                  <p className="text-sm">{group.company || '—'}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">{isOut ? 'Site' : 'Store'}</p>
                <p className="text-sm">{isOut ? (group.site || '—') : (group.store || '—')}</p>
              </div>
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
                  <TableCell className="text-right text-muted-foreground">{t.previous_balance}</TableCell>
                  <TableCell className="text-right font-semibold">{t.new_balance}</TableCell>
                  <TableCell>{t.remarks || '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}