// Inline grid editing helpers for the Time Entries table.
// They convert a stored ISO punch into the value shown by <input type="time">
// and rebuild an ISO timestamp on the row's attendance date. A punch that falls
// before the previous punch of the day rolls over to the next day (night shift),
// while a punch that already exists keeps its original calendar day.

export const PUNCH_FIELDS = [
  { key: 'first_in', recordKey: 'first_in_at', label: 'FIRST IN' },
  { key: 'first_out', recordKey: 'first_out_at', label: 'FIRST OUT' },
  { key: 'second_in', recordKey: 'second_in_at', label: 'SECOND IN' },
  { key: 'final_out', recordKey: 'final_out_at', label: 'FINAL OUT' },
];

const pad = (n) => String(n).padStart(2, '0');

// The stored value for a punch, using the same legacy fallbacks as the table.
export const storedPunch = (att, field) => {
  if (!att || !field) return '';
  if (field.key === 'first_in') return att.first_in_at || att.check_in_at || '';
  if (field.key === 'final_out') return att.final_out_at || att.check_out_at || '';
  return att[field.recordKey] || '';
};

// ISO → "HH:mm" (local) for the time input.
export const isoToTimeInput = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// "HH:mm" → ISO on the row date (or the punch's original date when it has one).
export const timeInputToIso = (rowDate, time, baseIso, previousIso) => {
  if (!time || !rowDate) return '';
  const [y, m, d] = rowDate.split('-').map(Number);
  const [hh, mm] = String(time).split(':').map(Number);
  if (!y || Number.isNaN(hh) || Number.isNaN(mm)) return '';

  let base = baseIso ? new Date(baseIso) : null;
  if (!base || Number.isNaN(base.getTime())) base = new Date(y, m - 1, d);

  const out = new Date(base.getFullYear(), base.getMonth(), base.getDate(), hh, mm, 0, 0);
  if (!baseIso && previousIso) {
    const prev = new Date(previousIso);
    if (!Number.isNaN(prev.getTime()) && out.getTime() < prev.getTime()) {
      out.setDate(out.getDate() + 1);
    }
  }
  return out.toISOString();
};

// Every punch of a row as ISO, using the draft where the user edited a cell.
export const buildPunchIsos = (rowDate, draft = {}, att = null) => {
  const values = {};
  let previous = '';
  PUNCH_FIELDS.forEach((field) => {
    const stored = storedPunch(att, field);
    const time = draft[field.key] !== undefined ? draft[field.key] : isoToTimeInput(stored);
    const iso = timeInputToIso(rowDate, time, stored, previous);
    values[field.key] = iso;
    if (iso) previous = iso;
  });
  return values;
};

// The punches whose cell value actually differs from what is stored.
// These are the only punches sent to the backend (changedPunchKeys).
export const changedPunchKeys = (draft = {}, att = null) =>
  PUNCH_FIELDS
    .filter((field) => {
      if (draft[field.key] === undefined) return false;
      return draft[field.key] !== isoToTimeInput(storedPunch(att, field));
    })
    .map((field) => field.key);

// Stable per-row key: the attendance record when it exists, otherwise the
// employee/day pair for a row that has no record yet (an absent employee).
export const gridRowKey = (emp, att, rowDate) =>
  att?.id || `${emp?.id || ''}|${rowDate || ''}`;