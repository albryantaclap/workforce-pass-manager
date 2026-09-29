/**
 * Attendance Clock / ID Card Scanner — employee recognition.
 *
 * This module answers ONE question: which workforce record does a scanned card
 * value belong to?  Nothing else.
 *
 *   PID No. (Employee.pid) is the PRIMARY identifier for the scanner workflow.
 *   The internal record id / UUID, shift-assignment ids, attendance ids and QID
 *   are never the first choice — they are only used as a fallback when the PID
 *   lookup genuinely finds nothing.
 *
 * Recognition is deliberately kept apart from attendance eligibility: shift
 * assignment, effective dates, punch windows, split-shift and cross-midnight
 * rules are applied afterwards by the existing attendance engine and are not
 * touched here.
 *
 * Pure functions only (no SDK / network) so the matching rules stay testable.
 */

/** Identifiers a scanned card may resolve against — PID No. first. */
export const SCAN_LOOKUP_FIELDS = ['pid', 'qid_no', 'staff_no', 'pp_no'];

/**
 * Normalise a scanned OR stored identifier so both sides compare identically.
 *
 * - always converted with String() — never Number(), so leading zeros survive
 * - control characters (\r, \n, \t) and hidden zero-width characters removed
 * - every kind of whitespace removed (leading, trailing and inside the value)
 * - separators a card or OCR may print (dashes, dots, colons, slashes) removed
 * - case-insensitive
 *
 * "1021122", " 1021122 ", "1021122\n", "1021122\r\n", "102-1122" and
 * "PID1021122" all normalise to "1021122".
 */
export const normalizeScanId = (value) => {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .replace(/[\s\u00A0\u200B-\u200D\uFEFF]/g, '')
    .replace(/[-_./\\:;,#]/g, '')
    .toUpperCase();
};

/** Every normalised value stored on one employee for one lookup field. */
const fieldValues = (employee, field) => {
  const raw = employee?.[field];
  if (raw === null || raw === undefined) return [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map(normalizeScanId).filter(Boolean);
};

/** Normalised candidate identifiers read off a card, in priority order. */
export const normalizeCandidates = (values) => {
  const seen = new Set();
  (values || []).forEach((value) => {
    const normalised = normalizeScanId(value);
    if (normalised) seen.add(normalised);
  });
  return Array.from(seen);
};

/** Distinct workforce records (two matches on the same record are one match). */
export const uniqueRecords = (rows) => {
  const seen = new Set();
  return (rows || []).filter((row) => {
    const key = row?.id ?? JSON.stringify(row);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Match candidates against records already held in the browser.
 *
 * PID No. is searched first across every candidate, in candidate order, so a
 * cleanly read PID always beats a stray number the OCR picked up elsewhere on
 * the card. The fallback identifiers are only consulted when no record owns the
 * scanned value as its PID No.
 *
 * @returns {{ matches: object[], field: string|null, value: string|null }}
 *          `matches` holds every DISTINCT record that owns the value — more than
 *          one means the identifier is not unique.
 */
export const matchLoadedEmployees = (candidates, employees = []) => {
  const list = Array.isArray(employees) ? employees : [];
  for (const field of SCAN_LOOKUP_FIELDS) {
    for (const candidate of candidates) {
      const matches = uniqueRecords(
        list.filter((employee) => fieldValues(employee, field).includes(candidate))
      );
      if (matches.length) return { matches, field, value: candidate };
    }
  }
  return { matches: [], field: null, value: null };
};

/**
 * Exact-match probes to run against the database when the browser copy misses.
 * One probe per candidate and field, candidate order preserved.
 */
export const buildLookupProbes = (candidates) =>
  SCAN_LOOKUP_FIELDS.flatMap((field) =>
    candidates.map((value) => ({ field, value }))
  );