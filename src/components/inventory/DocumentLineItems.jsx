import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import ItemLinePicker from '@/components/inventory/ItemLinePicker';
import { calculateAvailableStock } from '@/lib/inventoryService';
import { itemDisplayName, itemDisplayUnit } from '@/lib/inventoryText';

let lineSeq = 0;

/** A blank document line. */
export function blankLine() {
  lineSeq += 1;
  return { key: `line-${lineSeq}`, item_id: '', item_sn: '', item_name: '', unit: '', quantity: '', remarks: '' };
}

/**
 * Item lines table shared by Stock In (mode="in") and Stock Out (mode="out").
 * Handles multiple items under one document, duplicate prevention and, for
 * Stock Out, live available-stock display per line.
 */
export default function DocumentLineItems({ mode = 'in', lines, onChange, transactions = [] }) {
  const isOut = mode === 'out';
  const usedIds = lines.map(l => l.item_id).filter(Boolean);

  const patchLine = (key, patch) => onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => onChange(lines.filter(l => l.key !== key));
  const addLine = () => onChange([...lines, blankLine()]);

  const handleSelect = (key, item) => {
    patchLine(key, {
      item_id: item.id,
      item_sn: item.item_sn || '',
      item_name: itemDisplayName(item),
      unit: itemDisplayUnit(item),
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">
          Items <span className="text-muted-foreground font-normal">({lines.length} line{lines.length === 1 ? '' : 's'})</span>
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
              <TableHead className="w-[300px]">Item S.N. *</TableHead>
              <TableHead>Item Name / Description</TableHead>
              <TableHead className="w-16">Unit</TableHead>
              {isOut && <TableHead className="w-20 text-right">Available</TableHead>}
              <TableHead className="w-24 text-right">Qty *</TableHead>
              <TableHead className="w-40">Remarks</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, idx) => {
              const available = isOut && line.item_id ? calculateAvailableStock(transactions, line.item_id) : null;
              const over = isOut && available !== null && Number(line.quantity) > available;
              return (
                <TableRow key={line.key} className={over ? 'bg-red-50' : ''}>
                  <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                  <TableCell>
                    <ItemLinePicker
                      item={line.item_id ? { id: line.item_id, item_sn: line.item_sn, item_name: line.item_name, unit: line.unit } : null}
                      excludeIds={usedIds}
                      onSelect={(item) => handleSelect(line.key, item)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{line.item_name || '—'}</TableCell>
                  <TableCell>{line.unit || '—'}</TableCell>
                  {isOut && (
                    <TableCell className={`text-right font-semibold ${over ? 'text-red-600' : 'text-amber-700'}`}>
                      {available === null ? '—' : available}
                    </TableCell>
                  )}
                  <TableCell>
                    <Input
                      type="number"
                      min="1"
                      value={line.quantity}
                      onChange={e => patchLine(line.key, { quantity: e.target.value })}
                      className={`h-8 text-right text-xs ${over ? 'border-red-400' : ''}`}
                      placeholder="0"
                    />
                    {over && (
                      <p className="mt-0.5 text-[10px] text-red-600 font-semibold flex items-center gap-0.5">
                        <AlertTriangle className="w-3 h-3" /> Only {available} available
                      </p>
                    )}
                  </TableCell>
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