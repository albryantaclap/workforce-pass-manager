/**
 * Master List — ONE shared filter definition for all four personnel tabs.
 *
 * The tab decides the BASE DATASET only:
 *
 *   All Personnel   → every person on the active roster
 *   Active on Site  → personnel_status = 'Active on Site'
 *   Onboarding      → personnel_status = 'Onboarding'
 *   Inactive        → personnel_status = 'Inactive'
 *
 * The filter set, its order, its options and its behaviour are identical on all
 * four tabs, so switching tabs can never change how filtering works — it only
 * changes the dataset the same filters are applied to.
 *
 * Filtering is expressed twice, with ONE meaning:
 *
 *   buildMasterListQuery()     the part the database can apply, so only matching
 *                              records travel to the browser. Always a SUPERSET
 *                              of the predicate below.
 *   matchesMasterListFilters() the authoritative rule, applied to the rows that
 *                              arrive. It also covers the statuses that are
 *                              derived from dates and camp stays (RLIC / gate
 *                              pass, PID, camp) which no query can express.
 */
import { ACTIVE_ON_SITE, ONBOARDING, INACTIVE, resolvePersonnelStatus } from '@/lib/personnelStatus';
import { CAMP_STATUS, resolveCampStatus } from '@/lib/campStatus';
import { computePassStatus, MEDICAL_RESULTS, PID_STATUSES } from '@/utils/constants';
import { ATT_STATUS } from '@/lib/attendanceUtils';

export const MASTER_LIST_STORAGE_KEY = 'masterlist_filters';
export const MASTER_LIST_PAGE_SIZE = 50;

// ── Tabs ─────────────────────────────────────────────────────────────────────
/** The base dataset condition of each tab — the only thing a tab changes. */
export const TAB_DATASET_QUERY = {
  all: { is_active: true },
  active_on_site: { is_active: true, personnel_status: ACTIVE_ON_SITE },
  onboarding: { is_active: true, personnel_status: ONBOARDING },
  inactive: { is_active: false },
};

/** Noun used for each tab's total, e.g. "1,453 inactive personnel". */
export const TAB_TOTAL_LABEL = {
  all: 'active',
  active_on_site: 'active on site',
  onboarding: 'onboarding',
  inactive: 'inactive',
};

/**
 * The same base rule applied to the rows that arrive (legacy values included) —
 * the ONE partition the four tab counts AND the tables are both built from, so a
 * tab's count and the rows it lists can never disagree:
 *
 *   All Personnel    the active roster (Active on Site, Onboarding, no status yet)
 *   Active on Site   active roster + status 'Active on Site'
 *   Onboarding       active roster + status 'Onboarding'
 *   Inactive         is_active = false + status 'Inactive' (legacy 'Demobilized' included)
 */
export const matchesTabDataset = (emp, tab) => {
  if (!emp) return false;
  const status = resolvePersonnelStatus(emp);
  if (tab === 'inactive') return emp.is_active === false && status === INACTIVE;
  if (emp.is_active !== true) return false;
  if (tab === 'active_on_site') return status === ACTIVE_ON_SITE;
  if (tab === 'onboarding') return status === ONBOARDING;
  return true;
};

/**
 * The four tab counts for a set of rows.
 *
 * Always called with the FULL filtered dataset — never with the page on screen —
 * so a count is the total number of matching records, whatever the page size is.
 * */
export const countMasterListTabs = (rows) =>
  (rows || []).reduce(
    (counts, emp) => {
      if (matchesTabDataset(emp, 'all')) counts.all += 1;
      if (matchesTabDataset(emp, 'active_on_site')) counts.active_on_site += 1;
      if (matchesTabDataset(emp, 'onboarding')) counts.onboarding += 1;
      if (matchesTabDataset(emp, 'inactive')) counts.inactive += 1;
      return counts;
    },
    { all: 0, active_on_site: 0, onboarding: 0, inactive: 0 }
  );

// ── Camp status (accommodation) ───────────────────────────────────────────────
/** Camp-status filter values ↔ the camp status each one means. */
export const CAMP_STATUS_BY_FILTER = {
  [ATT_STATUS.CHECKED_IN]: CAMP_STATUS.INSIDE_CAMP,
  [ATT_STATUS.CHECKED_OUT]: CAMP_STATUS.CHECKED_OUT,
  [ATT_STATUS.NOT_CHECKED_IN]: CAMP_STATUS.NOT_CHECKED_IN,
};

export const CAMP_STATUS_FILTER_OPTIONS = [
  { value: ATT_STATUS.CHECKED_IN, label: 'Inside Camp' },
  { value: ATT_STATUS.CHECKED_OUT, label: 'Checked Out' },
  { value: ATT_STATUS.NOT_CHECKED_IN, label: 'Not Checked In' },
];

// ── Filter state ─────────────────────────────────────────────────────────────
/** Date-range filters: [from key, to key, employee field]. */
export const MASTER_DATE_RANGES = [
  ['trainingScheduledFrom', 'trainingScheduledTo', 'training_date_scheduled'],
  ['medicalTrApprovedFrom', 'medicalTrApprovedTo', 'ftw_approved_date'],
  ['gpIssueFrom', 'gpIssueTo', 'gate_pass_issue_date'],
  ['gpReceivedFrom', 'gpReceivedTo', 'gate_pass_received_date'],
  ['pidIssueFrom', 'pidIssueTo', 'pid_issue_date'],
  ['inactiveFrom', 'inactiveTo', 'inactive_date'],
];

export const createEmptyMasterFilters = () => ({
  search: '',
  companies: [],
  positions: [],
  departments: [],
  rlic: 'all',
  locations: 'all',
  dir: 'all',
  pidStatuses: [],
  gatePasses: [],
  medicals: [],
  training: 'all',
  campStatus: 'all',
  managerIds: [],
  dates: MASTER_DATE_RANGES.reduce((acc, [from, to]) => ({ ...acc, [from]: '', [to]: '' }), {}),
});

const asArray = (value) => (Array.isArray(value) ? value : []);

/** Restores the shared filter state (kept across tabs and page visits). */
export function loadMasterFilters() {
  const base = createEmptyMasterFilters();
  try {
    const saved = JSON.parse(sessionStorage.getItem(MASTER_LIST_STORAGE_KEY)) || {};
    return {
      ...base,
      ...saved,
      search: typeof saved.search === 'string' ? saved.search : '',
      companies: asArray(saved.companies),
      positions: asArray(saved.positions),
      departments: asArray(saved.departments),
      pidStatuses: asArray(saved.pidStatuses),
      gatePasses: asArray(saved.gatePasses),
      medicals: asArray(saved.medicals),
      managerIds: asArray(saved.managerIds),
      dates: { ...base.dates, ...(saved.dates || {}) },
    };
  } catch {
    return base;
  }
}

export function saveMasterFilters(filters) {
  try { sessionStorage.setItem(MASTER_LIST_STORAGE_KEY, JSON.stringify(filters)); } catch { /* ignore */ }
}

const list = (value) => (Array.isArray(value) ? value : value && value !== 'all' ? [value] : []);

/** True when any shared filter is applied — same rule on every tab. */
export const hasActiveMasterFilters = (filters) => {
  const f = filters || createEmptyMasterFilters();
  const d = f.dates || {};
  return !!f.search ||
    list(f.companies).length > 0 || list(f.positions).length > 0 || list(f.departments).length > 0 ||
    list(f.pidStatuses).length > 0 || list(f.gatePasses).length > 0 || list(f.medicals).length > 0 ||
    list(f.managerIds).length > 0 ||
    (f.rlic && f.rlic !== 'all') || (f.locations && f.locations !== 'all') || (f.dir && f.dir !== 'all') ||
    (f.training && f.training !== 'all') || (f.campStatus && f.campStatus !== 'all') ||
    MASTER_DATE_RANGES.some(([from, to]) => d[from] || d[to]);
};

/** Human-readable list of the filters in force (used by the print reports). */
export function activeMasterFilterLabels(filters) {
  const f = filters || createEmptyMasterFilters();
  const d = f.dates || {};
  const items = [];
  if (f.search) items.push(`Search: "${f.search}"`);
  if (list(f.companies).length) items.push(`Company: ${list(f.companies).join(', ')}`);
  if (list(f.positions).length) items.push(`Position: ${list(f.positions).join(', ')}`);
  if (list(f.departments).length) items.push(`Department: ${list(f.departments).join(', ')}`);
  if (f.rlic && f.rlic !== 'all') items.push(`RLIC: ${f.rlic}`);
  if (f.locations && f.locations !== 'all') items.push(`Location: ${f.locations}`);
  if (f.dir && f.dir !== 'all') items.push(`DIR/INDIR: ${f.dir}`);
  if (list(f.gatePasses).length) items.push(`Gate Pass Status: ${list(f.gatePasses).join(', ')}`);
  if (list(f.pidStatuses).length) {
    items.push(`PID Status: ${list(f.pidStatuses).map(s => PID_STATUSES.find(x => x.value === s)?.label || s).join(', ')}`);
  }
  if (list(f.medicals).length) {
    items.push(`Medical Result: ${list(f.medicals).map(m => MEDICAL_RESULTS.find(r => r.value === m)?.label || m).join(', ')}`);
  }
  if (f.training && f.training !== 'all') items.push(`Training Status: ${f.training}`);
  if (f.campStatus && f.campStatus !== 'all') {
    const label = CAMP_STATUS_FILTER_OPTIONS.find(o => o.value === f.campStatus)?.label || f.campStatus;
    items.push(`Camp Status: ${label}`);
  }
  if (list(f.managerIds).length) items.push(`Manager: ${list(f.managerIds).length} selected`);
  MASTER_DATE_RANGES.forEach(([from, to, field]) => {
    if (d[from] || d[to]) items.push(`${field}: ${d[from] || '…'} → ${d[to] || '…'}`);
  });
  return items;
}

// ── Database side ────────────────────────────────────────────────────────────
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The fields the shared search box looks in — same on every tab. */
export const MASTER_SEARCH_FIELDS = [
  'name', 'qid_no', 'pp_no', 'pid', 'staff_no', 'nationality',
  'company', 'designation_org_chart', 'position_application',
];

/**
 * The database part of the shared filters — every filter the database can apply,
 * with NO tab base dataset. This is the query the Master List runs: its result
 * covers all four tab datasets, which is what lets the tab counts be computed
 * from the same rows the table is built from.
 *
 * Deliberately a superset of the predicate below — records that pass this query
 * are still checked against the exact rule.
 */
export function buildMasterListFilterQuery(filters, managers = []) {
  const f = filters || createEmptyMasterFilters();
  const d = f.dates || {};
  const query = {};

  if (list(f.companies).length) query.company = { $in: list(f.companies) };
  if (list(f.departments).length) query.department = { $in: list(f.departments) };
  if (f.training && f.training !== 'all') query.training_status = f.training;
  if (f.locations && f.locations !== 'all') query.current_location = f.locations;
  if (f.dir && f.dir !== 'all') query.dir_indir = f.dir;

  // Independent OR groups ($and of $or) — each one mirrors the predicate.
  const groups = [];

  if (list(f.positions).length) {
    const positions = list(f.positions);
    groups.push({
      $or: [
        { designation_org_chart: { $in: positions } },
        { position_application: { $in: positions } },
      ],
    });
  }

  if (list(f.medicals).length) {
    const selected = list(f.medicals);
    // 'NEW' is both a stored medical result and the "no result yet" option, so
    // it matches its own value plus records with no result at all.
    const branches = [{ ftw_result: { $in: selected } }];
    if (selected.includes('NEW')) {
      branches.push({ ftw_result: { $in: ['', null] } }, { ftw_result: { $exists: false } });
    }
    groups.push({ $or: branches });
  }

  if (list(f.managerIds).length) {
    const managerIds = list(f.managerIds);
    const branches = [{ assigned_manager_id: { $in: managerIds } }];
    const labels = managerIds
      .map(id => managers.find(m => m.id === id)?.label)
      .filter(Boolean);
    if (labels.length) branches.push({ assigned_manager_name: { $in: labels } });
    groups.push({ $or: branches });
  }

  const term = (f.search || '').trim();
  if (term) {
    const pattern = escapeRegex(term);
    groups.push({ $or: MASTER_SEARCH_FIELDS.map(field => ({ [field]: { $regex: pattern, $options: 'i' } })) });
  }

  MASTER_DATE_RANGES.forEach(([from, to, field]) => {
    const range = {};
    if (d[from]) range.$gte = d[from];
    if (d[to]) range.$lte = d[to];
    if (Object.keys(range).length) query[field] = range;
  });

  if (groups.length) query.$and = groups;
  return query;
}

/**
 * The database query for ONE tab on its own: its base dataset plus the shared
 * filters. Used by callers that need a single tab's records.
 */
export function buildMasterListQuery(filters, tab, managers = []) {
  return {
    ...(TAB_DATASET_QUERY[tab] || TAB_DATASET_QUERY.all),
    ...buildMasterListFilterQuery(filters, managers),
  };
}

// ── Exact rule (browser side) ────────────────────────────────────────────────
/** Date-range test on a YYYY-MM-DD style value (an empty bound is open). */
const inRange = (value, from, to) => {
  const d = value ? String(value).substring(0, 10) : '';
  if (from && (!d || d < from)) return false;
  if (to && (!d || d > to)) return false;
  return true;
};

/**
 * THE shared filter rule — identical for All Personnel, Active on Site,
 * Onboarding and Inactive.
 *
 * @param emp     an employee record
 * @param filters the shared filter state (see createEmptyMasterFilters)
 * @param ctx     { latestByPersonnel, managers }
 */
export function matchesMasterListFilters(emp, filters, ctx = {}) {
  if (!emp) return false;
  const f = filters || createEmptyMasterFilters();
  const d = f.dates || {};
  const { latestByPersonnel, managers = [] } = ctx;

  const term = (f.search || '').trim().toLowerCase();
  if (term) {
    const matched = MASTER_SEARCH_FIELDS.some(field => String(emp[field] ?? '').toLowerCase().includes(term));
    if (!matched) return false;
  }

  if (list(f.companies).length && !list(f.companies).includes(emp.company)) return false;
  if (list(f.positions).length &&
    !list(f.positions).includes(emp.designation_org_chart) &&
    !list(f.positions).includes(emp.position_application)) return false;
  if (list(f.departments).length && !list(f.departments).includes(emp.department)) return false;
  if (list(f.medicals).length) {
    const selected = list(f.medicals);
    const ok = selected.includes(emp.ftw_result) || (selected.includes('NEW') && !emp.ftw_result);
    if (!ok) return false;
  }
  if (f.training && f.training !== 'all' && emp.training_status !== f.training) return false;

  // Gate pass / RLIC — derived from the expiry date, so never a stored-field test.
  const effectiveRlic = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
  if (f.rlic && f.rlic !== 'all' && effectiveRlic !== f.rlic) return false;
  if (list(f.gatePasses).length && !list(f.gatePasses).includes(effectiveRlic)) return false;

  // Project ID status — derived the same way.
  if (list(f.pidStatuses).length) {
    const effectivePid = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
    if (!list(f.pidStatuses).includes(effectivePid)) return false;
  }

  if (f.locations && f.locations !== 'all' && emp.current_location !== f.locations) return false;
  if (f.dir && f.dir !== 'all' && emp.dir_indir !== f.dir) return false;

  // COMO Camp status — one canonical resolution (stay first, stored status as
  // the fallback, demobilization always winning).
  if (f.campStatus && f.campStatus !== 'all') {
    const target = CAMP_STATUS_BY_FILTER[f.campStatus];
    if (target && resolveCampStatus(emp, latestByPersonnel?.get(emp.id)) !== target) return false;
  }

  if (list(f.managerIds).length) {
    const matchedManager = list(f.managerIds).some(mid =>
      emp.assigned_manager_id
        ? emp.assigned_manager_id === mid
        : emp.assigned_manager_name === managers.find(m => m.id === mid)?.label
    );
    if (!matchedManager) return false;
  }

  return MASTER_DATE_RANGES.every(([from, to, field]) => inRange(emp[field], d[from], d[to]));
}

/** Applies the shared rule to a set of rows. */
export const filterMasterRows = (rows, filters, ctx) =>
  (rows || []).filter(emp => matchesMasterListFilters(emp, filters, ctx));