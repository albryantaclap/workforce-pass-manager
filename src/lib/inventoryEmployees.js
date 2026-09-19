/**
 * fetchAllEmployees — loads all personnel from the centralized Workforce
 * Master List (Employee entity). This is the single source of truth for
 * employee data across the Inventory module.
 */
import { base44 } from '@/api/base44Client';

export async function fetchAllEmployees() {
  const all = await base44.entities.Employee.list('-created_date', 100000);
  return all.filter(e => e.is_active !== false && e.personnel_status !== 'Demobilized');
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