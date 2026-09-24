import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDebounce } from '@/hooks/useDebounce';
import AttendanceKpiCards from './AttendanceKpiCards';
import AttendanceFilterBar from './AttendanceFilterBar';
import CurrentlyClockedIn from './CurrentlyClockedIn';
import CheckInsByHourChart from './CheckInsByHourChart';
import DepartmentSnapshot from './DepartmentSnapshot';

// Dashboard tab — fetches ONLY its own data via the getAttendanceDashboard
// backend function. No other tabs are calculated. The backend performs all
// aggregation (KPIs, clocked-in, check-ins by hour, department snapshot) so
// the frontend never loads the full employee list.
export default function AttendanceDashboard({
  settings, shifts, assignments, holidays,
  selectedDate, filters, setFilters,
}) {
  // Debounce search to avoid a backend request on every keystroke
  const debouncedSearch = useDebounce(filters.search, 350);

  const { data, isLoading, error } = useQuery({
    queryKey: ['attendance-dashboard', {
      date: selectedDate,
      search: debouncedSearch,
      company: filters.company, department: filters.department,
      designation: filters.designation, manager: filters.manager,
      branch: filters.branch, dirIndir: filters.dirIndir,
    }],
    queryFn: () => base44.functions.invoke('getAttendanceDashboard', {
      date: selectedDate,
      filters: {
        search: debouncedSearch || '',
        company: filters.company || '',
        department: filters.department || '',
        designation: filters.designation || '',
        manager: filters.manager || '',
        branch: filters.branch || '',
        dirIndir: filters.dirIndir || '',
      },
    }),
    enabled: !!selectedDate,
  });

  const result = data?.data || {};

  return (
    <div className="space-y-4">
      <AttendanceFilterBar filters={filters} setFilters={setFilters} />

      {isLoading ? (
        <div className="space-y-4">
          {/* KPI skeleton */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9 gap-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-[72px] rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
          {/* Chart skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
            <div className="h-64 rounded-xl bg-muted/40 animate-pulse" />
          </div>
          <div className="h-32 rounded-xl bg-muted/40 animate-pulse" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">Failed to load dashboard data.</p>
          <p className="text-xs mt-1">{error?.message}</p>
        </div>
      ) : (
        <>
          <AttendanceKpiCards kpis={result.kpis} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <CurrentlyClockedIn clockedIn={result.clockedIn || []} />
            <CheckInsByHourChart checkInsByHour={result.checkInsByHour || []} />
          </div>

          <DepartmentSnapshot departments={result.departments || []} />
        </>
      )}
    </div>
  );
}