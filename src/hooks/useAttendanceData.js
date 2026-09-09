import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import {
  getDailyAttendance, getSettings, getShifts,
  getShiftAssignments, getHolidays,
} from '@/lib/attendanceService';

// Central hook for the Daily Attendance module. Loads active personnel from
// the Master List (single source of truth), attendance records for the selected
// date, and all configuration (settings, shifts, assignments, holidays).
export function useAttendanceData(selectedDate) {
  const { data: employees = [], isLoading: empLoading } = useQuery({
    queryKey: ['employees', 'active-attendance'],
    queryFn: () => base44.entities.Employee.filter(
      { personnel_status: 'Active', is_active: { $ne: false } },
      'name', 100000
    ),
  });

  const { data: attendance = [], isLoading: attLoading, refetch: refetchAtt } = useQuery({
    queryKey: ['attendance', 'daily', selectedDate],
    queryFn: async () => {
      const { records } = await getDailyAttendance(selectedDate);
      return records;
    },
    enabled: !!selectedDate,
  });

  const { data: settings } = useQuery({
    queryKey: ['attendance-settings'],
    queryFn: getSettings,
  });

  const { data: shifts = [] } = useQuery({
    queryKey: ['attendance-shifts'],
    queryFn: getShifts,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['attendance-assignments'],
    queryFn: getShiftAssignments,
  });

  const { data: holidays = [] } = useQuery({
    queryKey: ['attendance-holidays'],
    queryFn: getHolidays,
  });

  // Map attendance records by personnel_id for quick lookup
  const attendanceByPersonnel = new Map();
  for (const r of attendance) {
    if (!r.is_deleted) attendanceByPersonnel.set(r.personnel_id, r);
  }

  return {
    employees, attendance, attendanceByPersonnel,
    settings, shifts, assignments, holidays,
    isLoading: empLoading || attLoading,
    refetchAtt,
  };
}