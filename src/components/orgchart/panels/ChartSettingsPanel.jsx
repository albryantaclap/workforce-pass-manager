import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Archive, RotateCcw, Trash2, Copy, Layers } from 'lucide-react';
import ImportedGroupsPanel from '@/components/orgchart/panels/ImportedGroupsPanel';

const toggle = 'flex items-center justify-between gap-2 text-[11px] py-1';

export default function ChartSettingsPanel({ ctx }) {
  const { settings } = ctx;
  const charts = ctx.projectCharts;

  return (
    <div className="p-3 space-y-4">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold text-muted-foreground">Canvas</p>
        <label className={toggle}>
          <span>Show grid</span>
          <input type="checkbox" checked={!!settings.show_grid} onChange={(e) => ctx.updateViewSettings({ show_grid: e.target.checked })} />
        </label>
        <label className={toggle}>
          <span>Snap to grid</span>
          <input type="checkbox" checked={!!settings.snap_to_grid} onChange={(e) => ctx.updateViewSettings({ snap_to_grid: e.target.checked })} />
        </label>
        <label className={toggle}>
          <span>Alignment guides</span>
          <input type="checkbox" checked={!!settings.show_guides} onChange={(e) => ctx.updateViewSettings({ show_guides: e.target.checked })} />
        </label>
        <div className={toggle}>
          <span>Grid size</span>
          <input
            type="number"
            min={5}
            max={100}
            value={settings.grid_size}
            onChange={(e) => ctx.updateViewSettings({ grid_size: Math.max(5, Number(e.target.value) || 20) })}
            className="w-16 h-7 rounded-md border bg-background px-2 text-[11px]"
          />
        </div>
        <div className={toggle}>
          <span>Background</span>
          <input type="color" value={settings.background_color} onChange={(e) => ctx.updateViewSettings({ background_color: e.target.value })} className="w-7 h-7 rounded border" />
        </div>
      </div>

      <div className="border-t pt-3 space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground">Smart color legend</p>
        <p className="text-[10px] text-muted-foreground">
          {ctx.legendNode
            ? `${(ctx.legendNode.legend_config?.entries || []).length} legend item(s) · ${ctx.legendScopeLabel}`
            : 'No color legend on this chart yet.'}
        </p>
        <div className="grid grid-cols-2 gap-1">
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={!ctx.canEdit} onClick={ctx.insertLegend}>
            Insert
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={!ctx.legendNode} onClick={() => ctx.openLegend('items')}>
            Edit
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={!ctx.canEdit} onClick={ctx.refreshLegendColors}>
            Refresh
          </Button>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={!ctx.legendNode} onClick={() => ctx.openLegend('settings')}>
            Settings
          </Button>
        </div>
      </div>

      <div className="border-t pt-3 space-y-1.5">
        <p className="text-[11px] font-semibold text-muted-foreground">Chart details (used on exports)</p>
        {[
          ['revision_no', 'Revision no.', 'number'],
          ['effective_date', 'Effective date', 'date'],
          ['prepared_by', 'Prepared by', 'text'],
          ['approved_by', 'Approved by', 'text'],
        ].map(([key, label, type]) => (
          <div key={key} className={toggle}>
            <span>{label}</span>
            <input
              type={type}
              value={ctx.chart?.[key] ?? ''}
              onChange={(e) => ctx.updateChartField(key, type === 'number' ? Number(e.target.value) : e.target.value)}
              className="w-32 h-7 rounded-md border bg-background px-2 text-[11px]"
            />
          </div>
        ))}
        <textarea
          value={ctx.chart?.legend_notes || ''}
          onChange={(e) => ctx.updateChartField('legend_notes', e.target.value)}
          placeholder="Legend / notes printed on exports"
          rows={3}
          className="w-full rounded-md border bg-background px-2 py-1.5 text-[11px]"
        />
      </div>

      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[11px] font-semibold text-muted-foreground">Charts in this project ({charts.length})</p>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={!ctx.canEdit} onClick={ctx.insertChart}>
              <Layers className="w-3 h-3 mr-1" /> Insert
            </Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={ctx.newChart}>
              <Plus className="w-3 h-3" /> New
            </Button>
          </div>
        </div>
        <div className="space-y-1">
          {charts.map(item => (
            <div key={item.id} className={`rounded-md border p-1.5 ${item.id === ctx.chart?.id ? 'border-primary bg-primary/5' : ''}`}>
              <button type="button" className="w-full text-left" onClick={() => ctx.openChart(item)}>
                <span className="block text-[11px] truncate">{item.name}</span>
                <span className="block text-[9px] text-muted-foreground">
                  {item.status}{item.is_archived ? ' · archived' : ''}
                </span>
              </button>
              <div className="flex gap-1 mt-1">
                <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px]" title="Rename" onClick={() => ctx.renameChart(item)}>Rename</Button>
                <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px]" title="Duplicate" onClick={() => ctx.duplicateChart(item)}>
                  <Copy className="w-3 h-3" />
                </Button>
                {item.is_archived ? (
                  <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px]" title="Restore" onClick={() => ctx.archiveChart(item, false)}>
                    <RotateCcw className="w-3 h-3" />
                  </Button>
                ) : (
                  <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px]" title="Archive" onClick={() => ctx.archiveChart(item, true)}>
                    <Archive className="w-3 h-3" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" className="h-5 px-1 text-[9px] text-red-600" title="Delete" onClick={() => ctx.deleteChart(item)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
          {!charts.length && <p className="text-[11px] text-muted-foreground">No other charts in this project.</p>}
        </div>
      </div>

      <ImportedGroupsPanel ctx={ctx} />
    </div>
  );
}