/**
 * Warranty logic — shared by Stock In capture, Available Stock, Employee
 * Issuance, the Inventory Dashboard, the Warranty Report and the settings page.
 *
 * Warranty always belongs to the actual receipt (Stock In batch) or to an
 * individual serialized asset — never to the Item Master, because the same item
 * can be received several times with different warranty periods.
 *
 * Expiry convention: a warranty of N months/years starting on day D ends the day
 * BEFORE D + N (e.g. 10-Jan-2026 + 36 months = 09-Jan-2029), matching supplier
 * certificates. Statuses are always derived from the expiry date at render time
 * and are never stored as a fixed value.
 */
import { base44 } from '@/api/base44Client';
import { textValue } from '@/lib/inventoryText';

export const WARRANTY_STATUS = {
  UNDER: 'Under Warranty',
  SOON: 'Expiring Soon',
  EXPIRED: 'Expired',
  NONE: 'No Warranty',
};

export const WARRANTY_STATUS_OPTIONS = [
  WARRANTY_STATUS.UNDER, WARRANTY_STATUS.SOON, WARRANTY_STATUS.EXPIRED, WARRANTY_STATUS.NONE,
];

export const PERIOD_UNITS = ['Days', 'Months', 'Years'];
export const EXPIRING_SOON_OPTIONS = [30, 60, 90];
export const DEFAULT_EXPIRING_SOON_DAYS = 30;

const pad = (n) => String(n).padStart(2, '0');
const isoOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function todayISO() {
  return isoOf(new Date());
}

/** Add a period to a start date (no inclusive −1 day adjustment). */
export function addPeriodToDate(startISO, period, unit) {
  const n = Number(period);
  if (!startISO || !Number.isFinite(n) || n <= 0) return '';
  const d = new Date(`${startISO}T00:00:00`);
  if (isNaN(d.getTime())) return '';
  if (unit === 'Days') d.setDate(d.getDate() + n);
  else if (unit === 'Years') d.setFullYear(d.getFullYear() + n);
  else d.setMonth(d.getMonth() + n);
  return isoOf(d);
}

/** Warranty expiry = start + period − 1 day. */
export function computeWarrantyExpiry(startISO, period, unit) {
  const added = addPeriodToDate(startISO, period, unit);
  if (!added) return '';
  const d = new Date(`${added}T00:00:00`);
  d.setDate(d.getDate() - 1);
  return isoOf(d);
}

/** Whole days from today until the given date (negative when already past). */
export function daysUntil(dateISO) {
  if (!dateISO) return null;
  const target = new Date(`${dateISO}T00:00:00`);
  if (isNaN(target.getTime())) return null;
  const today = new Date(`${todayISO()}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

/** Dynamically calculated warranty status — never stored. */
export function warrantyStatus(expiryISO, warningDays = DEFAULT_EXPIRING_SOON_DAYS, applicable = true) {
  if (!applicable || !expiryISO) return WARRANTY_STATUS.NONE;
  const days = daysUntil(expiryISO);
  if (days === null) return WARRANTY_STATUS.NONE;
  if (days < 0) return WARRANTY_STATUS.EXPIRED;
  if (days <= (Number(warningDays) || DEFAULT_EXPIRING_SOON_DAYS)) return WARRANTY_STATUS.SOON;
  return WARRANTY_STATUS.UNDER;
}

export function warrantyStatusClasses(status) {
  switch (status) {
    case WARRANTY_STATUS.UNDER: return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case WARRANTY_STATUS.SOON: return 'bg-amber-50 text-amber-700 border-amber-200';
    case WARRANTY_STATUS.EXPIRED: return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export const isActiveWarranty = (w) => !!w && !w.is_deleted;

/** "36 Months" style description of a warranty row. */
export function describePeriod(row) {
  if (!row?.warranty_period) return '—';
  return `${row.warranty_period} ${row.warranty_period_unit || 'Months'}`;
}

/**
 * Item-level warranty summary for Available Stock: the item's batches/serials
 * are summarised (never merged into one invented date) — the nearest live expiry
 * is shown, and the detail dialog lists each batch/serial separately.
 */
export function summarizeItemWarranty(rows = [], warningDays = DEFAULT_EXPIRING_SOON_DAYS) {
  const active = rows.filter(r => isActiveWarranty(r) && r.warranty_applicable !== false && r.warranty_expiry_date);
  if (!active.length) {
    return { applicable: false, status: WARRANTY_STATUS.NONE, expiry: '', batchCount: 0, serialCount: 0, expiringSoon: 0, expired: 0 };
  }
  let expiringSoon = 0, expired = 0;
  for (const r of active) {
    const s = warrantyStatus(r.warranty_expiry_date, warningDays);
    if (s === WARRANTY_STATUS.SOON) expiringSoon++;
    if (s === WARRANTY_STATUS.EXPIRED) expired++;
  }
  const live = active.filter(r => warrantyStatus(r.warranty_expiry_date, warningDays) !== WARRANTY_STATUS.EXPIRED);
  const pool = live.length ? live : active;
  const expiry = pool.map(r => r.warranty_expiry_date).sort()[0];
  const status = expiringSoon > 0 ? WARRANTY_STATUS.SOON
    : expired === active.length ? WARRANTY_STATUS.EXPIRED
    : WARRANTY_STATUS.UNDER;
  return {
    applicable: true,
    status,
    expiry,
    batchCount: active.filter(r => !r.serial_no).length,
    serialCount: active.filter(r => r.serial_no).length,
    expiringSoon,
    expired,
  };
}

/** Warranty rows grouped by item_id (built once per render pass). */
export function indexWarrantiesByItem(rows = []) {
  const map = new Map();
  for (const r of rows) {
    if (!isActiveWarranty(r)) continue;
    if (!map.has(r.item_id)) map.set(r.item_id, []);
    map.get(r.item_id).push(r);
  }
  return map;
}

/** Serialized assets of an item that are still in the store (available to issue). */
export function assetsInStockForItem(rows = [], itemId) {
  return rows.filter(r =>
    isActiveWarranty(r) &&
    r.item_id === itemId &&
    !!r.serial_no &&
    r.asset_status !== 'Issued'
  );
}

/** Issued-asset index keyed by employee + item, used by Employee Issuance. */
export function issuedAssetKey(employeeId, itemId) {
  return `${employeeId || ''}::${itemId || ''}`;
}

export function indexIssuedAssets(rows = []) {
  const map = new Map();
  for (const r of rows) {
    if (!isActiveWarranty(r) || !r.issued_to_employee_id) continue;
    const key = issuedAssetKey(r.issued_to_employee_id, r.item_id);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(r);
  }
  return map;
}

/** Serialized assets issued to a given employee for an item (optionally per I/V). */
export function issuedAssetsFor(rows = [], employeeId, itemId, ivNo = '') {
  const candidates = rows.filter(r =>
    isActiveWarranty(r) &&
    r.issued_to_employee_id === employeeId &&
    r.item_id === itemId
  );
  if (ivNo) {
    const exact = candidates.filter(r => r.issued_iv_no === ivNo);
    if (exact.length) return exact;
  }
  return candidates;
}

// ── Validation (Stock In warranty fields) ──────────────────────────────

const parseSerialList = (line) =>
  (Array.isArray(line?.serials) ? line.serials : []).filter(s => String(s?.serial_no || '').trim());

/**
 * Validates the warranty block of a Stock In line.
 * Warranty Applicable = No → nothing is required (and no warranty row is stored).
 */
export function validateWarrantyLine(line) {
  if (!line?.warranty_applicable) return;

  const label = line.item_sn || line.item_name || 'item line';
  const serials = parseSerialList(line);

  const checkOne = (start, period, unit, expiry, ref) => {
    if (!start) throw new Error(`Warranty start date is required for ${label}.`);
    if (!period && !expiry) {
      throw new Error(`Enter a warranty period or a warranty expiry date for ${label}.`);
    }
    if (period && Number(period) <= 0) {
      throw new Error(`Warranty period must be greater than zero for ${label}.`);
    }
    if (period && !unit) {
      throw new Error(`Select the warranty period unit for ${label}.`);
    }
    if (expiry && start && expiry < start) {
      throw new Error(`Warranty expiry (${expiry}) cannot be earlier than the start date (${start}) for ${label}.`);
    }
    if (!expiry) {
      throw new Error(`Warranty expiry date is required for ${label} — enter a period or the exact certificate date.`);
    }
    return { start, period, unit, expiry, ref };
  };

  if (serials.length) {
    const qty = Number(line.quantity) || 0;
    if (serials.length !== qty) {
      throw new Error(
        `Enter one serial number per unit for ${label} — quantity is ${qty}, but ${serials.length} serial number(s) were given.`
      );
    }
    const seen = new Set();
    for (const s of serials) {
      const sn = String(s.serial_no).trim();
      if (seen.has(sn.toLowerCase())) throw new Error(`Duplicate serial number ${sn} on ${label}.`);
      seen.add(sn.toLowerCase());
      checkOne(s.warranty_start_date, s.warranty_period, s.warranty_period_unit, s.warranty_expiry_date, s.warranty_ref_no);
    }
    return;
  }

  checkOne(line.warranty_start_date, line.warranty_period, line.warranty_period_unit, line.warranty_expiry_date, line.warranty_ref_no);
}

/**
 * Builds the InventoryWarranty rows for one Stock In line.
 * ctx carries the batch context (transaction id, D/N, supplier, date, store…).
 */
export function buildWarrantyRows(line, ctx = {}) {
  if (!line?.warranty_applicable) return [];

  const base = {
    warranty_applicable: true,
    batch_txn_id: ctx.batchTxnId || '',
    document_id: ctx.documentId || '',
    document_no: ctx.documentNo || '',
    stock_in_date: ctx.date || '',
    item_id: line.item_id,
    item_sn: textValue(line.item_sn),
    item_name: textValue(line.item_name),
    unit: textValue(line.unit),
    category: ctx.category || '',
    supplier: ctx.supplier || '',
    mrf_no: ctx.mrfNo || '',
    lpo: ctx.lpo || '',
    store: ctx.store || '',
    warranty_remarks: line.warranty_remarks || '',
    warranty_file_url: line.warranty_file_url || '',
    current_location: ctx.store || '',
    asset_status: 'In Store',
    warranty_expiry_overridden: !!line.warranty_expiry_overridden,
    movement_history: [{
      date: ctx.date || todayISO(),
      action: 'Received',
      detail: `Received under ${ctx.documentNo || 'delivery note'}${ctx.supplier ? ` from ${ctx.supplier}` : ''}`,
      by: ctx.createdBy || '',
    }],
    created_by: ctx.createdBy || '',
    created_by_name: ctx.createdByName || '',
  };

  const serials = parseSerialList(line);
  if (serials.length) {
    return serials.map(s => ({
      ...base,
      quantity: 1,
      serial_no: String(s.serial_no).trim(),
      warranty_start_date: s.warranty_start_date || line.warranty_start_date || '',
      warranty_period: Number(s.warranty_period) || Number(line.warranty_period) || 0,
      warranty_period_unit: s.warranty_period_unit || line.warranty_period_unit || 'Months',
      warranty_expiry_date: s.warranty_expiry_date || line.warranty_expiry_date || '',
      warranty_ref_no: s.warranty_ref_no || line.warranty_ref_no || '',
    }));
  }

  return [{
    ...base,
    quantity: Number(line.quantity) || 0,
    serial_no: '',
    warranty_start_date: line.warranty_start_date || '',
    warranty_period: Number(line.warranty_period) || 0,
    warranty_period_unit: line.warranty_period_unit || 'Months',
    warranty_expiry_date: line.warranty_expiry_date || '',
    warranty_ref_no: line.warranty_ref_no || '',
  }];
}

// ── Settings ───────────────────────────────────────────────────────────

export async function fetchWarrantySetting() {
  const rows = await base44.entities.InventorySetting.filter({ setting_key: 'inventory' }, '-created_date', 1);
  const days = Number(rows[0]?.warranty_expiring_soon_days);
  return Number.isFinite(days) && days > 0 ? days : DEFAULT_EXPIRING_SOON_DAYS;
}

export async function saveWarrantySetting(days, user) {
  const value = Number(days) > 0 ? Number(days) : DEFAULT_EXPIRING_SOON_DAYS;
  const payload = { warranty_expiring_soon_days: value, updated_by: user?.email || '' };
  const rows = await base44.entities.InventorySetting.filter({ setting_key: 'inventory' }, '-created_date', 1);
  if (rows[0]) return base44.entities.InventorySetting.update(rows[0].id, payload);
  return base44.entities.InventorySetting.create({ setting_key: 'inventory', ...payload });
}

/**
 * Pre-fill a Stock In warranty block from the warranty rows already stored for a
 * receipt, so correcting a line updates the existing warranty instead of
 * creating a second one.
 */
export function warrantyLineFromRows(rows = [], fallback = {}) {
  const active = (rows || []).filter(r => isActiveWarranty(r));
  const batch = active.find(r => !r.serial_no);
  const serialRows = active.filter(r => r.serial_no);
  const source = batch || serialRows[0] || {};
  return {
    warranty_applicable: active.length > 0,
    warranty_start_date: source.warranty_start_date || fallback.warranty_start_date || '',
    warranty_period: source.warranty_period || '',
    warranty_period_unit: source.warranty_period_unit || 'Months',
    warranty_expiry_date: source.warranty_expiry_date || '',
    warranty_expiry_overridden: !!source.warranty_expiry_overridden,
    warranty_ref_no: source.warranty_ref_no || '',
    warranty_remarks: source.warranty_remarks || '',
    warranty_file_url: source.warranty_file_url || '',
    serial_text: serialRows.map(r => r.serial_no).join('\n'),
    serials: serialRows.map(r => ({
      serial_no: r.serial_no,
      warranty_start_date: r.warranty_start_date || '',
      warranty_period: r.warranty_period || '',
      warranty_period_unit: r.warranty_period_unit || 'Months',
      warranty_expiry_date: r.warranty_expiry_date || '',
      warranty_ref_no: r.warranty_ref_no || '',
    })),
  };
}

export const emptyWarrantyLineFields = () => ({
  warranty_applicable: false,
  warranty_start_date: '',
  warranty_period: '',
  warranty_period_unit: 'Months',
  warranty_expiry_date: '',
  warranty_expiry_overridden: false,
  warranty_ref_no: '',
  serials: [],
  warranty_remarks: '',
  warranty_file_url: '',
});