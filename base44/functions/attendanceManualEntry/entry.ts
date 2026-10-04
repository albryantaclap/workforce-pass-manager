import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { checkPermission } from '../../shared/permissionCheck.ts';
import {
  resolveShift, isSplitEffective, validatePunchSequence, calculateAttendanceStatus,
} from '../../shared/attendanceCalc.ts';

// Backend authorization for attendance manual entry / edit.
// Checks attendance.entries.edit permission before performing the operation.
// A user without the permission receives 403 Forbidden even if they call the
// endpoint directly.

// ── Duration helpers (duplicated from attendanceEngine — backend can't import src/) ──
const calcDuration = (startIso, endIso) => {
  if (!startIso || !endIso) return 0;
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
};

const calculateDurationFromRecord = (r) => {
  let total = 0;
  if (r.first_in_at && r.first_out_at) total += calcDuration(r.first_in_at, r.first_out_at);
  if (r.second_in_at && r.final_out_at) total += calcDuration(r.second_in_at, r.final_out_at);
  if (!r.first_out_at && !r.second_in_at && r.first_in_at && r.final_out_at) {
    total = calcDuration(r.first_in_at, r.final_out_at);
  }
  return total;
};

const calculateOvertime = (durationMinutes, settings) => {
  if (!durationMinutes || !settings) return 0;
  const otStart = (settings.overtime_start_hours ?? 8) * 60;
  return Math.max(0, durationMinutes - otStart);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { allowed } = await checkPermission(base44, user, 'attendance.entries.edit');
    if (!allowed) {
      return Response.json({ error: 'Forbidden: Manual Entry / Edit permission required for Time Entries' }, { status: 403 });
    }

    const body = await req.json();
    const {
      personnelId, employeeName, company, attendanceDate,
      attendanceRecordId,
      firstInIso, firstOutIso, secondInIso, finalOutIso,
      changedPunchKeys,
      reason, remarks, workLocation,
      shiftId, shiftName,
      manualStatusOverride, manualStatusReason,
    } = body;

    if (!personnelId) return Response.json({ error: 'Employee is required.' }, { status: 400 });
    if (!attendanceDate) return Response.json({ error: 'Attendance date is required.' }, { status: 400 });

    const email = user?.email || '';
    const name = user?.full_name || '';
    // The authenticated ACCOUNT behind this action (the permanent reference).
    const userId = user?.id || '';

    // The employee's assigned shift for this date is resolved HERE — a shift sent by
    // the client is never trusted. It decides the Split-Shift Punch Rules that the
    // punches are validated against, below, once the record being edited is known.
    let employee: any = null;
    try { employee = await base44.entities.Employee.get(personnelId); } catch { employee = null; }
    const [shiftRows, assignmentRows, settingRows] = await Promise.all([
      base44.asServiceRole.entities.AttendanceShift.list('-created_date', 1000),
      base44.asServiceRole.entities.AttendanceShiftAssignment.list('-created_date', 5000),
      base44.asServiceRole.entities.AttendanceSetting.list('-created_date', 100),
    ]);
    const settings = settingRows[0] || null;
    const resolvedShift = resolveShift(employee || { id: personnelId, company }, assignmentRows, shiftRows, settings);
    const splitEffective = !!(resolvedShift && isSplitEffective(resolvedShift, attendanceDate));

    // Resolve the record being edited. When the row's attendance record id is supplied
    // it is authoritative: the record must exist and must belong to the employee passed
    // in, so an edit can never touch another employee's attendance. Without an id the
    // record is matched by employee + date (legacy callers).
    let record: any = null;
    if (attendanceRecordId) {
      try { record = await base44.entities.AttendanceRecord.get(attendanceRecordId); } catch { record = null; }
      if (!record || record.is_deleted) {
        return Response.json({ error: 'The selected attendance record no longer exists.' }, { status: 404 });
      }
      if (record.personnel_id !== personnelId) {
        return Response.json({ error: 'This attendance record belongs to a different employee.' }, { status: 400 });
      }
    } else {
      const existing = await base44.entities.AttendanceRecord.filter(
        { personnel_id: personnelId, attendance_date: attendanceDate, is_deleted: { $ne: true } },
        undefined, 100
      );
      record = existing[0] || null;
    }

    // ── PATCH: only the punches the Admin actually changed are applied ─────────
    // Edit Attendance sends just the punch fields the Admin touched; every other punch
    // keeps the value already stored on the record. A punch recorded by the scanner
    // while the dialog was open is therefore never overwritten with the form's older
    // value, and one punch is never copied into another — a blank punch stays blank
    // unless the Admin sets it explicitly.
    const changed: string[] | null = Array.isArray(changedPunchKeys) ? changedPunchKeys : null;
    const punch: any = {
      first_in_at: record?.first_in_at || '',
      first_out_at: record?.first_out_at || '',
      second_in_at: record?.second_in_at || '',
      final_out_at: record?.final_out_at || '',
    };
    if (!changed || changed.includes('first_in')) punch.first_in_at = firstInIso || '';
    if (!changed || changed.includes('first_out')) punch.first_out_at = firstOutIso || '';
    if (!changed || changed.includes('second_in')) punch.second_in_at = secondInIso || '';
    if (!changed || changed.includes('final_out')) punch.final_out_at = finalOutIso || '';

    // ── Server-side punch-sequence validation (the sequence is authoritative) ──
    // The punches the record WILL hold are validated against the shift's Split-Shift
    // Punch Rules: FIRST IN → FIRST OUT → SECOND IN → FINAL OUT. They are compared as
    // FULL datetimes, so a cross-midnight sequence (SECOND IN 00:55 after FIRST OUT
    // 22:50) stays valid and the attendance date stays the shift-start date. A save
    // that would skip a required punch, jump a later punch over an earlier one, or
    // order them wrongly is rejected with the punch that is expected. Validation only
    // ever REJECTS: it never creates, fills in or infers a missing punch.
    const sequenceRecord: any = {
      attendance_date: attendanceDate,
      first_in_at: punch.first_in_at, first_out_at: punch.first_out_at,
      second_in_at: punch.second_in_at, final_out_at: punch.final_out_at,
    };
    const { blocked } = validatePunchSequence(sequenceRecord, resolvedShift, settings);
    if (blocked.length) {
      return Response.json({ error: blocked.join(' ') }, { status: 400 });
    }

    // Creating an attendance record from scratch still requires a reason; editing the
    // punches of an existing record does not force one.
    if (!record && !reason?.trim()) {
      return Response.json({ error: 'A reason is required for manual entry.' }, { status: 400 });
    }
    const reasonText = (reason || '').trim();

    // Backward-compat mirror fields. check_out_at follows a REAL final out only, and
    // a legacy single-session out that already lives in check_out_at is left exactly
    // where it is (it is never promoted into final_out_at either). No other punch is
    // ever copied into it — in particular a first out never becomes a final out — so
    // a cleared FINAL OUT stays cleared and a missing FINAL OUT stays missing.
    const singleSessionOut = (!punch.first_out_at && !punch.second_in_at)
      ? (record?.check_out_at || '')
      : '';
    const checkInIso = punch.first_in_at || record?.check_in_at || '';
    const checkOutIso = punch.final_out_at || singleSessionOut;
    const isCompleted = splitEffective
      ? !!punch.final_out_at
      : (!!punch.final_out_at || (!!punch.first_out_at && !punch.second_in_at));

    const tempRec = punch;
    const duration = calculateDurationFromRecord(tempRec);
    const overtime = calculateOvertime(duration, settings);

    // Status comes from the SAME shared calculation the punch paths and every
    // display use, so an edited record can never disagree with Time Entries.
    const calculatedStatus = calculateAttendanceStatus(sequenceRecord, resolvedShift, settings, [], new Date());

    const payload: any = {
      personnel_id: personnelId, employee_name: employeeName, company,
      attendance_date: attendanceDate,
      check_in_at: checkInIso, check_out_at: checkOutIso,
      first_in_at: punch.first_in_at, first_out_at: punch.first_out_at,
      second_in_at: punch.second_in_at, final_out_at: punch.final_out_at,
      duration_minutes: duration, overtime_minutes: overtime,
      work_location: workLocation || '',
      status: isCompleted ? 'completed' : 'open',
      source: 'Manual', source_page: 'Daily Attendance',
      is_manual: true, manual_reason: reasonText, remarks: remarks || '',
      shift_id: resolvedShift?.id && resolvedShift.id !== 'default' ? resolvedShift.id : (shiftId || ''),
      shift_name: resolvedShift?.shift_name || shiftName || '',
      calculated_status: calculatedStatus,
      attendance_status: manualStatusOverride || calculatedStatus,
      manual_status_override: manualStatusOverride || '',
      manual_status_reason: manualStatusOverride ? (manualStatusReason || reason || '').trim() : '',
    };

    // WHO performed each punch. Editing a record never rewrites the account that
    // originally scanned a punch: a punch that already existed keeps its stored
    // account, and only a punch newly entered here is attributed to this user.
    // The editor is recorded separately as Last Edited By.
    if (record) {
      payload.first_in_by_user_id = record.first_in_by_user_id || (!record.first_in_at && punch.first_in_at ? userId : '');
      payload.first_out_by_user_id = record.first_out_by_user_id || (!record.first_out_at && punch.first_out_at ? userId : '');
      payload.second_in_by_user_id = record.second_in_by_user_id || (!record.second_in_at && punch.second_in_at ? userId : '');
      payload.final_out_by_user_id = record.final_out_by_user_id || (!record.final_out_at && punch.final_out_at ? userId : '');
      payload.last_edited_by_user_id = userId;
      payload.last_edited_by_name = name;
      payload.last_edited_at = new Date().toISOString();
    } else {
      payload.first_in_by_user_id = punch.first_in_at ? userId : '';
      payload.first_out_by_user_id = punch.first_out_at ? userId : '';
      payload.second_in_by_user_id = punch.second_in_at ? userId : '';
      payload.final_out_by_user_id = punch.final_out_at ? userId : '';
    }

    if (record) {
      // Update existing — log correction
      await base44.entities.AttendanceRecord.update(record.id, payload);

      await base44.asServiceRole.entities.AttendanceCorrection.create({
        attendance_id: record.id, personnel_id: personnelId, employee_name: employeeName,
        field_changed: 'manual_entry',
        original_value: JSON.stringify({ first_in_at: record.first_in_at, first_out_at: record.first_out_at, second_in_at: record.second_in_at, final_out_at: record.final_out_at }),
        new_value: JSON.stringify({ first_in_at: punch.first_in_at, first_out_at: punch.first_out_at, second_in_at: punch.second_in_at, final_out_at: punch.final_out_at }),
        reason: reasonText, changed_by: email, changed_by_name: name,
      });

      await base44.asServiceRole.entities.ActivityLog.create({
        action: 'update', entity_name: 'AttendanceRecord', entity_id: record.id,
        performed_by: email, record_name: employeeName,
        record_snapshot: { ...payload, manual_correction: true, reason: reasonText },
        changed_fields: ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'manual_reason'],
      });

      // Audit any effective-status change (including manual overrides)
      const oldStatus = record.attendance_status || '';
      const newStatus = payload.attendance_status;
      if (oldStatus !== newStatus) {
        await base44.asServiceRole.entities.ActivityLog.create({
          action: 'update', entity_name: 'AttendanceRecord', entity_id: record.id,
          performed_by: email, record_name: employeeName,
          record_snapshot: { status_change: true, old_status: oldStatus, new_status: newStatus, manual_override: !!manualStatusOverride, reason: (manualStatusReason || reasonText) },
          changed_fields: ['attendance_status'],
        });
      }

      return Response.json({ action: 'updated', record: { ...record, ...payload } });
    }

    // Create new record
    const newRec = await base44.entities.AttendanceRecord.create({
      ...payload,
      checked_in_by: email, checked_in_by_name: name,
      checked_out_by: isCompleted ? email : '', checked_out_by_name: isCompleted ? name : '',
    });

    await base44.asServiceRole.entities.ActivityLog.create({
      action: 'create', entity_name: 'AttendanceRecord', entity_id: newRec.id,
      performed_by: email, record_name: employeeName,
      record_snapshot: { ...payload, manual_entry: true },
      changed_fields: ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'manual_reason'],
    });

    return Response.json({ action: 'created', record: newRec });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});