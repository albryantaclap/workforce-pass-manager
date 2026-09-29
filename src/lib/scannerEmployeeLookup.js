/**
 * Attendance Clock / ID Card Scanner — authoritative employee lookup.
 *
 * The scanner may hold a cached copy of the workforce, but recognition must
 * never depend on it: pagination, filtering, caching or a query still in flight
 * must never turn a valid card into "Not Recognized". When the local copy does
 * not resolve the card, this module queries the database by exact identifier —
 * PID No. first — instead of loading the workforce into the browser.
 */
import { base44 } from '@/api/base44Client';
import {
  buildLookupProbes, matchLoadedEmployees, normalizeCandidates, uniqueRecords,
} from '@/lib/scannerRecognition';

// Bounded number of parallel exact-match queries per field — the workforce can
// grow freely without the scanner slowing down.
const PROBE_LIMIT = 6;
const PROBE_ROWS = 20;

const queryByIdentifier = async (field, value) => {
  try {
    const rows = await base44.entities.Employee.filter(
      { [field]: value },
      undefined,
      PROBE_ROWS
    );
    return rows || [];
  } catch {
    // A single failed probe must not abort recognition — the remaining
    // identifiers and candidates are still tried.
    return [];
  }
};

/**
 * Resolve a scanned card to ONE workforce record.
 *
 * Flow: normalise → cached copy (PID first) → fresh database lookup (PID first)
 * → fallback identifiers. Never guesses: when an identifier is held by more than
 * one personnel record the result is reported as ambiguous so the caller can
 * refuse to punch.
 *
 * @param {string[]} scannedValues  raw identifiers read off the card
 * @param {object[]} cachedEmployees records already held in the browser
 * @returns {Promise<{
 *   employee: object|null, field: string|null, value: string|null,
 *   duplicateIds: string[], candidateIds: string[], cached: boolean
 * }>}
 */
export async function resolveEmployeeFromScan(scannedValues, cachedEmployees = []) {
  const candidateIds = normalizeCandidates(scannedValues);
  const empty = {
    employee: null, field: null, value: null,
    duplicateIds: [], candidateIds, cached: false,
  };
  if (candidateIds.length === 0) return empty;

  // 1. Fast path — records already in the browser.
  const local = matchLoadedEmployees(candidateIds, cachedEmployees);
  if (local.matches.length) {
    return {
      employee: local.matches.length === 1 ? local.matches[0] : null,
      field: local.field,
      value: local.value,
      duplicateIds: local.matches.map((m) => m.id),
      candidateIds,
      cached: true,
    };
  }

  // 2. Authoritative database lookup, PID No. first, candidate order preserved.
  const probes = buildLookupProbes(candidateIds.slice(0, PROBE_LIMIT));
  const results = await Promise.all(
    probes.map(async ({ field, value }) => ({
      field,
      value,
      rows: await queryByIdentifier(field, value),
    }))
  );

  for (const { field, value, rows } of results) {
    const matches = uniqueRecords(rows);
    if (matches.length) {
      return {
        employee: matches.length === 1 ? matches[0] : null,
        field,
        value,
        duplicateIds: matches.map((m) => m.id),
        candidateIds,
        cached: false,
      };
    }
  }

  return empty;
}