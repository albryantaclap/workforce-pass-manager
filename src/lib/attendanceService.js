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
  isSplitEffective, determineSplitExpectedPunch, resolvePunchWindow,
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

  // Find all open sessions for this employee
  const openRecords = await base44.entities.AttendanceRecord.filter(
    { personnel_id: personnelId, status: 'open', is_deleted: { $ne: true } },
    '-attendance_date', 500
  );

  const closed = [];
  for (const rec of openRecords) {
    // Resolve the shift for this record's date
    const dummyEmp = { id: personnelId, company: rec.company };
    const shift = resolveShift(dummyEmp, assignments, shifts, settings);
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

    // Sync check_out_at with the latest available out timestamp for backward compat
    const lastOut = rec.final_out_at || rec.check_out_at || rec.first_out_at || '';
    if (!rec.check_out_at && lastOut) updates.check_out_at = lastOut;
    // Populate new fields from old ones if missing
    if (!rec.first_in_at && rec.check_in_at) updates.first_in_at = rec.check_in_at;
    if (!rec.final_out_at && rec.check_out_at) updates.final_out_at = rec.check_out_at;

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

  const attDate = timestamp.toLocaleDateString('en-CA');

  // ── Split-shift path ──
  // When the employee's shift has split-shift rules enabled and effective for
  // this date, route through the split-shift punch processor. Normal shifts
  // keep their existing behavior unchanged.
  let emp = { id: personnelId, company };
  try { emp = (await base44.entities.Employee.get(personnelId)) || emp; } catch {}
  const shift = resolveShift(emp, assignments, shifts, settings);
  if (shift && isSplitEffective(shift, attDate)) {
    return processSplitPunch({
      personnelId, employeeName, company, shift, attDate, timestamp,
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

  // Record raw punch
  const tsIso = timestamp.toISOString();
  await base44.entities.AttendancePunch.create({
    personnel_id: personnelId, employee_name: employeeName, company,
    attendance_date: attDate, punch_timestamp: tsIso, punch_type: punchType,
    punch_sequence: punchSeq, source, location,
    created_by: currentUser?.email || '', created_by_name: currentUser?.full_name || '',
  });

  const email = currentUser?.email || '';
  const name = currentUser?.full_name || '';

  if (!session) {
    // Create new session
    if (punchType !== 'IN') throw new Error('Cannot clock out — no open session for this date.');
    session = await base44.entities.AttendanceRecord.create({
      personnel_id: personnelId, employee_name: employeeName, company,
      attendance_date: attDate,
      check_in_at: tsIso, first_in_at: tsIso,
      check_out_at: '', first_out_at: '', second_in_at: '', final_out_at: '',
      duration_minutes: 0, overtime_minutes: 0,
      work_location: workLocation || location || '',
      checked_in_by: email, checked_in_by_name: name,
      status: 'open', source, source_page: source,
      shift_id: shiftId, shift_name: shiftName,
    });
    await logActivity('create', session.id, employeeName,
      { attendance_date: attDate, first_in_at: tsIso, source, punch_sequence: 1 },
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
    } else if (!session.second_in_at && session.first_out_at) {
      // Second IN (return from break) — only valid after first_out
      updates.second_in_at = tsIso;
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
      updates.status = 'completed';
    } else if (!session.first_out_at) {
      // Break start (lunch out)
      updates.first_out_at = tsIso;
    } else if (!session.final_out_at) {
      // Final out after break
      updates.final_out_at = tsIso;
      updates.check_out_at = tsIso;
      updates.checked_out_by = email;
      updates.checked_out_by_name = name;
      updates.status = 'completed';
    } else {
      throw new Error('All punches already recorded for this date.');
    }
  }

  // Recalculate duration
  const merged = { ...session, ...updates };
  updates.duration_minutes = calculateDurationFromRecord(merged);
  if (updates.status === 'completed') {
    updates.overtime_minutes = calculateOvertime(updates.duration_minutes, settings);
  }

  await base44.entities.AttendanceRecord.update(session.id, updates);
  await logActivity('update', session.id, employeeName,
    { ...updates, punch_type: punchType, punch_sequence: punchSeq },
    Object.keys(updates).filter(k => k !== 'duration_minutes' && k !== 'overtime_minutes'), email);

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

  // Punch-window validation (only when the shift configures a window for this punch)
  const { earliest, latest } = resolvePunchWindow(expectedKey, shift, attDate);
  if (earliest && latest) {
    const label = expectedKey.replace(/_/g, ' ');
    if (timestamp < earliest) {
      throw new Error(
        `Punch window not yet open for ${label}. Opens at ${earliest.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`
      );
    }
    if (timestamp > latest) {
      throw new Error(`Punch window has closed for ${label}.`);
    }
  }

  const pType = punchDirection(expectedKey);
  const pSeq = punchSequence(expectedKey);

  // Record the raw punch
  await base44.entities.AttendancePunch.create({
    personnel_id: personnelId, employee_name: employeeName, company,
    attendance_date: attDate, punch_timestamp: tsIso, punch_type: pType,
    punch_sequence: pSeq, source, location,
    created_by: email, created_by_name: name,
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
  } else if (expectedKey === 'FIRST_OUT') {
    updates.first_out_at = tsIso;
  } else if (expectedKey === 'SECOND_IN') {
    updates.second_in_at = tsIso;
  } else if (expectedKey === 'FINAL_OUT') {
    updates.final_out_at = tsIso; updates.check_out_at = tsIso;
    updates.checked_out_by = email; updates.checked_out_by_name = name;
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

// ── Manual entry — create or update a full day's attendance with all 4 punches ──
export async function saveManualEntry({
  personnelId, employeeName, company, attendanceDate,
  firstInAt, firstOutAt, secondInAt, finalOutAt,
  reason, remarks, workLocation, currentUser,
  shiftId = '', shiftName = '', shift = null,
  manualStatusOverride = '', manualStatusReason = '',
}) {
  if (!personnelId) throw new Error('Employee is required.');
  if (!attendanceDate) throw new Error('Attendance date is required.');
  if (!reason?.trim()) throw new Error('A reason is required for manual entry.');

  const email = currentUser?.email || '';
  const name = currentUser?.full_name || '';

  // Find existing record for this date
  const existing = await base44.entities.AttendanceRecord.filter(
    { personnel_id: personnelId, attendance_date: attendanceDate, is_deleted: { $ne: true } },
    undefined, 100
  );
  const record = existing[0] || null;

  const toIso = (dt) => dt ? dt.toISOString() : '';
  const firstInIso = toIso(firstInAt);
  const firstOutIso = toIso(firstOutAt);
  const secondInIso = toIso(secondInAt);
  const finalOutIso = toIso(finalOutAt);

  // Sync backward-compat fields
  const checkInIso = firstInIso;
  const checkOutIso = finalOutIso || firstOutIso;

  const isCompleted = !!finalOutIso || (!!firstOutIso && !secondInIso);
  const tempRec = { first_in_at: firstInIso, first_out_at: firstOutIso, second_in_at: secondInIso, final_out_at: finalOutIso };
  const duration = calculateDurationFromRecord(tempRec);
  const settings = await getSettings();
  const overtime = calculateOvertime(duration, settings);

  const payload = {
    personnel_id: personnelId, employee_name: employeeName, company,
    attendance_date: attendanceDate,
    check_in_at: checkInIso, check_out_at: checkOutIso,
    first_in_at: firstInIso, first_out_at: firstOutIso,
    second_in_at: secondInIso, final_out_at: finalOutIso,
    duration_minutes: duration, overtime_minutes: overtime,
    work_location: workLocation || '',
    status: isCompleted ? 'completed' : 'open',
    source: 'Manual', source_page: 'Daily Attendance',
    is_manual: true, manual_reason: reason.trim(), remarks: remarks || '',
    shift_id: shiftId, shift_name: shiftName,
  };

  // Centralized status recalculation (split-shift aware). The manual override
  // is stored separately so the system-calculated status is never destroyed,
  // and punches are never fabricated when an admin overrides the status.
  const stateRecord = {
    attendance_date: attendanceDate,
    check_in_at: checkInIso, check_out_at: checkOutIso,
    first_in_at: firstInIso, first_out_at: firstOutIso,
    second_in_at: secondInIso, final_out_at: finalOutIso,
    manual_status_override: manualStatusOverride || '',
  };
  const state = shift ? calculateAttendanceState(stateRecord, shift, settings, [], new Date()) : null;
  const calculatedStatus = state?.calculatedStatus || (isCompleted ? 'Present' : (firstInIso ? 'Missing Check-out' : 'Absent'));
  payload.calculated_status = calculatedStatus;
  payload.attendance_status = manualStatusOverride || calculatedStatus;
  payload.manual_status_override = manualStatusOverride || '';
  payload.manual_status_reason = manualStatusOverride ? (manualStatusReason || reason || '').trim() : '';
  payload.is_late = state?.isLate ?? false;
  payload.late_minutes = state?.lateMinutes ?? 0;

  if (record) {
    // Update existing — log correction
    await base44.entities.AttendanceRecord.update(record.id, payload);
    await base44.entities.AttendanceCorrection.create({
      attendance_id: record.id, personnel_id: personnelId, employee_name: employeeName,
      field_changed: 'manual_entry',
      original_value: JSON.stringify({ first_in_at: record.first_in_at, first_out_at: record.first_out_at, second_in_at: record.second_in_at, final_out_at: record.final_out_at }),
      new_value: JSON.stringify({ first_in_at: firstInIso, first_out_at: firstOutIso, second_in_at: secondInIso, final_out_at: finalOutIso }),
      reason: reason.trim(), changed_by: email, changed_by_name: name,
    });
    await logActivity('update', record.id, employeeName,
      { ...payload, manual_correction: true, reason: reason.trim(), previous: { first_in_at: record.first_in_at, first_out_at: record.first_out_at, second_in_at: record.second_in_at, final_out_at: record.final_out_at } },
      ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'manual_reason'], email);

    // Audit any effective-status change (including manual overrides).
    const oldStatus = record.attendance_status || '';
    const newStatus = payload.attendance_status;
    if (oldStatus !== newStatus) {
      await logActivity('update', record.id, employeeName,
        { status_change: true, old_status: oldStatus, new_status: newStatus, manual_override: !!manualStatusOverride, reason: (manualStatusReason || reason || '').trim() },
        ['attendance_status'], email);
    }
    return { action: 'updated', record: { ...record, ...payload } };
  }

  const newRec = await base44.entities.AttendanceRecord.create({
    ...payload,
    checked_in_by: email, checked_in_by_name: name,
    checked_out_by: isCompleted ? email : '', checked_out_by_name: isCompleted ? name : '',
  });
  await logActivity('create', newRec.id, employeeName,
    { ...payload, manual_entry: true },
    ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'manual_reason'], email);
  return { action: 'created', record: newRec };
}

// ── Soft delete ──
export async function softDeleteAttendance(recordId, reason, currentUser) {
  if (!reason?.trim()) throw new Error('A deletion reason is required.');
  const rec = await base44.entities.AttendanceRecord.get(recordId);
  await base44.entities.AttendanceRecord.update(recordId, {
    is_deleted: true,
    deleted_at: new Date().toISOString(),
    deleted_by: currentUser?.email || '',
    deletion_reason: reason.trim(),
  });
  await logActivity('delete', recordId, rec.employee_name,
    { reason: reason.trim(), deleted_by: currentUser?.email }, ['is_deleted'], currentUser?.email);
  return { action: 'deleted', recordId };
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