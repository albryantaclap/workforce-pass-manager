import { base44 } from '@/api/base44Client';
import { calcDuration } from './attendanceUtils';

// Shared attendance session save logic used by the Personnel Form and COMO Camp.
// Creates a new session or corrects the existing latest session, preserving full
// history. Enforces the one-open-session rule. Returns { action, record }.
//
// Decision tree:
//   - No existing session + check-in entered  → CREATE new session
//   - Existing OPEN session + values changed  → CORRECT (reason required)
//   - Existing COMPLETED session + check-in changed → CREATE new session (preserve old)
//   - Existing COMPLETED session + only check-out changed → CORRECT (reason required)
export async function saveAttendanceSession({
  personnelId, employeeName, company, workLocation,
  existingRecord, // latest session or null
  checkInAt, // Date object or null
  checkOutAt, // Date object or null
  reason, // string (required for corrections)
  currentUser,
  sourcePage = 'Personnel Form',
}) {
  const email = currentUser?.email || '';
  const name = currentUser?.full_name || '';

  // ── No existing session → CREATE ──
  if (!existingRecord) {
    if (!checkInAt) return { action: 'none' };
    const attDate = checkInAt.toLocaleDateString('en-CA');
    const existing = await base44.entities.AttendanceRecord.filter(
      { personnel_id: personnelId, attendance_date: attDate }, undefined, 1000
    );
    const openSession = existing.find(r => r.check_in_at && !r.check_out_at);
    if (openSession) throw new Error('An open check-in session already exists for this date. Check out first before starting a new session.');

    const completed = !!checkOutAt;
    const outIso = completed ? checkOutAt.toISOString() : '';
    const duration = completed ? calcDuration(checkInAt.toISOString(), outIso) : 0;
    const rec = await base44.entities.AttendanceRecord.create({
      personnel_id: personnelId, employee_name: employeeName, company,
      attendance_date: attDate, check_in_at: checkInAt.toISOString(), check_out_at: outIso,
      first_in_at: checkInAt.toISOString(), final_out_at: outIso, first_out_at: '', second_in_at: '',
      duration_minutes: duration, work_location: workLocation || 'COMO CAMP',
      checked_in_by: email, checked_in_by_name: name,
      checked_out_by: completed ? email : '', checked_out_by_name: completed ? name : '',
      status: completed ? 'completed' : 'open', source_page: sourcePage,
    });
    await base44.entities.ActivityLog.create({
      action: 'create', entity_name: 'AttendanceRecord', entity_id: rec.id,
      performed_by: email, record_name: employeeName,
      record_snapshot: { attendance_date: attDate, check_in_at: rec.check_in_at, check_out_at: outIso, duration_minutes: duration, source: sourcePage },
      changed_fields: completed ? ['check_in_at', 'check_out_at'] : ['check_in_at'],
    });
    return { action: 'created', record: rec };
  }

  // ── Existing session — determine correction vs new session ──
  const existingIsCompleted = !!(existingRecord.check_in_at && existingRecord.check_out_at);
  const inChanged = existingRecord.check_in_at && checkInAt && checkInAt.toISOString() !== existingRecord.check_in_at;
  const outChanged = existingRecord.check_out_at ? (!!checkOutAt && checkOutAt.toISOString() !== existingRecord.check_out_at) : !!checkOutAt;
  const outCleared = existingRecord.check_out_at && !checkOutAt;
  const anyChange = inChanged || outChanged || outCleared;

  if (!anyChange) return { action: 'none' };

  // Completed session + check-in changed → CREATE new (preserve old)
  if (existingIsCompleted && inChanged) {
    if (!checkInAt) throw new Error('Check-in date and time are required.');
    const attDate = checkInAt.toLocaleDateString('en-CA');
    const existing = await base44.entities.AttendanceRecord.filter(
      { personnel_id: personnelId, attendance_date: attDate }, undefined, 1000
    );
    const openSession = existing.find(r => r.check_in_at && !r.check_out_at);
    if (openSession) throw new Error('An open check-in session already exists for this date. Check out first before starting a new session.');

    const completed = !!checkOutAt;
    const outIso = completed ? checkOutAt.toISOString() : '';
    const duration = completed ? calcDuration(checkInAt.toISOString(), outIso) : 0;
    const rec = await base44.entities.AttendanceRecord.create({
      personnel_id: personnelId, employee_name: employeeName, company,
      attendance_date: attDate, check_in_at: checkInAt.toISOString(), check_out_at: outIso,
      first_in_at: checkInAt.toISOString(), final_out_at: outIso, first_out_at: '', second_in_at: '',
      duration_minutes: duration, work_location: workLocation || 'COMO CAMP',
      checked_in_by: email, checked_in_by_name: name,
      checked_out_by: completed ? email : '', checked_out_by_name: completed ? name : '',
      status: completed ? 'completed' : 'open', source_page: sourcePage,
    });
    await base44.entities.ActivityLog.create({
      action: 'create', entity_name: 'AttendanceRecord', entity_id: rec.id,
      performed_by: email, record_name: employeeName,
      record_snapshot: { attendance_date: attDate, check_in_at: rec.check_in_at, check_out_at: outIso, duration_minutes: duration, source: sourcePage, action_type: 'New session (previous completed)' },
      changed_fields: completed ? ['check_in_at', 'check_out_at'] : ['check_in_at'],
    });
    return { action: 'created', record: rec };
  }

  // ── Otherwise → CORRECT the existing session (reason required) ──
  if (!reason || !reason.trim()) {
    throw new Error('A correction reason is required when modifying existing attendance.');
  }

  const finalIn = checkInAt ? checkInAt.toISOString() : existingRecord.check_in_at;
  const finalOut = checkOutAt ? checkOutAt.toISOString() : '';
  const updates = {};
  if (inChanged) { updates.check_in_at = finalIn; updates.first_in_at = finalIn; }
  if (outChanged) { updates.check_out_at = finalOut; updates.final_out_at = finalOut; }
  if (outCleared) { updates.check_out_at = ''; updates.final_out_at = ''; }
  updates.duration_minutes = (finalIn && finalOut) ? calcDuration(finalIn, finalOut) : 0;
  updates.status = finalOut ? 'completed' : 'open';
  if (outChanged || outCleared) {
    updates.checked_out_by = finalOut ? email : '';
    updates.checked_out_by_name = finalOut ? name : '';
  }

  await base44.entities.AttendanceRecord.update(existingRecord.id, updates);

  if (inChanged) await base44.entities.AttendanceCorrection.create({
    attendance_id: existingRecord.id, personnel_id: existingRecord.personnel_id,
    employee_name: existingRecord.employee_name,
    field_changed: 'check_in_at', original_value: existingRecord.check_in_at,
    new_value: finalIn, reason: reason.trim(), changed_by: email, changed_by_name: name,
  });
  if (outChanged) await base44.entities.AttendanceCorrection.create({
    attendance_id: existingRecord.id, personnel_id: existingRecord.personnel_id,
    employee_name: existingRecord.employee_name,
    field_changed: 'check_out_at', original_value: existingRecord.check_out_at,
    new_value: finalOut, reason: reason.trim(), changed_by: email, changed_by_name: name,
  });
  if (outCleared) await base44.entities.AttendanceCorrection.create({
    attendance_id: existingRecord.id, personnel_id: existingRecord.personnel_id,
    employee_name: existingRecord.employee_name,
    field_changed: 'check_out_at', original_value: existingRecord.check_out_at,
    new_value: '', reason: reason.trim(), changed_by: email, changed_by_name: name,
  });

  await base44.entities.ActivityLog.create({
    action: 'update', entity_name: 'AttendanceRecord', entity_id: existingRecord.id,
    performed_by: email, record_name: existingRecord.employee_name,
    record_snapshot: { ...updates, correction: true, source: sourcePage, previous_check_in: existingRecord.check_in_at, previous_check_out: existingRecord.check_out_at, previous_duration: existingRecord.duration_minutes, reason: reason.trim() },
    changed_fields: Object.keys(updates).filter(k => k !== 'duration_minutes' && k !== 'status'),
  });

  return { action: 'corrected', record: existingRecord };
}