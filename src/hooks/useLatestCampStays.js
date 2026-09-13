import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { groupByPersonnel, getLatestSession } from '@/lib/attendanceUtils';

// Fetches all COMO Camp stay records in a single query and returns a Map<
// personnel_id, latestStay>. This is the camp/accommodation movement source of
// truth — completely separate from work attendance (AttendanceRecord).
//
// The query key is prefixed with ['camp-stays'] so it is invalidated
// independently from the work-attendance ['attendance'] queries.
export function useLatestCampStays() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['camp-stays', 'latest-all'],
    queryFn: () => base44.entities.ComoCampStay.list('-check_in_at', 100000),
  });

  const latestByPersonnel = useMemo(() => {
    const active = records.filter(r => !r.is_deleted);
    const grouped = groupByPersonnel(active);
    const m = new Map();
    for (const [id, arr] of grouped) m.set(id, getLatestSession(arr));
    return m;
  }, [records]);

  return { latestByPersonnel, isLoading };
}