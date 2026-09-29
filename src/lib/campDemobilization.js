/**
 * COMO Camp movement → personnel record updates.
 *
 * Camp movement (accommodation) and personnel status (project relationship) are
 * two separate things, so this module keeps them apart:
 *
 *  - recordCampMovement() → CAMP ONLY. A normal camp check-in / camp check-out
 *    never changes the personnel status (Scenario A: the person is only leaving
 *    the accommodation and remains Active on Site / Onboarding).
 *
 *  - demobilizeFromCamp() → Scenario B. The person is leaving the project AND
 *    the camp: personnel status becomes Inactive and the camp status becomes
 *    Demobilized. The person stays in the Inactive list and ALSO appears under
 *    Demobilized — it is never moved out of Inactive.
 *
 * Guarantees:
 *  - Never creates a duplicate personnel record — it updates the current one.
 *  - Camp stay history (ComoCampStay) is never modified or deleted here.
 *  - Historical dates already recorded are not overwritten.
 *  - NEVER touches Daily Attendance (AttendanceRecord).
 */
import { base44 } from '@/api/base44Client';
import { CAMP_STATUS } from '@/lib/campStatus';
import { INACTIVE, resolvePersonnelStatus } from '@/lib/personnelStatus';

const toDateOnly = (value) =>
  value ? new Date(value).toLocaleDateString('en-CA') : new Date().toLocaleDateString('en-CA');

const auditMeta = (user) => {
  const nowIso = new Date().toISOString();
  return {
    _last_updated_by: user?.email || '',
    _last_updated_by_name: user?.full_name || '',
    _last_updated_by_role: user?.role || '',
    _last_updated_at: nowIso,
  };
};

/** Camp accommodation only — personnel status is left untouched. */
export async function recordCampMovement({ emp, status, checkInAt, checkOutAt, user }) {
  if (!emp?.id) return null;
  const updates = { camp_status: status };
  if (checkInAt !== undefined) updates.camp_check_in_at = checkInAt;
  if (checkOutAt !== undefined) updates.camp_check_out_at = checkOutAt;
  if (status === CAMP_STATUS.DEMOBILIZED) updates.demobilized_at = toDateOnly(checkOutAt);
  return base44.entities.Employee.update(emp.id, { ...updates, ...auditMeta(user) });
}

/**
 * Demobilization (project exit + camp departure).
 * personnel_status → Inactive, camp_status → Demobilized, camp check-out and
 * demobilization date/reason recorded. Existing history is preserved.
 */
export async function demobilizeFromCamp({ emp, checkOutAt, reason, user }) {
  if (!emp?.id) return null;
  const outDate = toDateOnly(checkOutAt);
  const wasInactive = resolvePersonnelStatus(emp) === INACTIVE;
  const nowIso = new Date().toISOString();

  return base44.entities.Employee.update(emp.id, {
    personnel_status: INACTIVE,
    is_active: false,
    camp_status: CAMP_STATUS.DEMOBILIZED,
    camp_check_out_at: checkOutAt || emp.camp_check_out_at || '',
    demobilized_at: outDate,
    demobilization_date: outDate,
    demobilization_reason: reason || emp.demobilization_reason || '',
    // The first day of inactivity is kept: a person who was already Inactive
    // keeps their original inactive date.
    inactive_date: emp.inactive_date || outDate,
    inactive_reason: emp.inactive_reason || reason || '',
    status_reason: reason || emp.status_reason || '',
    status_effective_date: wasInactive ? (emp.status_effective_date || outDate) : outDate,
    status_changed_by: user?.email || '',
    status_changed_at: nowIso,
    ...auditMeta(user),
  });
}