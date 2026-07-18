import { normalizeDate, formatDate } from '@/utils/constants';

// ── Badge styles (screen + print) ────────────────────────────────────────────
export const BADGE_STYLES = {
  green:  { bg: '#D6EFD8', fg: '#1A5C2A', border: '#A8D5AC' },
  amber:  { bg: '#FEF3C7', fg: '#7C4D00', border: '#F6D860' },
  orange: { bg: '#FDEBD0', fg: '#7B3500', border: '#F5C59A' },
  red:    { bg: '#FCE4E4', fg: '#8B1A1A', border: '#F5A9A9' },
  blue:   { bg: '#DBEAFE', fg: '#1E3A6E', border: '#93C5FD' },
  purple: { bg: '#EDE9FE', fg: '#4B2A8A', border: '#C4B5FD' },
  slate:  { bg: '#F1F5F9', fg: '#475569', border: '#CBD5E1' },
};

// ── Label → badge category mapping ─────────────────────────────────────────────
const MED_MAP = {
  ACCEPTED: { label: 'Accepted', color: 'green' },
  'WAITING TR APPROVAL': { label: 'Waiting TR', color: 'amber' },
  'WAITING TR': { label: 'Waiting TR', color: 'amber' },
  'RE-ASSESS': { label: 'Re-Assess', color: 'orange' },
  'REASSESS': { label: 'Re-Assess', color: 'orange' },
  REJECTED: { label: 'Rejected', color: 'slate' },
  RECALLED: { label: 'Recalled', color: 'slate' },
  NEW: { label: 'New', color: 'blue' },
};
const GP_MAP = {
  VALID: { label: 'Valid', color: 'green' },
  'VALID RLIC PASS': { label: 'Valid', color: 'green' },
  SOON: { label: 'Soon', color: 'amber' },
  'SOON TO EXPIRE': { label: 'Soon', color: 'amber' },
  EXPIRED: { label: 'Expired', color: 'red' },
  'EXPIRED RLIC PASS': { label: 'Expired', color: 'red' },
  'NO PASS': { label: 'No Pass', color: 'slate' },
  'NO RLIC PASS': { label: 'No Pass', color: 'slate' },
  'UNDER PROCESS': { label: 'Under Process', color: 'blue' },
  'DVC SENT': { label: 'DVC Sent', color: 'blue' },
  'WAITING MOI APPROVAL': { label: 'Waiting MOI', color: 'purple' },
  'WAITING MOI': { label: 'Waiting MOI', color: 'purple' },
  'HOLDING ACTIVE GP': { label: 'Holding Active GP', color: 'slate' },
};
const TRAIN_MAP = {
  DONE: { label: 'Done', color: 'green' },
  PENDING: { label: 'Pending', color: 'amber' },
  'ON-GOING': { label: 'On-Going', color: 'purple' },
  ONGOING: { label: 'On-Going', color: 'purple' },
  'ON GOING': { label: 'On-Going', color: 'purple' },
  SCHEDULED: { label: 'Scheduled', color: 'blue' },
  'TO BE SCHEDULED': { label: 'To Be Scheduled', color: 'amber' },
  'NOT REQUIRED': { label: 'Not Required', color: 'slate' },
  ABSENT: { label: 'Absent', color: 'red' },
};
const PID_MAP = {
  VALID: { label: 'Valid', color: 'green' },
  'VALID PID PASS': { label: 'Valid', color: 'green' },
  SOON: { label: 'Soon', color: 'amber' },
  'SOON TO EXPIRE': { label: 'Soon', color: 'amber' },
  EXPIRED: { label: 'Expired', color: 'red' },
  'EXPIRED PID PASS': { label: 'Expired', color: 'red' },
  'NO PID': { label: 'No PID', color: 'slate' },
  'NO PID PASS': { label: 'No PID', color: 'slate' },
  'RENEWAL UNDER PROCESS': { label: 'Renewal Under Process', color: 'blue' },
  RECALLED: { label: 'Recalled', color: 'slate' },
};
const APPROVAL_MAP = {
  Approved: { label: 'Approved', color: 'green' },
  Pending: { label: 'Pending', color: 'amber' },
  Rejected: { label: 'Rejected', color: 'red' },
  'For Revision': { label: 'For Revision', color: 'blue' },
};

function resolve(map, raw) {
  if (!raw) return null;
  const key = String(raw).trim().toUpperCase();
  return map[key] || { label: String(raw).trim(), color: 'slate' };
}

export function medBadge(v) { return v ? resolve(MED_MAP, v) : null; }
export function gpBadge(v)  { return v ? resolve(GP_MAP, v)  : null; }
export function trainBadge(v) { return v ? resolve(TRAIN_MAP, v) : null; }
export function pidBadge(v) { return v ? resolve(PID_MAP, v) : null; }
export function approvalBadge(v) { return APPROVAL_MAP[v] || { label: v || '—', color: 'slate' }; }

export function matchBadge(status) {
  return status === 'Matched'
    ? { label: 'Matched', color: 'green' }
    : { label: 'Unmatched', color: 'amber' };
}

// ── Badge span (screen) ────────────────────────────────────────────────────────
export function BadgeSpan({ color, label }) {
  const s = BADGE_STYLES[color] || BADGE_STYLES.slate;
  return (
    <span style={{ ...s, display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, border: `1px solid ${s.border}` }}>
      {label}
    </span>
  );
}

// ── Option lists (potluck labels observed in the dataset) ──────────────────────
export const MEDICAL_OPTIONS = [
  { value: 'Accepted', label: 'Accepted' },
  { value: 'Waiting TR Approval', label: 'Waiting TR Approval' },
  { value: 'Re-Assess', label: 'Re-Assess' },
  { value: 'Rejected', label: 'Rejected' },
];
export const GP_OPTIONS = [
  { value: 'Valid', label: 'Valid' },
  { value: 'Soon', label: 'Soon to Expire' },
  { value: 'Expired', label: 'Expired' },
  { value: 'No Pass', label: 'No Pass' },
  { value: 'Under Process', label: 'Under Process' },
  { value: 'Waiting MOI Approval', label: 'Waiting MOI Approval' },
  { value: 'Holding Active GP', label: 'Holding Active GP' },
];
export const TRAINING_OPTIONS = [
  { value: 'Done', label: 'Done' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Scheduled', label: 'Scheduled' },
  { value: 'On-Going', label: 'On-Going' },
  { value: 'To Be Scheduled', label: 'To Be Scheduled' },
  { value: 'Not Required', label: 'Not Required' },
  { value: 'Absent', label: 'Absent' },
];
export const PID_OPTIONS = [
  { value: 'Valid', label: 'Valid' },
  { value: 'Soon', label: 'Soon to Expire' },
  { value: 'Expired', label: 'Expired' },
  { value: 'No PID', label: 'No PID' },
  { value: 'Renewal Under Process', label: 'Renewal Under Process' },
  { value: 'Recalled', label: 'Recalled' },
];
export const APPROVAL_STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'For Revision', label: 'For Revision' },
];

// ── Dates ──────────────────────────────────────────────────────────────────────
const DMY = (v) => {
  const n = normalizeDate(v);
  if (!n) return null;
  try { return formatDate(n); } catch { return n; }
};
export function fmtDate(v) {
  if (!v) return '—';
  return DMY(v) || '—';
}

// ── Default sort: Approval Date DESC → Company ASC → Designation ASC → Name ASC
// Undated records appear after dated records.
export function defaultSort(rows) {
  return [...rows].sort((a, b) => {
    const da = a.approval_date ? a.approval_date.substring(0, 10) : '';
    const db = b.approval_date ? b.approval_date.substring(0, 10) : '';
    if (da && db && da !== db) return da < db ? 1 : -1;
    if (da && !db) return -1;
    if (!da && db) return 1;
    const co = (a.company || '').localeCompare(b.company || '');
    if (co !== 0) return co;
    const dp = (a.designation_position || '').localeCompare(b.designation_position || '');
    if (dp !== 0) return dp;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });
}