import { useQuery } from '@tanstack/react-query';
import { getSettings, getShifts, getShiftAssignments, getHolidays } from '@/lib/attendanceService';

/**
 * Cached reference data for the Daily Attendance module.
 * Settings, shifts, assignments, and holidays change rarely, so they are
 * cached for 5 minutes (staleTime). This avoids re-fetching on every
 * navigation between tabs.
 *
 * This hook does NOT load employees or attendance records — each tab
 * fetches its own data independently.
 */
export function useAttendanceReference() {
  const { data: settings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: getSettings,
    staleTime: 5 * 60 * 1000,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['attendance-shifts'],
    queryFn: getShifts,
    staleTime: 5 * 60 * 1000,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['attendance-assignments'],
    queryFn: getShiftAssignments,
    staleTime: 5 * 60 * 1000,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['attendance-holidays'],
    queryFn: getHolidays,
    staleTime: 5 * 60 * 1000,
  });

  return { settings, shifts, assignments, holidays };
}