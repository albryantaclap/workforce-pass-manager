import { computePassStatus, normalizeDate } from '@/utils/constants';

// Statuses whose meaning is derived from the expiry date (not custom workflow values).
const BUILT_IN_PID = new Set(['VALID PID PASS', 'SOON TO EXPIRE', 'EXPIRED PID PASS', 'NO PID PASS']);
const BUILT_IN_RLIC = new Set(['VALID RLIC PASS', 'SOON TO EXPIRE', 'EXPIRED RLIC PASS', 'NO RLIC PASS']);

/**
 * Derive all reporting flags for a single employee in one pass.
 * Grouping keys keep their original case so drill-down values match the
 * page filter options exactly. Medical / training / pass statuses are
 * uppercased because their lookup options are uppercase.
 */
export function empFlags(e) {
  const medRaw = (e.ftw_result || '').trim().toUpperCase();
  const medical = medRaw || 'NO MEDICAL RECORD';
  const gatePass = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  const training = (e.training_status || '').trim().toUpperCase() || 'NO RECORD';
  const pid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);

  const company = (e.company || '').trim() || 'Unassigned';
  const department = (e.department || '').trim() || 'Unassigned';
  const location = (e.current_location || '').trim() || 'Unassigned';
  const position = (e.designation_org_chart || e.position_application || '').trim() || 'Unassigned';
  const manager = (e.assigned_manager_name || '').trim() || 'Unassigned';

  const medOk = medRaw === 'ACCEPTED';
  const gpOk = gatePass === 'VALID RLIC PASS' || gatePass === 'SOON TO EXPIRE';
  const trainOk = training === 'DONE';
  const pidOk = pid === 'VALID PID PASS' || pid === 'SOON TO EXPIRE';
  const isFullyComplete = medOk && gpOk && trainOk && pidOk;

  let pidDays = null;
  const nd = normalizeDate(e.pid_expiry);
  if (nd) {
    const [y, m, d] = nd.split('-').map(Number);
    if (y && m && d) {
      const dt = new Date(y, m - 1, d);
      const today = new Date(); today.setHours(0, 0, 0, 0);
      pidDays = Math.ceil((dt - today) / 86400000);
    }
  }

  return {
    medical, gatePass, training, pid,
    company, department, location, position, manager,
    medOk, gpOk, trainOk, pidOk, isFullyComplete, pidDays,
  };
}

function newBucket() {
  return { total: 0, medAccepted: 0, gpValid: 0, trainDone: 0, pidValid: 0, fullyComplete: 0 };
}
function addCompliance(b, f) {
  b.total++;
  if (f.medOk) b.medAccepted++;
  if (f.gpOk) b.gpValid++;
  if (f.trainOk) b.trainDone++;
  if (f.pidOk) b.pidValid++;
  if (f.isFullyComplete) b.fullyComplete++;
}

/**
 * Single-pass aggregation over the filtered dataset.
 * Returns every count, map and compliance bucket the dashboard needs —
 * no further queries are required downstream.
 */
export function aggregateAll(data) {
  const kpi = {
    total: data.length, medAccepted: 0, medPending: 0,
    gpValid: 0, gpUnderProcess: 0, gpNoPass: 0,
    trainDone: 0, trainOnGoing: 0, trainPending: 0,
    pidValid: 0, pidSoon: 0, pidExpired: 0, pidRenewal: 0, noPid: 0,
    outside: 0, comoCamp: 0,
  };

  const byCompany = new Map();
  const byDepartment = new Map();
  const byLocation = new Map();
  const byMedical = new Map();
  const byGatePass = new Map();
  const byTraining = new Map();
  const byPid = new Map();
  const byPosition = new Map();
  const byManager = new Map();
  const pidExpiry = { expired: 0, '0-15': 0, '16-30': 0, '31-45': 0, '46-90': 0, '90+': 0, noDate: 0 };

  let fullyComplete = 0, missingMed = 0, missingGp = 0, missingTrain = 0, missingPid = 0;

  for (const e of data) {
    const f = empFlags(e);

    // Outside / COMO Camp cards — counted from current_location (Location/Mobilized),
    // the same field the COMO Camp page tab filter uses.
    const curLoc = (e.current_location || '').trim().toUpperCase();
    if (curLoc === 'OUTSIDE') kpi.outside++;
    if (curLoc === 'COMO CAMP') kpi.comoCamp++;

    if (f.medOk) kpi.medAccepted++; else kpi.medPending++;
    if (f.gpOk) kpi.gpValid++;
    if (!BUILT_IN_RLIC.has(f.gatePass) && f.gatePass !== 'NO RLIC PASS') kpi.gpUnderProcess++;
    if (f.gatePass === 'NO RLIC PASS') kpi.gpNoPass++;
    if (f.trainOk) kpi.trainDone++;
    if (f.training === 'ON-GOING') kpi.trainOnGoing++;
    if (f.training === 'PENDING' || f.training === 'TO BE SCHEDULED') kpi.trainPending++;
    if (f.pidOk) kpi.pidValid++;
    if (f.pid === 'SOON TO EXPIRE') kpi.pidSoon++;
    if (f.pid === 'EXPIRED PID PASS') kpi.pidExpired++;
    if (f.pid === 'NO PID PASS') kpi.noPid++;
    if (!BUILT_IN_PID.has(f.pid)) kpi.pidRenewal++;

    if (f.isFullyComplete) fullyComplete++;
    if (!f.medOk) missingMed++;
    if (!f.gpOk) missingGp++;
    if (!f.trainOk) missingTrain++;
    if (!f.pidOk) missingPid++;

    byLocation.set(f.location, (byLocation.get(f.location) || 0) + 1);
    byMedical.set(f.medical, (byMedical.get(f.medical) || 0) + 1);
    byGatePass.set(f.gatePass, (byGatePass.get(f.gatePass) || 0) + 1);
    byTraining.set(f.training, (byTraining.get(f.training) || 0) + 1);
    byPid.set(f.pid, (byPid.get(f.pid) || 0) + 1);

    if (!byCompany.has(f.company)) byCompany.set(f.company, newBucket());
    if (!byDepartment.has(f.department)) byDepartment.set(f.department, newBucket());
    if (!byPosition.has(f.position)) byPosition.set(f.position, newBucket());
    if (!byManager.has(f.manager)) byManager.set(f.manager, newBucket());
    addCompliance(byCompany.get(f.company), f);
    addCompliance(byDepartment.get(f.department), f);
    addCompliance(byPosition.get(f.position), f);
    addCompliance(byManager.get(f.manager), f);

    if (f.pidDays === null) pidExpiry.noDate++;
    else if (f.pidDays < 0) pidExpiry.expired++;
    else if (f.pidDays <= 15) pidExpiry['0-15']++;
    else if (f.pidDays <= 30) pidExpiry['16-30']++;
    else if (f.pidDays <= 45) pidExpiry['31-45']++;
    else if (f.pidDays <= 90) pidExpiry['46-90']++;
    else pidExpiry['90+']++;
  }

  return {
    kpi, byCompany, byDepartment, byLocation, byMedical, byGatePass, byTraining, byPid,
    byPosition, byManager, pidExpiry,
    fullyComplete, missingMed, missingGp, missingTrain, missingPid,
  };
}

// ── Display orders, labels & colors ────────────────────────────────────────
export const MEDICAL_ORDER = ['ACCEPTED', 'WAITING TR APPROVAL', 'RE-ASSESS', 'REJECTED', 'RECALLED', 'NO MEDICAL RECORD'];
export const MEDICAL_LABELS = {
  'ACCEPTED': 'Accepted', 'WAITING TR APPROVAL': 'Waiting TR', 'RE-ASSESS': 'Re-Assess',
  'REJECTED': 'Rejected', 'RECALLED': 'Recalled', 'NO MEDICAL RECORD': 'No Medical Record',
};
export const GATEPASS_ORDER = ['VALID RLIC PASS', 'SOON TO EXPIRE', 'EXPIRED RLIC PASS', 'NO RLIC PASS'];
export const GATEPASS_LABELS = {
  'VALID RLIC PASS': 'Valid', 'SOON TO EXPIRE': 'Soon', 'EXPIRED RLIC PASS': 'Expired', 'NO RLIC PASS': 'No Pass',
};
export const TRAINING_ORDER = ['DONE', 'ON-GOING', 'SCHEDULED', 'TO BE SCHEDULED', 'PENDING', 'ABSENT', 'NOT REQUIRED', 'RECALLED', 'NO RECORD'];
export const TRAINING_LABELS = {
  'DONE': 'Done', 'ON-GOING': 'On-Going', 'SCHEDULED': 'Scheduled', 'TO BE SCHEDULED': 'To Be Scheduled',
  'PENDING': 'Pending', 'ABSENT': 'Absent', 'NOT REQUIRED': 'N/A', 'RECALLED': 'Recalled', 'NO RECORD': 'No Record',
};
export const PID_ORDER = ['VALID PID PASS', 'SOON TO EXPIRE', 'EXPIRED PID PASS', 'NO PID PASS'];
export const PID_LABELS = {
  'VALID PID PASS': 'Valid', 'SOON TO EXPIRE': 'Soon', 'EXPIRED PID PASS': 'Expired', 'NO PID PASS': 'No PID',
};

export const STATUS_COLORS = {
  'ACCEPTED': '#10b981', 'WAITING TR APPROVAL': '#f59e0b', 'RE-ASSESS': '#3b82f6', 'REJECTED': '#ef4444', 'RECALLED': '#a855f7', 'NO MEDICAL RECORD': '#94a3b8',
  'VALID RLIC PASS': '#10b981', 'SOON TO EXPIRE': '#f59e0b', 'EXPIRED RLIC PASS': '#ef4444', 'NO RLIC PASS': '#94a3b8',
  'VALID PID PASS': '#10b981', 'SOON TO EXPIRE': '#f59e0b', 'EXPIRED PID PASS': '#ef4444', 'NO PID PASS': '#94a3b8',
  'DONE': '#10b981', 'ON-GOING': '#3b82f6', 'SCHEDULED': '#f59e0b', 'TO BE SCHEDULED': '#f59e0b',
  'PENDING': '#94a3b8', 'ABSENT': '#ef4444', 'NOT REQUIRED': '#94a3b8', 'RECALLED': '#a855f7', 'NO RECORD': '#cbd5e1',
};

export const PID_EXPIRY_GROUPS = [
  { key: 'expired', label: 'Expired', color: '#ef4444' },
  { key: '0-15', label: '0–15 Days', color: '#ef4444' },
  { key: '16-30', label: '16–30 Days', color: '#f59e0b' },
  { key: '31-45', label: '31–45 Days', color: '#f59e0b' },
  { key: '46-90', label: '46–90 Days', color: '#3b82f6' },
  { key: '90+', label: 'More Than 90 Days', color: '#10b981' },
  { key: 'noDate', label: 'No Expiry Date', color: '#94a3b8' },
];

/** Build a status-overview item list: known categories first (in order), unknowns appended. */
export function orderedItems(map, order, labels, colorMap) {
  const known = order.filter(k => map.has(k)).map(k => ({
    key: k, label: labels[k] || k, value: map.get(k), color: colorMap[k] || '#3b82f6',
  }));
  const knownKeys = new Set(order);
  const unknowns = [...map.entries()]
    .filter(([k]) => !knownKeys.has(k))
    .map(([k, v]) => ({ key: k, label: k, value: v, color: colorMap[k] || '#3b82f6' }));
  return [...known, ...unknowns];
}

/** Headcount items (company / department / location), sorted descending. */
export function countItems(map, color = '#3b82f6') {
  return [...map.entries()]
    .map(([k, v]) => ({ key: k, label: k, value: v, color }))
    .sort((a, b) => b.value - a.value);
}

/** Compliance bucket items (company / department / position / manager). */
export function complianceItems(map, sortKey = 'total', sortDir = 'desc') {
  const items = [...map.entries()].map(([k, b]) => ({
    key: k, label: k,
    total: b.total, medAccepted: b.medAccepted, gpValid: b.gpValid,
    trainDone: b.trainDone, pidValid: b.pidValid, fullyComplete: b.fullyComplete,
    completePct: b.total ? Math.round((b.fullyComplete / b.total) * 100) : 0,
  }));
  items.sort((a, b) => (sortDir === 'desc' ? b[sortKey] - a[sortKey] : a[sortKey] - b[sortKey]));
  return items;
}