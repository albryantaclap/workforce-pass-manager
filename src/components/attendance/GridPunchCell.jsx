import React from 'react';
import { cn } from '@/lib/utils';

// One editable punch cell in the Time Entries grid. The value is "HH:mm" (or ''
// when there is no punch); every change is staged in the parent until Save.
export default function GridPunchCell({ value, dirty, onChange }) {
  return (
    <div className="flex items-center gap-0.5">
      <input
        type="time"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        className={cn(
          'h-7 w-[86px] rounded border px-1 text-[11px]',
          dirty ? 'border-amber-400 bg-amber-50 text-amber-900' : 'border-input bg-transparent'
        )}
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange('')}
          title="Clear this punch"
          className="px-0.5 text-[12px] leading-none text-muted-foreground hover:text-red-600"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}