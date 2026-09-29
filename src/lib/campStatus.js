/**
 * COMO Camp / accommodation status — the camp half of a personnel record.
 *
 * A personnel record carries TWO independent status fields:
 *
 *   personnel_status  → project / employment relationship
 *                       Active on Site · Onboarding · Inactive
 *   camp_status       → COMO Camp accommodation position
 *                       NOT_CHECKED_IN · INSIDE_CAMP · CHECKED_OUT · DEMOBILIZED
 *
 * 'Demobilized' is therefore NOT a personnel status. It is the CAMP status of an
 * INACTIVE person who was checked out of COMO Camp as part of demobilization.
 *
 * Therefore:
 *   Demobilized ⊆ Inactive
 *   every demobilized person is Inactive,
 *   but not every Inactive person is demobilized.
 *
 * A person who is Inactive + Demobilized stays in the Inactive list AND appears
 * in the Demobilized list — the record is never moved out of Inactive.
 *
 * Camp status is completely separate from work attendance (AttendanceRecord):
 * moving in or out of camp never creates or changes attendance.
 */
import { resolvePersonnelStatus, INACTIVE } from '@/lib/personnelStatus';

export const CAMP_STATUS = {
  NOT_CHECKED_IN: 'NOT_CHECKED_IN',
  INSIDE_CAMP: 'INSIDE_CAMP',
  CHECKED_OUT: 'CHECKED_OUT',
  DEMOBILIZED: 'DEMOBILIZED',
};

/** A camp stay is open when it was checked in and not yet checked out. */
export const isStayOpen = (stay) => !!(stay?.check_in_at && !stay?.check_out_at);

/**
 * True when this person was demobilized from COMO Camp.
 * Legacy records kept 'Demobilized' in personnel_status — they read as
 * demobilized too (and are migrated to Inactive + camp status Demobilized).
 */
export const isDemobilized = (emp) =>
  emp?.camp_status === CAMP_STATUS.DEMOBILIZED || emp?.personnel_status === 'Demobilized';

/**
 * Resolves a record's current camp status.
 * A demobilization always wins over an older open camp stay, so a demobilized
 * person can never read as "still inside camp".
 */
export const resolveCampStatus = (emp, latestStay) => {
  if (isDemobilized(emp)) return CAMP_STATUS.DEMOBILIZED;
  if (isStayOpen(latestStay)) return CAMP_STATUS.INSIDE_CAMP;
  if (latestStay?.check_out_at) return CAMP_STATUS.CHECKED_OUT;
  const stored = emp?.camp_status;
  return stored && stored !== CAMP_STATUS.DEMOBILIZED ? stored : CAMP_STATUS.NOT_CHECKED_IN;
};

/** Inactive personnel currently accommodated in COMO Camp. */
export const isInsideCamp = (emp, latestStay) =>
  resolveCampStatus(emp, latestStay) === CAMP_STATUS.INSIDE_CAMP;

/** Inactive AND demobilized — the Demobilized list. */
export const isDemobilizedInactive = (emp) =>
  resolvePersonnelStatus(emp) === INACTIVE && isDemobilized(emp);

export const CAMP_STATUS_CONFIG = {
  [CAMP_STATUS.NOT_CHECKED_IN]: {
    label: 'Not Checked In',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  [CAMP_STATUS.INSIDE_CAMP]: {
    label: 'Inside Camp',
    badge: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  [CAMP_STATUS.CHECKED_OUT]: {
    label: 'Checked Out',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
  },
  [CAMP_STATUS.DEMOBILIZED]: {
    label: 'Demobilized',
    badge: 'bg-orange-50 text-orange-700 border-orange-200',
  },
};

export const campStatusLabel = (status) =>
  CAMP_STATUS_CONFIG[status]?.label || CAMP_STATUS_CONFIG[CAMP_STATUS.NOT_CHECKED_IN].label;