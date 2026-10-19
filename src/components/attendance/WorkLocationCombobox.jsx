import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { locationLabel } from '@/lib/workLocations';

/**
 * Type-to-search branch selector. Every active location is listed as
 * "CODE — NAME" and the list filters as the operator types a code or a name.
 */
export default function WorkLocationCombobox({ locations = [], value, onChange, allowNone = true }) {
  const [open, setOpen] = useState(false);
  const selected = locations.find((l) => l.id === value) || null;

  const pick = (id) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal h-9"
        >
          <span className={cn('truncate', !selected && 'text-muted-foreground')}>
            {selected ? locationLabel(selected) : 'Type or select a branch'}
          </span>
          <ChevronsUpDown className="w-4 h-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="p-0 w-[var(--radix-popover-trigger-width)]">
        <Command>
          <CommandInput placeholder="Search branch code or name..." />
          <CommandList>
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
      </PopoverContent>
    </Popover>
  );
}