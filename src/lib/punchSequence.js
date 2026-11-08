// Automatic cross-midnight resolution for the attendance punch slots.
// The Admin types clock times only: every punch is placed on the attendance
// date and rolls forward to the next calendar day whenever its clock time is
// earlier than the punch before it (a night / split shift passing midnight).

export const PUNCH_SLOTS = [
  { key: 'first_in', label: 'FIRST IN' },
  { key: 'first_out', label: 'FIRST OUT' },
  { key: 'second_in', label: 'SECOND IN' },
  { key: 'final_out', label: 'FINAL OUT' },
];

const pad = (n) => String(n).padStart(2, '0');

export const parseAnchorDate = (dateStr) => {
  if (!dateStr) return null;
  const [y, m, d] = String(dateStr).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};

// times: { first_in: 'HH:mm', first_out: 'HH:mm', … }
// → { iso: { first_in: ISO, … }, offsets: { first_in: 0 | 1, … } }
export const resolvePunchPlan = (anchorDate, times = {}) => {
  const anchor = parseAnchorDate(anchorDate);
  const iso = {};
  const offsets = {};
  let offset = 0;
  let previousMinutes = null;

  PUNCH_SLOTS.forEach(({ key }) => {
    const time = times[key];
    const [hh, mm] = String(time || '').split(':').map(Number);
    if (!anchor || !time || Number.isNaN(hh) || Number.isNaN(mm)) {
      iso[key] = '';
      offsets[key] = null;
      return;
    }
    const minutes = hh * 60 + mm;
    // Earlier than the punch before it → the next calendar day.
    if (previousMinutes !== null && minutes < previousMinutes) offset += 1;
    previousMinutes = minutes;

    const dt = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + offset, hh, mm, 0, 0);
    iso[key] = dt.toISOString();
    offsets[key] = offset;
  });

  return { iso, offsets };
};

// "02 Oct" for the day a resolved punch landed on.
export const resolvedDayLabel = (anchorDate, dayOffset) => {
  const anchor = parseAnchorDate(anchorDate);
  if (!anchor || dayOffset === null || dayOffset === undefined) return '';
  const d = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate() + dayOffset);
  return `${pad(d.getDate())} ${d.toLocaleDateString('en-GB', { month: 'short' })}`;
};