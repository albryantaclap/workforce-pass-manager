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

// "10h 18m" style duration label
export const formatDuration = (mins) => {
  if (!mins || mins <= 0) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
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