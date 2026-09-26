/**
 * Workforce Stage — identifies whether personnel is already physically working
 * on the project site or is still undergoing onboarding.
 *
 * This is INDEPENDENT of the personnel lifecycle (personnel_status:
 * Active / Inactive / Demobilized). It is never derived from Medical, Gate Pass,
 * Training, Project ID, Daily Attendance or COMO Camp status.
 *
 * Records that have not been classified yet resolve to "Unassigned" so existing
 * personnel never disappear from the Master List.
 */
export const UNASSIGNED_STAGE = 'Unassigned';

export const ACTIVE_ON_SITE = 'Active on Site';
export const ONBOARDING = 'Onboarding';

// Selectable stages (manual assignment).
export const WORKFORCE_STAGES = [
  { value: ACTIVE_ON_SITE, label: ACTIVE_ON_SITE },
  { value: ONBOARDING, label: ONBOARDING },
];

// Filter options — includes Unassigned so unclassified personnel can be found.
export const WORKFORCE_STAGE_FILTER_OPTIONS = [
  ...WORKFORCE_STAGES,
  { value: UNASSIGNED_STAGE, label: UNASSIGNED_STAGE },
];

/** Resolves a record's Workforce Stage, defaulting to Unassigned. */
export const getWorkforceStage = (emp) => (emp?.workforce_stage || UNASSIGNED_STAGE);