/**
 * COMO Camp Check-out → automatic Demobilization.
 *
 * When a personnel is successfully Camp Checked-out, the EXISTING centralized
 * personnel record (Employee) is updated to Demobilized so they immediately
 * appear under Inactive / Demobilized → Demobilized.
 *
 * Guarantees:
 *  - Never creates a duplicate personnel record — updates the current one only.
 *  - Idempotent: if the person is already Demobilized, nothing happens.
 *  - Camp stay history (check-in / check-out timestamps) lives on ComoCampStay
 *    and is never touched or deleted here.
 *  - The personnel's Location (current_location) is preserved.
 *  - Any existing demobilization remarks/reason is preserved.
 *
 * COMO Camp check-in / check-out is accommodation movement only — this function
 * NEVER creates, modifies or deletes Daily Attendance (AttendanceRecord) data.
 */
import { base44 } from '@/api/base44Client';

export async function demobilizeAfterCampCheckout({ emp, checkOutAt, user }) {
  if (!emp?.id) return null;
  // Already demobilized — do not create another Demobilized entry.
  if (emp.personnel_status === 'Demobilized') return null;

  const outDate = checkOutAt
    ? new Date(checkOutAt).toLocaleDateString('en-CA')
    : new Date().toLocaleDateString('en-CA');

  const existingReason = (emp.status_reason || '').trim();
  const nowIso = new Date().toISOString();

  return base44.entities.Employee.update(emp.id, {
    personnel_status: 'Demobilized',
    is_active: false,
    demobilization_date: outDate,
    status_effective_date: outDate,
    // Preserve any existing demobilization remarks/reason.
    status_reason: existingReason || 'Camp Check-out',
    status_changed_by: user?.email || '',
    status_changed_at: nowIso,
    _last_updated_by: user?.email || '',
    _last_updated_by_name: user?.full_name || '',
    _last_updated_by_role: user?.role || '',
    _last_updated_at: nowIso,
  });
}