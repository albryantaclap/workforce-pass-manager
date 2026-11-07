import { base44 } from '@/api/base44Client';

/**
 * Full-dataset readers for the attendance module.
 *
 * A single `filter(query, sort, 100000)` call is served in ONE server page and is
 * silently capped (5,000 rows on this app). Sorted newest-first, that page holds
 * only the most recent records — every older month simply is not in the result,
 * which is why a report could show September while an export built from the same
 * table could not. These readers page with the server cursor until the whole
 * matching set has been retrieved, so no report or export is truncated.
 *
 * De-duplicated by record id, so a row that reappears across pages (a record
 * created while paging) can never be counted twice.
 */

const PAGE_SIZE = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A read refused because the app's shared read budget was momentarily spent
// (usually a punch rush at the scanner). Waiting briefly and asking again
// returns the records instead of a short dataset.
const isRateLimit = (err) => /rate limit|too many requests|\b429\b/i.test(
  String(err?.message || err?.error || err || '')
);

export async function readWithRetry(run, attempts = 3, delayMs = 4000) {
  let last = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await run();
    } catch (err) {
      last = err;
      if (!isRateLimit(err) || i === attempts - 1) throw err;
      await sleep(delayMs * (i + 1));
    }
  }
  throw last;
}

async function readAll(entityName, query, sort) {
  const out = [];
  const seen = new Set();
  let cursor = '';
  for (;;) {
    const options = { sort, limit: PAGE_SIZE };
    if (cursor) options.cursor = cursor;
    const res = await readWithRetry(() => base44.entities[entityName].filter(query, options));
    if (Array.isArray(res)) {
      // Server answered without pages — the whole result is already here.
      res.forEach((row) => { if (!seen.has(row.id)) { seen.add(row.id); out.push(row); } });
      break;
    }
    (res.items || []).forEach((row) => { if (!seen.has(row.id)) { seen.add(row.id); out.push(row); } });
    if (!res.has_more || !res.next_cursor || res.next_cursor === cursor) break;
    cursor = res.next_cursor;
  }
  return out;
}

/** Every attendance record in the range — omit both dates for the full history. */
export const readAllAttendanceRecords = ({ from, to } = {}) => {
  const query = { is_deleted: { $ne: true } };
  if (from || to) {
    const range = {};
    if (from) range.$gte = from;
    if (to) range.$lte = to;
    query.attendance_date = range;
  }
  return readAll('AttendanceRecord', query, '-attendance_date');
};

/** Every Master List record matching the query (the roster is over the page cap). */
export const readAllEmployees = (query = {}) => readAll('Employee', query, 'name');