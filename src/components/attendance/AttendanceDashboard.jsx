import React from 'react';
import AttendanceKpiCards from './AttendanceKpiCards';
import AttendanceFilterBar from './AttendanceFilterBar';
import CurrentlyClockedIn from './CurrentlyClockedIn';
import CheckInsByHourChart from './CheckInsByHourChart';
import DepartmentSnapshot from './DepartmentSnapshot';

export default function AttendanceDashboard({
  employees, attendanceByPersonnel, settings, shifts, assignments, holidays,
  selectedDate, filters, setFilters,
}) {
  return (
    <div className="space-y-4">
      <AttendanceFilterBar filters={filters} setFilters={setFilters} employees={employees} />
      <AttendanceKpiCards
        employees={employees}
        attendanceByPersonnel={attendanceByPersonnel}
        settings={settings}
        holidays={holidays}
        selectedDate={selectedDate}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <CurrentlyClockedIn employees={employees} attendanceByPersonnel={attendanceByPersonnel} />
        <CheckInsByHourChart employees={employees} attendanceByPersonnel={attendanceByPersonnel} />
      </div>

      <DepartmentSnapshot
        employees={employees}
        attendanceByPersonnel={attendanceByPersonnel}
        settings={settings}
        holidays={holidays}
        selectedDate={selectedDate}
      />
    </div>
  );
}