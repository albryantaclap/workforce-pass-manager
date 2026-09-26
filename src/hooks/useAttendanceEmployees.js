import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

/**
 * Lazy-load all active employees. Only fetches when `enabled` is true.
 *
 * Used by:
 *   - Attendance Clock (when the scanner is activated)
 *   - Attendance Settings → Shifts tab (for shift assignment)
 *   - Manual Entry Dialog (employee dropdown)
 *   - PDF export dialogs (employee list for PDFs)
 *
 * Cached for 2 minutes to avoid re-fetching on rapid navigation.
 * This hook does NOT run on initial page load — only when explicitly
 * enabled by the consuming component.
 */
export function useAttendanceEmployees(enabled = true) {
  return useQuery({
    queryKey: ['employees', 'active-attendance'],
    queryFn: () => base44.entities.Employee.filter(
      { personnel_status: 'Active on Site', is_active: { $ne: false } },
      'name', 100000
    ),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
}