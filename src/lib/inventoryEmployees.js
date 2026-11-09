/**
 * Personnel access for the Inventory module.
 *
 * `fetchAllEmployees` is the active-workforce list used where an item is being
 * issued (Stock Out). Employee Issuance also has to reach historical personnel,
 * so it searches the Master List directly through `searchIssuanceEmployees`,
 * which returns one page of matches plus the total — nothing is duplicated and
 * no employee is excluded just because their status is Inactive.
 */
import { base44 } from '@/api/base44Client';

const EMP = base44.entities.Employee;

/**
 * @param {{ includeInactive?: boolean }} [options]
 * Active workforce by default; pass { includeInactive: true } for every record.
 */
export async function fetchAllEmployees(options) {
  const includeInactive = options?.includeInactive === true;
  const all = await EMP.list('-created_date', 100000);
  if (includeInactive) return all;
  return all.filter(e => e.is_active !== false && e.personnel_status !== 'Demobilized');
}

/** Inactive = the Master List status is Inactive (is_active is kept in sync). */
export function employeeStatus(employee) {
  const inactive = employee?.personnel_status === 'Inactive' || employee?.is_active === false;
  return { inactive, label: inactive ? 'Inactive' : 'Active' };
}

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const STATUS_CLAUSES = {
  active: () => ({ personnel_status: { $ne: 'Inactive' } }),
  inactive: () => ({ personnel_status: 'Inactive' }),
};

/**
 * One page of Master List employees for Employee Issuance, filtered on the
 * server so the browser never holds the whole workforce.
 *
 * @returns {Promise<{items: object[], total: number}>}
 */
export async function searchIssuanceEmployees({
  search = '', company = '', department = '', designation = '',
  status = 'all', page = 0, rowsPerPage = 50,
} = {}) {
  const clauses = [];
  const term = search.trim();
  if (term) {
    const rx = { $regex: escapeRegex(term), $options: 'i' };
    clauses.push({
      $or: [
        { name: rx }, { pid: rx }, { qid_no: rx }, { staff_no: rx },
        { company: rx }, { department: rx },
        { position_application: rx }, { designation_org_chart: rx },
      ],
    });
  }
  if (company) clauses.push({ company });
  if (department) clauses.push({ department });
  if (designation) {
    clauses.push({ $or: [{ position_application: designation }, { designation_org_chart: designation }] });
  }
  const statusClause = STATUS_CLAUSES[status];
  if (statusClause) clauses.push(statusClause());

  const query = clauses.length ? { $and: clauses } : {};
  const safePage = Math.max(0, Number(page) || 0);
  const size = Math.max(1, Number(rowsPerPage) || 50);

  const [total, result] = await Promise.all([
    EMP.count(query),
    EMP.filter(query, { sort: 'name', limit: size * (safePage + 1) }),
  ]);

  return { items: (result.items || []).slice(safePage * size), total };
}

/**
 * IDs of every Master List record whose status is Inactive. Used by the
 * inventory employee-status filters without loading the whole workforce.
 */
export async function fetchInactiveEmployeeIds() {
  const result = await EMP.filter({ personnel_status: 'Inactive' }, { limit: 100000 });
  return new Set((result.items || []).map(e => e.id));
}

/**
 * Build a map of employee_id → { itemCount, totalQty } from stock-out transactions.
 * Used by Employee Issuance to show issuance stats per employee without N+1 queries.
 */
export function buildIssuanceStatsMap(transactions) {
  const map = new Map();
  for (const t of transactions) {
    if (t.transaction_type !== 'STOCK_OUT' || t.is_deleted) continue;
    const empId = t.employee_id;
    if (!empId) continue;
    if (!map.has(empId)) {
      map.set(empId, { itemCount: new Set(), totalQty: 0 });
    }
    const stats = map.get(empId);
    if (t.item_id) stats.itemCount.add(t.item_id);
    stats.totalQty += (t.quantity_abs || 0);
  }
  // Convert Sets to counts
  const result = new Map();
  for (const [id, stats] of map) {
    result.set(id, { itemCount: stats.itemCount.size, totalQty: stats.totalQty });
  }
  return result;
}