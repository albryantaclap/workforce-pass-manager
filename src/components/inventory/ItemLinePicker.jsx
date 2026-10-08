import React, { useState, useEffect, useRef } from 'react';
import { Search, ChevronDown, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchItems } from '@/lib/inventoryService';
import { itemDisplayName, itemDisplayUnit } from '@/lib/inventoryText';
import AnchoredDropdown from '@/components/common/AnchoredDropdown';

/**
 * Compact searchable Inventory Items selector for one document line.
 * Searches the existing Inventory Items master list by Item S.N. or Item Name.
 * Items already added to the same document are shown but cannot be selected.
 * The result panel is rendered in a portal (see AnchoredDropdown) so the table's
 * scroll container can never clip it.
 */
export default function ItemLinePicker({ item, onSelect, excludeIds = [], placeholder = 'Search item S.N. or name...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [cursor, setCursor] = useState(0);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const timerRef = useRef(null);

  const close = () => { setOpen(false); setSearch(''); setCursor(0); };

  useEffect(() => {
    if (!open) return;
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        setResults(await searchItems(search, 40));
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timerRef.current);
  }, [search, open]);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  // Keep the highlighted row within the current result set.
  useEffect(() => { setCursor(0); }, [results]);

  const pick = (i) => {
    if (!i) return;
    onSelect(i);
    close();
  };

  const handleKey = (e) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = results[Math.min(cursor, results.length - 1)];
      const already = excludeIds.includes(target.id) && target.id !== item?.id;
      if (!already) pick(target);
    }
  };

  const text = item ? `${item.item_sn} — ${itemDisplayName(item)}` : '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(
          'flex h-8 w-full items-center justify-between rounded-md border border-input bg-white px-2 text-xs shadow-sm',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          !text && 'text-muted-foreground',
          open && 'ring-1 ring-ring'
        )}
      >
        <span className="truncate">{text || placeholder}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 opacity-50 shrink-0 ml-1 transition-transform', open && 'rotate-180')} />
      </button>

      <AnchoredDropdown anchorRef={containerRef} open={open} onClose={close} width={320} maxHeight={280}>
        <div className="flex shrink-0 items-center border-b px-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 h-8 px-2 text-xs bg-transparent border-0 outline-none placeholder:text-muted-foreground"
            placeholder="Type item S.N. or name..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKey}
          />
          {loading && <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin shrink-0" />}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1">
          {results.length === 0 && !loading ? (
            <div className="py-5 text-center text-xs text-muted-foreground">
              {search ? 'No matching items found' : 'Start typing to search items...'}
            </div>
          ) : (
            results.map((i, idx) => {
              const already = excludeIds.includes(i.id) && i.id !== item?.id;
              return (
                <button
                  key={i.id}
                  type="button"
                  disabled={already}
                  onMouseEnter={() => setCursor(idx)}
                  onClick={() => pick(i)}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs text-left',
                    already ? 'opacity-50 cursor-not-allowed' : idx === cursor ? 'bg-accent text-accent-foreground' : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate flex-1">
                    <span className="font-mono font-semibold">{i.item_sn}</span>
                    {' — '}
                    {itemDisplayName(i)}
                  </span>
                  {already ? (
                    <span className="text-[10px] text-amber-600 font-semibold shrink-0 flex items-center gap-0.5">
                      <AlertTriangle className="w-3 h-3" /> Already added
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground shrink-0">{itemDisplayUnit(i)}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
      </AnchoredDropdown>
    </div>
  );
}