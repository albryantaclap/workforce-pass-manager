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
// Only the fields the screens read from a stay — the stay history is a long
// table, so the rows are kept as small as possible.
const STAY_FIELDS = [
  'personnel_id', 'employee_name', 'company', 'stay_date',
  'check_in_at', 'check_out_at', 'duration_minutes', 'status',
  'camp_location', 'work_location', 'is_deleted',
];

export function useLatestCampStays() {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['camp-stays', 'latest-all'],
    queryFn: async () => {
      const { items } = await base44.entities.ComoCampStay.filter(
        {},
        { sort: '-check_in_at', limit: 100000, fields: STAY_FIELDS }
      );
      return items;
    },
    // The whole stay history is read once and kept for 5 minutes, so moving
    // between the Master List, COMO Camp and Inactive does not re-read it each
    // time. Camp check-ins/outs still invalidate ['camp-stays'] immediately.
    staleTime: 5 * 60 * 1000,
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