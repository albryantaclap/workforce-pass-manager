import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { checkPermission } from '../../shared/permissionCheck.ts';
import { calculateAttendanceStatus } from '../../shared/attendanceCalc.ts';

// ── Backfill a missing SECOND IN (audited admin correction) ─────────────────
// Fills in the Second In punch for employees who completed the First Out but were
// unable to record the Second In (punch window already closed), so they can still
// punch the Final Out later in the day.
//
// Rules enforced here:
//   • Only a MISSING Second In is written — a record that already has one is never
//     touched, and the First In / First Out / Final Out are never written at all.
//   • A Final Out is never fabricated: those employees still punch it themselves.
//   • The time must fall after the First Out (a wrong order is skipped, not fixed).
//   • Every change is recorded on the record (Last Edited By) and in the
//     AttendanceCorrection + ActivityLog audit trails.
//
// Body: { attendanceDate: 'YYYY-MM-DD', secondInTime: 'HH:mm', reason?, dryRun? }

const QATAR_OFFSET = '+03:00';

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
    const secondInTime = (body.secondInTime || '').trim();
    const dryRun = body.dryRun === true;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(attendanceDate)) {
      return Response.json({ error: 'A valid attendance date (YYYY-MM-DD) is required.' }, { status: 400 });
    }
    if (!/^\d{2}:\d{2}$/.test(secondInTime)) {
      return Response.json({ error: 'A valid time (HH:mm) is required.' }, { status: 400 });
    }

    // Qatar wall-clock time → stored ISO (same timezone the punch engine uses).
    const secondInIso = new Date(`${attendanceDate}T${secondInTime}:00${QATAR_OFFSET}`).toISOString();
    const userId = user?.id || '';
    const email = user?.email || '';
    const name = user?.full_name || '';
    const reason = (body.reason
      || `Second In backfilled to ${secondInTime} — the Second In punch window was already closed when the employee scanned.`).trim();

    const [settingsRows, shiftRows] = await Promise.all([
      base44.asServiceRole.entities.AttendanceSetting.list('-created_date', 100),
      base44.asServiceRole.entities.AttendanceShift.list('-created_date', 1000),
    ]);
    const settings = settingsRows[0] || null;
    const shifts = shiftRows || [];

    // Open sessions for the date that have a First Out but no Second In.
    const found = await base44.asServiceRole.entities.AttendanceRecord.filter({
      attendance_date: attendanceDate,
      is_deleted: { $ne: true },
      status: 'open',
      first_out_at: { $ne: '' },
      $or: [{ second_in_at: { $exists: false } }, { second_in_at: '' }, { second_in_at: null }],
    }, '-created_date', 1000);
    const records = found?.items || found || [];

    const applied: any[] = [];
    const skipped: any[] = [];
    const nowIso = new Date().toISOString();

    for (const rec of records) {
      if (!rec.first_out_at) {
        skipped.push({ name: rec.employee_name, why: 'No First Out recorded' });
        continue;
      }
      if (secondInIso <= rec.first_out_at) {
        skipped.push({ name: rec.employee_name, why: 'Time is before the First Out' });
        continue;
      }
      if (rec.final_out_at && secondInIso >= rec.final_out_at) {
        skipped.push({ name: rec.employee_name, why: 'Time is after the Final Out' });
        continue;
      }

      const shift = shifts.find((s: any) => s.id === rec.shift_id) || null;
      const merged = { ...rec, second_in_at: secondInIso, second_in_by_user_id: userId };
      // Same centralised status calculation the punch engine uses, so the stored
      // status can never disagree with Time Entries.
      const status = calculateAttendanceStatus(merged, shift, settings, [], new Date());

      applied.push({
        record: rec,
        updates: {
          second_in_at: secondInIso,
          second_in_by_user_id: userId,
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
        secondInIso,
        candidates: applied.length,
        skipped,
        sample: applied.slice(0, 10).map(a => ({
          name: a.record.employee_name,
          firstOut: a.record.first_out_at,
          newStatus: a.updates.attendance_status,
        })),
      });
    }

    if (!applied.length) {
      return Response.json({ action: 'nothing-to-do', attendanceDate, updated: 0, skipped });
    }

    const corrections = applied.map(a => ({
      attendance_id: a.record.id,
      personnel_id: a.record.personnel_id,
      employee_name: a.record.employee_name,
      field_changed: 'second_in_at',
      original_value: a.record.second_in_at || '',
      new_value: secondInIso,
      reason,
      changed_by: email,
      changed_by_name: name,
    }));
    const logs = applied.map(a => ({
      action: 'update',
      entity_name: 'AttendanceRecord',
      entity_id: a.record.id,
      performed_by: email,
      record_name: a.record.employee_name,
      record_snapshot: {
        second_in_at: secondInIso,
        second_in_by_user_id: userId,
        attendance_status: a.updates.attendance_status,
        backfilled_second_in: true,
        reason,
      },
      changed_fields: ['second_in_at', 'attendance_status'],
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
      secondInIso,
      updated: applied.length,
      skipped,
      names: applied.map(a => a.record.employee_name),
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});