import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { groupByPersonnel, getLatestSession, getOpenSession } from '@/lib/attendanceUtils';

// Fetches COMO Camp stay records for a specific date (stay_date = selected
// date). Returns the same shape of derived maps that ComoCamp.jsx previously
// got from AttendanceRecord, but backed by the dedicated ComoCampStay entity.
export function useCampStaysByDate(stayDate) {
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['camp-stays', 'by-date', stayDate],
    queryFn: () => base44.entities.ComoCampStay.filter(
      { stay_date: stayDate, is_deleted: { $ne: true } },
      '-check_in_at', 100000
    ),
    enabled: !!stayDate,
  });

  const sessionsByPersonnel = useMemo(() => groupByPersonnel(records), [records]);

  const latestByPersonnel = useMemo(() => {
    const m = new Map();
    for (const [id, arr] of sessionsByPersonnel) m.set(id, getLatestSession(arr));
    return m;
  }, [sessionsByPersonnel]);

  const openByPersonnel = useMemo(() => {
    const m = new Map();
    for (const [id, arr] of sessionsByPersonnel) {
      const o = getOpenSession(arr);
      if (o) m.set(id, o);
    }
    return m;
  }, [sessionsByPersonnel]);

  const countByPersonnel = useMemo(() => {
    const m = new Map();
    for (const [id, arr] of sessionsByPersonnel) m.set(id, arr.length);
    return m;
  }, [sessionsByPersonnel]);

  const daySessionIds = useMemo(() => new Set(sessionsByPersonnel.keys()), [sessionsByPersonnel]);

  return { records, sessionsByPersonnel, latestByPersonnel, openByPersonnel, countByPersonnel, daySessionIds, isLoading };
}