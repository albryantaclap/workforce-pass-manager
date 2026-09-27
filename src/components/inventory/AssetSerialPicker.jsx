import React from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { ShieldCheck, Info } from 'lucide-react';
import { warrantyStatus, warrantyStatusClasses } from '@/lib/warranty';

/**
 * Issue-time asset picker. Serialized assets keep their own warranty record, so
 * the storekeeper can point at the exact unit(s) being issued. Leaving it blank
 * links the issued units automatically by earliest expiry.
 */
export default function AssetSerialPicker({ assets = [], quantity = 0, value = [], onChange, warningDays = 30 }) {
  if (!assets.length) return null;

  const qty = Number(quantity) || 0;
  const toggle = (serial) => {
    const current = Array.isArray(value) ? value : [];
    if (current.some(s => s.toLowerCase() === serial.toLowerCase())) {
      onChange(current.filter(s => s.toLowerCase() !== serial.toLowerCase()));
      return;
    }
    if (qty > 0 && current.length >= qty) return; // never more units than the quantity
    onChange([...current, serial]);
  };

  return (
    <div className="rounded-md border border-blue-200 bg-blue-50/50 p-3 space-y-2">
      <p className="text-[11px] font-semibold flex items-center gap-1">
        <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
        Serialized assets in stock — select the unit(s) being issued
      </p>
      <div className="max-h-32 overflow-y-auto space-y-1">
        {assets.map(a => {
          const status = warrantyStatus(a.warranty_expiry_date, warningDays);
          const checked = (value || []).some(s => s.toLowerCase() === String(a.serial_no).toLowerCase());
          return (
            <label key={a.id}
              className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1 text-[11px] cursor-pointer">
              <Checkbox checked={checked} onCheckedChange={() => toggle(String(a.serial_no))} />
              <span className="font-mono font-semibold">{a.serial_no}</span>
              <span className="text-muted-foreground truncate">{a.item_name}</span>
              <span className={`ml-auto px-1.5 py-0.5 rounded border text-[9px] font-semibold ${warrantyStatusClasses(status)}`}>
                {status}{a.warranty_expiry_date ? ` · ${a.warranty_expiry_date}` : ''}
              </span>
            </label>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Info className="w-3 h-3" />
        {(value || []).length
          ? `${value.length} of ${qty || '—'} unit(s) assigned to specific assets.`
          : 'Nothing selected — the issued units are linked to the earliest-expiring assets automatically.'}
      </p>
    </div>
  );
}