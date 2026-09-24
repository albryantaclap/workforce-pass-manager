import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Cached filter options (companies, departments, designations, branches,
 * managers) from active employees. Fetched once from the backend and cached
 * for 5 minutes, so the filter bar dropdowns don't require loading the
 * full employee list on every page navigation.
 */
export function useAttendanceFilterOptions() {
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-filter-options'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getAttendanceFilterOptions');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return {
    options: data || { companies: [], departments: [], designations: [], branches: [], managers: [] },
    isLoading,
  };
}