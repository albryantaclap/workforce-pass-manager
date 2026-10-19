import React, { useState } from 'react';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { locationLabel } from '@/lib/workLocations';

/**
 * Type-to-search branch selector. Every active location is listed as
 * "CODE — NAME" and the list filters as the operator types a code or a name.
 *
 * The list expands in flow right under the field instead of floating in a portal:
 * this picker lives inside a modal dialog, and while a modal is open the page
 * scroll is locked (portalled panels are excluded from that lock), which is why
 * a floating list cannot be dragged on a touch screen. An in-flow list scrolls.
 */
export default function WorkLocationCombobox({ locations = [], value, onChange, allowNone = true }) {
  const [open, setOpen] = useState(false);
  const selected = locations.find((l) => l.id === value) || null;

  const pick = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        variant="outline"
        role="combobox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="w-full justify-between font-normal h-9"
      >
        <span className={cn('truncate', !selected && 'text-muted-foreground')}>
          {selected ? locationLabel(selected) : 'Type or select a branch'}
        </span>
        <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
      </Button>

      {open && (
        <Command className="rounded-lg border shadow-sm">
          <CommandInput placeholder="Search branch code or name..." autoFocus />
          <CommandList className="max-h-[40vh] overscroll-contain">
            <CommandEmpty>No branch found.</CommandEmpty>
            {allowNone && (
              <CommandItem value="no-location" onSelect={() => pick('')}>
                <span>No location</span>
                <Check className={cn('ml-auto w-4 h-4 shrink-0', !value ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
            )}
            {locations.map((l) => (
              <CommandItem
                key={l.id}
                value={locationLabel(l)}
                onSelect={() => pick(l.id)}
              >
                <span className="truncate">{locationLabel(l)}</span>
                <Check className={cn('ml-auto w-4 h-4 shrink-0', value === l.id ? 'opacity-100' : 'opacity-0')} />
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      )}
    </div>
  );
}