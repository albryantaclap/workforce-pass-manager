import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { checkPermission } from '../../shared/permissionCheck.ts';
import {
  resolveShift, isSplitEffective, validatePunchSequence, calculateAttendanceStatus,
} from '../../shared/attendanceCalc.ts';

// Backend authorization for attendance manual entry / edit.
// Checks attendance.entries.edit permission before performing the operation.
// A user without the permission receives 403 Forbidden even if they call the
// endpoint directly.
//
// TWO MODES
//   single (default)  — one employee, one attendance record (used by Edit Attendance)
//   bulk              — body.entries[] : many employees, one shared form (date,
//                       site location, reason, remarks). Settings, shifts and shift
//                       assignments are read ONCE for the whole batch, and the
//                       individual records are written in chunks. Every entry is
//                       validated and calculated with exactly the same rules as a
//                       single save, and gets its own per-employee result.

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

const MAX_BULK = 500;
const READ_CHUNK = 100;
const WRITE_CHUNK = 50;

// A personnel id must look like a stored record id — a malformed id is reported as
// a per-employee failure instead of failing the whole query.
const VALID_ID = /^[a-f0-9]{24}$/i;

const chunk = (list, size) => {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
};

/**
 * Build the record payload for ONE employee — the single place where a manual
 * entry's punches, duration, overtime and status are calculated, used by both the
 * single save and every entry of a bulk save.
 *
 * Returns { blocked: string[] } when the punch sequence must be refused, or
 * { payload, record } with everything ready to write.
 */
const prepareEntry = ({
  employee, employeeName, company, settings, shift, record,
  iso, changed, attendanceDate, siteLocation, workLocation, reasonText,
  manualStatusOverride, manualStatusReason, userId, userName,
}) => {
  // ── PATCH: only the punches the Admin actually changed are applied ─────────
  const punch: any = {
    first_in_at: record?.first_in_at || '',
    first_out_at: record?.first_out_at || '',
    second_in_at: record?.second_in_at || '',
    final_out_at: record?.final_out_at || '',
  };
  if (!changed || changed.includes('first_in')) punch.first_in_at = iso.first_in || '';
  if (!changed || changed.includes('first_out')) punch.first_out_at = iso.first_out || '';
  if (!changed || changed.includes('second_in')) punch.second_in_at = iso.second_in || '';
  if (!changed || changed.includes('final_out')) punch.final_out_at = iso.final_out || '';

  const sequenceRecord: any = {
    attendance_date: attendanceDate,
    first_in_at: punch.first_in_at, first_out_at: punch.first_out_at,
    second_in_at: punch.second_in_at, final_out_at: punch.final_out_at,
  };
  const { blocked } = validatePunchSequence(sequenceRecord, shift, settings);
  if (blocked.length) return { blocked };

  const splitEffective = !!(shift && isSplitEffective(shift, attendanceDate));

  // Backward-compat mirror fields — a cleared FINAL OUT stays cleared.
  const singleSessionOut = (!punch.first_out_at && !punch.second_in_at)
    ? (record?.check_out_at || '')
    : '';
  const checkInIso = punch.first_in_at || record?.check_in_at || '';
  const checkOutIso = punch.final_out_at || singleSessionOut;
  const isCompleted = splitEffective
    ? !!punch.final_out_at
    : (!!punch.final_out_at || (!!punch.first_out_at && !punch.second_in_at));

  const duration = calculateDurationFromRecord(punch);
  const overtime = calculateOvertime(duration, settings);
  const calculatedStatus = calculateAttendanceStatus(sequenceRecord, shift, settings, [], new Date());

  const payload: any = {
    personnel_id: employee?.id || record?.personnel_id || '',
    employee_name: employeeName, company,
    attendance_date: attendanceDate,
    check_in_at: checkInIso, check_out_at: checkOutIso,
    first_in_at: punch.first_in_at, first_out_at: punch.first_out_at,
    second_in_at: punch.second_in_at, final_out_at: punch.final_out_at,
    duration_minutes: duration, overtime_minutes: overtime,
    work_location: workLocation || '',
    status: isCompleted ? 'completed' : 'open',
    source: 'Manual', source_page: 'Daily Attendance',
    is_manual: true, manual_reason: reasonText, remarks: '',
    shift_id: shift?.id && shift.id !== 'default' ? shift.id : '',
    shift_name: shift?.shift_name || '',
    calculated_status: calculatedStatus,
    attendance_status: manualStatusOverride || calculatedStatus,
    manual_status_override: manualStatusOverride || '',
    manual_status_reason: manualStatusOverride ? (manualStatusReason || reasonText || '').trim() : '',
  };

  // WHO performed each punch. Editing never rewrites the account that originally
  // scanned a punch; only a punch newly entered here is attributed to this user.
  if (record) {
    payload.first_in_by_user_id = record.first_in_by_user_id || (!record.first_in_at && punch.first_in_at ? userId : '');
    payload.first_out_by_user_id = record.first_out_by_user_id || (!record.first_out_at && punch.first_out_at ? userId : '');
    payload.second_in_by_user_id = record.second_in_by_user_id || (!record.second_in_at && punch.second_in_at ? userId : '');
    payload.final_out_by_user_id = record.final_out_by_user_id || (!record.final_out_at && punch.final_out_at ? userId : '');
    payload.last_edited_by_user_id = userId;
    payload.last_edited_by_name = userName;
    payload.last_edited_at = new Date().toISOString();
  } else {
    payload.first_in_by_user_id = punch.first_in_at ? userId : '';
    payload.first_out_by_user_id = punch.first_out_at ? userId : '';
    payload.second_in_by_user_id = punch.second_in_at ? userId : '';
    payload.final_out_by_user_id = punch.final_out_at ? userId : '';
  }

  // The branch the entry was made for (Work Locations list) — the employee's own
  // assigned branch lives in work_location and is never touched here.
  if (siteLocation) payload.site_location = siteLocation;

  return { payload, record };
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
    const email = user?.email || '';
    const name = user?.full_name || '';
    const userId = user?.id || '';

    // Reference data — read ONCE for the whole request (a bulk save of 100 employees
    // must not re-read the shift tables 100 times).
    const [settingRows, shiftRows, assignmentRows] = await Promise.all([
      base44.asServiceRole.entities.AttendanceSetting.list('-created_date', 100),
      base44.asServiceRole.entities.AttendanceShift.list('-created_date', 1000),
      base44.asServiceRole.entities.AttendanceShiftAssignment.list('-created_date', 5000),
    ]);
    const settings = settingRows[0] || null;

    // ─────────────────────────────────────────────────────────────────────────
    // BULK MODE — one shared form applied to many employees
    // ─────────────────────────────────────────────────────────────────────────
    if (Array.isArray(body.entries)) {
      const {
        entries, attendanceDate, siteLocation, reason, remarks,
        manualStatusOverride, manualStatusReason, overlapMode, requestId,
      } = body;

      if (!attendanceDate) return Response.json({ error: 'Attendance date is required.' }, { status: 400 });
      if (!entries.length) return Response.json({ error: 'Select at least one employee.' }, { status: 400 });
      if (entries.length > MAX_BULK) {
        return Response.json({ error: `A batch can hold at most ${MAX_BULK} employees.` }, { status: 400 });
      }

      // Validate every personnel id up front — one bad id is a per-entry failure,
      // never a reason to abort the whole batch.
      const ids = [...new Set(
        entries
          .map((e: any) => e?.personnelId)
          .filter((id: any) => typeof id === 'string' && VALID_ID.test(id))
      )];
      if (!ids.length) return Response.json({ error: 'No valid employee was selected.' }, { status: 400 });

      const employeesById: Record<string, any> = {};
      for (const part of chunk(ids, READ_CHUNK)) {
        const rows = await base44.asServiceRole.entities.Employee.filter({ id: { $in: part } }, undefined, 500);
        (rows || []).forEach((e: any) => { employeesById[e.id] = e; });
      }

      // Existing attendance for the selected date — one read per chunk of ids, so
      // the conflict check does not cost one query per employee.
      const existingByPersonnel: Record<string, any> = {};
      for (const part of chunk(ids, READ_CHUNK)) {
        const rows = await base44.asServiceRole.entities.AttendanceRecord.filter(
          { personnel_id: { $in: part }, attendance_date: attendanceDate, is_deleted: { $ne: true } },
          undefined, 500
        );
        (rows || []).forEach((r: any) => { existingByPersonnel[r.personnel_id] = r; });
      }

      const defaultMode = overlapMode === 'update' ? 'update' : 'skip';
      const reasonText = (reason || '').trim();
      const siteLocationText = (siteLocation || '').trim();

      const results: any[] = [];
      const toCreate: any[] = [];
      const toUpdate: any[] = [];

      for (const entry of entries) {
        const personnelId = entry?.personnelId;
        const employeeName = entry?.employeeName || employeesById[personnelId]?.name || '';
        const fail = (error: string, status = 'failed') =>
          results.push({ personnelId, employeeName, status, error });

        const employee = employeesById[personnelId];
        if (!personnelId) { fail('The employee is missing.'); continue; }
        if (!employee) { fail('The employee no longer exists in the Master List.'); continue; }

        const record = existingByPersonnel[personnelId] || null;
        const mode = entry?.mode === 'update' ? 'update' : entry?.mode === 'skip' ? 'skip' : defaultMode;

        // Default is Skip Existing Attendance — an existing record is never
        // overwritten unless the Admin explicitly chose to update it.
        if (record && mode !== 'update') {
          results.push({ personnelId, employeeName, status: 'skipped', error: 'Attendance already exists for this date.' });
          continue;
        }
        if (!record && !reasonText) { fail('A reason is required for manual entry.'); continue; }
        if (!record && !entry?.firstInIso) { fail('FIRST IN is required to create an attendance record.'); continue; }

        const shift = resolveShift(employee, assignmentRows, shiftRows, settings);
        const prepared = prepareEntry({
          employee, employeeName, company: entry?.company || employee.company || '',
          settings, shift, record,
          iso: {
            first_in: entry?.firstInIso || '', first_out: entry?.firstOutIso || '',
            second_in: entry?.secondInIso || '', final_out: entry?.finalOutIso || '',
          },
          changed: null,
          attendanceDate, siteLocation: siteLocationText,
          workLocation: employee.current_location || '',
          reasonText, manualStatusOverride, manualStatusReason,
          userId, userName: name,
        });

        if (prepared.blocked) { fail(prepared.blocked.join(' ')); continue; }

        const payload = { ...prepared.payload, remarks: remarks || '' };
        if (record) toUpdate.push({ record, payload });
        else toCreate.push({ personnelId, employeeName, payload });
      }

      const corrections: any[] = [];
      const logs: any[] = [];

      // ── Create ──────────────────────────────────────────────────────────────
      for (const part of chunk(toCreate, WRITE_CHUNK)) {
        let created: any = null;
        let wrote = false;
        try {
          created = await base44.entities.AttendanceRecord.bulkCreate(part.map((p: any) => ({
            ...p.payload,
            checked_in_by: email, checked_in_by_name: name,
            checked_out_by: p.payload.status === 'completed' ? email : '',
            checked_out_by_name: p.payload.status === 'completed' ? name : '',
          })));
          wrote = true;
        } catch {
          wrote = false;
        }

        if (wrote) {
          const recs = Array.isArray(created) ? created : [];
          part.forEach((p: any, i: number) => {
            const rec = recs[i];
            results.push({ personnelId: p.personnelId, employeeName: p.employeeName, status: 'created', recordId: rec?.id });
            logs.push({
              action: 'create', entity_name: 'AttendanceRecord', entity_id: rec?.id || '',
              performed_by: email, record_name: p.employeeName,
              record_snapshot: { ...p.payload, manual_entry: true, bulk_request_id: requestId || '' },
              changed_fields: ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'site_location', 'manual_reason'],
            });
          });
          continue;
        }

        // The batch write did not go through — fall back to writing the entries one
        // by one so one unlucky row cannot lose the whole chunk.
        for (const p of part) {
          try {
            const rec = await base44.entities.AttendanceRecord.create({
              ...p.payload,
              checked_in_by: email, checked_in_by_name: name,
              checked_out_by: p.payload.status === 'completed' ? email : '',
              checked_out_by_name: p.payload.status === 'completed' ? name : '',
            });
            results.push({ personnelId: p.personnelId, employeeName: p.employeeName, status: 'created', recordId: rec?.id });
            logs.push({
              action: 'create', entity_name: 'AttendanceRecord', entity_id: rec?.id || '',
              performed_by: email, record_name: p.employeeName,
              record_snapshot: { ...p.payload, manual_entry: true, bulk_request_id: requestId || '' },
              changed_fields: ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'site_location', 'manual_reason'],
            });
          } catch (err: any) {
            results.push({
              personnelId: p.personnelId, employeeName: p.employeeName,
              status: 'failed', error: err?.message || 'The record could not be saved.',
            });
          }
        }
      }

      // ── Update (only the records the Admin explicitly chose to update) ──────
      for (const part of chunk(toUpdate, WRITE_CHUNK)) {
        try {
          await base44.entities.AttendanceRecord.bulkUpdate(
            part.map(({ record, payload }: any) => ({ id: record.id, ...payload }))
          );
          part.forEach(({ record, payload }: any) => {
            results.push({
              personnelId: payload.personnel_id, employeeName: payload.employee_name,
              status: 'updated', recordId: record.id,
            });
            corrections.push({
              attendance_id: record.id, personnel_id: payload.personnel_id,
              employee_name: payload.employee_name, field_changed: 'manual_entry',
              original_value: JSON.stringify({
                first_in_at: record.first_in_at, first_out_at: record.first_out_at,
                second_in_at: record.second_in_at, final_out_at: record.final_out_at,
              }),
              new_value: JSON.stringify({
                first_in_at: payload.first_in_at, first_out_at: payload.first_out_at,
                second_in_at: payload.second_in_at, final_out_at: payload.final_out_at,
              }),
              reason: reasonText, changed_by: email, changed_by_name: name,
            });
            logs.push({
              action: 'update', entity_name: 'AttendanceRecord', entity_id: record.id,
              performed_by: email, record_name: payload.employee_name,
              record_snapshot: { ...payload, manual_correction: true, reason: reasonText, bulk_request_id: requestId || '' },
              changed_fields: ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'site_location', 'manual_reason'],
            });
          });
        } catch (err: any) {
          part.forEach(({ payload }: any) => {
            results.push({
              personnelId: payload.personnel_id, employeeName: payload.employee_name,
              status: 'failed', error: err?.message || 'The record could not be updated.',
            });
          });
        }
      }

      // Audit history in two batched writes.
      for (const part of chunk(corrections, WRITE_CHUNK)) {
        try { await base44.asServiceRole.entities.AttendanceCorrection.bulkCreate(part); } catch { /* audit only */ }
      }
      for (const part of chunk(logs, WRITE_CHUNK)) {
        try { await base44.asServiceRole.entities.ActivityLog.bulkCreate(part); } catch { /* audit only */ }
      }

      const summary = {
        selected: entries.length,
        created: results.filter(r => r.status === 'created').length,
        updated: results.filter(r => r.status === 'updated').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        failed: results.filter(r => r.status === 'failed').length,
      };

      return Response.json({ results, summary });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // SINGLE MODE — one employee (Manual Entry / Edit Attendance)
    // ─────────────────────────────────────────────────────────────────────────
    const {
      personnelId, employeeName, company, attendanceDate,
      attendanceRecordId,
      firstInIso, firstOutIso, secondInIso, finalOutIso,
      changedPunchKeys,
      reason, remarks, workLocation, siteLocation,
      shiftId, shiftName,
      manualStatusOverride, manualStatusReason,
    } = body;

    if (!personnelId) return Response.json({ error: 'Employee is required.' }, { status: 400 });
    if (!attendanceDate) return Response.json({ error: 'Attendance date is required.' }, { status: 400 });

    // The employee's assigned shift for this date is resolved HERE — a shift sent by
    // the client is never trusted.
    let employee: any = null;
    try { employee = await base44.entities.Employee.get(personnelId); } catch { employee = null; }
    const resolvedShift = resolveShift(employee || { id: personnelId, company }, assignmentRows, shiftRows, settings);

    // Resolve the record being edited. When the row's attendance record id is supplied
    // it is authoritative: the record must exist and must belong to the employee.
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

    // Creating an attendance record from scratch still requires a reason.
    if (!record && !reason?.trim()) {
      return Response.json({ error: 'A reason is required for manual entry.' }, { status: 400 });
    }
    const reasonText = (reason || '').trim();
    const changed: string[] | null = Array.isArray(changedPunchKeys) ? changedPunchKeys : null;

    const prepared = prepareEntry({
      employee, employeeName, company, settings, shift: resolvedShift, record,
      iso: {
        first_in: firstInIso || '', first_out: firstOutIso || '',
        second_in: secondInIso || '', final_out: finalOutIso || '',
      },
      changed, attendanceDate,
      siteLocation: (siteLocation || '').trim(),
      workLocation,
      reasonText, manualStatusOverride, manualStatusReason,
      userId, userName: name,
    });

    if (prepared.blocked) {
      return Response.json({ error: prepared.blocked.join(' ') }, { status: 400 });
    }

    const payload: any = { ...prepared.payload, remarks: remarks || '' };
    if (!siteLocation && record) delete payload.site_location;
    payload.shift_id = payload.shift_id || shiftId || '';
    payload.shift_name = payload.shift_name || shiftName || '';

    if (record) {
      await base44.entities.AttendanceRecord.update(record.id, payload);

      await base44.asServiceRole.entities.AttendanceCorrection.create({
        attendance_id: record.id, personnel_id: personnelId, employee_name: employeeName,
        field_changed: 'manual_entry',
        original_value: JSON.stringify({ first_in_at: record.first_in_at, first_out_at: record.first_out_at, second_in_at: record.second_in_at, final_out_at: record.final_out_at }),
        new_value: JSON.stringify({ first_in_at: payload.first_in_at, first_out_at: payload.first_out_at, second_in_at: payload.second_in_at, final_out_at: payload.final_out_at }),
        reason: reasonText, changed_by: email, changed_by_name: name,
      });

      await base44.asServiceRole.entities.ActivityLog.create({
        action: 'update', entity_name: 'AttendanceRecord', entity_id: record.id,
        performed_by: email, record_name: employeeName,
        record_snapshot: { ...payload, manual_correction: true, reason: reasonText },
        changed_fields: ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'manual_reason'],
      });

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

    const newRec = await base44.entities.AttendanceRecord.create({
      ...payload,
      checked_in_by: email, checked_in_by_name: name,
      checked_out_by: payload.status === 'completed' ? email : '',
      checked_out_by_name: payload.status === 'completed' ? name : '',
    });

    await base44.asServiceRole.entities.ActivityLog.create({
      action: 'create', entity_name: 'AttendanceRecord', entity_id: newRec.id,
      performed_by: email, record_name: employeeName,
      record_snapshot: { ...payload, manual_entry: true },
      changed_fields: ['first_in_at', 'first_out_at', 'second_in_at', 'final_out_at', 'site_location', 'manual_reason'],
    });

    return Response.json({ action: 'created', record: newRec });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});