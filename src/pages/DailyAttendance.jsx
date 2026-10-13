import React, { useState } from 'react';
import { Clock, LayoutDashboard, Users, ScanLine, Timer, FileBarChart, Settings } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import SubmenuTabs from '@/components/common/SubmenuTabs';
import { useRbac } from '@/lib/useRbac';
import { useAttendanceReference } from '@/hooks/useAttendanceReference';
import AttendanceDashboard from '@/components/attendance/AttendanceDashboard';
import TimeEntries from '@/components/attendance/TimeEntries';
import EmployeeSummary from '@/components/attendance/EmployeeSummary';
import AttendanceSettings from '@/components/attendance/AttendanceSettings';
import AttendanceReports from '@/components/attendance/AttendanceReports';
import AttendanceClock from '@/components/attendance/AttendanceClock';

const TABS = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, gradient: 'from-blue-400 to-blue-600', perm: 'attendance.dashboard' },
  { key: 'summary', label: 'Employee Summary', icon: Users, gradient: 'from-violet-400 to-purple-600', perm: 'attendance.summary' },
  { key: 'scan', label: 'Attendance Clock', icon: ScanLine, gradient: 'from-amber-400 to-amber-600', perm: 'attendance.clock' },
  { key: 'entries', label: 'Time Entries', icon: Timer, gradient: 'from-teal-400 to-cyan-600', perm: 'attendance.entries' },
  { key: 'reports', label: 'Attendance Reports', icon: FileBarChart, gradient: 'from-emerald-400 to-green-600', perm: 'attendance.reports' },
  { key: 'settings', label: 'Attendance Settings', icon: Settings, gradient: 'from-slate-400 to-slate-600', perm: 'attendance.settings' },
];

export default function DailyAttendance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { canView } = useRbac();
  const visibleTabs = TABS.filter(tab => canView(tab.perm));
  const validTabs = visibleTabs.map(t => t.key);
  const activeTab = validTabs.includes(searchParams.get('tab')) ? searchParams.get('tab') : (validTabs[0] || 'dashboard');
  const setActiveTab = (key) => setSearchParams({ tab: key }, { replace: true });
  const [selectedDate, setSelectedDate] = useState(() => new Date().toLocaleDateString('en-CA'));

  // Cached reference data (settings, shifts, assignments, holidays).
  // Does NOT load employees or attendance — each tab fetches its own data
  // independently, so opening one tab does not calculate other tabs' data.
  const { settings, shifts, assignments, holidays } = useAttendanceReference();

  // Shared filter state (lifted so all tabs stay in sync)
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

  return (
    <div className="p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header — always visible, never blocked by loading */}
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

      {/* Tabs — same card style as the main Dashboard */}
      <SubmenuTabs activeKey={activeTab} onChange={setActiveTab} tabs={visibleTabs} />

      {/* Tab content — each tab fetches only its own data.
          No isLoading gate: the header and tabs are always visible.
          Each component shows its own lightweight skeleton/error state. */}
      {activeTab === 'dashboard' && (
        <AttendanceDashboard
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
          settings={settings}
          shifts={shifts}
          assignments={assignments}
          holidays={holidays}
          filters={filters}
          setFilters={setFilters}
        />
      )}
      {activeTab === 'scan' && (
        <AttendanceClock />
      )}
      {activeTab === 'entries' && (
        <TimeEntries
          settings={settings}
          shifts={shifts}
          assignments={assignments}
          holidays={holidays}
          selectedDate={selectedDate}
          setSelectedDate={setSelectedDate}
          filters={filters}
          setFilters={setFilters}
        />
      )}
      {activeTab === 'reports' && (
        <AttendanceReports
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
    </div>
  );
}