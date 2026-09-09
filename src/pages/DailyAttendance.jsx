import React, { useState, useMemo } from 'react';
import { Clock } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAttendanceData } from '@/hooks/useAttendanceData';
import AttendanceDashboard from '@/components/attendance/AttendanceDashboard';
import TimeEntries from '@/components/attendance/TimeEntries';
import EmployeeSummary from '@/components/attendance/EmployeeSummary';
import AttendanceSettings from '@/components/attendance/AttendanceSettings';
import AttendanceReports from '@/components/attendance/AttendanceReports';
import AttendanceClock from '@/components/attendance/AttendanceClock';

const TABS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'summary', label: 'Employee Summary' },
  { key: 'scan', label: 'Attendance Clock' },
  { key: 'entries', label: 'Time Entries' },
  { key: 'reports', label: 'Attendance Reports' },
  { key: 'settings', label: 'Attendance Settings' },
];

export default function DailyAttendance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const validTabs = TABS.map(t => t.key);
  const activeTab = validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : 'dashboard';
  const setActiveTab = (key) => setSearchParams({ tab: key }, { replace: true });
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString('en-CA'));

  const {
    employees, attendance, attendanceByPersonnel,
    settings, shifts, assignments, holidays,
    isLoading, refetchAtt,
  } = useAttendanceData(selectedDate);

  // Shared filter state (lifted so Dashboard and Time Entries stay in sync)
  const [filters, setFilters] = useState({
    search: '',
    company: '',
    department: '',
    designation: '',
    manager: '',
    branch: '',
    dirIndir: '',
    status: '',
  });

  // Filtered employees (shared across tabs)
  const filteredEmployees = useMemo(() => {
    if (!employees?.length) return [];
    const f = filters;
    return employees.filter(emp => {
      if (f.search) {
        const q = f.search.toLowerCase();
        const hay = `${emp.name || ''} ${emp.qid_no || ''} ${emp.pid || ''} ${emp.position_application || ''} ${emp.company || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.company && emp.company !== f.company) return false;
      if (f.department && emp.department !== f.department) return false;
      if (f.designation && emp.position_application !== f.designation) return false;
      if (f.manager && emp.assigned_manager_id !== f.manager) return false;
      if (f.branch && emp.current_location !== f.branch) return false;
      if (f.dirIndir && emp.dir_indir !== f.dirIndir) return false;
      if (f.status) {
        const att = attendanceByPersonnel.get(emp.id);
        const status = att?.attendance_status || (att ? 'Present' : 'Absent');
        if (status !== f.status) return false;
      }
      return true;
    });
  }, [employees, filters, attendanceByPersonnel]);

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md">
            <Clock className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Daily Attendance</h1>
            <p className="text-sm text-muted-foreground">Track and manage employee attendance records</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {activeTab === 'dashboard' && (
            <AttendanceDashboard
              employees={filteredEmployees}
              attendanceByPersonnel={attendanceByPersonnel}
              settings={settings}
              shifts={shifts}
              assignments={assignments}
              holidays={holidays}
              selectedDate={selectedDate}
              filters={filters}
              setFilters={setFilters}
            />
          )}
          {activeTab === 'summary' && (
            <EmployeeSummary
              employees={filteredEmployees}
              settings={settings}
              shifts={shifts}
              assignments={assignments}
              holidays={holidays}
              filters={filters}
              setFilters={setFilters}
            />
          )}
          {activeTab === 'scan' && (
            <AttendanceClock employees={employees} onRecorded={refetchAtt} />
          )}
          {activeTab === 'entries' && (
            <TimeEntries
              employees={filteredEmployees}
              attendanceByPersonnel={attendanceByPersonnel}
              settings={settings}
              shifts={shifts}
              assignments={assignments}
              holidays={holidays}
              selectedDate={selectedDate}
              setSelectedDate={setSelectedDate}
              filters={filters}
              setFilters={setFilters}
              refetchAtt={refetchAtt}
            />
          )}
          {activeTab === 'reports' && (
            <AttendanceReports
              employees={filteredEmployees}
              settings={settings}
              shifts={shifts}
              assignments={assignments}
              holidays={holidays}
              filters={filters}
              setFilters={setFilters}
            />
          )}
          {activeTab === 'settings' && (
            <AttendanceSettings
              settings={settings}
              shifts={shifts}
              assignments={assignments}
              holidays={holidays}
            />
          )}
        </>
      )}
    </div>
  );
}