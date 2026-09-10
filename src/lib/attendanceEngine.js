// Centralized Attendance Engine — pure calculation functions (no API calls).
// Used by attendanceService.js and shared across Daily Attendance, COMO Camp,
// Master List, and Personnel Form. All functions are timezone-safe and work
// with the user's local timezone (not UTC).

import { calcDuration as _calcDuration } from './attendanceUtils';

// Qatar (Arabia Standard Time) is UTC+3 year-round with no DST. Shift times are
// stored as Qatar-local "HH:mm" strings; these helpers build absolute Date
// instants for those wall-clock times so the engine is correct regardless of
// the browser's own timezone (e.g. when the preview runs in UTC).
const QATAR_OFFSET_MIN = 180;
const qatarDateFromParts = (y, monthIdx, d, h, mm) =>
  new Date(Date.UTC(y, monthIdx, d, h, mm, 0, 0) - QATAR_OFFSET_MIN * 60000);

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
  const start = qatarDateFromParts(y, m - 1, d, sh, sm);
  let end = qatarDateFromParts(y, m - 1, d, eh, em);
  if (shift.cross_midnight) {
    end = qatarDateFromParts(y, m - 1, d + 1, eh, em);
  }
  // If end <= start and not cross_midnight, assume end is next day
  if (!shift.cross_midnight && end <= start) {
    end = qatarDateFromParts(y, m - 1, d + 1, eh, em);
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
// Backward-compat helpers: old records have check_in_at/check_out_at but not
// the new first_in_at/final_out_at fields. These fallbacks ensure old records
// are handled correctly by the new multi-punch logic.
export const getFirstIn = (record) => record?.first_in_at || record?.check_in_at || '';
export const getFinalOut = (record) => record?.final_out_at || record?.check_out_at || '';

// Determines the next expected punch type based on what's already recorded.
export const getNextExpectedPunch = (record) => {
  const firstIn = getFirstIn(record);
  if (!firstIn) return 'IN'; // First Punch In
  if (!record.first_out_at) return 'OUT'; // First Punch Out
  if (!record.second_in_at) return 'IN'; // Second Punch In
  if (!record.final_out_at && !record.check_out_at) return 'OUT'; // Final Punch Out
  return null; // Session complete
};

// Determines the missing punch label for an incomplete/expired session.
export const getMissingPunchLabel = (record) => {
  if (!record) return '';
  const firstIn = getFirstIn(record);
  const finalOut = getFinalOut(record);
  if (!firstIn) return 'Missing First Punch In';
  if (record.first_out_at && record.second_in_at && !record.final_out_at) return 'Missing Final Punch Out';
  if (record.first_out_at && !record.second_in_at && !finalOut) return 'Missing Final Punch Out';
  if (record.first_out_at && !record.second_in_at) return ''; // single session complete
  if (!record.first_out_at) return 'Missing First Punch Out';
  if (!record.second_in_at) return 'Missing Second Punch In';
  if (!record.final_out_at) return 'Missing Final Punch Out';
  return '';
};

// ── Duration calculation ──
// Sum of completed IN→OUT pairs. Does not count open/incomplete pairs.
// Pair 1: first_in_at → first_out_at
// Pair 2: second_in_at → final_out_at
// Falls back to check_in_at/check_out_at for old records.
export const calculateDurationFromRecord = (record) => {
  if (!record) return 0;
  const firstIn = getFirstIn(record);
  const finalOut = getFinalOut(record);
  let total = 0;
  if (record.first_in_at && record.first_out_at) {
    total += _calcDuration(record.first_in_at, record.first_out_at);
  }
  if (record.second_in_at && record.final_out_at) {
    total += _calcDuration(record.second_in_at, record.final_out_at);
  }
  // Single session (no split): first_in → final_out (with fallback)
  if (!record.first_out_at && !record.second_in_at && firstIn && finalOut) {
    total = _calcDuration(firstIn, finalOut);
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
  const firstIn = getFirstIn(record);
  if (!firstIn || !shift) return { isLate: false, lateMinutes: 0 };
  const bounds = resolveShiftBounds(shift, record.attendance_date);
  if (!bounds) return { isLate: false, lateMinutes: 0 };
  const grace = (shift.grace_minutes ?? 0) * 60000;
  const checkIn = new Date(firstIn);
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

  const firstIn = getFirstIn(record);
  if (!firstIn) return 'Absent';

  const finalOut = getFinalOut(record);

  if (!finalOut) {
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
  'Not Checked In': { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', dot: 'bg-slate-400' },
  'First In Completed': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200', dot: 'bg-blue-500' },
  'First Out Completed': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200', dot: 'bg-indigo-500' },
  'Second In Completed': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', dot: 'bg-violet-500' },
  'Manual Override': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200', dot: 'bg-purple-500' },
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
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Qatar' });
  } catch { return '—'; }
};

export const formatDateShort = (dateStr) => {
  if (!dateStr) return '—';
  try {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

// ── Split-Shift Punch Rules ───────────────────────────────────────────────
// Enabled per-shift via shift.split_shift_enabled. When ON, the shift follows a
// 4-punch sequence: FIRST IN → FIRST OUT → SECOND IN → FINAL OUT, with
// configurable windows per punch and cross-midnight support. All punches stay
// under the shift's attendance_date (no separate after-midnight day is created).
// When OFF, normal attendance behavior is unchanged.

export const PUNCH_KEYS = ['FIRST_IN', 'FIRST_OUT', 'SECOND_IN', 'FINAL_OUT'];

export const isSplitShiftEnabled = (shift) => !!(shift && shift.split_shift_enabled);

// Whether split-shift rules are effective for a given attendance date
// (respects split_effective_from / split_effective_to).
export const isSplitEffective = (shift, attendanceDate) => {
  if (!isSplitShiftEnabled(shift) || !attendanceDate) return false;
  if (shift.split_effective_from && attendanceDate < shift.split_effective_from) return false;
  if (shift.split_effective_to && attendanceDate > shift.split_effective_to) return false;
  return true;
};

// Resolve a "HH:mm" time to a Date on the shift's attendance date, advancing to
// the next calendar day when the time is earlier than the shift start (cross-midnight).
// `forceSameDay` overrides the next-day jump — used for FIRST IN, which always
// belongs on the shift's attendance date (the shift-start day), even when its
// configured start is earlier than shift.start_time.
const resolvePunchDateTime = (timeStr, shift, attendanceDate, forceSameDay = false) => {
  if (!timeStr || !attendanceDate) return null;
  const [y, m, d] = attendanceDate.split('-').map(Number);
  const [ph, pm] = timeStr.split(':').map(Number);
  let dayOffset = 0;
  if (!forceSameDay) {
    const [sh, sm] = (shift?.start_time || '00:00').split(':').map(Number);
    if (ph < sh || (ph === sh && pm < sm)) dayOffset = 1;
  }
  return qatarDateFromParts(y, m - 1, d + dayOffset, ph, pm);
};

// Returns { earliest: Date|null, latest: Date|null } for a punch key on a date.
// earliest/latest are the inclusive bounds within which the punch is accepted.
export const resolvePunchWindow = (punchKey, shift, attendanceDate) => {
  if (!isSplitEffective(shift, attendanceDate)) return { earliest: null, latest: null };
  const eb = (min) => (min || 0) * 60000;
  if (punchKey === 'FIRST_IN') {
    // FIRST IN always belongs on the shift's attendance date (the shift-start
    // day). forceSameDay prevents the cross-midnight next-day jump from pushing
    // the window to tomorrow when split_first_in_start < shift.start_time.
    const start = resolvePunchDateTime(shift.split_first_in_start, shift, attendanceDate, true);
    const cutoff = resolvePunchDateTime(shift.split_first_in_cutoff, shift, attendanceDate, true);
    if (!start || !cutoff) return { earliest: null, latest: null };
    return { earliest: new Date(start.getTime() - eb(shift.split_first_in_enable_before_min)), latest: cutoff };
  }
  if (punchKey === 'FIRST_OUT') {
    const target = resolvePunchDateTime(shift.split_first_out_target, shift, attendanceDate);
    if (!target) return { earliest: null, latest: null };
    return {
      earliest: new Date(target.getTime() - eb(shift.split_first_out_enable_before_min)),
      latest: new Date(target.getTime() + (shift.split_first_out_window_min || 0) * 60000),
    };
  }
  if (punchKey === 'SECOND_IN') {
    const target = resolvePunchDateTime(shift.split_second_in_target, shift, attendanceDate);
    if (!target) return { earliest: null, latest: null };
    return {
      earliest: new Date(target.getTime() - eb(shift.split_second_in_enable_before_min)),
      latest: new Date(target.getTime() + (shift.split_second_in_window_min || 0) * 60000),
    };
  }
  if (punchKey === 'FINAL_OUT') {
    const earliestT = resolvePunchDateTime(shift.split_final_out_earliest, shift, attendanceDate);
    const latestT = resolvePunchDateTime(shift.split_final_out_latest, shift, attendanceDate);
    if (!earliestT || !latestT) return { earliest: null, latest: null };
    return {
      earliest: new Date(earliestT.getTime() - eb(shift.split_final_out_enable_before_min)),
      latest: latestT,
    };
  }
  return { earliest: null, latest: null };
};

// Whether a punch is required. FIRST_IN and FINAL_OUT are always required;
// FIRST_OUT and SECOND_IN follow their configured toggles.
export const isPunchRequired = (punchKey, shift) => {
  if (punchKey === 'FIRST_IN' || punchKey === 'FINAL_OUT') return true;
  if (punchKey === 'FIRST_OUT') return shift?.split_first_out_required !== false;
  if (punchKey === 'SECOND_IN') return shift?.split_second_in_required !== false;
  return false;
};

const getPunchValue = (record, punchKey) => {
  if (!record) return '';
  if (punchKey === 'FIRST_IN') return getFirstIn(record);
  if (punchKey === 'FIRST_OUT') return record.first_out_at || '';
  if (punchKey === 'SECOND_IN') return record.second_in_at || '';
  if (punchKey === 'FINAL_OUT') return getFinalOut(record);
  return '';
};

// Next expected punch key respecting required toggles, or null when complete.
export const determineSplitExpectedPunch = (record, shift) => {
  for (const key of PUNCH_KEYS) {
    if (!isPunchRequired(key, shift)) continue;
    if (!getPunchValue(record, key)) return key;
  }
  return null;
};

// Per-punch status for display: 'done' | 'waiting' | 'missed' | 'not_required' | 'not_configured'.
// A punch is 'waiting' until its window's latest bound has passed; only then (and
// if still missing + required) is it 'missed'. Future punches therefore show
// 'waiting' — never 'missed' — while the shift is still in progress.
export const getSplitPunchStatuses = (record, shift, now = new Date()) => {
  const result = {};
  for (const key of PUNCH_KEYS) {
    if (getPunchValue(record, key)) { result[key] = 'done'; continue; }
    if (!isPunchRequired(key, shift)) { result[key] = 'not_required'; continue; }
    const { earliest, latest } = resolvePunchWindow(key, shift, record?.attendance_date);
    if (!earliest || !latest) { result[key] = 'not_configured'; continue; }
    result[key] = now > latest ? 'missed' : 'waiting';
  }
  return result;
};

// IN/OUT direction and 1-4 sequence number for a punch key.
export const punchDirection = (punchKey) =>
  (punchKey === 'FIRST_IN' || punchKey === 'SECOND_IN') ? 'IN' : 'OUT';

export const punchSequence = (punchKey) =>
  ({ FIRST_IN: 1, FIRST_OUT: 2, SECOND_IN: 3, FINAL_OUT: 4 })[punchKey] || 0;

// Split-shift worked duration = (first_out - first_in) + (final_out - second_in).
// The split break (first_out → second_in) is not counted as worked time.
// Falls back to single-session first_in → final_out when split punches are absent.
export const calculateSplitDuration = (record) => calculateDurationFromRecord(record);

// ── Central attendance state engine ───────────────────────────────────────
// One function used by every attendance view (Daily Attendance, Time Entries,
// Employee Summary, Manual Entry, COMO Camp, reports, exports) so an employee
// cannot show different statuses on different pages.
//
// For split shifts it returns the live progression:
//   Not Checked In → First In Completed → First Out Completed →
//   Second In Completed → Present, with Incomplete only after a required
//   punch's window has fully passed (never "Missed" while the window is open),
//   and Absent when no FIRST IN occurs by the shift close.
// For normal shifts it falls back to the existing calculateDailyStatus logic.
//
// manual_status_override (stored on the record) takes precedence as the
// effective status without destroying the system-calculated value.
export const MANUAL_STATUS_OPTIONS = [
  'Not Checked In', 'First In Completed', 'First Out Completed', 'Second In Completed',
  'Present', 'Incomplete', 'Absent', 'On Leave', 'Manual Override',
];

const PROGRESSION_LABEL = {
  FIRST_IN: 'First In Completed',
  FIRST_OUT: 'First Out Completed',
  SECOND_IN: 'Second In Completed',
};

export const calculateAttendanceState = (record, shift, settings, holidays = [], now = new Date()) => {
  const dateStr = record?.attendance_date;
  const firstIn = getFirstIn(record);
  const finalOut = getFinalOut(record);
  const manualOverride = record?.manual_status_override || '';

  // ── Split-shift path ──
  if (shift && isSplitEffective(shift, dateStr)) {
    const statuses = getSplitPunchStatuses(record, shift, now);
    const requiredKeys = PUNCH_KEYS.filter((k) => isPunchRequired(k, shift));
    const completed = requiredKeys.filter((k) => statuses[k] === 'done');
    const missing = requiredKeys.filter((k) => statuses[k] === 'missed');

    let calculatedStatus;
    if (!firstIn) {
      if (isHoliday(dateStr, holidays)) calculatedStatus = 'Holiday';
      else if (!isWorkingDay(dateStr, settings)) calculatedStatus = 'Rest Day';
      else if (hasShiftExpired(shift, dateStr, settings?.auto_close_buffer_minutes ?? 120)) calculatedStatus = 'Absent';
      else calculatedStatus = 'Not Checked In';
    } else if (missing.length > 0) {
      calculatedStatus = 'Incomplete';
    } else {
      let lastDoneIdx = -1;
      for (let i = 0; i < requiredKeys.length; i++) {
        if (statuses[requiredKeys[i]] === 'done') lastDoneIdx = i;
        else break;
      }
      if (lastDoneIdx === requiredKeys.length - 1) calculatedStatus = 'Present';
      else if (lastDoneIdx < 0) calculatedStatus = 'Not Checked In';
      else calculatedStatus = PROGRESSION_LABEL[requiredKeys[lastDoneIdx]] || 'Not Checked In';
    }

    const { isLate, lateMinutes } = calculateLate(record, shift);
    const workedDuration = calculateDurationFromRecord(record);
    const firstOut = record?.first_out_at || '';
    const secondIn = record?.second_in_at || '';
    const splitBreakDuration = firstOut && secondIn ? _calcDuration(firstOut, secondIn) : 0;
    const isComplete = completed.length === requiredKeys.length && missing.length === 0;

    return {
      isSplit: true,
      calculatedStatus,
      effectiveStatus: manualOverride || calculatedStatus,
      completedPunches: completed,
      missingPunches: missing,
      expectedPunch: determineSplitExpectedPunch(record, shift),
      workedDuration, splitBreakDuration, isLate, lateMinutes, isComplete,
    };
  }

  // ── Normal-shift path (existing logic, unchanged) ──
  const calculatedStatus = calculateDailyStatus(record, shift, settings, holidays);
  const { isLate, lateMinutes } = calculateLate(record, shift);
  return {
    isSplit: false,
    calculatedStatus,
    effectiveStatus: manualOverride || calculatedStatus,
    completedPunches: [],
    missingPunches: [],
    expectedPunch: getNextExpectedPunch(record),
    workedDuration: calculateDurationFromRecord(record),
    splitBreakDuration: 0,
    isLate, lateMinutes,
    isComplete: !!finalOut,
  };
};