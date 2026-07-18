import { computePassStatus, normalizeDate } from '@/utils/constants';
import { format, parseISO } from 'date-fns';

// ── Badge system — identical to Onboarding Monitoring (hex values) ─────────────
export const BADGE_STYLES = {
  'badge-softgreen':  { background: '#D6EFD8', color: '#1A5C2A', border: '1px solid #A8D5AC' },
  'badge-softamber':  { background: '#FEF3C7', color: '#7C4D00', border: '1px solid #F6D860' },
  'badge-softorange': { background: '#FDEBD0', color: '#7B3500', border: '1px solid #F5C59A' },
  'badge-softred':    { background: '#FCE4E4', color: '#8B1A1A', border: '1px solid #F5A9A9' },
  'badge-lightblue':  { background: '#DBEAFE', color: '#1E3A6E', border: '1px solid #93C5FD' },
  'badge-softpurple': { background: '#EDE9FE', color: '#4B2A8A', border: '1px solid #C4B5FD' },
  'badge-softgray':   { background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' },
};

export function BadgeSpan({ colorKey, label }) {
  const s = BADGE_STYLES[colorKey] || BADGE_STYLES['badge-softgray'];
  return (
    <span style={{ ...s, display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>
      {label}
    </span>
  );
}

// Print-class map (badge-soft* → print class for HTML export)
export const PRINT_CLASS_MAP = {
  'badge-softgreen': 'badge-green', 'badge-softamber': 'badge-amber',
  'badge-softorange': 'badge-orange', 'badge-softred': 'badge-red',
  'badge-lightblue': 'badge-blue', 'badge-softpurple': 'badge-purple',
  'badge-softgray': 'badge-slate',
};
// Excel argb map (badge-soft* → {bg,fg})
export const EXCEL_COLOR_MAP = {
  'badge-softgreen':  { bg: 'D6EFD8', fg: '1A5C2A' },
  'badge-softamber':  { bg: 'FEF3C7', fg: '7C4D00' },
  'badge-softorange': { bg: 'FDEBD0', fg: '7B3500' },
  'badge-softred':    { bg: 'FCE4E4', fg: '8B1A1A' },
  'badge-lightblue':  { bg: 'DBEAFE', fg: '1E3A6E' },
  'badge-softpurple': { bg: 'EDE9FE', fg: '4B2A8A' },
  'badge-softgray':   { bg: 'F1F5F9', fg: '475569' },
};

// ── Status derivation (live Employee when linked, else stored Approved text) ───
function medMap(raw) {
  const t = (raw || '').trim().toUpperCase();
  if (!raw) return { label: 'New', colorKey: 'badge-lightblue' };
  if (t === 'ACCEPTED') return { label: 'Accepted', colorKey: 'badge-softgreen' };
  if (t === 'WAITING TR APPROVAL' || t === 'WAITING TR') return { label: 'Waiting TR', colorKey: 'badge-softamber' };
  if (t === 'RE-ASSESS' || t === 'REASSESS') return { label: 'Re-Assess', colorKey: 'badge-softorange' };
  if (t === 'REJECTED') return { label: 'Recalled', colorKey: 'badge-softgray' };
  return { label: raw, colorKey: 'badge-softgray' };
}
function gpMapFromText(raw) {
  const t = (raw || '').trim().toUpperCase();
  if (!raw) return { label: '—', colorKey: 'badge-softgray' };
  if (t === 'VALID' || t === 'VALID RLIC PASS') return { label: 'Valid', colorKey: 'badge-softgreen' };
  if (t === 'SOON' || t === 'SOON TO EXPIRE') return { label: 'Soon', colorKey: 'badge-softamber' };
  if (t === 'EXPIRED' || t === 'EXPIRED RLIC PASS') return { label: 'Expired', colorKey: 'badge-softred' };
  if (t === 'NO PASS' || t === 'NO RLIC PASS') return { label: 'No Pass', colorKey: 'badge-softgray' };
  if (t === 'UNDER PROCESS' || t === 'DVC SENT') return { label: 'Under Process', colorKey: 'badge-lightblue' };
  if (t === 'WAITING MOI APPROVAL' || t === 'WAITING MOI') return { label: 'Waiting MOI', colorKey: 'badge-softpurple' };
  if (t === 'HOLDING ACTIVE GP') return { label: 'Holding Active GP', colorKey: 'badge-softgray' };
  return { label: raw, colorKey: 'badge-softgray' };
}
function trainMapFromText(raw) {
  const t = (raw || '').trim().toUpperCase();
  if (!raw) return { label: '—', colorKey: 'badge-softgray' };
  if (t === 'DONE') return { label: 'Done', colorKey: 'badge-softgreen' };
  if (t === 'PENDING') return { label: 'Pending', colorKey: 'badge-softamber' };
  if (t === 'ON-GOING' || t === 'ONGOING' || t === 'ON GOING') return { label: 'On-Going', colorKey: 'badge-softpurple' };
  if (t === 'SCHEDULED') return { label: 'Scheduled', colorKey: 'badge-lightblue' };
  if (t === 'TO BE SCHEDULED') return { label: 'To Be Scheduled', colorKey: 'badge-softamber' };
  if (t === 'NOT REQUIRED') return { label: 'Not Required', colorKey: 'badge-softgray' };
  if (t === 'ABSENT') return { label: 'Absent', colorKey: 'badge-softred' };
  return { label: raw, colorKey: 'badge-softgray' };
}
function pidMapFromText(raw) {
  const t = (raw || '').trim().toUpperCase();
  if (!raw) return { label: '—', colorKey: 'badge-softgray' };
  if (t === 'VALID' || t === 'VALID PID PASS') return { label: 'Valid', colorKey: 'badge-softgreen' };
  if (t === 'SOON' || t === 'SOON TO EXPIRE') return { label: 'Soon', colorKey: 'badge-softamber' };
  if (t === 'EXPIRED' || t === 'EXPIRED PID PASS') return { label: 'Expired', colorKey: 'badge-softred' };
  if (t === 'NO PID' || t === 'NO PID PASS') return { label: 'No PID', colorKey: 'badge-softgray' };
  if (t === 'RENEWAL UNDER PROCESS') return { label: 'Renewal Under Process', colorKey: 'badge-lightblue' };
  if (t === 'RECALLED') return { label: 'Recalled', colorKey: 'badge-softgray' };
  return { label: raw, colorKey: 'badge-softgray' };
}

// Live employee derivation (mirrors Onboarding getGPLabel / getPIDLabel)
export function getMedStatus(rec, emp) {
  if (emp) return medMap(emp.ftw_result);
  return medMap(rec.medical);
}
export function getGPStatus(rec, emp) {
  if (emp) {
    const eff = (computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status) || '').toUpperCase();
    if (eff === 'VALID RLIC PASS') return { label: 'Valid', colorKey: 'badge-softgreen' };
    if (eff === 'SOON TO EXPIRE') return { label: 'Soon', colorKey: 'badge-softamber' };
    if (eff === 'EXPIRED RLIC PASS') return { label: 'Expired', colorKey: 'badge-softred' };
    if (eff === 'NO RLIC PASS') return { label: 'No Pass', colorKey: 'badge-softgray' };
    const raw = (emp.rlic_status || '').trim().toUpperCase();
    if (raw === 'UNDER PROCESS' || raw === 'DVC SENT') return { label: 'Under Process', colorKey: 'badge-lightblue' };
    if (raw === 'WAITING MOI APPROVAL') return { label: 'Waiting MOI', colorKey: 'badge-softpurple' };
    if (raw === 'HOLDING ACTIVE GP') return { label: 'Holding Active GP', colorKey: 'badge-softgray' };
    return { label: emp.rlic_status || '—', colorKey: 'badge-softgray' };
  }
  return gpMapFromText(rec.gate_pass_status);
}
export function getTrainingStatus(rec, emp) {
  if (emp) {
    const t = (emp.training_status || '').trim().toUpperCase();
    if (!emp.training_status) return { label: '—', colorKey: 'badge-softgray' };
    if (t === 'DONE') return { label: 'Done', colorKey: 'badge-softgreen' };
    if (t === 'PENDING') return { label: 'Pending', colorKey: 'badge-softamber' };
    if (t === 'ON-GOING' || t === 'ONGOING' || t === 'ON GOING') return { label: 'On-Going', colorKey: 'badge-softpurple' };
    if (t === 'SCHEDULED') return { label: 'Scheduled', colorKey: 'badge-lightblue' };
    if (t === 'TO BE SCHEDULED') return { label: 'To Be Scheduled', colorKey: 'badge-softamber' };
    if (t === 'NOT REQUIRED') return { label: 'Not Required', colorKey: 'badge-softgray' };
    if (t === 'ABSENT') return { label: 'Absent', colorKey: 'badge-softred' };
    return { label: emp.training_status, colorKey: 'badge-softgray' };
  }
  return trainMapFromText(rec.training_status);
}
export function getPIDStatus(rec, emp) {
  if (emp) {
    const eff = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase();
    if (eff === 'VALID PID PASS') return { label: 'Valid', colorKey: 'badge-softgreen' };
    if (eff === 'SOON TO EXPIRE') return { label: 'Soon', colorKey: 'badge-softamber' };
    if (eff === 'EXPIRED PID PASS') return { label: 'Expired', colorKey: 'badge-softred' };
    if (eff === 'NO PID PASS') return { label: 'No PID', colorKey: 'badge-softgray' };
    const raw = (emp.pid_status || '').trim().toUpperCase();
    if (raw === 'RENEWAL UNDER PROCESS') return { label: 'Renewal Under Process', colorKey: 'badge-lightblue' };
    if (raw === 'RECALLED') return { label: 'Recalled', colorKey: 'badge-softgray' };
    return { label: emp.pid_status || '—', colorKey: 'badge-softgray' };
  }
  return pidMapFromText(rec.project_id_status);
}

export function approvalBadge(v) {
  if (v === 'Approved') return { label: 'Approved', colorKey: 'badge-softgreen' };
  if (v === 'Pending') return { label: 'Pending', colorKey: 'badge-softamber' };
  if (v === 'Rejected') return { label: 'Rejected', colorKey: 'badge-softred' };
  if (v === 'For Revision') return { label: 'For Revision', colorKey: 'badge-lightblue' };
  return { label: v || '—', colorKey: 'badge-softgray' };
}
export function matchBadge(status) {
  return status === 'Matched'
    ? { label: 'Matched', colorKey: 'badge-softgreen' }
    : { label: 'Unmatched', colorKey: 'badge-softamber' };
}

// ── Date formatting ─────────────────────────────────────────────────────────────
// Onboarding screen uses InlineEditCell → formatDate (DD/MM/YYYY).
// Print/Excel use dd-MMM-yyyy for employee dates (Onboarding convention).
export function fmtOnboardingDate(v) {
  if (!v) return '—';
  try { return format(parseISO(normalizeDate(v)), 'dd-MMM-yyyy'); } catch { return '—'; }
}
// Approval Date is explicitly DD/MM/YYYY per spec.
export function fmtApprovalDate(v) {
  if (!v) return '—';
  const n = normalizeDate(v);
  if (!n) return '—';
  const [yyyy, mm, dd] = n.split('-');
  return `${dd}/${mm}/${yyyy}`;
}

// ── Default sort: Approval Date DESC → Company ASC → Designation ASC → Name ASC
// Records without an Approval Date sink to the bottom.
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

// ── Editable employee status option lists (raw enum values, Onboarding-aligned) ─
export const EMP_MEDICAL_OPTIONS = [
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'WAITING TR APPROVAL', label: 'Waiting TR Approval' },
  { value: 'RE-ASSESS', label: 'Re-Assess' },
  { value: 'REJECTED', label: 'Rejected' },
];
export const EMP_GP_OPTIONS = [
  { value: 'VALID RLIC PASS', label: 'Valid RLIC Pass' },
  { value: 'EXPIRED RLIC PASS', label: 'Expired RLIC Pass' },
  { value: 'SOON TO EXPIRE', label: 'Soon to Expire' },
  { value: 'NO RLIC PASS', label: 'No RLIC Pass' },
  { value: 'UNDER PROCESS', label: 'Under Process' },
  { value: 'WAITING MOI APPROVAL', label: 'Waiting MOI Approval' },
  { value: 'HOLDING ACTIVE GP', label: 'Holding Active GP' },
];
export const EMP_TRAINING_OPTIONS = [
  { value: 'DONE', label: 'Done' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ON-GOING', label: 'On-Going' },
  { value: 'TO BE SCHEDULED', label: 'To Be Scheduled' },
  { value: 'NOT REQUIRED', label: 'Not Required' },
  { value: 'ABSENT', label: 'Absent' },
];
export const EMP_PID_OPTIONS = [
  { value: 'VALID PID PASS', label: 'Valid PID Pass' },
  { value: 'EXPIRED PID PASS', label: 'Expired PID Pass' },
  { value: 'SOON TO EXPIRE', label: 'Soon to Expire' },
  { value: 'NO PID PASS', label: 'No PID Pass' },
  { value: 'RENEWAL UNDER PROCESS', label: 'Renewal Under Process' },
  { value: 'RECALLED', label: 'Recalled' },
];

// Form-friendly options (ApprovedRecordForm uses friendly values)
export const MEDICAL_OPTIONS = EMP_MEDICAL_OPTIONS;
export const GP_OPTIONS = EMP_GP_OPTIONS;
export const TRAINING_OPTIONS = EMP_TRAINING_OPTIONS;
export const PID_OPTIONS = EMP_PID_OPTIONS;
export const APPROVAL_STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'For Revision', label: 'For Revision' },
];