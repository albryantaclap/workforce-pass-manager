// Centralized Attendance Engine — pure calculation functions (no API calls).
// Used by attendanceService.js and shared across Daily Attendance, COMO Camp,
// Master List, and Personnel Form. All functions are timezone-safe and work
// with the user's local timezone (not UTC).

import { calcDuration as _calcDuration } from './attendanceUtils';

// ── Day-of-week helpers ──
export const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const dayKey = (dateStr) => {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return DAY_KEYS[new Date(y, m - 1, d).getDay()];
};

export const isWorkingDay = (dateStr, settings) => {
  if (!dateStr) return false;
  const days = settings?.working_days || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'];
  return days.includes(dayKey(dateStr));
};

// ── Holiday helpers ──
export const isHoliday = (dateStr, holidays = []) => {
  if (!dateStr || !holidays?.length) return null;
  const [y, m, d] = dateStr.split('-').map(Number);
  const monthDay = `${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  return holidays.find(h => {
    if (!h.is_active) return false;
    if (h.repeat_yearly) return h.holiday_date?.slice(5) === monthDay;
    return h.holiday_date === dateStr;
  }) || null;
};

// ── Shift resolution ──
// Resolves the effective shift for an employee based on shift assignments.
// Priority: employee-specific > branch > department > company > global default.
export const resolveShift = (employee, assignments = [], shifts = [], settings = null) => {
  if (!employee) return null;
  const shiftMap = new Map(shifts.filter(s => s.is_active !== false).map(s => [s.id, s]));

  const tryResolve = (a) => {
    const shift = shiftMap.get(a.shift_id);
    if (!shift) return null;
    return { ...shift, _assignment: a };
  };

  // 1. Employee-specific
  const empAssign = assignments.find(a =>
    a.is_active !== false && a.assignment_type === 'employee' && a.personnel_id === employee.id
  );
  if (empAssign) { const s = tryResolve(empAssign); if (s) return s; }

  // 2. Branch
  if (employee.current_location) {
    const branchAssign = assignments.find(a =>
      a.is_active !== false && a.assignment_type === 'branch' &&
      a.branch_location === employee.current_location
    );
    if (branchAssign) { const s = tryResolve(branchAssign); if (s) return s; }
  }

  // 3. Department
  if (employee.department) {
    const deptAssign = assignments.find(a =>
      a.is_active !== false && a.assignment_type === 'department' &&
      a.department === employee.department
    );
    if (deptAssign) { const s = tryResolve(deptAssign); if (s) return s; }
  }

  // 4. Company
  if (employee.company) {
    const coAssign = assignments.find(a =>
      a.is_active !== false && a.assignment_type === 'company' &&
      a.company === employee.company
    );
    if (coAssign) { const s = tryResolve(coAssign); if (s) return s; }
  }

  // 5. Global default (synthesized from settings)
  if (settings) {
    return {
      id: 'default',
      shift_name: 'Default Shift',
      start_time: settings.default_shift_start || '07:00',
      end_time: settings.default_shift_end || '17:00',
      break_minutes: settings.break_minutes ?? 60,
      grace_minutes: settings.late_grace_minutes ?? 10,
      overtime_start_hours: settings.overtime_start_hours ?? 8,
      cross_midnight: false,
    };
  }
  return null;
};

// ── Shift boundary resolution ──
// Returns { start: Date, end: Date } for a shift on a given attendance date.
// Handles cross-midnight shifts (end_time is on the next calendar day).
export const resolveShiftBounds = (shift, attendanceDate) => {
  if (!shift || !attendanceDate) return null;
  const [y, m, d] = attendanceDate.split('-').map(Number);
  const [sh, sm] = (shift.start_time || '00:00').split(':').map(Number);
  const [eh, em] = (shift.end_time || '00:00').split(':').map(Number);
  const start = new Date(y, m - 1, d, sh, sm, 0, 0);
  let end = new Date(y, m - 1, d, eh, em, 0, 0);
  if (shift.cross_midnight) {
    end = new Date(y, m - 1, d + 1, eh, em, 0, 0);
  }
  // If end <= start and not cross_midnight, assume end is next day
  if (!shift.cross_midnight && end <= start) {
    end = new Date(y, m - 1, d + 1, eh, em, 0, 0);
  }
  return { start, end };
};

// ── Shift expiry (for day-reset logic) ──
// Returns true if the shift end + buffer has passed — meaning the session
// should be auto-closed and the employee released for the next shift.
export const hasShiftExpired = (shift, attendanceDate, bufferMinutes = 0) => {
  const bounds = resolveShiftBounds(shift, attendanceDate);
  if (!bounds) return false;
  const now = new Date();
  return now >= new Date(bounds.end.getTime() + (bufferMinutes || 0) * 60000);
};

// ── Punch sequence helpers ──
// Determines the next expected punch type based on what's already recorded.
export const getNextExpectedPunch = (record) => {
  if (!record || !record.first_in_at) return 'IN'; // First Punch In
  if (!record.first_out_at) return 'OUT'; // First Punch Out
  if (!record.second_in_at) return 'IN'; // Second Punch In
  if (!record.final_out_at) return 'OUT'; // Final Punch Out
  return null; // Session complete
};

// Determines the missing punch label for an incomplete/expired session.
export const getMissingPunchLabel = (record) => {
  if (!record) return '';
  if (!record.first_in_at) return 'Missing First Punch In';
  if (!record.first_out_at) return 'Missing First Punch Out';
  if (!record.second_in_at) return 'Missing Second Punch In';
  if (!record.final_out_at) return 'Missing Final Punch Out';
  return '';
};

// ── Duration calculation ──
// Sum of completed IN→OUT pairs. Does not count open/incomplete pairs.
// Pair 1: first_in_at → first_out_at
// Pair 2: second_in_at → final_out_at
export const calculateDurationFromRecord = (record) => {
  if (!record) return 0;
  let total = 0;
  if (record.first_in_at && record.first_out_at) {
    total += _calcDuration(record.first_in_at, record.first_out_at);
  }
  if (record.second_in_at && record.final_out_at) {
    total += _calcDuration(record.second_in_at, record.final_out_at);
  }
  // Single session (no split): first_in → final_out
  if (!record.first_out_at && !record.second_in_at && record.first_in_at && record.final_out_at) {
    total = _calcDuration(record.first_in_at, record.final_out_at);
  }
  return total;
};

// ── Overtime calculation ──
export const calculateOvertime = (durationMinutes, settings) => {
  if (!durationMinutes || !settings) return 0;
  const otStart = (settings.overtime_start_hours ?? 8) * 60;
  return Math.max(0, durationMinutes - otStart);
};

// ── Late calculation ──
// Returns { isLate, lateMinutes } based on first clock-in vs shift start + grace.
export const calculateLate = (record, shift) => {
  if (!record?.first_in_at || !shift) return { isLate: false, lateMinutes: 0 };
  const bounds = resolveShiftBounds(shift, record.attendance_date);
  if (!bounds) return { isLate: false, lateMinutes: 0 };
  const grace = (shift.grace_minutes ?? 0) * 60000;
  const checkIn = new Date(record.first_in_at);
  const lateMs = checkIn.getTime() - (bounds.start.getTime() + grace);
  if (lateMs <= 0) return { isLate: false, lateMinutes: 0 };
  return { isLate: true, lateMinutes: Math.round(lateMs / 60000) };
};

// ── Daily status calculation ──
// Determines the attendance_status based on punches, shift, settings, and holidays.
export const calculateDailyStatus = (record, shift, settings, holidays = []) => {
  const dateStr = record?.attendance_date;
  const holiday = isHoliday(dateStr, holidays);
  if (holiday) return 'Holiday';
  if (!isWorkingDay(dateStr, settings)) return 'Rest Day';

  const hasFirstIn = !!record?.first_in_at;
  if (!hasFirstIn) return 'Absent';

  const hasFinalOut = !!record?.final_out_at;
  const hasFirstOut = !!record?.first_out_at;

  if (!hasFinalOut) {
    // Session is still open or was auto-closed without final out
    return 'Missing Check-out';
  }

  // Has first in and final out — check for late
  const { isLate } = calculateLate(record, shift);
  if (isLate) return 'Late';

  // Check half-day threshold
  const duration = calculateDurationFromRecord(record);
  const halfDayThreshold = (settings?.half_day_threshold_hours ?? 4) * 60;
  if (duration > 0 && duration < halfDayThreshold) return 'Half Day';

  return 'Present';
};

// ── Status → color mapping (for UI) ──
export const STATUS_COLORS = {
  'Present': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', dot: 'bg-emerald-500' },
  'Absent': { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200', dot: 'bg-red-500' },
  'Late': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', dot: 'bg-amber-500' },
  'Half Day': { bg: 'bg-yellow-50', text: 'text-yellow-700', border: 'border-yellow-200', dot: 'bg-yellow-500' },
  'On Leave': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'Rest Day': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  'Holiday': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
  'Missing Check-out': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
  'Incomplete': { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', dot: 'bg-orange-500' },
};

// ── Duration color logic (for table rows) ──
export const getDurationColor = (minutes) => {
  if (!minutes || minutes <= 0) return 'text-slate-400';
  if (minutes < 5 * 60) return 'text-red-600';
  if (minutes <= 10 * 60) return 'text-emerald-600';
  return 'text-blue-600';
};

// ── Format helpers ──
export const formatMinutes = (mins) => {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

export const formatTimeShort = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return '—'; }
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};