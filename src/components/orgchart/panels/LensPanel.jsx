import React from 'react';
import { ACCENT_PALETTE, CARD_STYLE_OPTIONS, DENSITY_OPTIONS, VISIBLE_FIELD_DEFS } from '@/lib/orgChartConstants';
import { ChevronUp, ChevronDown } from 'lucide-react';

export default function LensPanel({ ctx }) {
  const { settings } = ctx;
  const visible = settings.visible_fields || [];

  const toggleField = (key) => {
    const next = visible.includes(key) ? visible.filter(f => f !== key) : [...visible, key];
    ctx.updateViewSettings({ visible_fields: next });
  };

  const move = (key, direction) => {
    const index = visible.indexOf(key);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= visible.length) return;
    const next = [...visible];
    next.splice(index, 1);
    next.splice(target, 0, key);
    ctx.updateViewSettings({ visible_fields: next });
  };

  return (
    <div className="p-3 space-y-4">
      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Card style</p>
        <div className="space-y-1">
          {CARD_STYLE_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => ctx.updateViewSettings({ card_style: option.key })}
              className={`w-full text-left rounded-md border px-2.5 py-1.5 ${settings.card_style === option.key ? 'border-primary bg-primary/5' : 'hover:bg-muted'}`}
            >
              <span className="block text-xs font-medium">{option.label}</span>
              <span className="block text-[10px] text-muted-foreground">{option.hint}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Detail density</p>
        <div className="flex gap-1">
          {DENSITY_OPTIONS.map(option => (
            <button
              key={option.key}
              type="button"
              onClick={() => ctx.updateViewSettings({ density: option.key })}
              className={`flex-1 rounded-md border px-2 py-1 text-[11px] ${settings.density === option.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Card accent</p>
        <div className="flex flex-wrap gap-1.5">
          {ACCENT_PALETTE.map(color => (
            <button
              key={color}
              type="button"
              title={color}
              onClick={() => ctx.updateViewSettings({ accent_color: color })}
              className={`w-6 h-6 rounded-full border-2 ${settings.accent_color === color ? 'border-foreground' : 'border-transparent'}`}
              style={{ background: color }}
            />
          ))}
          <input
            type="color"
            value={settings.accent_color}
            onChange={(e) => ctx.updateViewSettings({ accent_color: e.target.value })}
            className="w-6 h-6 rounded border"
            title="Custom accent"
          />
        </div>
      </div>

      <div>
        <p className="text-[11px] font-semibold text-muted-foreground mb-1">Visible fields</p>
        <div className="space-y-0.5">
          {VISIBLE_FIELD_DEFS.map(field => {
            const index = visible.indexOf(field.key);
            const shown = index >= 0;
            return (
              <div key={field.key} className={`flex items-center gap-1.5 rounded px-1.5 py-1 ${shown ? 'bg-muted/60' : ''}`}>
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => toggleField(field.key)}
                  className="w-3.5 h-3.5"
                />
                <span className="text-[11px] flex-1">{field.label}</span>
                {shown && (
                  <>
                    <button type="button" className="p-0.5 hover:bg-background rounded disabled:opacity-30" disabled={index === 0} onClick={() => move(field.key, -1)}>
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button type="button" className="p-0.5 hover:bg-background rounded disabled:opacity-30" disabled={index === visible.length - 1} onClick={() => move(field.key, 1)}>
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground mt-1.5">
          Cards update instantly. Use the checkbox to hide a field, the arrows to reorder.
        </p>
      </div>

      <div className="border-t pt-3">
        <button
          type="button"
          disabled={!ctx.selection.length}
          onClick={() => ctx.applyDisplayToSelection()}
          className="w-full h-7 rounded-md border text-[11px] hover:bg-muted disabled:opacity-40"
        >
          Apply style & density to selected cards
        </button>
      </div>
    </div>
  );
}