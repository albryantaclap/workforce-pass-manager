import React from 'react';
import { Trash2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  CONNECTOR_LINE_STYLES, CONNECTOR_PATH_STYLES, CONNECTOR_TYPES, connectorDefaults,
} from '@/lib/orgChartConstants';

const chip = 'px-2 py-0.5 rounded-full border text-[11px] capitalize';
const TYPES_WITH_OFFICIAL = ['Direct Reporting', 'Functional Reporting', 'Matrix Reporting'];

export default function ConnectorBar({ edge, canApplyOfficial, onUpdate, onDelete, onAddBend, onClearBends, onApplyOfficial }) {
  if (!edge) return null;
  const defaults = connectorDefaults(edge.relationship_type);
  const color = edge.color || defaults.color;

  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 rounded-xl border bg-card/95 backdrop-blur px-3 py-2 shadow-lg">
      <div className="flex items-center gap-2 flex-wrap max-w-[1100px]">
        <span className="text-[11px] font-semibold text-muted-foreground">Connector</span>
        <select
          value={edge.relationship_type}
          onChange={(e) => {
            const next = connectorDefaults(e.target.value);
            onUpdate({ relationship_type: e.target.value, color: '', path_style: next.path, line_style: next.line, arrow: next.arrow });
          }}
          className="h-7 rounded-md border bg-background px-2 text-[11px]"
        >
          {CONNECTOR_TYPES.map(t => <option key={t.key} value={t.key}>{t.key}</option>)}
        </select>

        <div className="flex items-center gap-1">
          {CONNECTOR_PATH_STYLES.map(style => (
            <button
              key={style}
              type="button"
              onClick={() => onUpdate({ path_style: style })}
              className={`${chip} capitalize ${edge.path_style === style ? 'bg-primary text-primary-foreground border-primary' : ''}`}
            >
              {style}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          {CONNECTOR_LINE_STYLES.map(style => (
            <button
              key={style}
              type="button"
              onClick={() => onUpdate({ line_style: style })}
              className={`${chip} capitalize ${edge.line_style === style ? 'bg-primary text-primary-foreground border-primary' : ''}`}
            >
              {style}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onUpdate({ arrow: edge.arrow === false })}
          className={`${chip} ${edge.arrow !== false ? 'bg-primary text-primary-foreground border-primary' : ''}`}
        >
          {edge.arrow !== false ? 'Arrow' : 'No arrow'}
        </button>

        <input
          type="color"
          value={color}
          onChange={(e) => onUpdate({ color: e.target.value })}
          title="Connector colour"
          className="w-7 h-7 rounded border bg-background"
        />

        <Input
          value={edge.label || ''}
          placeholder="Label"
          onChange={(e) => onUpdate({ label: e.target.value })}
          className="h-7 w-36 text-[11px]"
        />

        <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
          Width
          <input
            type="range"
            min="1"
            max="6"
            step="0.5"
            value={edge.thickness || 1.5}
            onChange={(e) => onUpdate({ thickness: Number(e.target.value) })}
            className="w-20"
          />
        </label>

        <div className="w-px h-5 bg-border" />
        <button type="button" className={chip} onClick={onAddBend}>Add bend point</button>
        <button type="button" className={chip} onClick={onClearBends} disabled={!edge.bend_points?.length}>Clear bends</button>
        <div className="w-px h-5 bg-border" />
        <Button
          size="sm"
          variant={edge.is_official ? 'secondary' : 'outline'}
          className="h-7 gap-1 text-[11px]"
          disabled={!canApplyOfficial || edge.is_official}
          title={edge.is_official
            ? `Applied${edge.official_applied_by ? ` by ${edge.official_applied_by}` : ''}`
            : 'Write this reporting line onto the linked Master List employees'}
          onClick={() => onApplyOfficial(edge)}
        >
          <CheckCircle2 className="w-3 h-3" />
          {edge.is_official ? 'Official' : 'Apply as official reporting'}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px] text-red-600" onClick={onDelete}>
          <Trash2 className="w-3 h-3" /> Delete
        </Button>
      </div>
      {!TYPES_WITH_OFFICIAL.includes(edge.relationship_type) && (
        <p className="text-[10px] text-muted-foreground mt-1">
          {edge.relationship_type} lines stay visual only — they never change the Master List.
        </p>
      )}
    </div>
  );
}