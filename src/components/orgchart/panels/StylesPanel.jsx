import React, { useState } from 'react';
import { CARD_PRESETS, CARD_STYLE_OPTIONS, DENSITY_OPTIONS, FONT_WEIGHTS } from '@/lib/orgChartConstants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const row = 'flex items-center justify-between gap-2';
const label = 'text-[11px] text-muted-foreground';

function NumberField({ title, value, fallback, min, max, onChange }) {
  return (
    <div className={row}>
      <span className={label}>{title}</span>
      <input
        type="number"
        min={min}
        max={max}
        value={value ?? ''}
        placeholder={String(fallback)}
        onChange={(e) => onChange(e.target.value === '' ? undefined : Number(e.target.value))}
        className="w-20 h-7 rounded-md border bg-background px-2 text-[11px]"
      />
    </div>
  );
}

export default function StylesPanel({ ctx }) {
  const [presetName, setPresetName] = useState('');
  const selected = ctx.nodes.filter(n => ctx.selection.includes(n.id));
  const first = selected[0];
  const hasSelection = selected.length > 0;
  const presets = ctx.chart?.card_presets || [];

  const patchSelection = (patch) => {
    if (!hasSelection) return;
    ctx.updateNodes(selected.map(n => ({ id: n.id, ...patch })));
  };

  const current = (key, fallback) => (first && first[key] !== undefined && first[key] !== null ? first[key] : fallback);

  if (!hasSelection) {
    return (
      <div className="p-3 space-y-3">
        <p className="text-[11px] text-muted-foreground">
          Select a card on the canvas to style it, or apply a preset to the whole chart.
        </p>
        <div className="space-y-1.5">
          {CARD_PRESETS.map(preset => (
            <div key={preset.name} className="rounded-md border p-2 flex items-center justify-between gap-2">
              <span className="text-xs">{preset.name}</span>
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={!ctx.canEdit} onClick={() => ctx.applyPresetToChart(preset)}>
                Apply to chart
              </Button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-4">
      <p className="text-[11px] font-semibold text-muted-foreground">
        {selected.length} card{selected.length > 1 ? 's' : ''} selected
      </p>

      <div className="space-y-1">
        <p className={label}>Display style</p>
        <div className="flex gap-1">
          {CARD_STYLE_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => patchSelection({ display_style: option.key })}
              className={`flex-1 rounded-md border px-1.5 py-1 text-[10px] ${first?.display_style === option.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
            >
              {option.label.split(' ')[0]}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {DENSITY_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => patchSelection({ density: option.key })}
              className={`flex-1 rounded-md border px-1.5 py-1 text-[10px] ${first?.density === option.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <p className={label}>Colours</p>
        {[
          ['accent_color', 'Accent', '#254dd0'],
          ['background_color', 'Background', '#ffffff'],
          ['border_color', 'Border', '#254dd0'],
          ['text_color', 'Text', '#0e1425'],
        ].map(([key, title, fallback]) => (
          <div key={key} className={row}>
            <span className={label}>{title}</span>
            <div className="flex items-center gap-1">
              <input
                type="color"
                value={current(key, fallback)}
                onChange={(e) => patchSelection({ [key]: e.target.value })}
                className="w-7 h-7 rounded border bg-background"
              />
              <button type="button" className="text-[10px] text-muted-foreground hover:underline" onClick={() => patchSelection({ [key]: '' })}>
                reset
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="space-y-1.5">
        <p className={label}>Geometry</p>
        <NumberField title="Border thickness" value={first?.border_width} fallback={1} min={0} max={8} onChange={(v) => patchSelection({ border_width: v })} />
        <NumberField title="Corner radius" value={first?.corner_radius} fallback={12} min={0} max={40} onChange={(v) => patchSelection({ corner_radius: v })} />
        <NumberField title="Card width" value={first?.width} fallback={260} min={120} max={600} onChange={(v) => patchSelection({ width: v })} />
        <NumberField title="Card height" value={first?.height} fallback={118} min={50} max={400} onChange={(v) => patchSelection({ height: v })} />
        <NumberField title="Padding" value={first?.padding} fallback={14} min={0} max={40} onChange={(v) => patchSelection({ padding: v })} />
      </div>

      <div className="space-y-1.5">
        <p className={label}>Text & avatar</p>
        <NumberField title="Font size" value={first?.font_size} fallback={13} min={8} max={28} onChange={(v) => patchSelection({ font_size: v })} />
        <div className={row}>
          <span className={label}>Font weight</span>
          <select
            value={String(first?.font_weight || '600')}
            onChange={(e) => patchSelection({ font_weight: e.target.value })}
            className="w-20 h-7 rounded-md border bg-background px-1 text-[11px]"
          >
            {FONT_WEIGHTS.map(w => <option key={w} value={w}>{w}</option>)}
          </select>
        </div>
        <NumberField title="Avatar size" value={first?.avatar_size} fallback={44} min={20} max={120} onChange={(v) => patchSelection({ avatar_size: v })} />
        <div className={row}>
          <span className={label}>Shadow</span>
          <select
            value={first?.shadow || 'sm'}
            onChange={(e) => patchSelection({ shadow: e.target.value })}
            className="w-20 h-7 rounded-md border bg-background px-1 text-[11px]"
          >
            {['none', 'sm', 'md', 'lg'].map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className={row}>
          <span className={label}>Alignment</span>
          <select
            value={first?.align || 'center'}
            onChange={(e) => patchSelection({ align: e.target.value })}
            className="w-20 h-7 rounded-md border bg-background px-1 text-[11px]"
          >
            {['left', 'center', 'right'].map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      </div>

      <div className="border-t pt-3 space-y-1.5">
        <p className={label}>Card style presets</p>
        {CARD_PRESETS.map(preset => (
          <div key={preset.name} className="rounded-md border p-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px]">{preset.name}</span>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => patchSelection(preset.style)}>Apply</Button>
          </div>
        ))}
        {presets.map((preset, index) => (
          <div key={`${preset.name}-${index}`} className="rounded-md border p-1.5 flex items-center justify-between gap-2">
            <span className="text-[11px]">{preset.name}</span>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => patchSelection(preset.style || {})}>Apply</Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 px-1.5 text-[10px] text-red-600"
                onClick={() => ctx.setCardPresets(presets.filter((_, i) => i !== index))}
              >
                ×
              </Button>
            </div>
          </div>
        ))}
        <div className="flex gap-1.5">
          <Input value={presetName} onChange={(e) => setPresetName(e.target.value)} placeholder="Preset name" className="h-7 text-[11px]" />
          <Button
            size="sm"
            className="h-7 px-2 text-[10px]"
            disabled={!presetName.trim()}
            onClick={() => {
              const style = {};
              ['accent_color', 'background_color', 'border_color', 'text_color', 'border_width', 'corner_radius', 'font_size', 'font_weight', 'avatar_size', 'shadow', 'padding', 'align'].forEach(key => {
                if (first && first[key] !== undefined && first[key] !== null && first[key] !== '') style[key] = first[key];
              });
              ctx.setCardPresets([...presets, { name: presetName.trim(), style }]);
              setPresetName('');
            }}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}