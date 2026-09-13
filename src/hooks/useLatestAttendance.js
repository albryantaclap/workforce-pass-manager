import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { groupByPersonnel, getLatestSession } from '@/lib/attendanceUtils';

// Fetches all WORK-ATTENDANCE records in a single query and returns a Map<
// personnel_id, latestSession>. Avoids N+1 — one query for the entire list.
//
// IMPORTANT: COMO Camp accommodation movement (source_page === 'COMO Camp') is
// EXCLUDED — those records are camp/accommodation stays, not work attendance.
// They live in the dedicated ComoCampStay entity and are surfaced via
// useLatestCampStays. Soft-deleted records are also excluded.
// The query key is prefixed with ['attendance'] so it is invalidated by the
// same invalidation calls used by the Personnel Form.
export function useLatestAttendance() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', 'latest-all'],
    queryFn: () => base44.entities.AttendanceRecord.list('-check_in_at', 100000),
  });

  const latestByPersonnel = useMemo(() => {
    // Exclude COMO Camp accommodation movement and soft-deleted records —
    // this hook is for WORK ATTENDANCE only.
    const workRecords = records.filter(
      r => !r.is_deleted && r.source_page !== 'COMO Camp'
    );
    const grouped = groupByPersonnel(workRecords);
    const m = new Map();
    for (const [id, arr] of grouped) m.set(id, getLatestSession(arr));
    return m;
  }, [records]);

  return { latestByPersonnel, isLoading };
}