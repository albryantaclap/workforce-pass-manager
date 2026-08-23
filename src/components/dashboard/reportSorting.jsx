import { computePassStatus } from '@/utils/constants';

// ── Sorting modes (primary) ────────────────────────────────────────────────
export const SORT_MODES = [
  { id: 'position_rank', label: 'Position Rank', desc: 'Department → Position Rank → Full Name' },
  { id: 'onboarding_completion', label: 'Onboarding Completion', desc: 'Completed stages count → Full Name' },
  { id: 'workflow_progress', label: 'Workflow Progress', desc: 'Onboarding progress level → Full Name' },
  { id: 'status_priority', label: 'Status Priority', desc: 'Medical → Gate Pass → Training → PID → Full Name' },
  { id: 'company', label: 'Company', desc: 'Company → Position Rank → Full Name' },
  { id: 'department', label: 'Department', desc: 'Department → Position Rank → Full Name' },
  { id: 'position_designation', label: 'Position / Designation', desc: 'Position Rank → Position Name → Full Name' },
  { id: 'assigned_manager', label: 'Assigned Manager', desc: 'Manager → Company → Position Rank → Full Name' },
  { id: 'alphabetical', label: 'Alphabetical', desc: 'Full Name only' },
  { id: 'current_order', label: 'Current Table Order', desc: 'Preserve existing filtered order' },
];

// ── Secondary / tertiary field list ────────────────────────────────────────
export const SORT_FIELDS = [
  { id: 'position_rank', label: 'Position Rank', kind: 'rank' },
  { id: 'completion_score', label: 'Completion Score', kind: 'score' },
  { id: 'company', label: 'Company', kind: 'text' },
  { id: 'department', label: 'Department', kind: 'text' },
  { id: 'assigned_manager', label: 'Assigned Manager', kind: 'text' },
  { id: 'medical_status', label: 'Medical Status', kind: 'text' },
  { id: 'gate_pass_status', label: 'Gate Pass Status', kind: 'text' },
  { id: 'training_status', label: 'Training Status', kind: 'text' },
  { id: 'project_id_status', label: 'Project ID Status', kind: 'text' },
  { id: 'name', label: 'Full Name', kind: 'text' },
  { id: 'qid_no', label: 'QID Number', kind: 'text' },
  { id: 'approval_date', label: 'Approval Date', kind: 'date' },
  { id: 'gate_pass_expiry', label: 'Gate Pass Expiry', kind: 'date' },
  { id: 'pid_expiry', label: 'PID Expiry', kind: 'date' },
];

// ── Recommended presets ────────────────────────────────────────────────────
export const SORT_PRESETS = [
  {
    id: 'management_hierarchy', label: 'Management Hierarchy',
    mode: 'position_rank', secondary: 'department', tertiary: 'name', direction: 'asc',
  },
  {
    id: 'fully_completed_first', label: 'Fully Completed First',
    mode: 'onboarding_completion', secondary: 'position_rank', tertiary: 'name', direction: 'desc',
  },
  {
    id: 'pending_attention_first', label: 'Pending Attention First',
    mode: 'workflow_progress', secondary: 'position_rank', tertiary: 'name', direction: 'asc',
  },
  {
    id: 'company_hierarchy', label: 'Company Hierarchy',
    mode: 'company', secondary: 'department', tertiary: 'position_rank', direction: 'asc',
  },
  {
    id: 'manager_team_view', label: 'Manager Team View',
    mode: 'assigned_manager', secondary: 'department', tertiary: 'position_rank', direction: 'asc',
  },
];

export const DEFAULT_SORT_CONFIG = {
  mode: 'position_rank',
  direction: 'asc',
  secondary: 'name',
  tertiary: '',
};

// ── Helpers ────────────────────────────────────────────────────────────────
function normUpper(v) { return (v || '').trim().toUpperCase(); }

export function buildRankMap(positionRanks = []) {
  const m = new Map();
  for (const r of positionRanks) {
    if (r.position) m.set(r.position.trim().toUpperCase(), r.rank ?? 9999);
  }
  return m;
}

export function getPositionRank(emp, rankMap) {
  const pos = (emp.designation_org_chart || emp.position_application || '').trim().toUpperCase();
  if (!pos) return 9999;
  if (rankMap.has(pos)) return rankMap.get(pos);
  for (const [key, rank] of rankMap.entries()) {
    if (pos.includes(key) || key.includes(pos)) return rank;
  }
  return 9999;
}

const PASS_VALID = (s) => s === 'VALID RLIC PASS' || s === 'SOON TO EXPIRE';
const PID_VALID = (s) => s === 'VALID PID PASS' || s === 'SOON TO EXPIRE';

export function completionScore(emp) {
  let score = 0;
  if (normUpper(emp.ftw_result) === 'ACCEPTED') score++;
  const gp = normUpper(computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status));
  if (PASS_VALID(gp)) score++;
  if (normUpper(emp.training_status) === 'DONE') score++;
  const pid = normUpper(computePassStatus(emp.pid_expiry, 'pid', emp.pid_status));
  if (PID_VALID(pid)) score++;
  return score;
}

// Days remaining until PID expiry (negative = already expired). Missing → 9999 (sorts last).
export function pidDaysLeft(emp) {
  if (!emp.pid_expiry) return 9999;
  const d = new Date(String(emp.pid_expiry).substring(0, 10)); d.setHours(0, 0, 0, 0);
  const t = new Date(); t.setHours(0, 0, 0, 0);
  return Math.ceil((d - t) / 86400000);
}

// Workflow progress level (1 = most complete, 12 = worst)
function workflowLevel(emp) {
  const ftw = normUpper(emp.ftw_result);
  const gp = normUpper(computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status));
  const gpValid = PASS_VALID(gp);
  const train = normUpper(emp.training_status);
  const pid = normUpper(computePassStatus(emp.pid_expiry, 'pid', emp.pid_status));
  const pidValid = PID_VALID(pid);

  if (ftw === 'ACCEPTED' && gpValid && train === 'DONE' && pidValid) return 1;
  if (ftw === 'ACCEPTED' && gpValid && train === 'DONE') return 2;
  if (ftw === 'ACCEPTED' && gpValid && (train === 'ON-GOING' || train === 'ONGOING' || train === 'ON GOING')) return 3;
  if (ftw === 'ACCEPTED' && gpValid && train === 'SCHEDULED') return 4;
  if (ftw === 'ACCEPTED' && gpValid && train === 'TO BE SCHEDULED') return 5;
  if (ftw === 'ACCEPTED' && gpValid && train === 'PENDING') return 6;
  if (ftw === 'ACCEPTED' && gp === 'UNDER PROCESS') return 7;
  if (ftw === 'ACCEPTED' && gp === 'NO RLIC PASS') return 8;
  if (ftw === 'RE-ASSESS') return 9;
  if (ftw === 'WAITING TR APPROVAL') return 10;
  if (!ftw) return 11; // New
  return 12; // Rejected / Expired / Absent
}

// Status priority maps (lower = higher priority)
const MED_PRIORITY = { 'ACCEPTED': 1, 'RE-ASSESS': 2, 'WAITING TR APPROVAL': 3, 'REJECTED': 6, 'RECALLED': 5 };
const GP_PRIORITY = {
  'VALID RLIC PASS': 1, 'SOON TO EXPIRE': 2, 'UNDER PROCESS': 4, 'DVC SENT': 5,
  'WAITING MOI APPROVAL': 6, 'HOLDING ACTIVE GP': 8, 'EXPIRED RLIC PASS': 11, 'NO RLIC PASS': 10, 'REJECTED': 11,
  'VALID / RENEWAL UNDER PROCESS': 3, 'DVC / SS - TR': 7, 'RECALLED W/ VALID': 9,
};
const TRAIN_PRIORITY = {
  'DONE': 1, 'ON-GOING': 2, 'ONGOING': 2, 'ON GOING': 2, 'SCHEDULED': 3, 'TO BE SCHEDULED': 4,
  'PENDING': 5, 'RECALLED': 6, 'NOT REQUIRED': 7, 'N/A': 7, 'ABSENT': 8,
};
const PID_PRIORITY = {
  'VALID PID PASS': 1, 'SOON TO EXPIRE': 2, 'RENEWAL UNDER PROCESS': 3, 'RECALLED': 4,
  'NO PID PASS': 5, 'NO PID / NO PASS': 5, 'EXPIRED PID PASS': 6,
};

function medPriority(emp) {
  const f = normUpper(emp.ftw_result);
  if (!f) return 4; // New
  return MED_PRIORITY[f] ?? 99;
}
function gpPriority(emp) {
  const s = normUpper(computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status));
  const raw = normUpper(emp.rlic_status);
  return GP_PRIORITY[s] ?? GP_PRIORITY[raw] ?? 99;
}
function trainPriority(emp) {
  const t = normUpper(emp.training_status);
  return TRAIN_PRIORITY[t] ?? 99;
}
function pidPriority(emp) {
  const s = normUpper(computePassStatus(emp.pid_expiry, 'pid', emp.pid_status));
  const raw = normUpper(emp.pid_status);
  return PID_PRIORITY[s] ?? PID_PRIORITY[raw] ?? 99;
}

// ── Field value resolver for secondary / tertiary ──────────────────────────
function fieldValue(emp, fieldId, rankMap) {
  switch (fieldId) {
    case 'position_rank': return getPositionRank(emp, rankMap);
    case 'completion_score': return completionScore(emp);
    case 'company': return (emp.company || '').trim().toUpperCase();
    case 'department': return (emp.department || '').trim().toUpperCase();
    case 'assigned_manager': return emp.assigned_manager_name || '';
    case 'medical_status': return normUpper(emp.ftw_result);
    case 'gate_pass_status': return normUpper(computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status));
    case 'training_status': return normUpper(emp.training_status);
    case 'project_id_status': return normUpper(computePassStatus(emp.pid_expiry, 'pid', emp.pid_status));
    case 'name': return (emp.name || '').trim();
    case 'qid_no': return (emp.qid_no || '').trim();
    case 'approval_date': return emp.approval_date || '';
    case 'gate_pass_expiry': return emp.gate_pass_expiry || '';
    case 'pid_expiry': return emp.pid_expiry || '';
    case 'work_location': return (emp.work_location || '').trim().toUpperCase();
    case 'pid_days_left': return pidDaysLeft(emp);
    case 'pid_issue_date': return emp.pid_issue_date || '';
    case 'nationality': return (emp.nationality || '').trim().toUpperCase();
    case 'contact_details': return emp.contact_details || '';
    case 'pid': return (emp.pid || '').trim();
    default: return '';
  }
}

function fieldKind(fieldId) {
  return SORT_FIELDS.find(f => f.id === fieldId)?.kind || 'text';
}

function compareValues(a, b, kind) {
  if (kind === 'rank' || kind === 'score') {
    return (a ?? 9999) - (b ?? 9999);
  }
  if (kind === 'date') {
    const av = a ? new Date(a).getTime() : -Infinity;
    const bv = b ? new Date(b).getTime() : -Infinity;
    // empty dates last in ascending
    if (av === -Infinity && bv === -Infinity) return 0;
    if (av === -Infinity) return 1;
    if (bv === -Infinity) return -1;
    return av - bv;
  }
  // text — empty last
  const av = a || '';
  const bv = b || '';
  if (!av && !bv) return 0;
  if (!av) return 1;
  if (!bv) return -1;
  return av.localeCompare(bv);
}

// ── Primary comparator per mode ─────────────────────────────────────────────
function primaryCompare(a, b, mode, direction, rankMap) {
  const asc = direction !== 'desc';
  let c = 0;

  switch (mode) {
    case 'position_rank': {
      // Department ASC → Position Rank ASC → Full Name ASC
      c = ((a.department || '').trim().toUpperCase()).localeCompare((b.department || '').trim().toUpperCase());
      if (c === 0) c = getPositionRank(a, rankMap) - getPositionRank(b, rankMap);
      if (c === 0) c = (a.name || '').localeCompare(b.name || '');
      return asc ? c : -c;
    }
    case 'onboarding_completion': {
      const diff = completionScore(b) - completionScore(a); // desc default
      c = asc ? -diff : diff;
      if (c === 0) c = (a.name || '').localeCompare(b.name || '');
      return c;
    }
    case 'workflow_progress': {
      c = workflowLevel(a) - workflowLevel(b);
      if (c === 0) c = (a.name || '').localeCompare(b.name || '');
      return asc ? c : -c;
    }
    case 'status_priority': {
      c = medPriority(a) - medPriority(b);
      if (c === 0) c = gpPriority(a) - gpPriority(b);
      if (c === 0) c = trainPriority(a) - trainPriority(b);
      if (c === 0) c = pidPriority(a) - pidPriority(b);
      if (c === 0) c = (a.name || '').localeCompare(b.name || '');
      return asc ? c : -c;
    }
    case 'company': {
      c = ((a.company || '').trim().toUpperCase()).localeCompare((b.company || '').trim().toUpperCase());
      if (c === 0) c = getPositionRank(a, rankMap) - getPositionRank(b, rankMap);
      if (c === 0) c = (a.name || '').localeCompare(b.name || '');
      return asc ? c : -c;
    }
    case 'department': {
      c = ((a.department || '').trim().toUpperCase()).localeCompare((b.department || '').trim().toUpperCase());
      if (c === 0) c = getPositionRank(a, rankMap) - getPositionRank(b, rankMap);
      if (c === 0) c = (a.name || '').localeCompare(b.name || '');
      return asc ? c : -c;
    }
    case 'position_designation': {
      c = getPositionRank(a, rankMap) - getPositionRank(b, rankMap);
      if (c === 0) c = ((a.designation_org_chart || a.position_application || '').trim().toUpperCase())
        .localeCompare((b.designation_org_chart || b.position_application || '').trim().toUpperCase());
      if (c === 0) c = (a.name || '').localeCompare(b.name || '');
      return asc ? c : -c;
    }
    case 'assigned_manager': {
      const ma = a.assigned_manager_name ? 0 : 1;
      const mb = b.assigned_manager_name ? 0 : 1;
      c = ma - mb; // assigned first
      if (c === 0) c = (a.assigned_manager_name || '').localeCompare(b.assigned_manager_name || '');
      if (c === 0) c = ((a.company || '').trim().toUpperCase()).localeCompare((b.company || '').trim().toUpperCase());
      if (c === 0) c = getPositionRank(a, rankMap) - getPositionRank(b, rankMap);
      if (c === 0) c = (a.name || '').localeCompare(b.name || '');
      return asc ? c : -c;
    }
    case 'alphabetical': {
      c = (a.name || '').localeCompare(b.name || '');
      return asc ? c : -c;
    }
    case 'current_order':
    default:
      return 0;
  }
}

// ── Main entry: returns a new sorted array ─────────────────────────────────
export function applyReportSorting(rows, sortConfig, rankMap) {
  const cfg = { ...DEFAULT_SORT_CONFIG, ...(sortConfig || {}) };
  const { mode, direction, secondary, tertiary } = cfg;

  const secKind = fieldKind(secondary);
  const tertKind = fieldKind(tertiary);

  return [...rows].sort((a, b) => {
    let c = primaryCompare(a, b, mode, direction, rankMap);
    if (c !== 0) return c;
    if (secondary) {
      const ca = fieldValue(a, secondary, rankMap);
      const cb = fieldValue(b, secondary, rankMap);
      c = compareValues(ca, cb, secKind);
      if (c !== 0) return c;
    }
    if (tertiary) {
      const ta = fieldValue(a, tertiary, rankMap);
      const tb = fieldValue(b, tertiary, rankMap);
      c = compareValues(ta, tb, tertKind);
    }
    return c;
  });
}

// ── Labels for the preview summary ──────────────────────────────────────────
export function sortModeLabel(modeId) {
  return SORT_MODES.find(m => m.id === modeId)?.label || modeId;
}
export function sortFieldLabel(fieldId) {
  if (!fieldId) return '—';
  return SORT_FIELDS.find(f => f.id === fieldId)?.label || fieldId;
}
export function directionLabel(modeId, direction) {
  if (modeId === 'onboarding_completion') return direction === 'desc' ? 'Fully Completed First' : 'Least Completed First';
  if (modeId === 'position_rank') return direction === 'asc' ? 'Highest Rank First' : 'Lowest Rank First';
  return direction === 'desc' ? 'Descending' : 'Ascending';
}