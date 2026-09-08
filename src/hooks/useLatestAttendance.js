import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { groupByPersonnel, getLatestSession } from '@/lib/attendanceUtils';

// Fetches all attendance records in a single query and returns a Map<
// personnel_id, latestSession>. Avoids N+1 — one query for the entire list.
// The query key is prefixed with ['attendance'] so it is invalidated by the
// same invalidation calls used by COMO Camp and the Personnel Form.
export function useLatestAttendance() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', 'latest-all'],
    queryFn: () => base44.entities.AttendanceRecord.list('-check_in_at', 100000),
  });

  const latestByPersonnel = useMemo(() => {
    const grouped = groupByPersonnel(records);
    const m = new Map();
    for (const [id, arr] of grouped) m.set(id, getLatestSession(arr));
    return m;
  }, [records]);

  return { latestByPersonnel, isLoading };
}