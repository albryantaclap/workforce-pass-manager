import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, X } from 'lucide-react';
import { exportData } from '@/utils/constants';

const STORAGE_PREFIX = 'export_cols_';

export default function ExportButton({ getData, filename, label = 'Export' }) {
  const [showModal, setShowModal] = useState(false);
  const [columns, setColumns] = useState([]);
  const [selectedCols, setSelectedCols] = useState([]);
  const [colSearch, setColSearch] = useState('');
  const storageKey = STORAGE_PREFIX + filename;

  const openModal = () => {
    const data = getData();
    if (!data || data.length === 0) return;
    const allCols = Object.keys(data[0]);

    let initial = [...allCols];
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey));
      if (Array.isArray(saved) && saved.length > 0 && saved.every(c => allCols.includes(c))) {
        initial = saved;
      }
    } catch {}

    setColumns(allCols);
    setSelectedCols(initial);
    setColSearch('');
    setShowModal(true);
  };

  const handleExport = (format) => {
    if (selectedCols.length === 0) return;
    const data = getData();
    if (!data || data.length === 0) return;

    // Export only selected columns in original order
    const ordered = columns.filter(c => selectedCols.includes(c));
    const exportRows = data.map(row => {
      const obj = {};
      for (const col of ordered) obj[col] = row[col] ?? '';
      return obj;
    });

    try { sessionStorage.setItem(storageKey, JSON.stringify(ordered)); } catch {}
    exportData(exportRows, filename, format);
    setShowModal(false);
  };

  const filteredCols = useMemo(() => {
    if (!colSearch.trim()) return columns;
    return columns.filter(c => c.toLowerCase().replace(/_/g, ' ').includes(colSearch.toLowerCase()));
  }, [columns, colSearch]);

  const toggleCol = (col) => {
    setSelectedCols(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  return (
    <>
      <Button variant="outline" onClick={openModal}>
        <Download className="w-4 h-4 mr-2" /> {label}
      </Button>

      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[85vh]">

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <div>
                <h3 className="font-semibold text-base">Select Columns to Export</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  <span className="font-semibold text-primary">{selectedCols.length}</span> of {columns.length} columns selected
                </p>
              </div>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground p-1 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search + Select All / Unselect All */}
            <div className="px-5 py-3 border-b space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search columns..."
                  value={colSearch}
                  onChange={e => setColSearch(e.target.value)}
                  className="pl-9 h-8 text-xs"
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setSelectedCols([...columns])}>Select All</Button>
                <Button variant="outline" size="sm" className="h-7 text-xs"
                  onClick={() => setSelectedCols([])}>Unselect All</Button>
              </div>
            </div>

            {/* Column checkboxes */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {filteredCols.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">No columns match your search.</p>
              ) : (
                <div className="grid grid-cols-2 gap-0.5">
                  {filteredCols.map(col => (
                    <label key={col} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={selectedCols.includes(col)}
                        onChange={() => toggleCol(col)}
                        className="w-3.5 h-3.5 rounded accent-primary flex-shrink-0"
                      />
                      <span className="text-xs text-foreground truncate" title={col}>
                        {col.replace(/_/g, ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Export buttons */}
            <div className="px-5 py-4 border-t bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
              <p className="text-xs text-muted-foreground">
                {selectedCols.length === 0
                  ? 'Select at least 1 column to export'
                  : `Ready to export ${selectedCols.length} column(s)`}
              </p>
              <div className="flex gap-2 flex-wrap">
                <Button variant="outline" size="sm" onClick={() => setShowModal(false)}>Cancel</Button>
                <Button size="sm" disabled={selectedCols.length === 0} onClick={() => handleExport('csv')} className="bg-slate-700 hover:bg-slate-800 text-white">CSV</Button>
                <Button size="sm" disabled={selectedCols.length === 0} onClick={() => handleExport('excel')} className="bg-emerald-600 hover:bg-emerald-700 text-white">Excel</Button>
                <Button size="sm" disabled={selectedCols.length === 0} onClick={() => handleExport('iqy')} className="bg-blue-600 hover:bg-blue-700 text-white">IQY</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}