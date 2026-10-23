import React from 'react';
import { IMPORT_MODES, PLACEMENT_OPTIONS } from '@/lib/orgChartMerge';

const chip = 'px-2 py-0.5 rounded-full border text-[10px]';

export default function InsertPlacementOptions({
  mode, setMode, placement, setPlacement, gap, setGap,
}) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Insert mode</p>
        <div className="space-y-1">
          {IMPORT_MODES.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={`w-full text-left rounded-md border px-2 py-1.5 ${mode === item.key ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <span className="block text-[11px] font-medium">{item.label}</span>
              <span className="block text-[10px] text-muted-foreground">{item.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Placement</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEMENT_OPTIONS.map(item => (
            <button
              key={item.key}
              type="button"
              onClick={() => setPlacement(item.key)}
              className={`${chip} ${placement === item.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 text-[10px] mt-2">
          <span className="text-muted-foreground">Spacing between charts</span>
          <input
            type="number"
            min={20}
            max={600}
            step={20}
            value={gap}
            onChange={(e) => setGap(Math.max(20, Number(e.target.value) || 140))}
            className="w-16 h-7 rounded-md border bg-background px-2 text-[11px]"
          />
        </label>
      </div>
    </div>
  );
}