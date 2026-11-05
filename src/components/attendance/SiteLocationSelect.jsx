import React from 'react';
import { useQuery } from '@tanstack/react-query';
import SearchableSelect from '@/components/common/SearchableSelect';
import { getActiveLocations, locationLabel } from '@/lib/workLocations';

// Site Location for Manual Attendance Entry.
// Options come from Attendance Settings → Branch / Work Locations (WorkLocation,
// active only) — the same list the scanner uses. Selecting one here never changes
// the employee's assigned Branch on the Master List.
export default function SiteLocationSelect({ value, onChange, required = false }) {
  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['work-locations', 'active'],
    queryFn: getActiveLocations,
    staleTime: 5 * 60 * 1000,
  });

  const options = locations.map((l) => ({ value: l.id, label: locationLabel(l) }));

  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase">
        Site Location {required && <span className="text-red-500">*</span>}
      </label>
      <SearchableSelect
        value={value || ''}
        onChange={(id) => {
          const loc = locations.find((l) => l.id === id) || null;
          onChange(loc ? { id: loc.id, name: loc.location_name, code: loc.location_code } : { id: '', name: '', code: '' });
        }}
        options={options}
        placeholder={isLoading ? 'Loading work locations...' : 'Search branch / work location...'}
        emptyMessage="No active work location matches."
        disabled={isLoading}
      />
      <p className="text-[10px] text-muted-foreground">
        Applied to every employee in this entry. The employee's assigned Branch is not changed.
      </p>
    </div>
  );
}