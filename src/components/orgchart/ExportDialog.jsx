import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EXPORT_AREAS, EXPORT_FORMATS, PAGE_SIZES } from '@/lib/orgChartExport';

const row = 'flex items-center justify-between gap-3 text-[11px]';
const chip = 'px-2 py-0.5 rounded-full border text-[11px]';

export default function ExportDialog({ open, chart, onClose, onExport, error }) {
  const [format, setFormat] = useState('PNG');
  const [area, setArea] = useState('all');
  const [transparent, setTransparent] = useState(false);
  const [resolution, setResolution] = useState(2);
  const [pageSize, setPageSize] = useState('A4');
  const [orientation, setOrientation] = useState('landscape');
  const [fitToPage, setFitToPage] = useState(true);
  const [multiPage, setMultiPage] = useState(true);
  const [busy, setBusy] = useState(false);
  const [header, setHeader] = useState({});

  useEffect(() => {
    if (!open) return;
    setHeader({
      chartTitle: chart?.name || '',
      projectName: chart?.project_name || '',
      revisionNo: chart?.revision_no || 1,
      effectiveDate: chart?.effective_date || '',
      preparedBy: chart?.prepared_by || '',
      approvedBy: chart?.approved_by || '',
      legendNotes: chart?.legend_notes || '',
    });
    setBusy(false);
  }, [open, chart]);

  const isRaster = ['PNG', 'JPEG', 'PDF'].includes(format);

  const run = async () => {
    setBusy(true);
    try {
      await onExport({ format, area, transparent, resolution, pageSize, orientation, fitToPage, multiPage, header });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export chart</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1">Format</p>
            <div className="flex flex-wrap gap-1.5">
              {EXPORT_FORMATS.map(item => (
                <button key={item} type="button" onClick={() => setFormat(item)} className={`${chip} ${format === item ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                  {item}
                </button>
              ))}
            </div>
          </div>

          {isRaster && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Area</p>
              <div className="flex flex-wrap gap-1.5">
                {EXPORT_AREAS.map(item => (
                  <button key={item.key} type="button" onClick={() => setArea(item.key)} className={`${chip} ${area === item.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}>
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {isRaster && (
            <div className="space-y-1.5 border-t pt-2">
              <label className={row}>
                <span>Transparent background</span>
                <input type="checkbox" checked={transparent} onChange={(e) => setTransparent(e.target.checked)} />
              </label>
              <label className={row}>
                <span>High resolution</span>
                <select value={resolution} onChange={(e) => setResolution(Number(e.target.value))} className="h-7 rounded-md border bg-background px-2 text-[11px]">
                  <option value={1}>Standard (1×)</option>
                  <option value={2}>High (2×)</option>
                  <option value={3}>Print (3×)</option>
                </select>
              </label>
            </div>
          )}

          {format === 'PDF' && (
            <div className="space-y-1.5 border-t pt-2">
              <label className={row}>
                <span>Page size</span>
                <select value={pageSize} onChange={(e) => setPageSize(e.target.value)} className="h-7 rounded-md border bg-background px-2 text-[11px]">
                  {Object.keys(PAGE_SIZES).map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <label className={row}>
                <span>Orientation</span>
                <select value={orientation} onChange={(e) => setOrientation(e.target.value)} className="h-7 rounded-md border bg-background px-2 text-[11px]">
                  <option value="landscape">Landscape</option>
                  <option value="portrait">Portrait</option>
                </select>
              </label>
              <label className={row}>
                <span>Fit to page width</span>
                <input type="checkbox" checked={fitToPage} onChange={(e) => setFitToPage(e.target.checked)} />
              </label>
              <label className={row}>
                <span>Multi-page printing</span>
                <input type="checkbox" checked={multiPage} onChange={(e) => setMultiPage(e.target.checked)} />
              </label>
            </div>
          )}

          <div className="border-t pt-2 space-y-1.5">
            <p className="text-[11px] font-semibold text-muted-foreground">Header details (printed on the page)</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['chartTitle', 'Chart title'],
                ['projectName', 'Project name'],
                ['revisionNo', 'Revision number'],
                ['effectiveDate', 'Effective date'],
                ['preparedBy', 'Prepared by'],
                ['approvedBy', 'Approved by'],
              ].map(([key, label]) => (
                <label key={key} className="space-y-1">
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                  <Input value={header[key] ?? ''} onChange={(e) => setHeader({ ...header, [key]: e.target.value })} className="h-7 text-[11px]" />
                </label>
              ))}
            </div>
            <textarea
              value={header.legendNotes || ''}
              onChange={(e) => setHeader({ ...header, legendNotes: e.target.value })}
              rows={2}
              placeholder="Legend / notes"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-[11px]"
            />
          </div>

          <p className="text-[10px] text-muted-foreground">
            Exports keep exact card positions, formatting, photos, connectors, labels, shapes and background. JSON stays fully editable and can be re-imported as a chart or template.
          </p>
          {error && <p className="text-[11px] text-red-600">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={run} disabled={busy}>{busy ? 'Preparing…' : `Export ${format}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}