import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useLookupOptions } from '@/hooks/useLookupOptions';

/**
 * Filter option lists for the Master List — the SAME lists on every tab.
 *
 * Options come from the lookup tables and from whole-workforce distinct values,
 * never from the tab's own (filtered) dataset, so switching tabs can never
 * change which options a filter offers or silently drop a selection.
 */
export function useMasterListFilterOptions() {
  const {
    companyOptions, departmentOptions, locationOptions,
    rlicStatusOptions, pidStatusOptions, medicalResultOptions, trainingStatusOptions,
  } = useLookupOptions();

  const { data: positionOptions = [] } = useQuery({
    queryKey: ['employee-position-options'],
    staleTime: 300000,
    queryFn: async () => {
      const [designations, applications] = await Promise.all([
        base44.entities.Employee.list({ distinct: 'designation_org_chart', limit: 2000 }),
        base44.entities.Employee.list({ distinct: 'position_application', limit: 2000 }),
      ]);
      const values = new Set();
      [...(designations.items || []), ...(applications.items || [])].forEach(v => {
        const value = String(v ?? '').trim();
        if (value) values.add(value);
      });
      return [...values].sort().map(p => ({ value: p, label: p }));
    },
  });

  return useMemo(() => ({
    companyOptions,
    positionOptions,
    departmentOptions,
    locationOptions,
    rlicStatusOptions,
    pidStatusOptions,
    medicalResultOptions,
    trainingStatusOptions,
  }), [companyOptions, positionOptions, departmentOptions, locationOptions, rlicStatusOptions, pidStatusOptions, medicalResultOptions, trainingStatusOptions]);
}