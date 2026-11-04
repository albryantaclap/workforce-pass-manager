/**
 * Short-lived cache for reference data on the attendance punch path.
 *
 * Every punch re-reads the same reference tables (Attendance Settings, shifts).
 * Those change only when an admin edits them, but each read spends part of the
 * per-caller read budget that a clock-in rush needs for the punches themselves
 * (list/filter is rate limited to ~70 calls a minute per caller). Keeping a
 * reference value for REF_TTL_MS removes those repeated reads without changing
 * any punch rule: the cached value is the same record the punch would have read.
 *
 * Punches, sessions and personnel records are NEVER cached — only the reference
 * tables an admin controls, which never change mid-shift.
 */
export const REF_TTL_MS = 60 * 1000;

const entries = new Map();

/**
 * Return the cached value for `key`, loading it when it is missing or older than
 * `ttlMs`. Concurrent callers share one in-flight load, so ten simultaneous
 * scans still cause one read.
 */
export function cachedRef(key, loader, ttlMs = REF_TTL_MS) {
  const now = Date.now();
  const hit = entries.get(key);
  if (hit) {
    if (hit.pending) return hit.pending;
    if (now - hit.at < ttlMs) return Promise.resolve(hit.value);
  }

  const pending = Promise.resolve()
    .then(loader)
    .then((value) => {
      entries.set(key, { at: Date.now(), value, pending: null });
      return value;
    })
    .catch((error) => {
      // A failed read is never cached — the next punch retries it.
      entries.delete(key);
      throw error;
    });

  entries.set(key, { at: hit?.at || 0, value: hit?.value, pending });
  return pending;
}

/** Drop a cached reference value (no key = drop everything). */
export function clearCachedRef(key) {
  if (key) entries.delete(key);
  else entries.clear();
}