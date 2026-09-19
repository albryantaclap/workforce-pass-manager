/**
 * Inventory Service — shared CRUD and calculation logic for the Inventory
 * Management module. All available-stock figures are calculated dynamically
 * from the InventoryTransaction ledger (SUM of signed quantities), never
 * stored as a manually editable total.
 */
import { base44 } from '@/api/base44Client';

const TXN = base44.entities.InventoryTransaction;
const ITEM = base44.entities.InventoryItem;
const LOOKUP = base44.entities.InventoryLookup;

// ── Items ──────────────────────────────────────────────────────────────

export async function fetchItems(includeArchived = false) {
  const all = await ITEM.list('-created_date', 100000);
  return all.filter(i => includeArchived || !i.is_archived);
}

export async function fetchItemBySn(itemSn) {
  const all = await ITEM.filter({ item_sn: itemSn }, '-created_date', 1);
  return all[0] || null;
}

export async function fetchItemById(id) {
  return ITEM.get(id);
}

export async function createItem(data) {
  return ITEM.create(data);
}

export async function updateItem(id, data) {
  return ITEM.update(id, data);
}

export async function archiveItem(id, archivedBy) {
  return ITEM.update(id, { is_archived: true, updated_by: archivedBy });
}

export async function unarchiveItem(id, updatedBy) {
  return ITEM.update(id, { is_archived: false, updated_by: updatedBy });
}

// ── Transactions ──────────────────────────────────────────────────────

export async function fetchTransactions(filters = {}) {
  const all = await TXN.list('-created_date', 100000);
  let result = all.filter(t => !t.is_deleted);

  if (filters.transaction_type) {
    result = result.filter(t => t.transaction_type === filters.transaction_type);
  }
  if (filters.item_id) {
    result = result.filter(t => t.item_id === filters.item_id);
  }
  if (filters.item_sn) {
    result = result.filter(t => t.item_sn === filters.item_sn);
  }
  if (filters.store) {
    result = result.filter(t => t.store === filters.store);
  }
  if (filters.supplier) {
    result = result.filter(t => t.supplier === filters.supplier);
  }
  if (filters.site) {
    result = result.filter(t => t.site === filters.site);
  }
  if (filters.employee_id) {
    result = result.filter(t => t.employee_id === filters.employee_id);
  }
  if (filters.pid) {
    result = result.filter(t => t.pid === filters.pid);
  }
  if (filters.fromDate) {
    result = result.filter(t => t.transaction_date >= filters.fromDate);
  }
  if (filters.toDate) {
    result = result.filter(t => t.transaction_date <= filters.toDate);
  }
  return result;
}

/**
 * Calculate current available stock for an item.
 * Available = SUM(Stock In) - SUM(Stock Out)
 * Uses only non-deleted transactions.
 */
export function calculateAvailableStock(transactions, itemId) {
  return transactions
    .filter(t => t.item_id === itemId && !t.is_deleted)
    .reduce((sum, t) => sum + (t.quantity || 0), 0);
}

/**
 * Calculate stock-in total for an item (sum of positive quantities).
 */
export function calculateStockIn(transactions, itemId) {
  return transactions
    .filter(t => t.item_id === itemId && !t.is_deleted && t.transaction_type === 'STOCK_IN')
    .reduce((sum, t) => sum + (t.quantity_abs || 0), 0);
}

/**
 * Calculate stock-out total for an item (sum of absolute negative quantities).
 */
export function calculateStockOut(transactions, itemId) {
  return transactions
    .filter(t => t.item_id === itemId && !t.is_deleted && t.transaction_type === 'STOCK_OUT')
    .reduce((sum, t) => sum + (t.quantity_abs || 0), 0);
}

/**
 * Get stock status based on available quantity and minimum level.
 */
export function getStockStatus(availableQty, minLevel) {
  if (availableQty <= 0) return 'Out of Stock';
  if (availableQty <= (minLevel || 0)) return 'Low Stock';
  return 'Available';
}

/**
 * Create a Stock In transaction.
 * quantity is always positive for STOCK_IN.
 */
export async function createStockIn(data, user) {
  const item = await fetchItemById(data.item_id);
  if (!item) throw new Error('Item not found');

  const allTxns = await fetchTransactions({ item_id: data.item_id });
  const prevBalance = calculateAvailableStock(allTxns, data.item_id);
  const newBalance = prevBalance + data.quantity;

  return TXN.create({
    transaction_date: data.transaction_date,
    transaction_type: 'STOCK_IN',
    item_id: data.item_id,
    item_sn: item.item_sn,
    item_name: item.item_name,
    unit: item.unit,
    quantity: data.quantity,
    quantity_abs: data.quantity,
    dn_no: data.dn_no || '',
    mrf_no: data.mrf_no || '',
    lpo: data.lpo || '',
    supplier: data.supplier || '',
    store: data.store || '',
    previous_balance: prevBalance,
    new_balance: newBalance,
    created_by: user?.email || '',
    created_by_name: user?.full_name || user?.email || '',
    remarks: data.remarks || '',
  });
}

/**
 * Create a Stock Out transaction.
 * Validates that sufficient stock is available before issuing.
 * quantity is stored as negative for STOCK_OUT.
 */
export async function createStockOut(data, user) {
  const item = await fetchItemById(data.item_id);
  if (!item) throw new Error('Item not found');

  const allTxns = await fetchTransactions({ item_id: data.item_id });
  const available = calculateAvailableStock(allTxns, data.item_id);

  if (data.quantity > available) {
    throw new Error(
      `Insufficient stock. Available quantity: ${available} ${item.unit || ''}.`.trim()
    );
  }

  const newBalance = available - data.quantity;

  return TXN.create({
    transaction_date: data.transaction_date,
    transaction_type: 'STOCK_OUT',
    item_id: data.item_id,
    item_sn: item.item_sn,
    item_name: item.item_name,
    unit: item.unit,
    quantity: -data.quantity,
    quantity_abs: data.quantity,
    iv_no: data.iv_no || '',
    site: data.site || '',
    store: data.store || '',
    pid: data.pid || '',
    employee_id: data.employee_id || '',
    employee_name: data.employee_name || '',
    company: data.company || '',
    department: data.department || '',
    designation: data.designation || '',
    previous_balance: available,
    new_balance: newBalance,
    created_by: user?.email || '',
    created_by_name: user?.full_name || user?.email || '',
    remarks: data.remarks || '',
  });
}

/**
 * Soft-delete a transaction (correction). The original is retained for audit.
 */
export async function deleteTransaction(id, user, reason) {
  return TXN.update(id, {
    is_deleted: true,
    deleted_by: user?.email || '',
    deletion_reason: reason || '',
  });
}

// ── Lookups ────────────────────────────────────────────────────────────

export async function fetchLookups(type) {
  const all = await LOOKUP.filter({ type }, '-created_date', 10000);
  return all.filter(l => !l.is_deleted && l.is_active !== false);
}

export async function fetchAllLookups() {
  const all = await LOOKUP.list('-created_date', 10000);
  return all.filter(l => !l.is_deleted);
}

export async function createLookup(data) {
  return LOOKUP.create({
    ...data,
    value: (data.value || data.label || '').toUpperCase(),
    label: data.label || data.value,
    is_active: true,
  });
}

export async function updateLookup(id, data) {
  return LOOKUP.update(id, data);
}

export async function deleteLookup(id, deletedBy) {
  return LOOKUP.update(id, { is_deleted: true, updated_by: deletedBy });
}

// ── Dashboard Aggregations ─────────────────────────────────────────────

/**
 * Calculate all dashboard KPIs from items + transactions.
 */
export function calculateDashboardStats(items, transactions) {
  const activeItems = items.filter(i => !i.is_archived);
  const itemIds = new Set(activeItems.map(i => i.id));

  let totalAvailable = 0;
  let totalStockIn = 0;
  let totalStockOut = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  const employeesWithIssuance = new Set();

  for (const item of activeItems) {
    const available = calculateAvailableStock(transactions, item.id);
    const stockIn = calculateStockIn(transactions, item.id);
    const stockOut = calculateStockOut(transactions, item.id);
    totalAvailable += available;
    totalStockIn += stockIn;
    totalStockOut += stockOut;

    const status = getStockStatus(available, item.min_stock_level);
    if (status === 'Low Stock') lowStockCount++;
    if (status === 'Out of Stock') outOfStockCount++;
  }

  // Employees with issued items
  for (const t of transactions) {
    if (t.transaction_type === 'STOCK_OUT' && t.employee_id) {
      employeesWithIssuance.add(t.employee_id);
    }
  }

  // Stock by store
  const stockByStore = {};
  for (const t of transactions) {
    if (t.is_deleted) continue;
    const store = t.store || 'Unspecified';
    if (!stockByStore[store]) stockByStore[store] = { store, stockIn: 0, stockOut: 0, available: 0 };
    if (t.transaction_type === 'STOCK_IN') stockByStore[store].stockIn += t.quantity_abs || 0;
    if (t.transaction_type === 'STOCK_OUT') stockByStore[store].stockOut += t.quantity_abs || 0;
    stockByStore[store].available += t.quantity || 0;
  }

  // Low stock alerts
  const lowStockAlerts = activeItems
    .map(i => ({
      item_sn: i.item_sn,
      item_name: i.item_name,
      unit: i.unit,
      available: calculateAvailableStock(transactions, i.id),
      min_level: i.min_stock_level || 0,
      status: getStockStatus(calculateAvailableStock(transactions, i.id), i.min_stock_level),
    }))
    .filter(a => a.status !== 'Available')
    .sort((a, b) => a.available - b.available);

  return {
    totalItems: activeItems.length,
    totalAvailable,
    totalStockIn,
    totalStockOut,
    lowStockCount,
    outOfStockCount,
    employeesWithIssuance: employeesWithIssuance.size,
    stockByStore: Object.values(stockByStore),
    lowStockAlerts,
  };
}

// ── Employee lookup (Master List integration) ──────────────────────────

/**
 * Find an employee by PID (staff_no), QID, or name from the Master List.
 */
export async function findEmployeeByPid(pid) {
  if (!pid) return null;
  const pidStr = String(pid).trim();
  const all = await base44.entities.Employee.list('-created_date', 100000);
  return all.find(e =>
    String(e.staff_no || '').trim() === pidStr ||
    String(e.pid || '').trim() === pidStr ||
    String(e.qid_no || '').trim() === pidStr
  ) || null;
}

/**
 * Search employees by name, PID, or QID.
 */
export async function searchEmployees(query, limit = 20) {
  if (!query || query.length < 2) return [];
  const q = query.toLowerCase();
  const all = await base44.entities.Employee.list('-created_date', 100000);
  return all
    .filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      String(e.staff_no || '').toLowerCase().includes(q) ||
      String(e.pid || '').toLowerCase().includes(q) ||
      String(e.qid_no || '').toLowerCase().includes(q)
    )
    .slice(0, limit);
}