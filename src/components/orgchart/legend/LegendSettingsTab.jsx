import React, { useEffect, useState } from 'react';
import { ALL_SCOPE_KEYS, DEFAULT_LEGEND_CONFIG, DETECT_SCOPES, LEGEND_LAYOUTS, legendConfig, normalizeColor } from '@/lib/orgChartLegend';

const row = 'flex items-center justify-between gap-2 text-[11px]';
const label = 'text-muted-foreground';
const inputCls = 'h-7 rounded-md border bg-background px-2 text-[11px]';

const FONT_FAMILIES = [
  { key: '', label: 'App default' },
  { key: 'Inter, system-ui, sans-serif', label: 'Inter' },
  { key: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { key: 'Georgia, serif', label: 'Georgia' },
  { key: '"Times New Roman", serif', label: 'Times New Roman' },
  { key: '"Courier New", monospace', label: 'Courier New' },
];
const SHADOWS = ['none', 'sm', 'md', 'lg'];

// Text fields commit on blur so one typing session is one undo step.
function CommitInput({ value, disabled, placeholder, className, onCommit }) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => { setDraft(value ?? ''); }, [value]);
  return (
    <input
      value={draft}
      disabled={disabled}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (String(draft) !== String(value ?? '')) onCommit(draft); }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      className={className || inputCls}
    />
  );
}

function NumberInput({ value, fallback, min, max, disabled, onCommit }) {
  return (
    <input
      type="number"
      min={min}
      max={max}
      value={value ?? ''}
      placeholder={String(fallback)}
      disabled={disabled}
      onChange={(e) => onCommit(e.target.value === '' ? undefined : Number(e.target.value))}
      className={`${inputCls} w-20`}
    />
  );
}

export default function LegendSettingsTab({ legend, canEdit, onPatchNode, onPatchConfig }) {
  const cfg = legendConfig(legend);
  const scope = cfg.scope || [];
  const allSelected = ALL_SCOPE_KEYS.every((key) => scope.includes(key));
  const toggleScope = (key, on) => onPatchConfig({
    scope: on ? [...new Set([...scope, key])] : scope.filter((k) => k !== key),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground">Legend</p>
        <div className={row}>
          <span className={label}>Title</span>
          <CommitInput value={legend.name} disabled={!canEdit} placeholder="Legend" onCommit={(name) => onPatchNode({ name })} className={`${inputCls} w-40`} />
        </div>
        <div className={row}>
          <span className={label}>Layout</span>
          <select
            value={cfg.layout}
            disabled={!canEdit}
            onChange={(e) => onPatchConfig({ layout: e.target.value })}
            className={`${inputCls} w-40`}
          >
            {LEGEND_LAYOUTS.map((l) => <option key={l.key} value={l.key}>{l.label}</option>)}
          </select>
        </div>
        <label className={row}>
          <span className={label}>Show header band</span>
          <input type="checkbox" checked={cfg.show_header !== false} disabled={!canEdit} onChange={(e) => onPatchConfig({ show_header: e.target.checked })} />
        </label>
        <label className={row}>
          <span className={label}>Add new colors automatically</span>
          <input type="checkbox" checked={cfg.auto_add !== false} disabled={!canEdit} onChange={(e) => onPatchConfig({ auto_add: e.target.checked })} />
        </label>

        <p className="text-[11px] font-semibold text-muted-foreground pt-2">Detect colors from</p>
        <label className={row}>
          <span className="font-medium">All supported objects</span>
          <input
            type="checkbox"
            checked={allSelected}
            disabled={!canEdit}
            onChange={(e) => onPatchConfig({ scope: e.target.checked ? [...ALL_SCOPE_KEYS] : [] })}
          />
        </label>
        {DETECT_SCOPES.map((s) => (
          <label key={s.key} className={row}>
            <span className={label}>{s.label}</span>
            <input type="checkbox" checked={scope.includes(s.key)} disabled={!canEdit} onChange={(e) => toggleScope(s.key, e.target.checked)} />
          </label>
        ))}

        <p className="text-[11px] font-semibold text-muted-foreground pt-2">Size on canvas</p>
        <div className={row}>
          <span className={label}>Width</span>
          <NumberInput value={legend.width} fallback={240} min={140} max={900} disabled={!canEdit} onCommit={(width) => onPatchNode({ width })} />
        </div>
        <div className={row}>
          <span className={label}>Height</span>
          <NumberInput value={legend.height} fallback={200} min={80} max={1200} disabled={!canEdit} onCommit={(height) => onPatchNode({ height })} />
        </div>
      </div>

      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground">Typography</p>
        <div className={row}>
          <span className={label}>Font family</span>
          <select
            value={cfg.font_family || ''}
            disabled={!canEdit}
            onChange={(e) => onPatchConfig({ font_family: e.target.value })}
            className={`${inputCls} w-40`}
          >
            {FONT_FAMILIES.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
          </select>
        </div>
        <div className={row}>
          <span className={label}>Font size</span>
          <NumberInput value={legend.font_size} fallback={13} min={8} max={40} disabled={!canEdit} onCommit={(font_size) => onPatchNode({ font_size })} />
        </div>
        <div className={row}>
          <span className={label}>Font color</span>
          <input type="color" value={normalizeColor(legend.text_color) || '#333333'} disabled={!canEdit} onChange={(e) => onPatchNode({ text_color: e.target.value })} className="w-7 h-7 rounded border bg-background" />
        </div>
        <div className={row}>
          <span className={label}>Font weight</span>
          <select value={String(legend.font_weight || '500')} disabled={!canEdit} onChange={(e) => onPatchNode({ font_weight: e.target.value })} className={`${inputCls} w-20`}>
            {['400', '500', '600', '700'].map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>

        <p className="text-[11px] font-semibold text-muted-foreground pt-2">Panel</p>
        <div className={row}>
          <span className={label}>Background</span>
          <div className="flex items-center gap-1">
            <input type="color" value={normalizeColor(legend.background_color) || '#ffffff'} disabled={!canEdit} onChange={(e) => onPatchNode({ background_color: e.target.value })} className="w-7 h-7 rounded border bg-background" />
            <label className="flex items-center gap-1 text-[10px]">
              <input type="checkbox" checked={legend.fill_mode === 'none'} disabled={!canEdit} onChange={(e) => onPatchNode({ fill_mode: e.target.checked ? 'none' : 'solid' })} />
              Transparent
            </label>
          </div>
        </div>
        <div className={row}>
          <span className={label}>Border color</span>
          <input type="color" value={normalizeColor(legend.border_color) || '#dcdfe5'} disabled={!canEdit} onChange={(e) => onPatchNode({ border_color: e.target.value })} className="w-7 h-7 rounded border bg-background" />
        </div>
        <div className={row}>
          <span className={label}>Border thickness</span>
          <NumberInput value={legend.border_width} fallback={0} min={0} max={12} disabled={!canEdit} onCommit={(border_width) => onPatchNode({ border_width: border_width ?? 0 })} />
        </div>
        <div className={row}>
          <span className={label}>Corner radius</span>
          <NumberInput value={legend.corner_radius} fallback={8} min={0} max={40} disabled={!canEdit} onCommit={(corner_radius) => onPatchNode({ corner_radius })} />
        </div>
        <div className={row}>
          <span className={label}>Shadow</span>
          <select value={legend.shadow || 'sm'} disabled={!canEdit} onChange={(e) => onPatchNode({ shadow: e.target.value })} className={`${inputCls} w-20`}>
            {SHADOWS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <p className="text-[11px] font-semibold text-muted-foreground pt-2">Swatches & spacing</p>
        <div className={row}>
          <span className={label}>Swatch shape</span>
          <select value={cfg.swatch_shape} disabled={!canEdit} onChange={(e) => onPatchConfig({ swatch_shape: e.target.value })} className={`${inputCls} w-24`}>
            <option value="circle">Circle</option>
            <option value="square">Square</option>
          </select>
        </div>
        <div className={row}>
          <span className={label}>Swatch size</span>
          <NumberInput value={cfg.swatch_size} fallback={12} min={6} max={40} disabled={!canEdit} onCommit={(swatch_size) => onPatchConfig({ swatch_size: swatch_size ?? DEFAULT_LEGEND_CONFIG.swatch_size })} />
        </div>
        <div className={row}>
          <span className={label}>Row spacing</span>
          <NumberInput value={cfg.row_spacing} fallback={8} min={0} max={40} disabled={!canEdit} onCommit={(row_spacing) => onPatchConfig({ row_spacing: row_spacing ?? 0 })} />
        </div>
        <div className={row}>
          <span className={label}>Internal padding</span>
          <NumberInput value={legend.padding} fallback={14} min={0} max={60} disabled={!canEdit} onCommit={(padding) => onPatchNode({ padding })} />
        </div>
      </div>
    </div>
  );
}