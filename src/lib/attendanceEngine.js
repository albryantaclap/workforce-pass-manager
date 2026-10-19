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
export const hasShiftExpired = (shift, attendanceDate, bufferMinutes = 0, now = new Date()) => {
  const bounds = resolveShiftBounds(shift, attendanceDate);
  if (!bounds) return false;
  return now >= new Date(bounds.end.getTime() + (bufferMinutes || 0) * 60000);
};

// ── Punch sequence helpers ──
// Backward-compat helpers: old records have check_in_at/check_out_at but not
// the new first_in_at/final_out_at fields. These fallbacks ensure old records
// are handled correctly by the new multi-punch logic.
export const getFirstIn = (record) => record?.first_in_at || record?.check_in_at || '';
// FINAL OUT is read from its OWN field. check_out_at (a backward-compat mirror) is
// consulted ONLY for a genuine single-session record — one with no first out and no
// second in — where it is the day's one and only OUT. As soon as a break punch
// exists, a check_out_at that merely mirrors another punch is never reported as a
// FINAL OUT: one punch is never derived from a different punch.
export const getFinalOut = (record) => {
  if (!record) return '';
  if (record.final_out_at) return record.final_out_at;
  if (record.first_out_at || record.second_in_at) return '';
  return record.check_out_at || '';
};

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

// ── Daily status calculation ──────────────────────────────────────────────
// THE single source of truth for the attendance status shown in Time Entries,
// Attendance Reports, Employee Summary and every export/PDF. The backend
// functions run the identical logic from base44/shared/attendanceCalc.ts.
//
// Order matters:
//  1. No punch for the attendance date → the schedule decides
//     (Holiday / Rest Day / Absent), so Rest Day only ever appears when the
//     employee did NOT punch. A punch can never be overridden by the schedule.
//  2. Punches exist → the status follows the actual punch progression
//     FIRST IN → FIRST OUT → SECOND IN → FINAL OUT.
//  3. Once the whole shift/punch window has finished the status is finalized
//     from the completed IN/OUT pairs and the actual worked duration, so an
//     incomplete day is never left sitting on a progression label.
export const calculateDailyStatus = (record, shift, settings, holidays = [], now = new Date()) => {
  const dateStr = record?.attendance_date;
  const firstIn = getFirstIn(record);
  const firstOut = record?.first_out_at || '';
  const secondIn = record?.second_in_at || '';
  const finalOut = getFinalOut(record);
  const isSplit = !!(shift && isSplitEffective(shift, dateStr));
  // The strict sequence applies to punch-sequence records only; COMO Camp and
  // Personnel Form sessions keep exactly their previous behaviour.
  const splitSequence = isSplit && !isSingleSessionSource(record);
  const finished = shift ? hasShiftExpired(shift, dateStr, settings?.auto_close_buffer_minutes ?? 120, now) : true;
  const halfDayMin = (settings?.half_day_threshold_hours ?? 4) * 60;
  const duration = calculateDurationFromRecord(record);

  // 1. No punch at all → the schedule decides.
  if (!firstIn) {
    if (isHoliday(dateStr, holidays)) return 'Holiday';
    if (!isWorkingDay(dateStr, settings)) return 'Rest Day';
    if (isSplit && !finished) return 'Not Checked In';
    return 'Absent';
  }

  // 2. Shift still running → report the latest punch reached.
  if (!finished && !finalOut) {
    if (secondIn) return 'Second In Completed';
    if (firstOut) return 'First Out Completed';
    return 'First In Completed';
  }

  // 3. Shift finished → finalize from the completed punches and worked duration.
  //    Only completed IN/OUT pairs count — an open IN is never extrapolated.
  //    For a split shift the day only counts as complete when every REQUIRED stage
  //    is present, so a FINAL OUT that jumped a missing FIRST OUT / SECOND IN can
  //    never be reported as Present or Half Day — it stays Incomplete.
  const sequenceComplete = splitSequence
    ? !!finalOut
      && (!isPunchRequired('FIRST_OUT', shift) || !!firstOut)
      && (!isPunchRequired('SECOND_IN', shift) || !!secondIn)
    : (!!finalOut && (!firstOut || !!secondIn));
  if (sequenceComplete) {
    if (isSplit) return 'Present';
    if (calculateLate(record, shift).isLate) return 'Late';
    return duration > 0 && duration < halfDayMin ? 'Half Day' : 'Present';
  }
  if (!splitSequence && duration >= halfDayMin) return 'Half Day';
  return isSplit ? 'Incomplete' : 'Missing Check-out';
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
    // The split sequence starts at split_first_in_start; any punch whose wall-clock
    // time is earlier than that belongs to the next calendar day (cross-midnight).
    // Keying off split_first_in_start (not shift.start_time) keeps the split
    // windows fully self-contained — they never depend on normal-shift times.
    const ref = shift?.split_first_in_start || shift?.start_time || '00:00';
    const [sh, sm] = ref.split(':').map(Number);
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

// ── Punch-sequence validation (authoritative for EVERY save path) ──────────
// THE rule: FIRST IN → FIRST OUT → SECOND IN → FINAL OUT.
//
//  • A punch may never jump over an earlier required punch.
//  • The four timestamps must be chronologically ordered when compared as FULL
//    datetimes — never by clock time alone — so a cross-midnight SECOND IN
//    (00:55 on the next calendar day) is correctly ordered after a FIRST OUT at
//    22:50 the previous evening, and the attendance date stays the shift-start date.
//
// Returns { blocked, warnings }:
//   blocked  → the save must be rejected; the message names the expected punch
//   warnings → unusual but allowed; the Admin is warned before saving
export const PUNCH_LABELS = {
  FIRST_IN: 'FIRST IN', FIRST_OUT: 'FIRST OUT', SECOND_IN: 'SECOND IN', FINAL_OUT: 'FINAL OUT',
};

// COMO Camp and Personnel Form sessions are single IN→OUT sessions by design —
// they carry no break punches — so they are never judged by the split-shift
// sequence. Only punch-sequence records (scanner, clock, manual entry) are.
export const SINGLE_SESSION_SOURCES = ['COMO Camp', 'Personnel Form'];

export const isSingleSessionSource = (record) =>
  SINGLE_SESSION_SOURCES.includes(record?.source_page || '') || record?.source === 'COMO Camp';

export const punchStamp = (iso) => {
  if (!iso) return '—';
  try { return `${formatDateShort(String(iso).slice(0, 10))} ${formatTimeShort(iso)}`; } catch { return String(iso); }
};

export const validatePunchSequence = (record, shift, settings, { enforceWindows = false } = {}) => {
  const blocked = [];
  const warnings = [];
  const dateStr = record?.attendance_date || '';
  // "strictSplit" = the split-shift sequence applies to this record. Single-session
  // sources (COMO Camp / Personnel Form) keep their own 2-punch semantics.
  const strictSplit = !!(shift && isSplitEffective(shift, dateStr)) && !isSingleSessionSource(record);
  const values = {
    FIRST_IN: record?.first_in_at || record?.check_in_at || '',
    FIRST_OUT: record?.first_out_at || '',
    SECOND_IN: record?.second_in_at || '',
    // Read through getFinalOut: a FINAL OUT that exists only as a mirror of
    // another punch is not a punch, so it can never raise a sequence error.
    FINAL_OUT: getFinalOut(record),
  };
  const provided = PUNCH_KEYS.filter((k) => values[k]);

  // 1. No punch can exist without a FIRST IN.
  if (!values.FIRST_IN && provided.length) {
    blocked.push('FIRST IN is required when any other punch is provided.');
  }

  // 2. Chronological order — compare complete datetimes, never clock times.
  for (let i = 1; i < provided.length; i++) {
    const prev = provided[i - 1];
    const cur = provided[i];
    if (new Date(values[cur]).getTime() < new Date(values[prev]).getTime()) {
      blocked.push(
        `${PUNCH_LABELS[cur]} (${punchStamp(values[cur])}) cannot be earlier than ${PUNCH_LABELS[prev]} (${punchStamp(values[prev])}). Compare the full date and time — a cross-midnight punch only moves the calendar date forward.`
      );
    }
  }

  // 3. A later punch must never skip an earlier required punch. For a split shift
  //    the required stages come from the shift's own Split-Shift Punch Rules
  //    (FIRST IN and FINAL OUT are always required).
  PUNCH_KEYS.forEach((key, idx) => {
    if (!values[key]) return;
    const missing = PUNCH_KEYS.slice(0, idx).find((earlier) => {
      if (values[earlier]) return false;
      return strictSplit ? isPunchRequired(earlier, shift) : earlier === 'FIRST_IN';
    });
    if (missing) {
      blocked.push(
        `Expected punch: ${PUNCH_LABELS[missing]} has not been completed for this attendance record. Do not record ${PUNCH_LABELS[key]} before it.`
      );
    }
  });

  // 4. Window check — each punch must fall inside its own configured window, built
  //    from the shift-start date (cross-midnight aware). Reported as a warning
  //    only: an Admin repairing a record may legitimately be outside the window.
  if (enforceWindows && strictSplit) {
    for (const key of PUNCH_KEYS) {
      if (!values[key]) continue;
      const { earliest, latest } = resolvePunchWindow(key, shift, dateStr);
      if (!earliest || !latest) continue;
      const t = new Date(values[key]).getTime();
      if (t < earliest.getTime() || t > latest.getTime()) {
        warnings.push(
          `${PUNCH_LABELS[key]} at ${punchStamp(values[key])} is outside its configured shift window (${punchStamp(earliest.toISOString())} – ${punchStamp(latest.toISOString())}).`
        );
      }
    }
  }

  return { blocked, warnings };
};

// Detects records whose STORED punches break the sequence for the shift that
// applies (e.g. a FINAL OUT with FIRST OUT / SECOND IN missing on a split shift).
// Nothing is ever rewritten — the record is only flagged so an Admin can repair
// it through Edit Attendance, and no timestamp is ever fabricated.
export const getRecordSequenceIssue = (record, shift) => {
  if (!record || isSingleSessionSource(record)) return null;
  const { blocked } = validatePunchSequence(record, shift, null);
  return blocked.length ? blocked[0] : null;
};

// ── Central attendance state engine ───────────────────────────────────────
// One function used by every attendance view (Daily Attendance, Time Entries,
// Attendance Reports, Employee Summary, Manual Entry, COMO Camp, exports and
// PDFs) so an employee can never show different statuses on different pages.
// The status itself comes from calculateDailyStatus above — the punch
// progression is authoritative and a Rest Day or Holiday never overrides a
// punch. The split-shift punch detail below is presentation only.
//
// manual_status_override (stored on the record) always takes precedence as the
// effective status without destroying the system-calculated value.
export const MANUAL_STATUS_OPTIONS = [
  'Not Checked In', 'First In Completed', 'First Out Completed', 'Second In Completed',
  'Present', 'Incomplete', 'Absent', 'On Leave', 'Manual Override',
];

export const calculateAttendanceState = (record, shift, settings, holidays = [], now = new Date()) => {
  const dateStr = record?.attendance_date;
  const calculatedStatus = calculateDailyStatus(record, shift, settings, holidays, now);
  const manualOverride = record?.manual_status_override || '';
  const isSplit = !!(shift && isSplitEffective(shift, dateStr));

  let completedPunches = [];
  let missingPunches = [];
  let expectedPunch = null;
  let isComplete = false;
  if (isSplit) {
    const statuses = getSplitPunchStatuses(record, shift, now);
    const requiredKeys = PUNCH_KEYS.filter((k) => isPunchRequired(k, shift));
    completedPunches = requiredKeys.filter((k) => statuses[k] === 'done');
    missingPunches = requiredKeys.filter((k) => statuses[k] === 'missed');
    isComplete = requiredKeys.every((k) => statuses[k] === 'done');
    expectedPunch = determineSplitExpectedPunch(record, shift);
  } else {
    expectedPunch = getNextExpectedPunch(record);
    isComplete = !!getFinalOut(record);
  }

  const { isLate, lateMinutes } = calculateLate(record, shift);
  const firstOut = record?.first_out_at || '';
  const secondIn = record?.second_in_at || '';

  return {
    isSplit,
    calculatedStatus,
    effectiveStatus: manualOverride || calculatedStatus,
    completedPunches, missingPunches, expectedPunch, isComplete,
    workedDuration: calculateDurationFromRecord(record),
    splitBreakDuration: firstOut && secondIn ? _calcDuration(firstOut, secondIn) : 0,
    isLate, lateMinutes,
  };
};

// ── Branch / Location filter helpers ─────────────────────────────────────────
// The branch list comes from Attendance Settings → Branch / Work Locations and is
// matched against the site location recorded on the attendance record (the branch
// the supervisor selected at the scanner), never the employee current_location.
export const sameSiteLocation = (value, branch) => {
  if (!branch) return true;
  return String(value || '').trim().toLowerCase() === String(branch).trim().toLowerCase();
};

// Personnel ids with attendance recorded at the branch inside a period.
export const personnelAtBranch = (records, branch, from, to) => {
  const ids = new Set();
  if (!branch) return ids;
  for (const r of records || []) {
    if (!r || r.is_deleted) continue;
    if (from && r.attendance_date < from) continue;
    if (to && r.attendance_date > to) continue;
    if (sameSiteLocation(r.site_location, branch)) ids.add(r.personnel_id);
  }
  return ids;
};