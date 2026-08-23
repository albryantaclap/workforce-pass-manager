import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Check, ChevronDown, Search, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Searchable single-select Location dropdown for the COMO Camp Edit Grid.
 *
 * - Options come dynamically from Lookup Management → Location (active only),
 *   passed in via the `options` prop (already merged by useLookupOptions).
 * - Preselects the asset's existing Location when opened.
 * - If the existing value is no longer an active lookup, it is shown at the top
 *   of the list tagged "Inactive" and is NOT selectable — the user must pick an
 *   active location to change it.
 * - Case-insensitive type-to-search.
 */
export default function LocationGridDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Select location…',
  className,
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const valueUpper = (value || '').trim().toUpperCase();
  const isActive = !!value && options.some(o => (o.value || '').toUpperCase() === valueUpper);
  const isInactiveExisting = !!value && !isActive;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o =>
      (o.label || '').toLowerCase().includes(q) ||
      (o.value || '').toLowerCase().includes(q)
    );
  }, [options, search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false); setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search when opened
  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSelect = (val) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'flex w-full items-center justify-between gap-1 rounded border border-input bg-background px-1.5 py-1 text-xs',
          'focus:outline-none focus:ring-1 focus:ring-primary',
          !value && 'text-muted-foreground'
        )}
      >
        <span className="flex items-center gap-1 truncate min-w-0">
          <MapPin className="w-3 h-3 text-red-500 shrink-0" />
          <span className="truncate uppercase">{value || placeholder}</span>
          {isInactiveExisting && (
            <span className="text-[9px] font-semibold px-1 rounded bg-amber-100 text-amber-700 border border-amber-200 shrink-0">
              Inactive
            </span>
          )}
        </span>
        <ChevronDown className={cn('w-3 h-3 opacity-60 shrink-0 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-56 rounded-md border bg-popover shadow-md">
          <div className="flex items-center border-b px-2">
            <Search className="w-3 h-3 text-muted-foreground shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setSearch(''); } }}
              placeholder="Search…"
              className="flex-1 h-8 px-2 text-xs bg-transparent border-0 outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-52 overflow-y-auto p-1">
            {isInactiveExisting && (
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-muted-foreground cursor-not-allowed">
                <span className="w-3.5 h-3.5 rounded-sm border border-input shrink-0" />
                <span className="truncate uppercase">{value}</span>
                <span className="text-[9px] font-semibold px-1 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  Inactive
                </span>
              </div>
            )}
            {filtered.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">No locations found</div>
            ) : (
              filtered.map(opt => {
                const selected = (opt.value || '').toUpperCase() === valueUpper;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-xs',
                      selected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent'
                    )}
                  >
                    <span
                      className={cn(
                        'w-3.5 h-3.5 rounded-sm border flex items-center justify-center shrink-0',
                        selected ? 'bg-primary border-primary' : 'border-input'
                      )}
                    >
                      {selected && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                    </span>
                    <span className="truncate uppercase">{opt.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}