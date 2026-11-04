/**
 * Complete retrieval helpers for attendance reporting.
 *
 * Why this module exists: a single `filter(query, limit)` call stops at the
 * backend row cap without telling anyone, so a report built from it can silently
 * miss the oldest rows (or any row past the cap). Every read below walks the
 * server cursor until the backend says there is nothing left and reports whether
 * the walk really completed, so callers never publish numbers that might be short.
 */

const PAGE = 1000;

async function paginate(entity: any, query: any, sort: string): Promise<{ items: any[]; complete: boolean }> {
  const out: any[] = [];
  const seen = new Set<string>();
  let cursor = "";
  let complete = false;

  for (;;) {
    const options: any = { sort: sort, limit: PAGE };
    if (cursor) options.cursor = cursor;
    const res: any = await entity.filter(query, options);

    // Older call shapes return a plain array; treat that as a complete answer.
    if (Array.isArray(res)) {
      for (const row of res) { if (!seen.has(row.id)) { seen.add(row.id); out.push(row); } }
      complete = true;
      break;
    }

    const items: any[] = res && res.items ? res.items : [];
    for (const row of items) { if (!seen.has(row.id)) { seen.add(row.id); out.push(row); } }

    if (!res || !res.has_more) { complete = true; break; }
    if (!res.next_cursor || res.next_cursor === cursor) break;
    cursor = res.next_cursor;
  }

  return { items: out, complete: complete };
}

/**
 * Every non-deleted attendance record inside a date range, for ALL personnel —
 * not only the people currently on the attendance roster. Someone who has since
 * left the project still has valid work history, and a report that quietly drops
 * it makes the numbers wrong.
 */
export async function fetchAttendanceRecordsInRange(base44: any, dateFrom: string, dateTo: string) {
  const query: any = { is_deleted: { $ne: true } };
  if (dateFrom || dateTo) {
    const range: any = {};
    if (dateFrom) range.$gte = dateFrom;
    if (dateTo) range.$lte = dateTo;
    query.attendance_date = range;
  }
  const result = await paginate(base44.entities.AttendanceRecord, query, "-attendance_date");
  return { records: result.items, complete: result.complete, retrieved: result.items.length };
}

/**
 * Resolves the personnel a set of records points at, whatever their current
 * status, so names and companies stay attached to historical attendance.
 */
export async function fetchEmployeesByIds(base44: any, ids: string[]) {
  const map = new Map<string, any>();
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const id of ids) { if (id && !seen.has(id)) { seen.add(id); unique.push(id); } }

  let index = 0;
  for (;;) {
    if (unique.length === index) break;
    const chunk = unique.slice(index, index + 150);
    index = index + 150;
    const result = await paginate(base44.entities.Employee, { id: { $in: chunk } }, "name");
    for (const emp of result.items) map.set(emp.id, emp);
  }
  return map;
}

/** The whole shift-assignment table, without a silent row cap. */
export async function loadShiftAssignments(base44: any) {
  const result = await paginate(base44.entities.AttendanceShiftAssignment, {}, "-created_date");
  return result.items;
}

/**
 * Data-quality facts that must never be hidden from whoever reads a report:
 * the same person holding two sessions on one day (counted twice), or attendance
 * whose personnel record can no longer be resolved.
 */
export function attendanceIntegrity(records: any[], empMap: Map<string, any>) {
  const ELIGIBLE = ["Active on Site", "Onboarding", "", "Active"];
  const seen = new Set<string>();
  const duplicateSamples: any[] = [];
  const unresolvedSamples: any[] = [];
  let duplicateDayRows = 0;
  let unresolvedPersonnel = 0;
  let notOnActiveRoster = 0;

  for (const r of records) {
    const key = r.attendance_date + "|" + r.personnel_id;
    if (seen.has(key)) {
      duplicateDayRows = duplicateDayRows + 1;
      duplicateSamples.push({ id: r.id, personnel_id: r.personnel_id, name: r.employee_name, date: r.attendance_date });
    } else {
      seen.add(key);
    }

    const emp = empMap.get(r.personnel_id);
    if (!emp) {
      unresolvedPersonnel = unresolvedPersonnel + 1;
      unresolvedSamples.push({ id: r.id, personnel_id: r.personnel_id, name: r.employee_name, date: r.attendance_date });
    } else if (!(ELIGIBLE.indexOf(emp.personnel_status) >= 0 && emp.is_active !== false)) {
      notOnActiveRoster = notOnActiveRoster + 1;
    }
  }

  return {
    records_in_range: records.length,
    duplicate_day_rows: duplicateDayRows,
    duplicate_samples: duplicateSamples.slice(0, 5),
    unresolved_personnel: unresolvedPersonnel,
    unresolved_samples: unresolvedSamples.slice(0, 5),
    not_on_active_roster: notOnActiveRoster,
  };
}