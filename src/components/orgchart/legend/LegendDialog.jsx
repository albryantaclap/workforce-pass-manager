import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Copy, Palette, RefreshCw, Trash2 } from 'lucide-react';
import LegendItemsTab from '@/components/orgchart/legend/LegendItemsTab';
import LegendSettingsTab from '@/components/orgchart/legend/LegendSettingsTab';

export default function LegendDialog({
  open, tab, legend, detected = [], canEdit, onClose, onInsert, onRefresh, onPatchNode, onPatchConfig, onDuplicate, onDelete,
}) {
  const [activeTab, setActiveTab] = useState('items');

  useEffect(() => {
    if (open) setActiveTab(tab === 'settings' ? 'settings' : 'items');
  }, [open, tab]);

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-4 h-4" /> Smart Color Legend
          </DialogTitle>
        </DialogHeader>

        {legend ? (
          <>
            <div className="flex items-center gap-1 border-b pb-1">
              {[
                { key: 'items', label: 'Legend Items' },
                { key: 'settings', label: 'Legend Settings' },
              ].map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActiveTab(t.key)}
                  className={`px-3 py-1.5 text-[11px] rounded-t-md border-b-2 ${activeTab === t.key ? 'border-primary text-foreground font-semibold' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            {activeTab === 'items' ? (
              <LegendItemsTab
                legend={legend}
                detected={detected}
                canEdit={canEdit}
                onChangeEntries={(entries, excluded) => onPatchConfig(excluded ? { entries, excluded } : { entries })}
                onRefresh={onRefresh}
              />
            ) : (
              <LegendSettingsTab
                legend={legend}
                canEdit={canEdit}
                onPatchNode={onPatchNode}
                onPatchConfig={onPatchConfig}
              />
            )}
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-[11px] text-muted-foreground">
              This chart has no color legend yet. Insert one to record what each color on the chart represents — the legend is a
              movable canvas object, so it can be repositioned, styled and exported with the chart.
            </p>
            <div className="rounded-lg border p-2">
              <p className="text-[11px] font-semibold mb-1.5">Colors detected in this chart ({detected.length})</p>
              <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
                {detected.map((d) => (
                  <span key={d.color} className="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px]">
                    <span className="w-3 h-3 rounded-full border" style={{ background: d.color }} />
                    <span className="font-mono">{d.color}</span>
                    <span className="text-muted-foreground">· {d.count}</span>
                  </span>
                ))}
                {!detected.length && (
                  <p className="text-[11px] text-muted-foreground">No distinct colors found yet. Color your cards, shapes or connectors first.</p>
                )}
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex-wrap gap-2 sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {legend && (
              <>
                <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" onClick={onRefresh}>
                  <RefreshCw className="w-3 h-3 mr-1" /> Refresh Detected Colors
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-[10px]" disabled={!canEdit} onClick={onDuplicate}>
                  <Copy className="w-3 h-3 mr-1" /> Duplicate
                </Button>
                <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] text-red-600" disabled={!canEdit} onClick={onDelete}>
                  <Trash2 className="w-3 h-3 mr-1" /> Delete
                </Button>
              </>
            )}
          </div>
          <div className="flex gap-1.5">
            {!legend && (
              <Button size="sm" className="h-7 px-2 text-[10px]" disabled={!canEdit} onClick={onInsert}>
                <Palette className="w-3 h-3 mr-1" /> Insert Color Legend
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}