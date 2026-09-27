import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Paperclip, ChevronRight, ChevronDown, ShieldCheck, ShieldOff } from 'lucide-react';
import {
  warrantyStatus, warrantyStatusClasses, describePeriod, isActiveWarranty,
} from '@/lib/warranty';

/**
 * Warranty details for one inventory item — every receipt (batch) and every
 * serialized asset is listed with its own warranty; dates are never merged.
 */
export default function WarrantyDetailsDialog({ open, onClose, item, rows = [], warningDays = 30 }) {
  const [expanded, setExpanded] = useState(() => new Set());
  if (!item) return null;

  const itemRows = rows
    .filter(r => isActiveWarranty(r) && r.item_id === item.id && r.warranty_applicable !== false)
    .sort((a, b) => (a.serial_no || '').localeCompare(b.serial_no || ''));

  const toggle = (id) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Warranty Details — {item.item_sn}</DialogTitle>
        </DialogHeader>

        <Card className="border-slate-200">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Item S.N.</p>
                <p className="text-sm font-mono font-semibold">{item.item_sn}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Item Name</p>
                <p className="text-sm">{item.item_name}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Category</p>
                <p className="text-sm">{item.category || '—'}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Warranty Records</p>
                <p className="text-sm font-semibold">{itemRows.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {itemRows.length === 0 ? (
          <Card className="border-slate-200">
            <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
              <ShieldOff className="w-4 h-4" />
              No warranty recorded for this item — its receipts were saved with Warranty Applicable = No.
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-md border table-scroll-x">
            <Table className="table-list-view">
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="w-28">Serial / Asset No.</TableHead>
                  <TableHead className="w-24">D/N No.</TableHead>
                  <TableHead className="w-24">Stock In Date</TableHead>
                  <TableHead className="w-32">Supplier</TableHead>
                  <TableHead className="w-24">Warranty Start</TableHead>
                  <TableHead className="w-20">Period</TableHead>
                  <TableHead className="w-24">Warranty Expiry</TableHead>
                  <TableHead className="w-28">Warranty Status</TableHead>
                  <TableHead className="w-28">Reference</TableHead>
                  <TableHead className="w-24">Location</TableHead>
                  <TableHead className="w-32">Issued To</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itemRows.map(r => {
                  const status = warrantyStatus(r.warranty_expiry_date, warningDays);
                  const isOpen = expanded.has(r.id);
                  return (
                    <React.Fragment key={r.id}>
                      <TableRow>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => toggle(r.id)}>
                            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                          </Button>
                        </TableCell>
                        <TableCell className="font-mono font-semibold">
                          {r.serial_no || <span className="italic text-muted-foreground">Batch ({r.quantity})</span>}
                        </TableCell>
                        <TableCell className="font-mono">{r.document_no || '—'}</TableCell>
                        <TableCell>{r.stock_in_date || '—'}</TableCell>
                        <TableCell>{r.supplier || '—'}</TableCell>
                        <TableCell>{r.warranty_start_date || '—'}</TableCell>
                        <TableCell>{describePeriod(r)}</TableCell>
                        <TableCell className="font-semibold">{r.warranty_expiry_date || '—'}</TableCell>
                        <TableCell>
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-semibold ${warrantyStatusClasses(status)}`}>
                            {status}
                          </span>
                        </TableCell>
                        <TableCell>{r.warranty_ref_no || '—'}</TableCell>
                        <TableCell>{r.current_location || r.store || '—'}</TableCell>
                        <TableCell>{r.issued_to_name || '—'}</TableCell>
                      </TableRow>
                      {isOpen && (
                        <TableRow className="bg-slate-50/70">
                          <TableCell></TableCell>
                          <TableCell colSpan={11}>
                            <div className="space-y-1 py-1">
                              <p className="text-[11px]">
                                <span className="font-semibold">Warranty Applicable:</span> Yes ·
                                <span className="font-semibold ml-2">Start:</span> {r.warranty_start_date || '—'} ·
                                <span className="font-semibold ml-2">Period:</span> {describePeriod(r)} ·
                                <span className="font-semibold ml-2">Expiry:</span> {r.warranty_expiry_date || '—'}
                                {r.warranty_expiry_overridden ? ' (manual override)' : ' (calculated)'} ·
                                <span className="font-semibold ml-2">Asset status:</span> {r.asset_status || '—'}
                              </p>
                              <p className="text-[11px]">
                                <span className="font-semibold">Remarks:</span> {r.warranty_remarks || '—'}
                              </p>
                              <p className="text-[11px]">
                                <span className="font-semibold">Issued under:</span> {r.issued_iv_no || '—'}
                                {r.issued_date ? ` on ${r.issued_date}` : ''}
                                {r.issued_company ? ` · ${r.issued_company}` : ''}
                              </p>
                              {r.warranty_file_url ? (
                                <a href={r.warranty_file_url} target="_blank" rel="noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:underline">
                                  <Paperclip className="w-3 h-3" /> Open warranty certificate
                                </a>
                              ) : (
                                <p className="text-[11px] text-muted-foreground">No supporting document attached.</p>
                              )}
                              <div className="pt-1">
                                <p className="text-[11px] font-semibold flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-blue-600" /> Movement history
                                </p>
                                {(r.movement_history || []).length === 0 ? (
                                  <p className="text-[11px] text-muted-foreground">No movements recorded.</p>
                                ) : (
                                  <ul className="text-[11px] text-muted-foreground space-y-0.5 mt-0.5">
                                    {r.movement_history.map((m, i) => (
                                      <li key={i}>• {m.date} — {m.action}: {m.detail}</li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}