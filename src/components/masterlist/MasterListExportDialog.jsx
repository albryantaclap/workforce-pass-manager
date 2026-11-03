import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, X, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

const STORAGE_PREFIX = 'export_cols_';

/**
 * Master List export dialog.
 *
 * The export scope is chosen explicitly and the file is always built from the
 * complete backend dataset for that scope — never from the page on screen. The
 * dialog reports the scope, the number of matching personnel, the number
 * actually exported, and whether the export is complete.
 */
export default function MasterListExportDialog({
  open, onClose, columns = [], scopes = [], initialScope, filename, onExport,
}) {
  const [scope, setScope] = useState(initialScope || scopes[0]?.key);
  const [selectedCols, setSelectedCols] = useState(columns);
  const [colSearch, setColSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [summary, setSummary] = useState(null);
  const [error, setError] = useState('');
  const storageKey = STORAGE_PREFIX + filename;

  useEffect(() => {
    if (!open) return;
    setScope(initialScope || scopes[0]?.key);
    setBusy(false);
    setProgress('');
    setSummary(null);
    setError('');
    setColSearch('');
    let initial = [...columns];
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (Array.isArray(saved) && saved.length > 0 && saved.every(c => columns.includes(c))) initial = saved;
    } catch { /* ignore */ }
    setSelectedCols(initial);
  }, [open]);

  const filteredCols = useMemo(() => {
    if (!colSearch.trim()) return columns;
    const term = colSearch.toLowerCase();
    return columns.filter(c => c.toLowerCase().replace(/_/g, ' ').includes(term));
  }, [columns, colSearch]);

  const toggleCol = (col) => setSelectedCols(prev => (
    prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
  ));

  const ordered = columns.filter(c => selectedCols.includes(c));
  const activeScopeLabel = scopes.find(s => s.key === scope)?.label || '';

  const run = async (format) => {
    if (ordered.length === 0) return;
    setBusy(true);
    setError('');
    setSummary(null);
    setProgress('Reading personnel records…');
    try {
      const meta = await onExport(scope, ordered, format);
      setSummary({ ...meta, scopeLabel: activeScopeLabel, format });
      try { sessionStorage.setItem(storageKey, JSON.stringify(ordered)); } catch { /* ignore */ }
    } catch (err) {
      setError(err?.message || 'The export could not be completed.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[88vh] border">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold text-base">Export Master List</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every record in the selected scope is exported, across all pages.
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1 rounded" disabled={busy}>
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Scope */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase text-muted-foreground">What to export</p>
            <div className="grid sm:grid-cols-3 gap-2">
              {scopes.map(item => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setScope(item.key)}
                  disabled={busy}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${scope === item.key ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}
                >
                  <span className="block text-xs font-semibold">{item.label}</span>
                  <span className="block text-[10px] text-muted-foreground mt-0.5">{item.description}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Columns */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Columns · {selectedCols.length} of {columns.length}
              </p>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={busy}
                  onClick={() => setSelectedCols([...columns])}>All</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs" disabled={busy}
                  onClick={() => setSelectedCols([])}>None</Button>
              </div>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input placeholder="Search columns..." value={colSearch} onChange={e => setColSearch(e.target.value)} className="pl-9 h-8 text-xs" />
            </div>
            <div className="border rounded-lg max-h-56 overflow-y-auto px-2 py-2">
              {filteredCols.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No columns match your search.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-0.5">
                  {filteredCols.map(col => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted/50 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedCols.includes(col)}
                        onChange={() => toggleCol(col)}
                        className="w-3.5 h-3.5 rounded accent-primary flex-shrink-0"
                      />
                      <span className="text-[11px] text-foreground truncate" title={col}>{col.replace(/_/g, ' ')}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          {busy && (
            <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{progress || 'Preparing export…'}</span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {summary && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs space-y-1">
              <p className="flex items-center gap-1.5 font-semibold text-emerald-800">
                <CheckCircle2 className="w-3.5 h-3.5" /> Export complete
              </p>
              <p className="text-emerald-900">Export scope: {summary.scopeLabel}</p>
              <p className="text-emerald-900">Total matching personnel: {summary.matched.toLocaleString()}</p>
              <p className="text-emerald-900">Total exported personnel: {summary.exported.toLocaleString()}</p>
              <p className="text-emerald-900">Status: {summary.exported === summary.matched ? 'Complete' : 'Incomplete'}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-xs text-muted-foreground">
            {ordered.length === 0 ? 'Select at least 1 column' : `${ordered.length} column(s) selected`}
          </p>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={onClose} disabled={busy}>Close</Button>
            <Button size="sm" disabled={busy || ordered.length === 0} onClick={() => run('csv')} className="bg-slate-700 hover:bg-slate-800 text-white">
              <Download className="w-3.5 h-3.5 mr-1" /> CSV
            </Button>
            <Button size="sm" disabled={busy || ordered.length === 0} onClick={() => run('excel')} className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <Download className="w-3.5 h-3.5 mr-1" /> Excel
            </Button>
            <Button size="sm" disabled={busy || ordered.length === 0} onClick={() => run('iqy')} className="bg-blue-600 hover:bg-blue-700 text-white">
              <Download className="w-3.5 h-3.5 mr-1" /> IQY
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}