import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ATTENDANCE_ROSTER_QUERY } from '@/lib/attendanceEligibility';

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
export function useAttendanceEmployees(enabled = true, staleTime = 2 * 60 * 1000) {
  return useQuery({
    queryKey: ['employees', 'active-attendance'],
    // Roster = the Master List read with the shared eligibility rule
    // (@/lib/attendanceEligibility) — no separate attendance employee table.
    queryFn: () => base44.entities.Employee.filter(ATTENDANCE_ROSTER_QUERY, 'name', 100000),
    enabled,
    // The caller may hold this roster much longer: the ID Card Scanner treats the
    // cached copy as a fast path only and resolves any card it cannot match here
    // through the authoritative exact-ID lookup (@/lib/scannerEmployeeLookup), so
    // re-reading the whole workforce every 2 minutes buys nothing but read traffic.
    staleTime,
  });
}