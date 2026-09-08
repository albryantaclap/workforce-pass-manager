// Attendance helpers shared across COMO Camp check-in / check-out, dashboard KPIs,
// history, export and reporting. Pure functions — no React.

// Today's date in the user's local timezone as YYYY-MM-DD.
export const todayStr = () => new Date().toLocaleDateString('en-CA');

export const ATT_STATUS = {
  NOT_CHECKED_IN: 'not_checked_in',
  CHECKED_IN: 'checked_in',
  CHECKED_OUT: 'checked_out',
};

// 12-hour compact time, e.g. "08:14 AM"
export const formatTime = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch { return '—'; }
};

export const formatDateOnly = (iso) => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};

// Minutes between two ISO timestamps (0 if invalid / negative).
export const calcDuration = (checkInIso, checkOutIso) => {
  if (!checkInIso || !checkOutIso) return 0;
  const ms = new Date(checkOutIso) - new Date(checkInIso);
  return Math.max(0, Math.round(ms / 60000));
};

// "10h 00m" style duration label (minutes zero-padded)
export const formatDuration = (mins) => {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

export const getAttendanceStatus = (rec) => {
  if (!rec) return ATT_STATUS.NOT_CHECKED_IN;
  if (rec.check_in_at && !rec.check_out_at) return ATT_STATUS.CHECKED_IN;
  if (rec.check_in_at && rec.check_out_at) return ATT_STATUS.CHECKED_OUT;
  return ATT_STATUS.NOT_CHECKED_IN;
};

export const statusLabel = (rec) => {
  const s = getAttendanceStatus(rec);
  return s === 'not_checked_in' ? 'Not Checked In'
    : s === 'checked_in' ? 'Checked In'
    : 'Checked Out';
};

// ── Multi-session helpers (multiple check-in/check-out sessions per date) ──

// Group attendance records by personnel_id.
export const groupByPersonnel = (records) => {
  const m = new Map();
  for (const r of records) {
    if (!r || !r.personnel_id) continue;
    if (!m.has(r.personnel_id)) m.set(r.personnel_id, []);
    m.get(r.personnel_id).push(r);
  }
  return m;
};

// The "latest" session for display: prefer an open session, else the most
// recent completed session by check_in_at descending.
export const getLatestSession = (sessions) => {
  if (!sessions || sessions.length === 0) return null;
  const open = sessions.find(s => s.check_in_at && !s.check_out_at);
  if (open) return open;
  const completed = sessions.filter(s => s.check_in_at);
  if (completed.length === 0) return null;
  return [...completed].sort((a, b) => new Date(b.check_in_at) - new Date(a.check_in_at))[0];
};

// The currently open session (check_in set, check_out blank), if any.
export const getOpenSession = (sessions) => {
  if (!sessions) return null;
  return sessions.find(s => s.check_in_at && !s.check_out_at) || null;
};

// ── Local-timezone date/time helpers (no UTC drift) ──
// Used by the Personnel Form and COMO Camp edit dialogs to split an ISO
// timestamp into separate date/time inputs and rebuild them on save.

export const toDateStr = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-CA'); } catch { return ''; }
};

export const toTimeStr = (iso) => {
  if (!iso) return '';
  try { return new Date(iso).toTimeString().slice(0, 5); } catch { return ''; }
};

export const buildDateTime = (dateStr, timeStr) => {
  if (!dateStr || !timeStr) return null;
  const [y, m, day] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const dt = new Date(y, m - 1, day, hh, mm, 0, 0);
  return isNaN(dt.getTime()) ? null : dt;
};

// Compact datetime for table cells: "08/09/2026" on first line, "08:15 AM" on second.
export const formatDateTimeCompact = (iso) => {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    return { date, time };
  } catch { return null; }
};