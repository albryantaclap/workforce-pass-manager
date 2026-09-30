/**
 * Daily Attendance eligibility — THE single rule, in one place.
 *
 * The Workforce Master List is the single source of truth for personnel. Daily
 * Attendance keeps no employee table of its own: every list, report, punch and
 * shift assignment is linked to the SAME Employee record by personnel_id, so a
 * person added to the Master List is available to attendance automatically —
 * there is nothing to synchronize or duplicate.
 *
 * Which people are on the attendance roster is decided by their PROJECT status,
 * resolved exactly as the rest of the app resolves it
 * (@/lib/personnelStatus → resolvePersonnelStatus):
 *
 *   Active on Site   → eligible (mobilized, working on the project/site)
 *   Onboarding       → eligible — onboarding personnel are on site completing
 *                      their requirements and their attendance IS recorded
 *                      (their status stays Onboarding; it is never promoted)
 *   unassigned ('')  → eligible — the app never assigns 'Active on Site' by
 *                      itself, so a newly added or imported person must stay
 *                      punchable
 *   legacy 'Active'  → reads as unassigned → eligible
 *   Inactive         → NOT eligible (never punchable)
 *   legacy 'Demobilized' → reads as Inactive → NOT eligible
 *
 * The roster query and the clock's refusal message both read from this module,
 * so a record can never appear on one attendance page and be refused by
 * another, and widening or narrowing eligibility happens in one place only.
 *
 * NOTE: the matching server-side rule for the backend functions lives in
 * base44/shared/attendanceRoster.ts — keep the two in step.
 */
import {
  ACTIVE_ON_SITE, UNASSIGNED, ONBOARDING, INACTIVE, resolvePersonnelStatus,
} from '@/lib/personnelStatus';

/** Legacy personnel_status value — always read as unassigned. */
export const LEGACY_ACTIVE_STATUS = 'Active';

/** Raw personnel_status values that put a record on the attendance roster. */
export const ATTENDANCE_ELIGIBLE_STATUSES = [ACTIVE_ON_SITE, ONBOARDING, UNASSIGNED, LEGACY_ACTIVE_STATUS];

/**
 * The roster query every attendance view uses to read the Master List.
 * `is_active: { $ne: false }` keeps Inactive (and legacy Demobilized) records
 * out without depending on the flag being present on older rows.
 */
export const ATTENDANCE_ROSTER_QUERY = {
  personnel_status: { $in: ATTENDANCE_ELIGIBLE_STATUSES },
  is_active: { $ne: false },
};

/** Whether one Master List record is eligible to be punched. */
export const isAttendanceEligible = (emp) => {
  if (!emp || emp.is_active === false) return false;
  const status = resolvePersonnelStatus(emp);
  return status === ACTIVE_ON_SITE || status === ONBOARDING || status === UNASSIGNED;
};

/**
 * Why a recognised person cannot be punched — empty string when they can.
 * The reason is what the Attendance Clock shows the operator.
 */
export const attendanceBlockReason = (emp) => {
  const status = resolvePersonnelStatus(emp);
  if (emp?.is_active === false || status === INACTIVE) {
    return 'Employee is inactive — attendance cannot be recorded.';
  }
  return '';
};