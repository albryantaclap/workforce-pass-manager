/**
 * Inventory Service — shared CRUD and calculation logic for the Inventory
 * Management module. All available-stock figures are calculated dynamically
 * from the InventoryTransaction ledger (SUM of signed quantities), never
 * stored as a manually editable total.
 */
import { base44 } from '@/api/base44Client';
import { textValue } from '@/lib/inventoryText';

const TXN = base44.entities.InventoryTransaction;
const ITEM = base44.entities.InventoryItem;
const LOOKUP = base44.entities.InventoryLookup;

// Item name/unit leave this service as plain display text. Every inventory page,
// dropdown and export reads through here, so a value stored as an object — or as
// the leftover "[object Object]" placeholder — is never rendered raw.
const withItemText = (record) => ({
  ...record,
  item_name: textValue(record?.item_name),
  unit: textValue(record?.unit),
});

// ── Items ──────────────────────────────────────────────────────────────

export async function fetchItems(includeArchived = false) {
  const all = await ITEM.list('-created_date', 100000);
  return all
    .filter(i => includeArchived || !i.is_archived)
    .map(withItemText);
}

export async function fetchItemBySn(itemSn) {
  const all = await ITEM.filter({ item_sn: itemSn }, '-created_date', 1);
  return all[0] || null;
}

export async function fetchItemById(id) {
  return ITEM.get(id);
}

/**
 * Search inventory items by Item S.N. or Item Name (debounced from UI).
 * Returns a limited result set to avoid loading the full database.
 */
export async function searchItems(query, limit = 50) {
  const all = await ITEM.list('-created_date', 100000);
  let result = all.filter(i => !i.is_archived);
  if (query && query.trim()) {
    const q = query.toLowerCase();
    result = result.filter(i =>
      textValue(i.item_sn).toLowerCase().includes(q) ||
      textValue(i.item_name).toLowerCase().includes(q)
    );
  }
  return result.slice(0, limit).map(withItemText);
}

/**
 * Find items with names similar to the given name (for duplicate warning).
 */
export async function findSimilarItems(itemName, excludeId) {
  if (!itemName || !itemName.trim()) return [];
  const q = itemName.toLowerCase().trim();
  const all = await ITEM.list('-created_date', 100000);
  return all
    .filter(i => !i.is_archived && i.id !== excludeId && !!textValue(i.item_name) && (
      (i.item_name || '').toLowerCase().trim() === q ||
      (i.item_name || '').toLowerCase().includes(q) ||
      q.includes((i.item_name || '').toLowerCase())
    ))
    .slice(0, 10);
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
  return result.map(withItemText);
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
    dn_file_url: data.dn_file_url || '',
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
    voucher_file_url: data.voucher_file_url || '',
    remarks: data.remarks || '',
  });
}

/**
 * Generate an Internal Delivery Note number (IDN-YYYYMMDD-XXXX).
 */
export function generateInternalDnNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
  return `IDN-${ymd}-${rand}`;
}

/**
 * Upload a file (DN scan, store voucher, etc.) to public storage.
 */
export async function uploadInventoryFile(file) {
  const { file_url } = await base44.integrations.Core.UploadPublicFile({ file });
  return file_url;
}

/**
 * Create a Stock Transfer transaction (store to store).
 * Net quantity is 0 — total available stock is unchanged; only store distribution shifts.
 */
export async function createStockTransfer(data, user) {
  const item = await fetchItemById(data.item_id);
  if (!item) throw new Error('Item not found');

  const allTxns = await fetchTransactions({ item_id: data.item_id });
  const available = calculateAvailableStock(allTxns, data.item_id);

  if (data.quantity > available) {
    throw new Error(`Insufficient stock. Available: ${available} ${item.unit || ''}`.trim());
  }

  return TXN.create({
    transaction_date: data.transaction_date,
    transaction_type: 'TRANSFER',
    item_id: data.item_id,
    item_sn: item.item_sn,
    item_name: item.item_name,
    unit: item.unit,
    quantity: 0,
    quantity_abs: data.quantity,
    transfer_from_store: data.from_store || '',
    transfer_to_store: data.to_store || '',
    store: data.to_store || '',
    internal_dn_no: data.internal_dn_no || '',
    dn_file_url: data.dn_file_url || '',
    previous_balance: available,
    new_balance: available,
    created_by: user?.email || '',
    created_by_name: user?.full_name || user?.email || '',
    remarks: data.remarks || '',
  });
}

/**
 * Create a Return transaction (items returned by employee).
 * Quantity is positive — adds stock back to available.
 */
export async function createReturn(data, user) {
  const item = await fetchItemById(data.item_id);
  if (!item) throw new Error('Item not found');

  const allTxns = await fetchTransactions({ item_id: data.item_id });
  const prevBalance = calculateAvailableStock(allTxns, data.item_id);
  const newBalance = prevBalance + data.quantity;

  return TXN.create({
    transaction_date: data.transaction_date,
    transaction_type: 'RETURN',
    item_id: data.item_id,
    item_sn: item.item_sn,
    item_name: item.item_name,
    unit: item.unit,
    quantity: data.quantity,
    quantity_abs: data.quantity,
    store: data.store || '',
    return_of: data.original_txn_id || '',
    return_reason: data.return_reason || '',
    pid: data.pid || '',
    employee_id: data.employee_id || '',
    employee_name: data.employee_name || '',
    company: data.company || '',
    department: data.department || '',
    designation: data.designation || '',
    previous_balance: prevBalance,
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
 * Single-pass aggregation over the transaction ledger for performance.
 */
export function calculateDashboardStats(items, transactions) {
  const activeItems = items.filter(i => !i.is_archived);
  const archivedCount = items.filter(i => i.is_archived).length;
  const validTxns = transactions.filter(t => !t.is_deleted);

  // ── Single-pass per-item aggregate map ──
  const itemAggs = {}; // itemId -> { stockIn, stockOut, available, txnCount }
  for (const t of validTxns) {
    const id = t.item_id;
    if (!itemAggs[id]) itemAggs[id] = { stockIn: 0, stockOut: 0, available: 0, txnCount: 0 };
    itemAggs[id].txnCount++;
    if (t.transaction_type === 'STOCK_IN') {
      itemAggs[id].stockIn += t.quantity_abs || 0;
      itemAggs[id].available += t.quantity || 0;
    } else if (t.transaction_type === 'STOCK_OUT') {
      itemAggs[id].stockOut += t.quantity_abs || 0;
      itemAggs[id].available += t.quantity || 0;
    } else if (t.transaction_type === 'RETURN') {
      itemAggs[id].available += t.quantity || 0;
    }
  }

  let totalAvailable = 0;
  let totalStockIn = 0;
  let totalStockOut = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;
  let deadStockCount = 0;
  const employeesWithIssuance = new Set();

  for (const item of activeItems) {
    const agg = itemAggs[item.id] || { stockIn: 0, stockOut: 0, available: 0, txnCount: 0 };
    totalAvailable += agg.available;
    totalStockIn += agg.stockIn;
    totalStockOut += agg.stockOut;

    const status = getStockStatus(agg.available, item.min_stock_level);
    if (status === 'Low Stock') lowStockCount++;
    if (status === 'Out of Stock') outOfStockCount++;
    if (agg.txnCount === 0) deadStockCount++;
  }

  // Transaction counts
  const totalTransactions = validTxns.length;
  const stockInTxnCount = validTxns.filter(t => t.transaction_type === 'STOCK_IN').length;
  const stockOutTxnCount = validTxns.filter(t => t.transaction_type === 'STOCK_OUT').length;

  // Employees with issued items
  for (const t of validTxns) {
    if (t.transaction_type === 'STOCK_OUT' && t.employee_id) {
      employeesWithIssuance.add(t.employee_id);
    }
  }

  // Issuance rate (% of received stock that has been issued)
  const issuanceRate = totalStockIn > 0 ? Math.round((totalStockOut / totalStockIn) * 100) : 0;

  // ── Stock by store ──
  const stockByStore = {};
  for (const t of validTxns) {
    if (t.transaction_type === 'TRANSFER') {
      const fromStore = t.transfer_from_store || 'Unspecified';
      const toStore = t.transfer_to_store || 'Unspecified';
      if (!stockByStore[fromStore]) stockByStore[fromStore] = { store: fromStore, stockIn: 0, stockOut: 0, available: 0 };
      if (!stockByStore[toStore]) stockByStore[toStore] = { store: toStore, stockIn: 0, stockOut: 0, available: 0 };
      stockByStore[fromStore].available -= t.quantity_abs || 0;
      stockByStore[toStore].available += t.quantity_abs || 0;
      continue;
    }
    const store = t.store || 'Unspecified';
    if (!stockByStore[store]) stockByStore[store] = { store, stockIn: 0, stockOut: 0, available: 0 };
    if (t.transaction_type === 'STOCK_IN' || t.transaction_type === 'RETURN') stockByStore[store].stockIn += t.quantity_abs || 0;
    if (t.transaction_type === 'STOCK_OUT') stockByStore[store].stockOut += t.quantity_abs || 0;
    stockByStore[store].available += t.quantity || 0;
  }

  // ── Stock by category ──
  const stockByCategory = {};
  for (const item of activeItems) {
    const cat = item.category || 'Uncategorized';
    if (!stockByCategory[cat]) stockByCategory[cat] = { category: cat, itemCount: 0, available: 0 };
    stockByCategory[cat].itemCount++;
    stockByCategory[cat].available += (itemAggs[item.id]?.available || 0);
  }

  // ── Stock by site (stock-out issuance) ──
  const stockBySite = {};
  for (const t of validTxns) {
    if (t.transaction_type !== 'STOCK_OUT') continue;
    const site = t.site || 'Unspecified';
    if (!stockBySite[site]) stockBySite[site] = { site, stockOut: 0, txnCount: 0 };
    stockBySite[site].stockOut += t.quantity_abs || 0;
    stockBySite[site].txnCount++;
  }

  // ── Top issued items ──
  const issuedMap = {};
  for (const t of validTxns) {
    if (t.transaction_type !== 'STOCK_OUT') continue;
    if (!issuedMap[t.item_id]) {
      issuedMap[t.item_id] = { item_sn: t.item_sn, item_name: t.item_name, unit: t.unit, qty: 0 };
    }
    issuedMap[t.item_id].qty += t.quantity_abs || 0;
  }
  const topIssuedItems = Object.values(issuedMap).sort((a, b) => b.qty - a.qty).slice(0, 8);

  // ── Top suppliers (by stock-in volume) ──
  const supplierMap = {};
  for (const t of validTxns) {
    if (t.transaction_type !== 'STOCK_IN') continue;
    const sup = t.supplier || 'Unspecified';
    if (!supplierMap[sup]) supplierMap[sup] = { supplier: sup, stockIn: 0, txnCount: 0 };
    supplierMap[sup].stockIn += t.quantity_abs || 0;
    supplierMap[sup].txnCount++;
  }
  const topSuppliers = Object.values(supplierMap).sort((a, b) => b.stockIn - a.stockIn).slice(0, 8);

  // ── Monthly movement (last 6 months) ──
  const monthlyMovement = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en', { month: 'short' });
    let inQty = 0, outQty = 0;
    for (const t of validTxns) {
      if (!t.transaction_date || !t.transaction_date.startsWith(ym)) continue;
      if (t.transaction_type === 'STOCK_IN') inQty += t.quantity_abs || 0;
      if (t.transaction_type === 'STOCK_OUT') outQty += t.quantity_abs || 0;
    }
    monthlyMovement.push({ month: label, stockIn: inQty, stockOut: outQty });
  }

  // ── Low stock alerts ──
  const lowStockAlerts = activeItems
    .map(i => ({
      item_sn: i.item_sn,
      item_name: i.item_name,
      unit: i.unit,
      available: itemAggs[i.id]?.available || 0,
      min_level: i.min_stock_level || 0,
      status: getStockStatus(itemAggs[i.id]?.available || 0, i.min_stock_level),
    }))
    .filter(a => a.status !== 'Available')
    .sort((a, b) => a.available - b.available);

  // ── TPC & Calibration expiry alerts (within 45 days) ──
  const nowDate = new Date();
  const expiryAlerts = activeItems
    .filter(i => i.is_equipment)
    .map(i => {
      const tpcExpiry = i.tpc_expiry ? new Date(i.tpc_expiry + 'T00:00:00') : null;
      const calExpiry = i.calibration_expiry ? new Date(i.calibration_expiry + 'T00:00:00') : null;
      const tpcDaysLeft = tpcExpiry ? Math.ceil((tpcExpiry - nowDate) / 86400000) : null;
      const calDaysLeft = calExpiry ? Math.ceil((calExpiry - nowDate) / 86400000) : null;
      return {
        item_sn: i.item_sn, item_name: i.item_name,
        equipment_serial_no: i.equipment_serial_no || '',
        tpc_expiry: i.tpc_expiry || '', tpc_days_left: tpcDaysLeft,
        calibration_expiry: i.calibration_expiry || '', cal_days_left: calDaysLeft,
      };
    })
    .filter(a => (a.tpc_days_left !== null && a.tpc_days_left <= 45) || (a.cal_days_left !== null && a.cal_days_left <= 45))
    .sort((a, b) => Math.min(a.tpc_days_left ?? 9999, a.cal_days_left ?? 9999) - Math.min(b.tpc_days_left ?? 9999, b.cal_days_left ?? 9999));

  return {
    totalItems: activeItems.length,
    archivedCount,
    totalAvailable,
    totalStockIn,
    totalStockOut,
    totalTransactions,
    stockInTxnCount,
    stockOutTxnCount,
    lowStockCount,
    outOfStockCount,
    deadStockCount,
    employeesWithIssuance: employeesWithIssuance.size,
    issuanceRate,
    avgQtyPerItem: activeItems.length > 0 ? Math.round(totalAvailable / activeItems.length) : 0,
    stockByStore: Object.values(stockByStore).sort((a, b) => b.available - a.available),
    stockByCategory: Object.values(stockByCategory).sort((a, b) => b.available - a.available),
    stockBySite: Object.values(stockBySite).sort((a, b) => b.stockOut - a.stockOut),
    topIssuedItems,
    topSuppliers,
    monthlyMovement,
    lowStockAlerts,
    expiryAlerts,
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

// ── Multi-item documents (one header → many lines) ─────────────────────

const DOC = base44.entities.InventoryDocument;

/**
 * Document number carried by a transaction line.
 */
export function documentNoOf(t) {
  if (t.transaction_type === 'STOCK_IN') return t.dn_no || t.mrf_no || t.lpo || '';
  if (t.transaction_type === 'STOCK_OUT') return t.iv_no || '';
  if (t.transaction_type === 'TRANSFER') return t.internal_dn_no || '';
  if (t.transaction_type === 'RETURN') return t.iv_no || '';
  return '';
}

/**
 * Group transaction lines into their documents.
 *
 * Lines saved through the multi-item forms share a document_id. Older
 * single-item records have no document_id, so they are grouped by their own
 * D/N or I/V — each legacy row simply becomes a one-line document and keeps
 * displaying exactly as before.
 */
export function groupTransactionsIntoDocuments(transactions = []) {
  const groups = new Map();

  for (const t of transactions) {
    if (!t || t.is_deleted) continue;
    const no = documentNoOf(t);
    const key = t.document_id
      || (no ? `${t.transaction_type}::${no}::${t.employee_id || t.pid || ''}` : t.id);

    if (!groups.has(key)) {
      groups.set(key, {
        key,
        documentId: t.document_id || '',
        documentNo: no,
        type: t.transaction_type,
        date: t.transaction_date || '',
        supplier: '',
        employeeId: '',
        employeeName: '',
        pid: '',
        company: '',
        site: '',
        store: '',
        createdBy: '',
        fileUrl: '',
        lines: [],
      });
    }

    const g = groups.get(key);
    g.lines.push(t);
    if (!g.date || (t.transaction_date || '') < g.date) g.date = t.transaction_date || g.date;
    if (!g.supplier && t.supplier) g.supplier = t.supplier;
    if (!g.employeeId && t.employee_id) g.employeeId = t.employee_id;
    if (!g.employeeName && t.employee_name) g.employeeName = t.employee_name;
    if (!g.pid && t.pid) g.pid = t.pid;
    if (!g.company && t.company) g.company = t.company;
    if (!g.site && t.site) g.site = t.site;
    if (!g.store && t.store) g.store = t.store;
    if (!g.createdBy) g.createdBy = t.created_by_name || t.created_by || '';
    if (!g.fileUrl) g.fileUrl = t.dn_file_url || t.voucher_file_url || '';
  }

  return [...groups.values()]
    .map(g => {
      const lines = g.lines.sort((a, b) => (a.created_date || '').localeCompare(b.created_date || ''));
      return {
        ...g,
        lines,
        lineCount: lines.length,
        totalQty: lines.reduce((sum, l) => sum + (l.quantity_abs || 0), 0),
        party: g.type === 'STOCK_IN' ? (g.supplier || '—') : (g.employeeName || '—'),
      };
    })
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
}

/**
 * Create a multi-item Stock In / Stock Out document.
 *
 * Nothing is written until every line has passed validation (item selected,
 * quantity entered, no duplicate items, and — for Stock Out — enough stock).
 * The header and all its lines are then saved together; if the lines fail, the
 * header and any line that slipped through are rolled back, so a delivery note
 * or issue voucher is never left partially processed.
 */
export async function createInventoryDocument({ document: doc, lines = [] }, user) {
  const isStockOut = doc.document_type === 'STOCK_OUT';
  if (!lines.length) throw new Error('Add at least one item line.');

  const seen = new Set();
  for (const l of lines) {
    if (!l.item_id) throw new Error('Select an item on every line.');
    if (seen.has(l.item_id)) {
      throw new Error(`Item already added: ${l.item_sn} — ${l.item_name}. Remove the duplicate line.`);
    }
    seen.add(l.item_id);
    if (!Number(l.quantity) || Number(l.quantity) <= 0) {
      throw new Error(`Enter a quantity for ${l.item_sn} — ${l.item_name}.`);
    }
  }

  const masterMap = new Map((await fetchItems(true)).map(i => [i.id, i]));
  const ledger = await fetchTransactions({});

  // Validate every line against stock before anything is saved.
  if (isStockOut) {
    for (const l of lines) {
      const available = calculateAvailableStock(ledger, l.item_id);
      if (Number(l.quantity) > available) {
        throw new Error(
          `Insufficient stock for ${l.item_name || l.item_sn}. Available: ${available}, Requested: ${l.quantity}.`
        );
      }
    }
  }

  const totalQty = lines.reduce((sum, l) => sum + Number(l.quantity), 0);

  const header = await DOC.create({
    document_no: doc.document_no || '',
    document_type: doc.document_type,
    document_date: doc.document_date,
    supplier: doc.supplier || '',
    store: doc.store || '',
    site: doc.site || '',
    mrf_no: doc.mrf_no || '',
    lpo: doc.lpo || '',
    pid: doc.pid || '',
    employee_id: doc.employee_id || '',
    employee_name: doc.employee_name || '',
    company: doc.company || '',
    department: doc.department || '',
    designation: doc.designation || '',
    remarks: doc.remarks || '',
    file_url: doc.file_url || '',
    item_count: lines.length,
    total_quantity: totalQty,
    created_by: user?.email || '',
    created_by_name: user?.full_name || user?.email || '',
  });

  try {
    const created = await TXN.bulkCreate(lines.map((l) => {
      const item = masterMap.get(l.item_id) || {};
      const available = calculateAvailableStock(ledger, l.item_id);
      const qty = Number(l.quantity);
      return {
        transaction_date: doc.document_date,
        transaction_type: doc.document_type,
        document_id: header.id,
        item_id: l.item_id,
        item_sn: item.item_sn || l.item_sn || '',
        item_name: item.item_name || l.item_name || '',
        unit: item.unit || l.unit || '',
        quantity: isStockOut ? -qty : qty,
        quantity_abs: qty,
        dn_no: isStockOut ? '' : (doc.document_no || ''),
        mrf_no: isStockOut ? '' : (doc.mrf_no || ''),
        lpo: isStockOut ? '' : (doc.lpo || ''),
        supplier: isStockOut ? '' : (doc.supplier || ''),
        iv_no: isStockOut ? (doc.document_no || '') : '',
        site: isStockOut ? (doc.site || '') : '',
        store: doc.store || '',
        pid: isStockOut ? (doc.pid || '') : '',
        employee_id: isStockOut ? (doc.employee_id || '') : '',
        employee_name: isStockOut ? (doc.employee_name || '') : '',
        company: isStockOut ? (doc.company || '') : '',
        department: isStockOut ? (doc.department || '') : '',
        designation: isStockOut ? (doc.designation || '') : '',
        previous_balance: available,
        new_balance: isStockOut ? available - qty : available + qty,
        created_by: user?.email || '',
        created_by_name: user?.full_name || user?.email || '',
        dn_file_url: isStockOut ? '' : (doc.file_url || ''),
        voucher_file_url: isStockOut ? (doc.file_url || '') : '',
        remarks: l.remarks || doc.remarks || '',
      };
    }));

    return { header, lines: created };
  } catch (e) {
    // Roll the whole document back so no stock movement is left half-applied.
    const orphans = await TXN.filter({ document_id: header.id }).catch(() => []);
    if (orphans.length) await TXN.deleteMany({ document_id: header.id }).catch(() => {});
    await DOC.delete(header.id).catch(() => {});
    throw new Error(e.message || 'The document could not be saved — no stock was changed.');
  }
}

/**
 * Soft-delete a whole document (every line plus its header), retaining the
 * audit trail. Works for legacy one-line documents too.
 */
export async function deleteDocument(group, user, reason) {
  const lines = group.lines || [];
  if (lines.length) {
    await TXN.bulkUpdate(lines.map(l => ({
      id: l.id,
      is_deleted: true,
      deleted_by: user?.email || '',
      deletion_reason: reason || '',
    })));
  }
  if (group.documentId) {
    await DOC.update(group.documentId, {
      is_deleted: true,
      deleted_by: user?.email || '',
      deletion_reason: reason || '',
    }).catch(() => {});
  }
}