import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, AlertTriangle, ShieldCheck } from 'lucide-react';
import ItemLinePicker from '@/components/inventory/ItemLinePicker';
import LineEmployeePicker from '@/components/inventory/LineEmployeePicker';
import LineWarrantyFields from '@/components/inventory/LineWarrantyFields';
import AssetSerialPicker from '@/components/inventory/AssetSerialPicker';
import { calculateAvailableStock } from '@/lib/inventoryService';
import { itemDisplayName, itemDisplayUnit } from '@/lib/inventoryText';
import { emptyWarrantyLineFields, assetsInStockForItem, warrantyStatus, warrantyStatusClasses } from '@/lib/warranty';

let lineSeq = 0;

/** A blank document line (Stock In lines carry their own warranty block). */
export function blankLine() {
  lineSeq += 1;
  return {
    key: `line-${lineSeq}`,
    item_id: '', item_sn: '', item_name: '', unit: '', quantity: '', remarks: '',
    employee_id: '', employee_name: '', pid: '', company: '', department: '', designation: '',
    ...emptyWarrantyLineFields(),
    serial_text: '',
    asset_serials: [],
  };
}

/** The employee fields one issue line carries once an employee is picked. */
export const employeeLineFields = (emp) => ({
  employee_id: emp?.id || '',
  employee_name: emp?.name || '',
  pid: String(emp?.pid || emp?.staff_no || ''),
  company: emp?.company || '',
  department: emp?.department || '',
  designation: emp?.position_application || emp?.designation_org_chart || '',
});

export const emptyEmployeeLineFields = () => ({
  employee_id: '', employee_name: '', pid: '', company: '', department: '', designation: '',
});

/**
 * Item lines table shared by Stock In (mode="in") and Stock Out (mode="out").
 * Handles multiple items under one document and, for Stock Out, live
 * available-stock display per line.
 *
 * Stock Out: every line is issued to its own employee (searched by Name, PID or
 * QID), so one store issue voucher can serve several employees, and the same
 * item may be issued to more than one of them — the voucher's total per item is
 * what has to fit the available stock.
 *
 * Stock In: every line owns its warranty fields — one receipt may carry items
 * with completely different warranty periods, and serialized units keep their
 * own warranty each.
 */
export default function DocumentLineItems({ mode = 'in', lines, onChange, employees = [], transactions = [], warranties = [], warningDays = 30, warrantyEnabled = true }) {
  const isOut = mode === 'out';
  const showWarranty = !isOut && warrantyEnabled;
  const usedIds = lines.map(l => l.item_id).filter(Boolean);
  const [openWarranty, setOpenWarranty] = useState(() => new Set());

  const patchLine = (key, patch) => onChange(lines.map(l => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key) => onChange(lines.filter(l => l.key !== key));
  const addLine = () => onChange([...lines, blankLine()]);

  const toggleWarranty = (key) => setOpenWarranty(prev => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const handleSelect = (key, item) => {
    patchLine(key, {
      item_id: item.id,
      item_sn: item.item_sn || '',
      item_name: itemDisplayName(item),
      unit: itemDisplayUnit(item),
      asset_serials: [],
    });
  };

  // Quantity asked for each item across all lines of this voucher — the same
  // item on two lines is validated together, so nothing is ever over-issued.
  const requestedByItem = new Map();
  lines.forEach(l => {
    if (l.item_id) requestedByItem.set(l.item_id, (requestedByItem.get(l.item_id) || 0) + Number(l.quantity || 0));
  });

  const outColumnCount = 11;
  const inColumnCount = showWarranty ? 8 : 7;

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
              <TableHead className="w-[280px]">Item S.N. *</TableHead>
              <TableHead>Item Name / Description</TableHead>
              <TableHead className="w-16">Unit</TableHead>
              {isOut && <TableHead className="w-20 text-right">Available</TableHead>}
              <TableHead className="w-24 text-right">Qty *</TableHead>
              {isOut && <TableHead className="w-[220px]">Employee *</TableHead>}
              {isOut && <TableHead className="w-24">PID No.</TableHead>}
              {isOut && <TableHead className="w-28">Company</TableHead>}
              <TableHead className="w-40">Remarks</TableHead>
              {showWarranty && <TableHead className="w-32">Warranty</TableHead>}
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((line, idx) => {
              const available = isOut && line.item_id ? calculateAvailableStock(transactions, line.item_id) : null;
              const requested = line.item_id ? (requestedByItem.get(line.item_id) || 0) : 0;
              const onSeveralLines = isOut && line.item_id && lines.filter(l => l.item_id === line.item_id).length > 1;
              const over = isOut && available !== null && requested > available;
              const assets = isOut && line.item_id ? assetsInStockForItem(warranties, line.item_id) : [];
              const status = line.warranty_applicable
                ? warrantyStatus(line.warranty_expiry_date, warningDays)
                : null;
              const warrantyOpen = openWarranty.has(line.key) || !!line.warranty_applicable;
              return (
                <React.Fragment key={line.key}>
                  <TableRow className={over ? 'bg-red-50' : ''}>
                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell>
                      <ItemLinePicker
                        item={line.item_id ? { id: line.item_id, item_sn: line.item_sn, item_name: line.item_name, unit: line.unit } : null}
                        excludeIds={isOut ? [] : usedIds}
                        onSelect={(item) => handleSelect(line.key, item)}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{line.item_name || '—'}</TableCell>
                    <TableCell>{line.unit || '—'}</TableCell>
                    {isOut && (
                      <TableCell className={`text-right font-semibold ${over ? 'text-red-600' : 'text-amber-700'}`}>
                        {available === null ? '—' : available}
                        {onSeveralLines && !over && (
                          <span className="block text-[9px] font-normal text-muted-foreground">{requested} on this voucher</span>
                        )}
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
                    {isOut && (
                      <TableCell>
                        <LineEmployeePicker
                          employees={employees}
                          value={line}
                          onSelect={(emp) => patchLine(line.key, employeeLineFields(emp))}
                          onClear={() => patchLine(line.key, emptyEmployeeLineFields())}
                        />
                      </TableCell>
                    )}
                    {isOut && <TableCell className="font-mono">{line.pid || '—'}</TableCell>}
                    {isOut && <TableCell>{line.company || '—'}</TableCell>}
                    <TableCell>
                      <Input
                        value={line.remarks}
                        onChange={e => patchLine(line.key, { remarks: e.target.value })}
                        className="h-8 text-xs"
                        placeholder="Line remarks"
                      />
                    </TableCell>
                    {showWarranty && (
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => toggleWarranty(line.key)}
                          className="flex items-center gap-1 text-[10px] font-semibold"
                        >
                          <ShieldCheck className={`w-3.5 h-3.5 ${line.warranty_applicable ? 'text-emerald-600' : 'text-slate-400'}`} />
                          {line.warranty_applicable ? (
                            <span className={`px-1.5 py-0.5 rounded border ${warrantyStatusClasses(status)}`}>
                              {status === 'No Warranty' ? 'Set expiry' : status}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">No warranty</span>
                          )}
                        </button>
                        <p className="text-[9px] text-muted-foreground mt-0.5">
                          {warrantyOpen ? 'Click to hide fields' : 'Click to add warranty'}
                        </p>
                      </TableCell>
                    )}
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

                  {/* Warranty block — one per receipt, independent of the other lines */}
                  {showWarranty && warrantyOpen && (
                    <TableRow>
                      <TableCell colSpan={inColumnCount} className="bg-white p-2">
                        <LineWarrantyFields line={line} onChange={(patch) => patchLine(line.key, patch)} />
                      </TableCell>
                    </TableRow>
                  )}

                  {/* Serialized assets available to issue */}
                  {isOut && assets.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={outColumnCount} className="bg-white p-2">
                        <AssetSerialPicker
                          assets={assets}
                          quantity={line.quantity}
                          value={line.asset_serials || []}
                          onChange={(serials) => patchLine(line.key, { asset_serials: serials })}
                          warningDays={warningDays}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}