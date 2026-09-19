import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Plus, ChevronDown, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { searchItems } from '@/lib/inventoryService';

/**
 * Searchable dropdown for finding existing Inventory Items.
 * Searches by Item S.N. or Item Name (debounced, server-fetched).
 * Includes a "+ Create New Inventory Item" option at the top.
 */
export default function ExistingItemSearch({ selectedItem, onSelectItem, onCreateNew }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);
  const inputRef = useRef(null);
  const debounceRef = useRef(null);

  const doSearch = useCallback(async (query) => {
    setLoading(true);
    try {
      const items = await searchItems(query, 50);
      setResults(items);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounced search when dropdown is open
  useEffect(() => {
    if (!open) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, open, doSearch]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSelect = (item) => {
    onSelectItem(item);
    setOpen(false);
    setSearch('');
  };

  const handleCreateNew = () => {
    onCreateNew();
    setOpen(false);
    setSearch('');
  };

  const displayText = selectedItem
    ? `${selectedItem.item_sn} — ${selectedItem.item_name}`
    : '';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
          'focus:outline-none focus:ring-1 focus:ring-ring',
          !displayText && 'text-muted-foreground',
          open && 'ring-1 ring-ring'
        )}
      >
        <span className="truncate">{displayText || 'Search existing item or create new...'}</span>
        <ChevronDown className={cn('h-4 w-4 opacity-50 shrink-0 ml-1 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              className="flex-1 h-8 px-2 text-sm bg-transparent border-0 outline-none placeholder:text-muted-foreground"
              placeholder="Search by Item S.N. or Name..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {loading && <div className="w-3 h-3 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin shrink-0" />}
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {/* Create New option */}
            <button
              type="button"
              onClick={handleCreateNew}
              className="flex w-full items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 outline-none border-b mb-1"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>Create New Inventory Item</span>
            </button>

            {/* Results */}
            {results.length === 0 && !loading ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                {search ? 'No matching items found' : 'Start typing to search existing items...'}
              </div>
            ) : (
              results.map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground"
                >
                  <Package className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    <span className="font-medium">{item.item_sn}</span>
                    {' — '}
                    {item.item_name}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}