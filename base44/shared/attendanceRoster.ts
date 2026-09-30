/**
 * Daily Attendance roster — the server-side half of THE single eligibility rule.
 *
 * The Workforce Master List (Employee) is the single source of truth for
 * personnel; attendance functions read it directly and link every row back to
 * the same Employee record by personnel_id, so no separate attendance employee
 * table exists and nothing has to be copied or synchronized.
 *
 * Eligible PROJECT statuses (raw stored values):
 *   "Active on Site"  mobilized, working on the project/site
 *   "Onboarding"      on site completing requirements — attendance is recorded
 *                     while the status itself stays Onboarding
 *   ""                no status set yet — the app never assigns
 *                     "Active on Site" by itself, so newly added or imported
 *                     personnel must stay on the roster
 *   "Active"          legacy value, always read as unassigned
 *
 * Inactive (and the legacy "Demobilized") are never eligible. The clock's
 * refusal message is the user-facing half of this rule.
 *
 * Keep in step with the frontend rule: src/lib/attendanceEligibility.js
 */
export const LEGACY_ACTIVE_STATUS = "Active";

export const ATTENDANCE_ELIGIBLE_STATUSES = ["Active on Site", "Onboarding", "", LEGACY_ACTIVE_STATUS];

export const ATTENDANCE_ROSTER_QUERY = {
  personnel_status: { $in: ATTENDANCE_ELIGIBLE_STATUSES },
  is_active: { $ne: false },
};