/**
 * Personnel Status — the single source of truth for a personnel record's
 * lifecycle status.
 *
 * There is exactly ONE place a status lives: the Employee.personnel_status
 * field. Everything reads from it — Add / Edit Personnel, the Master List
 * tabs & filters, the Inactive / Demobilized page, reports and the workforce
 * pages — so a person can never be "Active on Site" on one page and
 * "Onboarding" on another.
 *
 *   Active on Site  → mobilized, actively working on the project/site.
 *   Onboarding      → registered, still completing requirements (Medical,
 *                     Gate Pass, Training, Project ID, …). Never auto-promoted.
 *   Inactive        → not currently active / not on site.
 *   Demobilized     → demobilized from the project.
 *
 * Personnel status is completely separate from Daily Attendance status:
 * an "Active on Site" person can still be Present / Absent / First In
 * Completed / etc. on any given day.
 */

export const ACTIVE_ON_SITE = 'Active on Site';
export const ONBOARDING = 'Onboarding';
export const INACTIVE = 'Inactive';
export const DEMOBILIZED = 'Demobilized';

/** The four selectable statuses, in display order. */
export const PERSONNEL_STATUSES = [ACTIVE_ON_SITE, ONBOARDING, INACTIVE, DEMOBILIZED];

/**
 * Statuses that stay on the working roster. A record with one of these keeps
 * Employee.is_active = true and therefore stays in the Master List;
 * Inactive / Demobilized set is_active = false and live on their own page.
 */
export const ACTIVE_ROSTER_STATUSES = [ACTIVE_ON_SITE, ONBOARDING];

export const isActiveRosterStatus = (status) => ACTIVE_ROSTER_STATUSES.includes(status);

/** Per-status presentation used by the status buttons, badge and modal. */
export const PERSONNEL_STATUS_CONFIG = {
  [ACTIVE_ON_SITE]: {
    label: ACTIVE_ON_SITE,
    description: 'Mobilized and actively working on the project/site.',
    selected: 'bg-emerald-600 text-white border-emerald-600',
    idle: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    text: 'text-emerald-600',
    solid: 'bg-emerald-600 hover:bg-emerald-700',
  },
  [ONBOARDING]: {
    label: ONBOARDING,
    description: 'Registered, still completing onboarding requirements (Medical, Gate Pass, Training, Project ID).',
    selected: 'bg-indigo-600 text-white border-indigo-600',
    idle: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100',
    text: 'text-indigo-600',
    solid: 'bg-indigo-600 hover:bg-indigo-700',
  },
  [INACTIVE]: {
    label: INACTIVE,
    description: 'Not currently active / not on site.',
    selected: 'bg-red-600 text-white border-red-600',
    idle: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    text: 'text-red-600',
    solid: 'bg-red-600 hover:bg-red-700',
  },
  [DEMOBILIZED]: {
    label: DEMOBILIZED,
    description: 'Demobilized from the project.',
    selected: 'bg-orange-600 text-white border-orange-600',
    idle: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100',
    text: 'text-orange-600',
    solid: 'bg-orange-600 hover:bg-orange-700',
  },
};

/**
 * Normalises a stored status to the current four-status vocabulary.
 * Legacy 'Active' and blank values map to 'Active on Site' while the record is
 * on the active roster, or to 'Inactive' when it is already flagged
 * is_active = false (so no existing record is ever misread).
 */
export const normalizeStatus = (status, isActiveFlag) => {
  if (!status || status === 'Active') {
    return isActiveFlag === false ? INACTIVE : ACTIVE_ON_SITE;
  }
  return status;
};

/** Resolves any record's personnel status — never returns a blank value. */
export const resolvePersonnelStatus = (emp) => normalizeStatus(emp?.personnel_status, emp?.is_active);