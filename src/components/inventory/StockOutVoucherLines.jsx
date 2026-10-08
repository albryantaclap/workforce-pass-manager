import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import ItemLinePicker from '@/components/inventory/ItemLinePicker';
import LineEmployeePicker from '@/components/inventory/LineEmployeePicker';
import { blankLine, employeeLineFields, emptyEmployeeLineFields } from '@/components/inventory/DocumentLineItems';
import { calculateAvailableStock } from '@/lib/inventoryService';
import { itemDisplayName, itemDisplayUnit } from '@/lib/inventoryText';

/**
 * The editable item lines of one issue voucher. Each line keeps the employee it
 * was issued to, and the same item may appear on several lines — the voucher's
 * total per item is what is checked against available stock.
 *
 * `ledger` is the inventory ledger WITHOUT this voucher's own lines, so the
 * availability shown already accounts for the voucher being corrected.
 */
export default function StockOutVoucherLines({ lines, onChange, employees = [], ledger = [] }) {
  const patchLine = (key, patch) => onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => onChange(lines.filter(l => l.key !== key));
  const addLine = () => onChange([...lines, blankLine()]);

  const requestedByItem = new Map();
  lines.forEach(l => {
    if (l.item_id) requestedByItem.set(l.item_id, (requestedByItem.get(l.item_id) || 0) + Number(l.quantity || 0));
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          Item lines <span className="text-muted-foreground font-normal">({lines.length})</span>
        </p>
        <Button type="button" size="sm" variant="outline" onClick={addLine}>
          <Plus className="w-3.5 h-3.5" /> Add Item
        </Button>
      </div>

      <div className="rounded-md border table-scroll-x">
        <Table className="table-list-view">
          <TableHeader>
            <TableRow className="bg-slate-50">
              <TableHead className="w-8">#</TableHead>
              <TableHead className="w-[280px]">Item S.N. *</TableHead>
              <TableHead>Item Name / Description</TableHead>
              <TableHead className="w-16">Unit</TableHead>
              <TableHead className="w-24 text-right">Available</TableHead>
              <TableHead className="w-24 text-right">Qty *</TableHead>
              <TableHead className="w-[220px]">Employee *</TableHead>
              <TableHead className="w-24">PID No.</TableHead>
              <TableHead className="w-28">Company</TableHead>
              <TableHead className="w-40">Remarks</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, idx) => {
              const available = line.item_id ? calculateAvailableStock(ledger, line.item_id) : null;
              const requested = line.item_id ? (requestedByItem.get(line.item_id) || 0) : 0;
              const over = available !== null && requested > available;
              const onSeveralLines = line.item_id && lines.filter(l => l.item_id === line.item_id).length > 1;
              return (
                <TableRow key={line.key} className={over ? 'bg-red-50' : ''}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <ItemLinePicker
                      item={line.item_id ? { id: line.item_id, item_sn: line.item_sn, item_name: line.item_name, unit: line.unit } : null}
                      excludeIds={[]}
                      onSelect={(item) => patchLine(line.key, {
                        item_id: item.id,
                        item_sn: item.item_sn || '',
                        item_name: itemDisplayName(item),
                        unit: itemDisplayUnit(item),
                      })}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{line.item_name || '—'}</TableCell>
                  <TableCell>{line.unit || '—'}</TableCell>
                  <TableCell className={`text-right font-semibold ${over ? 'text-red-600' : 'text-amber-700'}`}>
                    {available === null ? '—' : available}
                    {onSeveralLines && !over && (
                      <span className="block text-[9px] font-normal text-muted-foreground">{requested} on this voucher</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={e => patchLine(line.key, { quantity: e.target.value })}
                      className={`h-8 text-right text-xs ${over ? 'border-red-400' : ''}`}
                    />
                    {over && (
                      <p className="mt-0.5 text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Only {available} available
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <LineEmployeePicker
                      employees={employees}
                      value={line}
                      onSelect={(emp) => patchLine(line.key, employeeLineFields(emp))}
                      onClear={() => patchLine(line.key, emptyEmployeeLineFields())}
                    />
                  </TableCell>
                  <TableCell className="font-mono">{line.pid || '—'}</TableCell>
                  <TableCell>{line.company || '—'}</TableCell>
                  <TableCell>
                    <Input
                      value={line.remarks}
                      onChange={e => patchLine(line.key, { remarks: e.target.value })}
                      className="h-8 text-xs"
                      placeholder="Line remarks"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-red-500"
                      onClick={() => removeLine(line.key)}
                      disabled={lines.length === 1}
                      title="Remove line"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}