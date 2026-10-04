// Centralized Attendance Service — API-calling functions that use the
// attendance engine. This is the single shared service used by Daily Attendance,
// COMO Camp, Master List, and Personnel Form.
//
// All functions preserve existing data. No destructive operations.
// Raw punches are always recorded in AttendancePunch. Sessions are maintained
// in AttendanceRecord with backward-compatible check_in_at/check_out_at fields.

import { base44 } from '@/api/base44Client';
import {
  calculateDurationFromRecord, calculateOvertime, calculateLate,
  calculateDailyStatus, hasShiftExpired, resolveShift, resolveShiftBounds,
  getNextExpectedPunch, getMissingPunchLabel, isWorkingDay, isHoliday,
  isSplitEffective, isSplitShiftEnabled, determineSplitExpectedPunch, resolvePunchWindow,
  punchDirection, punchSequence, calculateAttendanceState,
} from './attendanceEngine';

// ── Settings ──
export async function getSettings() {
  const rows = await base44.entities.AttendanceSetting.filter({ setting_key: 'global' }, undefined, 10);
  if (rows.length > 0) return rows[0];
  // Create default settings if none exist
  return await base44.entities.AttendanceSetting.create({
    setting_key: 'global',
    working_days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu'],
    default_shift_start: '07:00',
    default_shift_end: '17:00',
    break_minutes: 60,
    late_grace_minutes: 10,
    half_day_threshold_hours: 4,
    overtime_start_hours: 8,
    max_working_hours: 12,
    auto_close_open_sessions: true,
    auto_close_buffer_minutes: 120,
    first_punch_window_minutes: 180,
  });
}

// ── Shifts & assignments ──
export async function getShifts() {
  return await base44.entities.AttendanceShift.list('-created_date', 1000);
}

export async function getShiftAssignments() {
  return await base44.entities.AttendanceShiftAssignment.list('-created_date', 5000);
}

export async function getHolidays() {
  return await base44.entities.AttendanceHoliday.filter({ is_active: true }, undefined, 1000);
}

// ── Activity logging ──
async function logActivity(action, entityId, recordName, snapshot, changedFields, userEmail) {
  try {
    await base44.entities.ActivityLog.create({
      action,
      entity_name: 'AttendanceRecord',
      entity_id: entityId,
      performed_by: userEmail || '',
      record_name: recordName,
      record_snapshot: snapshot,
      changed_fields: changedFields,
    });
  } catch { /* non-fatal */ }
}

// ── Auto-close expired incomplete sessions (Day Reset Logic) ──
// This is the core fix: when a shift has ended + buffer has passed, any open
// session for that date is closed as "Missing Check-out". All existing punches
// are preserved — no timestamps are fabricated. The employee is then free to
// start a new session on the next working day.
//
// This function is called:
//   1. Lazily — before any punch operation (clockIn/clockOut/recordPunch)
//   2. Lazily — when fetching daily attendance (getDailyAttendance)
//   3. Via a scheduled workflow (see base44/workflows/)
export async function autoCloseExpiredSessions(personnelId, settings, shifts, assignments, holidays, currentUser) {
  if (!personnelId || !settings?.auto_close_open_sessions) return [];
  const buffer = settings.auto_close_buffer_minutes ?? 120;

  // Fetch the full employee record for correct shift resolution (by department,
  // branch, etc.). Without this, cross-midnight shifts assigned by department or
  // branch would fall back to the default shift and be incorrectly auto-closed.
  let emp = { id: personnelId };
  try { emp = (await base44.entities.Employee.get(personnelId)) || emp; } catch {}

  // Find all open sessions for this employee
  const openRecords = await base44.entities.AttendanceRecord.filter(
    { personnel_id: personnelId, status: 'open', is_deleted: { $ne: true } },
    '-attendance_date', 500
  );

  const closed = [];
  for (const rec of openRecords) {
    // Resolve the shift using the full employee record
    const shift = resolveShift(emp, assignments, shifts, settings);
    const effectiveShift = shift || {
      start_time: settings.default_shift_start,
      end_time: settings.default_shift_end,
      cross_midnight: false,
    };

    if (!hasShiftExpired(effectiveShift, rec.attendance_date, buffer)) continue;

    // The shift has expired — close the session
    const missingLabel = getMissingPunchLabel(rec);
    const updates = {
      status: 'completed',
      attendance_status: 'Missing Check-out',
      duration_minutes: calculateDurationFromRecord(rec),
    };

    // Backward-compat sync ONLY — no punch timestamp is ever fabricated here.
    // check_out_at mirrors a real FINAL OUT (never a first out), and an existing
    // check_out_at is never promoted into final_out_at: a missing FINAL OUT stays
    // missing, so auto-close can never invent one out of a first out.
    if (!rec.first_in_at && rec.check_in_at) updates.first_in_at = rec.check_in_at;
    if (!rec.check_out_at && rec.final_out_at) updates.check_out_at = rec.final_out_at;

    await base44.entities.AttendanceRecord.update(rec.id, updates);
    await logActivity('update', rec.id, rec.employee_name, {
      ...updates, auto_closed: true, missing_label: missingLabel,
      previous_status: 'open', reason: `Auto-closed: shift expired (${missingLabel})`,
    }, ['status', 'attendance_status', 'duration_minutes'], currentUser?.email);

    closed.push(rec.id);
  }
  return closed;
}

// ── Record a punch (IN or OUT) ──
// Records the raw punch in AttendancePunch and updates the AttendanceRecord session.
// Automatically closes any expired open sessions first (day reset logic).
export async function recordPunch({
  personnelId, employeeName, company, punchType, // 'IN' | 'OUT'
  timestamp, source = 'Admin Entry', location = '', workLocation = '',
  currentUser, shiftId = '', shiftName = '',
}) {
  if (!personnelId) throw new Error('Employee is required.');
  if (!timestamp) throw new Error('Punch timestamp is required.');

  // Load settings/shifts to auto-close expired sessions
  const settings = await getSettings();
  const [shifts, assignments] = await Promise.all([getShifts(), getShiftAssignments()]);
  await autoCloseExpiredSessions(personnelId, settings, shifts, assignments, [], currentUser);

  // Attendance date is always the Qatar calendar date — never the browser's
  // local date — so the punch window is built on the same day the shift runs.
  const attDate = timestamp.toLocaleDateString('en-CA', { timeZone: 'Asia/Qatar' });

  let emp = { id: personnelId, company };
  try { emp = (await base44.entities.Employee.get(personnelId)) || emp; } catch {}
  const shift = resolveShift(emp, assignments, shifts, settings);

  // ── Cross-midnight split-shift: resolve the shift-start date ──
  // For cross-midnight split-shifts, the attendance date is the shift-start
  // date, which may be the previous calendar day when the punch occurs after
  // midnight. If there is an open session from the previous date whose shift
  // has not yet expired, continue that session instead of starting a new one.
  let effectiveAttDate = attDate;
  if (shift && shift.cross_midnight && isSplitShiftEnabled(shift)) {
    // Search for any open session for this employee whose cross-midnight shift
    // hasn't expired yet. The session may have been started on a previous
    // calendar day (e.g., 23 Sep for a punch at 01:00 on 24 Sep). Continue that
    // session instead of starting a new one on the current calendar date.
    const allOpen = await base44.entities.AttendanceRecord.filter(
      { personnel_id: personnelId, status: 'open', is_deleted: { $ne: true } },
      '-attendance_date', 50
    );
    const continuing = allOpen.find(r => {
      if (r.attendance_date === attDate) return false; // today's session handled normally
      if (!isSplitEffective(shift, r.attendance_date)) return false;
      if (hasShiftExpired(shift, r.attendance_date, settings?.auto_close_buffer_minutes ?? 120)) return false;
      return true;
    });
    if (continuing) {
      effectiveAttDate = continuing.attendance_date;
    } else {
      // No open session found — check for a session that was incorrectly
      // auto-closed (Missing Check-out) even though the cross-midnight shift
      // hasn't actually expired yet. Re-open it so the punch can continue.
      const recent = await base44.entities.AttendanceRecord.filter(
        { personnel_id: personnelId, status: 'completed', is_deleted: { $ne: true } },
        '-attendance_date', 50
      );
      const wronglyClosed = recent.find(r => {
        if (r.attendance_date === attDate) return false;
        if (!isSplitEffective(shift, r.attendance_date)) return false;
        if (hasShiftExpired(shift, r.attendance_date, settings?.auto_close_buffer_minutes ?? 120)) return false;
        // A record an Admin has explicitly overridden is left alone.
        if (r.manual_status_override) return false;
        // Continue the SAME attendance date whenever the required split sequence is
        // still incomplete — whether the day was closed early (Missing Check-out) or
        // a later punch was recorded before a required earlier one (an inconsistent
        // record the Admin repairs in Edit Attendance). No timestamp is ever touched:
        // the session is only re-opened so the next punch continues that shift date
        // (cross-midnight stays ONE record).
        const firstIn = r.first_in_at || r.check_in_at;
        if (!firstIn) return false;
        return determineSplitExpectedPunch(r, shift) !== null;
      });
      if (wronglyClosed) {
        await base44.entities.AttendanceRecord.update(wronglyClosed.id, { status: 'open' });
        effectiveAttDate = wronglyClosed.attendance_date;
      }
    }
  }

  console.debug('[recordPunch] resolved shift', {
    personnelId,
    employee: emp?.name || employeeName,
    company: emp?.company,
    branch: emp?.current_location,
    department: emp?.department,
    shiftId: shift?.id,
    shiftName: shift?.shift_name,
    splitEnabled: shift?.split_shift_enabled,
    splitEffective: shift ? isSplitEffective(shift, effectiveAttDate) : false,
    attDate,
    effectiveAttDate,
  });

  // ── Split-shift path ──
  // When the employee's shift has split-shift rules enabled and effective for
  // the resolved attendance date, route through the split-shift punch processor.
  // Normal shifts keep their existing behavior unchanged.
  if (shift && isSplitEffective(shift, effectiveAttDate)) {
    return processSplitPunch({
      personnelId, employeeName, company, shift, attDate: effectiveAttDate, timestamp,
      source, location, workLocation, currentUser, settings,
      shiftId: shift.id, shiftName: shift.shift_name,
    });
  }

  // Find existing session for this date (non-deleted)
  const existing = await base44.entities.AttendanceRecord.filter(
    { personnel_id: personnelId, attendance_date: attDate, is_deleted: { $ne: true } },
    undefined, 100
  );
  let session = existing.find(r => r.status === 'open') || existing[0] || null;

  // Determine punch sequence (with backward-compat fallback for old records)
  const sessFirstIn = session ? (session.first_in_at || session.check_in_at) : '';
  let punchSeq = 1;
  if (session) {
    if (!sessFirstIn) punchSeq = 1;
    else if (!session.first_out_at && !session.second_in_at && !session.final_out_at) punchSeq = 2; // single-session OUT = final out
    else if (!session.first_out_at) punchSeq = 2;
    else if (!session.second_in_at) punchSeq = 3;
    else if (!session.final_out_at) punchSeq = 4;
    else throw new Error('All 4 punches already recorded for this date. Edit the record instead.');
  }

  const tsIso = timestamp.toISOString();
  const email = currentUser?.email || '';
  const name = currentUser?.full_name || '';
  // The authenticated ACCOUNT is stored per punch (never only a name) so the
  // scanner of every individual punch can be shown and audited later.
  const userId = currentUser?.id || '';

  // The raw punch is only written once the punch has been ACCEPTED, so a rejected
  // scan can never leave a stray AttendancePunch row behind.
  const writeRawPunch = () => base44.entities.AttendancePunch.create({
    personnel_id: personnelId, employee_name: employeeName, company,
    attendance_date: attDate, punch_timestamp: tsIso, punch_type: punchType,
    punch_sequence: punchSeq, source, location,
    created_by: email, created_by_user_id: userId, created_by_name: name,
  });

  if (!session) {
    // Create new session
    if (punchType !== 'IN') throw new Error('Cannot clock out — no open session for this date.');
    await writeRawPunch();
    // Calculate the initial attendance status using the centralized resolver
    // so the stored status matches the live display from the first punch.
    const tempRecord = {
      attendance_date: attDate,
      first_in_at: tsIso, check_in_at: tsIso,
      first_out_at: '', second_in_at: '', final_out_at: '', check_out_at: '',
    };
    const initState = calculateAttendanceState(tempRecord, shift, settings, [], new Date());
    session = await base44.entities.AttendanceRecord.create({
      personnel_id: personnelId, employee_name: employeeName, company,
      attendance_date: attDate,
      check_in_at: tsIso, first_in_at: tsIso,
      check_out_at: '', first_out_at: '', second_in_at: '', final_out_at: '',
      duration_minutes: 0, overtime_minutes: 0,
      work_location: workLocation || location || '',
      checked_in_by: email, checked_in_by_name: name,
      first_in_by_user_id: userId,
      status: 'open', source, source_page: source,
      // The shift that actually judged this punch is stored on the record, so the
      // rules applied stay auditable ('default' = no shift assignment resolved).
      shift_id: shift?.id && shift.id !== 'default' ? shift.id : (shiftId || ''),
      shift_name: shift?.shift_name || shiftName || '',
      attendance_status: initState.calculatedStatus,
      calculated_status: initState.calculatedStatus,
      is_late: initState.isLate, late_minutes: initState.lateMinutes,
    });
    await logActivity('create', session.id, employeeName,
      { attendance_date: attDate, first_in_at: tsIso, source, punch_sequence: 1, attendance_status: initState.calculatedStatus },
      ['first_in_at'], email);
    return { action: 'created', record: session, punchSequence: 1 };
  }

  // Update existing session
  const updates = {};
  if (punchType === 'IN') {
    if (!sessFirstIn) {
      updates.first_in_at = tsIso;
      updates.check_in_at = tsIso;
      updates.checked_in_by = email;
      updates.checked_in_by_name = name;
      updates.first_in_by_user_id = userId;
    } else if (!session.second_in_at && session.first_out_at) {
      // Second IN (return from break) — only valid after first_out
      updates.second_in_at = tsIso;
      updates.second_in_by_user_id = userId;
    } else if (!session.second_in_at && !session.first_out_at) {
      throw new Error('Cannot punch in — session is already open. Punch OUT to check out.');
    } else {
      throw new Error('No more IN punches expected for this session.');
    }
  } else { // OUT
    // Single-session mode: if no break punches exist, first OUT = final OUT (session complete)
    if (!session.first_out_at && !session.second_in_at && !session.final_out_at) {
      updates.final_out_at = tsIso;
      updates.check_out_at = tsIso;
      updates.checked_out_by = email;
      updates.checked_out_by_name = name;
      updates.final_out_by_user_id = userId;
      updates.status = 'completed';
    } else if (!session.first_out_at) {
      // Break start (lunch out)
      updates.first_out_at = tsIso;
      updates.first_out_by_user_id = userId;
    } else if (!session.final_out_at) {
      // Final out after break
      updates.final_out_at = tsIso;
      updates.check_out_at = tsIso;
      updates.checked_out_by = email;
      updates.checked_out_by_name = name;
      updates.final_out_by_user_id = userId;
      updates.status = 'completed';
    } else {
      throw new Error('All punches already recorded for this date.');
    }
  }

  // The punch has been accepted — record it now (never before this point).
  await writeRawPunch();

  // Keep the shift that judged this punch auditable on older records.
  if (!session.shift_id && shift) {
    updates.shift_id = shift.id && shift.id !== 'default' ? shift.id : '';
    updates.shift_name = shift.shift_name || '';
  }

  // Recalculate duration
  const merged = { ...session, ...updates };
  updates.duration_minutes = calculateDurationFromRecord(merged);
  if (updates.status === 'completed') {
    updates.overtime_minutes = calculateOvertime(updates.duration_minutes, settings);
  }

  // Recalculate the centralized attendance state so the stored status stays in
  // sync with the punch progression (same as the split-shift path). A manual
  // status override is preserved.
  const state = calculateAttendanceState(merged, shift, settings, [], new Date());
  updates.calculated_status = state.calculatedStatus;
  if (!merged.manual_status_override) {
    updates.attendance_status = state.calculatedStatus;
    updates.is_late = state.isLate;
    updates.late_minutes = state.lateMinutes;
  }

  await base44.entities.AttendanceRecord.update(session.id, updates);
  await logActivity('update', session.id, employeeName,
    { ...updates, punch_type: punchType, punch_sequence: punchSeq },
    Object.keys(updates).filter(k => k !== 'duration_minutes' && k !== 'overtime_minutes' && k !== 'calculated_status' && k !== 'attendance_status' && k !== 'is_late' && k !== 'late_minutes'), email);

  return { action: 'updated', record: { ...session, ...updates }, punchSequence: punchSeq };
}

// ── Split-shift punch processor ──
// Used by recordPunch when the employee's shift has split-shift rules enabled
// and effective for the attendance date. Enforces the 4-punch sequence
// (FIRST IN → FIRST OUT → SECOND IN → FINAL OUT), punch-order protection,
// per-punch window validation, and cross-midnight handling — all under the
// shift's attendance_date. Normal-shift behavior is untouched.
async function processSplitPunch({
  personnelId, employeeName, company, shift, attDate, timestamp,
  source, location, workLocation, currentUser, settings, shiftId, shiftName,
}) {
  if (!personnelId) throw new Error('Employee is required.');
  if (!timestamp) throw new Error('Punch timestamp is required.');
  const email = currentUser?.email || '';
  const name = currentUser?.full_name || '';
  // The account responsible for THIS punch (each split-shift punch may be
  // performed by a different supervisor).
  const userId = currentUser?.id || '';
  const tsIso = timestamp.toISOString();

  const existing = await base44.entities.AttendanceRecord.filter(
    { personnel_id: personnelId, attendance_date: attDate, is_deleted: { $ne: true } },
    undefined, 100
  );
  let session = existing.find((r) => r.status === 'open') || existing[0] || null;

  const expectedKey = determineSplitExpectedPunch(session, shift);
  if (!expectedKey) {
    throw new Error('All required split-shift punches already recorded for this date.');
  }

  // Punch-window validation (only when the shift configures a window for this punch).
  // The window and the reject/accept decision are computed once, here, from the
  // same resolvePunchWindow used for display — never calculated separately.
  const { earliest, latest } = resolvePunchWindow(expectedKey, shift, attDate);
  const _fmt = (d) => (d ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Qatar' }) : '—');
  const _date = (d) => (d ? d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'Asia/Qatar' }) : '—');
  const decision = !earliest || !latest
    ? 'ACCEPT (no window configured)'
    : timestamp < earliest
      ? 'REJECT (not yet open)'
      : timestamp > latest
        ? 'REJECT (window closed)'
        : 'ACCEPT';
  // Diagnostic — one log per punch showing the resolved shift, the configured
  // split values, the calculated window, the current time, and the decision.
  console.debug('[processSplitPunch]', {
    employee: `${employeeName} (${personnelId})`,
    shiftId: shift?.id,
    shiftName: shift?.shift_name,
    attendanceDate: attDate,
    splitEnabled: shift?.split_shift_enabled,
    expectedPunch: expectedKey,
    previousPunches: {
      first_in_at: session?.first_in_at || session?.check_in_at || '',
      first_out_at: session?.first_out_at || '',
      second_in_at: session?.second_in_at || '',
      final_out_at: session?.final_out_at || session?.check_out_at || '',
    },
    configured: {
      first_in: { start: shift?.split_first_in_start, enableBefore: shift?.split_first_in_enable_before_min, cutoff: shift?.split_first_in_cutoff },
      first_out: { target: shift?.split_first_out_target, enableBefore: shift?.split_first_out_enable_before_min, window: shift?.split_first_out_window_min },
      second_in: { target: shift?.split_second_in_target, enableBefore: shift?.split_second_in_enable_before_min, window: shift?.split_second_in_window_min },
      final_out: { earliest: shift?.split_final_out_earliest, enableBefore: shift?.split_final_out_enable_before_min, latest: shift?.split_final_out_latest },
    },
    calculatedWindow: { open: _fmt(earliest), close: _fmt(latest), date: _date(earliest) },
    currentTime: _fmt(timestamp),
    decision,
  });
  if (earliest && latest) {
    const label = expectedKey.replace(/_/g, ' ');
    if (timestamp < earliest) {
      throw new Error(
        `${label} punch window is not yet open. Allowed time: ${_fmt(earliest)} – ${_fmt(latest)} on ${_date(earliest)}. Current time: ${_fmt(timestamp)}.`
      );
    }
    if (timestamp > latest) {
      throw new Error(
        `${label} punch window has expired. Allowed time: ${_fmt(earliest)} – ${_fmt(latest)} on ${_date(earliest)}. Current time: ${_fmt(timestamp)}.`
      );
    }
  }

  const pType = punchDirection(expectedKey);
  const pSeq = punchSequence(expectedKey);

  // Record the raw punch
  await base44.entities.AttendancePunch.create({
    personnel_id: personnelId, employee_name: employeeName, company,
    attendance_date: attDate, punch_timestamp: tsIso, punch_type: pType,
    punch_sequence: pSeq, source, location,
    created_by: email, created_by_user_id: userId, created_by_name: name,
  });

  // No session yet → first punch must be FIRST IN
  if (!session) {
    if (expectedKey !== 'FIRST_IN') {
      throw new Error('Cannot start a split shift without a First Punch In.');
    }
    session = await base44.entities.AttendanceRecord.create({
      personnel_id: personnelId, employee_name: employeeName, company,
      attendance_date: attDate,
      check_in_at: tsIso, first_in_at: tsIso,
      check_out_at: '', first_out_at: '', second_in_at: '', final_out_at: '',
      duration_minutes: 0, overtime_minutes: 0,
      work_location: workLocation || location || '',
      checked_in_by: email, checked_in_by_name: name,
      first_in_by_user_id: userId,
      status: 'open', source, source_page: source,
      shift_id: shiftId, shift_name: shiftName,
    });
    const initState = calculateAttendanceState(session, shift, settings, [], new Date());
    await base44.entities.AttendanceRecord.update(session.id, {
      attendance_status: initState.calculatedStatus,
      calculated_status: initState.calculatedStatus,
      is_late: initState.isLate, late_minutes: initState.lateMinutes,
    });
    await logActivity('create', session.id, employeeName,
      { attendance_date: attDate, first_in_at: tsIso, source, split_shift: true, punch_sequence: pSeq, attendance_status: initState.calculatedStatus },
      ['first_in_at'], email);
    return { action: 'created', record: { ...session, attendance_status: initState.calculatedStatus, calculated_status: initState.calculatedStatus }, punchSequence: pSeq, punchKey: expectedKey };
  }

  // Update existing session with the expected punch (order is enforced because
  // the expected punch is derived from the recorded state — duplicates and
  // out-of-sequence attempts are rejected).
  const updates = {};
  if (expectedKey === 'FIRST_IN') {
    updates.first_in_at = tsIso; updates.check_in_at = tsIso;
    updates.checked_in_by = email; updates.checked_in_by_name = name;
    updates.first_in_by_user_id = userId;
  } else if (expectedKey === 'FIRST_OUT') {
    updates.first_out_at = tsIso;
    updates.first_out_by_user_id = userId;
  } else if (expectedKey === 'SECOND_IN') {
    updates.second_in_at = tsIso;
    updates.second_in_by_user_id = userId;
  } else if (expectedKey === 'FINAL_OUT') {
    updates.final_out_at = tsIso; updates.check_out_at = tsIso;
    updates.checked_out_by = email; updates.checked_out_by_name = name;
    updates.final_out_by_user_id = userId;
    updates.status = 'completed';
  }

  const merged = { ...session, ...updates };
  updates.duration_minutes = calculateDurationFromRecord(merged);
  if (updates.status === 'completed') {
    updates.overtime_minutes = calculateOvertime(updates.duration_minutes, settings);
  }

  // Recalculate the centralized attendance state so the stored status stays in
  // sync with the punch progression. A manual status override is preserved.
  const state = calculateAttendanceState(merged, shift, settings, [], new Date());
  updates.calculated_status = state.calculatedStatus;
  if (!merged.manual_status_override) {
    updates.attendance_status = state.calculatedStatus;
    updates.is_late = state.isLate;
    updates.late_minutes = state.lateMinutes;
  }

  await base44.entities.AttendanceRecord.update(session.id, updates);
  await logActivity('update', session.id, employeeName,
    { ...updates, punch_key: expectedKey, punch_type: pType, punch_sequence: pSeq, split_shift: true },
    Object.keys(updates).filter((k) => k !== 'duration_minutes' && k !== 'overtime_minutes' && k !== 'calculated_status' && k !== 'attendance_status' && k !== 'is_late' && k !== 'late_minutes'), email);

  return { action: 'updated', record: { ...session, ...updates }, punchSequence: pSeq, punchKey: expectedKey };
}

// Convenience wrappers
export async function clockIn(opts) {
  return recordPunch({ ...opts, punchType: 'IN' });
}
export async function clockOut(opts) {
  return recordPunch({ ...opts, punchType: 'OUT' });
}

// ── Manual entry — create or update a day's attendance punches ──
// Editing an existing record is a PATCH: `changedPunchKeys` lists ONLY the punches
// the Admin actually changed, and every punch not listed keeps the value stored on
// the record. Punch timestamps are never inferred, copied or auto-completed.
export async function saveManualEntry({
  personnelId, employeeName, company, attendanceDate,
  attendanceRecordId = '',
  firstInAt, firstOutAt, secondInAt, finalOutAt,
  changedPunchKeys = null,
  reason, remarks, workLocation, currentUser,
  shiftId = '', shiftName = '', shift = null,
  manualStatusOverride = '', manualStatusReason = '',
}) {
  if (!personnelId) throw new Error('Employee is required.');
  if (!attendanceDate) throw new Error('Attendance date is required.');
  // The reason is enforced by the backend: required when creating a new record,
  // optional when editing the punches of an existing one.

  // Delegate to the backend function which checks attendance.entries.edit
  // permission before performing the operation (server-side authorization).
  // Accepts a Date or an ISO string (the dialog sends the punches it changed).
  const toIso = (v) => !v ? '' : (typeof v === 'string' ? v : v.toISOString());
  try {
    const res = await base44.functions.invoke('attendanceManualEntry', {
      personnelId, employeeName, company, attendanceDate,
      attendanceRecordId,
      firstInIso: toIso(firstInAt),
      firstOutIso: toIso(firstOutAt),
      secondInIso: toIso(secondInAt),
      finalOutIso: toIso(finalOutAt),
      // Only these punches are applied; every other punch keeps its stored value.
      changedPunchKeys,
      reason: (reason || '').trim(),
      remarks: remarks || '',
      workLocation: workLocation || '',
      shiftId, shiftName,
      manualStatusOverride: manualStatusOverride || '',
      manualStatusReason: (manualStatusReason || reason || '').trim(),
    });
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.error || error?.message || 'Manual entry failed';
    throw new Error(msg);
  }
}

// ── Soft delete ──
export async function softDeleteAttendance(recordId, reason, currentUser) {
  if (!reason?.trim()) throw new Error('A deletion reason is required.');
  // Delegate to the backend function which checks attendance.entries.delete
  // permission before performing the operation (server-side authorization).
  try {
    const res = await base44.functions.invoke('attendanceDelete', {
      recordId, reason: reason.trim(),
    });
    return res.data;
  } catch (error) {
    const msg = error?.response?.data?.error || error?.message || 'Delete failed';
    throw new Error(msg);
  }
}

// ── Restore soft-deleted record ──
export async function restoreAttendance(recordId, currentUser) {
  await base44.entities.AttendanceRecord.update(recordId, {
    is_deleted: false, deleted_at: '', deleted_by: '', deletion_reason: '',
  });
  const rec = await base44.entities.AttendanceRecord.get(recordId);
  await logActivity('update', recordId, rec.employee_name,
    { restored: true, restored_by: currentUser?.email }, ['is_deleted'], currentUser?.email);
  return { action: 'restored', recordId };
}

// ── Get daily attendance for a date ──
// Returns attendance records for the given date, auto-closing expired sessions.
export async function getDailyAttendance(dateStr, filters = {}) {
  const [settings, shifts, assignments, holidays] = await Promise.all([
    getSettings(), getShifts(), getShiftAssignments(), getHolidays(),
  ]);

  // Fetch all attendance records for this date (non-deleted)
  const records = await base44.entities.AttendanceRecord.filter(
    { attendance_date: dateStr, is_deleted: { $ne: true } },
    '-check_in_at', 100000
  );

  // Auto-close expired open sessions
  const personnelIds = [...new Set(records.map(r => r.personnel_id))];
  for (const pid of personnelIds) {
    await autoCloseExpiredSessions(pid, settings, shifts, assignments, holidays, null);
  }

  // Re-fetch after auto-close
  const updated = await base44.entities.AttendanceRecord.filter(
    { attendance_date: dateStr, is_deleted: { $ne: true } },
    '-check_in_at', 100000
  );

  // Calculate statuses for records that don't have one
  for (const rec of updated) {
    if (!rec.attendance_status) {
      const emp = { id: rec.personnel_id, company: rec.company };
      const shift = resolveShift(emp, assignments, shifts, settings);
      const status = calculateDailyStatus(rec, shift, settings, holidays);
      const { isLate, lateMinutes } = calculateLate(rec, shift);
      // Only update if status changed
      if (status !== rec.attendance_status || isLate !== rec.is_late) {
        await base44.entities.AttendanceRecord.update(rec.id, {
          attendance_status: status, is_late: isLate, late_minutes: lateMinutes,
        });
        rec.attendance_status = status;
        rec.is_late = isLate;
        rec.late_minutes = lateMinutes;
      }
    }
  }

  return { records: updated, settings, shifts, assignments, holidays };
}

// ── Get employee attendance summary for a date range ──
export async function getEmployeeAttendanceSummary(personnelId, dateFrom, dateTo) {
  const records = await base44.entities.AttendanceRecord.filter(
    { personnel_id: personnelId, is_deleted: { $ne: true } },
    '-attendance_date', 10000
  );
  return records.filter(r => {
    if (dateFrom && r.attendance_date < dateFrom) return false;
    if (dateTo && r.attendance_date > dateTo) return false;
    return true;
  });
}