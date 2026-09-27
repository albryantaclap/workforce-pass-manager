import React, { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Paperclip, RefreshCw, Info } from 'lucide-react';
import { uploadInventoryFile } from '@/lib/inventoryService';
import { PERIOD_UNITS, computeWarrantyExpiry, warrantyStatus, warrantyStatusClasses, daysUntil } from '@/lib/warranty';
import { useWarrantySetting } from '@/hooks/useWarrantySetting';
import { useToast } from '@/components/ui/use-toast';

/** Parse the serial text box into per-asset warranty rows (values carried over). */
function parseSerialText(text, line, prev = []) {
  const sns = String(text || '').split(/[\n,;]+/).map(s => s.trim()).filter(Boolean);
  return sns.map(sn => {
    const found = prev.find(p => String(p.serial_no || '').trim().toLowerCase() === sn.toLowerCase());
    return found || {
      serial_no: sn,
      warranty_start_date: line.warranty_start_date || '',
      warranty_period: line.warranty_period || '',
      warranty_period_unit: line.warranty_period_unit || 'Months',
      warranty_expiry_date: line.warranty_expiry_date || '',
      warranty_ref_no: line.warranty_ref_no || '',
    };
  });
}

/**
 * Warranty block for one Stock In item line.
 *
 * Warranty Applicable = No  → saved normally, no warranty fields required.
 * Warranty Applicable = Yes → start date + period produce the expiry date
 * automatically, and the expiry can be overridden to match the certificate.
 * Serial numbers make each physical unit its own warranty record.
 */
export default function LineWarrantyFields({ line, onChange }) {
  const warningDays = useWarrantySetting();
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);

  const set = (patch) => onChange(patch);
  const serials = Array.isArray(line.serials) ? line.serials : [];
  const qty = Number(line.quantity) || 0;

  const recalcExpiry = () => {
    const expiry = computeWarrantyExpiry(line.warranty_start_date, line.warranty_period, line.warranty_period_unit);
    set({ warranty_expiry_date: expiry, warranty_expiry_overridden: false });
  };

  const handlePeriodChange = (patch) => {
    const next = { ...line, ...patch };
    if (!next.warranty_expiry_overridden) {
      next.warranty_expiry_date = computeWarrantyExpiry(next.warranty_start_date, next.warranty_period, next.warranty_period_unit);
    }
    onChange(next);
  };

  const patchSerial = (index, patch) => {
    const next = serials.map((s, i) => {
      if (i !== index) return s;
      const merged = { ...s, ...patch };
      if (!merged.expiry_overridden && !('warranty_expiry_date' in patch)) {
        merged.warranty_expiry_date = computeWarrantyExpiry(
          merged.warranty_start_date, merged.warranty_period, merged.warranty_period_unit
        );
      }
      return merged;
    });
    set({ serials: next });
  };

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadInventoryFile(file);
      set({ warranty_file_url: url });
      toast({ title: 'Warranty document uploaded' });
    } catch {
      toast({ title: 'Upload failed', variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const status = warrantyStatus(line.warranty_expiry_date, warningDays, true);
  const left = daysUntil(line.warranty_expiry_date);
  const dateError = line.warranty_expiry_date && line.warranty_start_date && line.warranty_expiry_date < line.warranty_start_date;

  return (
    <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Switch
            checked={!!line.warranty_applicable}
            onCheckedChange={(v) => set({ warranty_applicable: v })}
          />
          <span className="text-xs font-semibold">Warranty Applicable</span>
        </div>
        {line.warranty_applicable && line.warranty_expiry_date && (
          <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${warrantyStatusClasses(status)}`}>
            {status}{left !== null && status !== 'No Warranty' ? ` · ${left < 0 ? `${Math.abs(left)}d ago` : `${left}d left`}` : ''}
          </span>
        )}
      </div>

      {!line.warranty_applicable ? (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Info className="w-3 h-3" /> No warranty is required for this line — it is saved normally without warranty data
          (use this for consumables such as gloves, rope, welding rods and tape).
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <Label className="text-[11px]">Warranty Start Date *</Label>
              <Input type="date" value={line.warranty_start_date || ''}
                onChange={e => handlePeriodChange({ warranty_start_date: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Warranty Period</Label>
              <Input type="number" min="1" value={line.warranty_period || ''} placeholder="e.g. 36"
                onChange={e => handlePeriodChange({ warranty_period: e.target.value })} />
            </div>
            <div>
              <Label className="text-[11px]">Period Unit</Label>
              <Select value={line.warranty_period_unit || 'Months'}
                onValueChange={v => handlePeriodChange({ warranty_period_unit: v })}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[11px]">
                Warranty Expiry *
                <span className="ml-1 font-normal text-muted-foreground">
                  ({line.warranty_expiry_overridden ? 'manual' : 'auto'})
                </span>
              </Label>
              <div className="flex items-center gap-1">
                <Input type="date" value={line.warranty_expiry_date || ''}
                  className={dateError ? 'border-red-400' : ''}
                  onChange={e => set({ warranty_expiry_date: e.target.value, warranty_expiry_overridden: true })} />
                {line.warranty_expiry_overridden && (
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Recalculate from period"
                    onClick={recalcExpiry}>
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <div className="col-span-2">
              <Label className="text-[11px]">Warranty Reference / Certificate No.</Label>
              <Input value={line.warranty_ref_no || ''} onChange={e => set({ warranty_ref_no: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-[11px]">Warranty Remarks</Label>
              <Input value={line.warranty_remarks || ''} onChange={e => set({ warranty_remarks: e.target.value })} />
            </div>
          </div>

          {dateError && (
            <p className="text-[11px] font-semibold text-red-600">
              Warranty expiry cannot be earlier than the warranty start date.
            </p>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label className="text-[11px]">Serial / Asset Nos. (one per line — leave blank for a batch warranty)</Label>
              <textarea
                value={line.serial_text || ''}
                onChange={e => set({
                  serial_text: e.target.value,
                  serials: parseSerialText(e.target.value, line, serials),
                })}
                rows={3}
                placeholder={'SN-001\nSN-002\nSN-003'}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              />
              {serials.length > 0 && qty > 0 && serials.length !== qty && (
                <p className="mt-1 text-[11px] font-semibold text-amber-600">
                  {serials.length} serial number(s) for a quantity of {qty} — enter one serial per unit.
                </p>
              )}
            </div>
            <div>
              <Label className="text-[11px]">Warranty Certificate / Attachment</Label>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*,application/pdf" onChange={handleUpload}
                  className="text-xs file:mr-2 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-xs" />
                {uploading && <span className="text-[11px] text-muted-foreground">Uploading...</span>}
                {line.warranty_file_url && (
                  <a href={line.warranty_file_url} target="_blank" rel="noreferrer"
                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1">
                    <Paperclip className="w-3 h-3" /> Attached
                  </a>
                )}
              </div>
            </div>
          </div>

          {serials.length > 0 && (
            <div className="rounded-md border bg-white">
              <p className="px-3 py-1.5 text-[11px] font-semibold border-b bg-slate-50">
                Per-unit warranty ({serials.length} asset{serials.length === 1 ? '' : 's'})
              </p>
              <div className="table-scroll-x">
                <table className="w-full table-list-view">
                  <thead>
                    <tr className="bg-slate-50 text-left">
                      <th className="px-2 py-1">Serial / Asset No.</th>
                      <th className="px-2 py-1">Start</th>
                      <th className="px-2 py-1">Period</th>
                      <th className="px-2 py-1">Unit</th>
                      <th className="px-2 py-1">Expiry</th>
                      <th className="px-2 py-1">Reference</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serials.map((s, i) => (
                      <tr key={s.serial_no + i} className="border-t">
                        <td className="px-2 py-1 font-mono font-semibold">{s.serial_no}</td>
                        <td className="px-1 py-1">
                          <Input type="date" value={s.warranty_start_date || ''} className="h-7 text-[11px]"
                            onChange={e => patchSerial(i, { warranty_start_date: e.target.value })} />
                        </td>
                        <td className="px-1 py-1">
                          <Input type="number" min="1" value={s.warranty_period || ''} className="h-7 text-[11px]"
                            onChange={e => patchSerial(i, { warranty_period: e.target.value })} />
                        </td>
                        <td className="px-1 py-1">
                          <Select value={s.warranty_period_unit || 'Months'}
                            onValueChange={v => patchSerial(i, { warranty_period_unit: v })}>
                            <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {PERIOD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-1 py-1">
                          <Input type="date" value={s.warranty_expiry_date || ''} className="h-7 text-[11px]"
                            onChange={e => patchSerial(i, { warranty_expiry_date: e.target.value, expiry_overridden: true })} />
                        </td>
                        <td className="px-1 py-1">
                          <Input value={s.warranty_ref_no || ''} className="h-7 text-[11px]"
                            onChange={e => patchSerial(i, { warranty_ref_no: e.target.value })} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}