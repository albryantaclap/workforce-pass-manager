import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { checkPermission } from '../../shared/permissionCheck.ts';
import { calculateAttendanceStatus } from '../../shared/attendanceCalc.ts';

// ── Backfill missing BREAK punches (audited admin correction) ────────────────
// Employees who scanned the First In but could not record the First Out and / or
// the Second In (the punch window was already closed when they scanned) get those
// break punches filled in, so they can still punch the Final Out themselves.
//
// Rules enforced here:
//   • Only the break punches are written — a punch that already exists is never
//     overwritten, and the Final Out is NEVER fabricated (the employee punches it).
//   • A time that would fall out of order (before the First In / after an existing
//     later punch) is skipped and reported, never "fixed".
//   • Every change is stamped on the record (Last Edited By) and written to the
//     AttendanceCorrection + ActivityLog audit trails, one entry per punch.
//
// Body: { attendanceDate: 'YYYY-MM-DD', firstOutTime?: 'HH:mm', secondInTime?: 'HH:mm', reason?, dryRun? }

const QATAR_OFFSET = '+03:00';

const iso = (date: string, time: string) => new Date(`${date}T${time}:00${QATAR_OFFSET}`).toISOString();

const calcDuration = (startIso: string, endIso: string) => {
  if (!startIso || !endIso) return 0;
  return Math.round((new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000);
};

const calculateDurationFromRecord = (r: any) => {
  let total = 0;
  if (r.first_in_at && r.first_out_at) total += calcDuration(r.first_in_at, r.first_out_at);
  if (r.second_in_at && r.final_out_at) total += calcDuration(r.second_in_at, r.final_out_at);
  if (!r.first_out_at && !r.second_in_at && r.first_in_at && r.final_out_at) {
    total = calcDuration(r.first_in_at, r.final_out_at);
  }
  return total;
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
    const attendanceDate = (body.attendanceDate || '').trim();
    const firstOutTime = (body.firstOutTime || '').trim();
    const secondInTime = (body.secondInTime || '').trim();
    const dryRun = body.dryRun === true;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
      return Response.json({ error: 'A valid attendance date (YYYY-MM-DD) is required.' }, { status: 400 });
    }
    if (!firstOutTime && !secondInTime) {
      return Response.json({ error: 'Provide the First Out time and / or the Second In time to backfill.' }, { status: 400 });
    }
    if ((firstOutTime && !/^\d{2}:\d{2}$/.test(firstOutTime)) || (secondInTime && !/^\d{2}:\d{2}$/.test(secondInTime))) {
      return Response.json({ error: 'Times must use the HH:mm format.' }, { status: 400 });
    }

    const firstOutIso = firstOutTime ? iso(attendanceDate, firstOutTime) : '';
    const secondInIso = secondInTime ? iso(attendanceDate, secondInTime) : '';

    const userId = user?.id || '';
    const email = user?.email || '';
    const name = user?.full_name || '';
    const parts = [];
    if (firstOutTime) parts.push(`First Out to ${firstOutTime}`);
    if (secondInTime) parts.push(`Second In to ${secondInTime}`);
    const reason = (body.reason
      || `${parts.join(' and ')} backfilled — the punch window was already closed when the employee scanned.`).trim();

    const [settingsRows, shiftRows] = await Promise.all([
      base44.asServiceRole.entities.AttendanceSetting.list('-created_date', 100),
      base44.asServiceRole.entities.AttendanceShift.list('-created_date', 1000),
    ]);
    const settings = settingsRows[0] || null;
    const shifts = shiftRows || [];

    // Open sessions for the date that already hold a First In.
    const found = await base44.asServiceRole.entities.AttendanceRecord.filter({
      attendance_date: attendanceDate,
      is_deleted: { $ne: true },
      status: 'open',
      first_in_at: { $ne: '' },
    }, '-created_date', 1000);
    const records = found?.items || found || [];

    const applied: any[] = [];
    const skipped: any[] = [];
    const nowIso = new Date().toISOString();

    for (const rec of records) {
      const isBlank = (v: any) => !v || String(v).trim() === '';
      const updates: any = {};
      const changedFields: string[] = [];

      // ── First Out (break start) ──
      let firstOut = rec.first_out_at || '';
      if (isBlank(firstOut) && firstOutIso) {
        if (firstOutIso <= rec.first_in_at) {
          skipped.push({ name: rec.employee_name, why: 'First Out time is before the First In' });
          continue;
        }
        firstOut = firstOutIso;
        updates.first_out_at = firstOutIso;
        updates.first_out_by_user_id = userId;
        changedFields.push('first_out_at');
      }

      // ── Second In (return from break) — needs a First Out to follow ──
      if (isBlank(rec.second_in_at) && secondInIso) {
        if (!firstOut) {
          skipped.push({ name: rec.employee_name, why: 'No First Out — the Second In cannot be recorded on its own' });
          continue;
        }
        if (secondInIso <= firstOut) {
          skipped.push({ name: rec.employee_name, why: 'Second In time is before the First Out' });
          continue;
        }
        if (rec.final_out_at && secondInIso >= rec.final_out_at) {
          skipped.push({ name: rec.employee_name, why: 'Second In time is after the Final Out' });
          continue;
        }
        updates.second_in_at = secondInIso;
        updates.second_in_by_user_id = userId;
        changedFields.push('second_in_at');
      }

      if (!changedFields.length) continue;

      const merged = { ...rec, ...updates };
      const shift = shifts.find((s: any) => s.id === rec.shift_id) || null;
      // Same centralised status calculation the punch engine uses, so the stored
      // status can never disagree with Time Entries.
      const status = calculateAttendanceStatus(merged, shift, settings, [], new Date());

      applied.push({
        record: rec,
        changedFields,
        updates: {
          ...updates,
          duration_minutes: calculateDurationFromRecord(merged),
          calculated_status: status,
          attendance_status: rec.manual_status_override ? rec.manual_status_override : status,
          manual_reason: reason,
          last_edited_by_user_id: userId,
          last_edited_by_name: name,
          last_edited_at: nowIso,
        },
      });
    }

    if (dryRun) {
      return Response.json({
        action: 'dry-run',
        attendanceDate,
        firstOutIso,
        secondInIso,
        candidates: applied.length,
        skipped,
        sample: applied.slice(0, 10).map(a => ({
          name: a.record.employee_name,
          fills: a.changedFields,
          firstIn: a.record.first_in_at,
          newFirstOut: a.updates.first_out_at || '(kept)',
          newSecondIn: a.updates.second_in_at || '(kept)',
          newStatus: a.updates.attendance_status,
        })),
      });
    }

    if (!applied.length) {
      return Response.json({ action: 'nothing-to-do', attendanceDate, updated: 0, skipped });
    }

    // One audit entry per punch that was filled in.
    const corrections = applied.flatMap(a => a.changedFields.map(field => ({
      attendance_id: a.record.id,
      personnel_id: a.record.personnel_id,
      employee_name: a.record.employee_name,
      field_changed: field,
      original_value: '',
      new_value: field === 'first_out_at' ? firstOutIso : secondInIso,
      reason,
      changed_by: email,
      changed_by_name: name,
    })));
    const logs = applied.map(a => ({
      action: 'update',
      entity_name: 'AttendanceRecord',
      entity_id: a.record.id,
      performed_by: email,
      record_name: a.record.employee_name,
      record_snapshot: {
        ...a.changedFields.reduce((acc, f) => ({ ...acc, [f]: a.updates[f] }), {}),
        attendance_status: a.updates.attendance_status,
        backfilled_break_punch: true,
        reason,
      },
      changed_fields: [...a.changedFields, 'attendance_status'],
    }));

    // Writes are batched: one update call, then both audit trails in bulk.
    await base44.asServiceRole.entities.AttendanceRecord.bulkUpdate(
      applied.map(a => ({ id: a.record.id, ...a.updates }))
    );
    await base44.asServiceRole.entities.AttendanceCorrection.bulkCreate(corrections);
    await base44.asServiceRole.entities.ActivityLog.bulkCreate(logs);

    return Response.json({
      action: 'backfilled',
      attendanceDate,
      firstOutIso,
      secondInIso,
      updated: applied.length,
      punchesWritten: corrections.length,
      byFill: {
        first_out: applied.filter(a => a.changedFields.includes('first_out_at')).length,
        second_in: applied.filter(a => a.changedFields.includes('second_in_at')).length,
      },
      skipped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});