import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function MultiSelect({ options, value = [], onChange, placeholder = 'Select...', className }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredOptions = options.filter(opt => {
    const label = typeof opt === 'string' ? opt : opt.label;
    return label.toLowerCase().includes(search.toLowerCase());
  });

  const toggle = (val) => {
    if (value.includes(val)) onChange(value.filter(v => v !== val));
    else onChange([...value, val]);
  };

  const remove = (val, e) => { e.stopPropagation(); onChange(value.filter(v => v !== val)); };

  return (
    <div ref={ref} className={cn('relative', className)}>
      <div
        className="flex flex-wrap gap-1 min-h-9 w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm cursor-pointer hover:bg-accent/20"
        onClick={() => setOpen(!open)}
      >
        {value.length === 0 ? (
          <span className="text-muted-foreground self-center">{placeholder}</span>
        ) : (
          value.map(v => {
            const opt = options.find(o => (typeof o === 'string' ? o : o.value) === v);
            const label = opt ? (typeof opt === 'string' ? opt : opt.label) : v;
            return (
              <span key={v} className="flex items-center gap-1 bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full">
                {label}
                <X className="w-3 h-3 cursor-pointer" onClick={(e) => remove(v, e)} />
              </span>
            );
          })
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground ml-auto self-center transition-transform', open && 'rotate-180')} />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
          <div className="p-2 border-b">
            <input
              className="w-full text-sm px-2 py-1 rounded border border-input bg-transparent outline-none"
              placeholder="Search..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div className="max-h-52 overflow-auto">
            {filteredOptions.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">No results</div>}
            {filteredOptions.map(opt => {
              const val = typeof opt === 'string' ? opt : opt.value;
              const label = typeof opt === 'string' ? opt : opt.label;
              const selected = value.includes(val);
              return (
                <div
                  key={val}
                  className={cn('flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-accent', selected && 'bg-accent/50')}
                  onClick={() => toggle(val)}
                >
                  <div className={cn('w-4 h-4 rounded border flex items-center justify-center', selected ? 'bg-primary border-primary' : 'border-input')}>
                    {selected && <Check className="w-3 h-3 text-white" />}
                  </div>
                  {label}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}