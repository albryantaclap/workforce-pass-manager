/**
 * Historical issuance entry for Employee Issuance.
 *
 * An issue documented after the fact is stored with quantity 0, so available
 * stock (SUM(quantity)) is never touched by it — the quantity that was
 * physically issued lives in quantity_abs. Correcting a line that is a real
 * recorded movement goes through the existing accounting rules
 * (updateTransactionLine / createReturn) instead, so stock moves by the
 * difference only and nothing is deducted twice.
 *
 * Every write appends to the line's edit_history (who, when, change type,
 * previous and new values, reason, personnel and voucher reference) and to the
 * ActivityLog, so historical data is auditable and never silently overwritten.
 */
import { base44 } from '@/api/base44Client';
import { textValue } from '@/lib/inventoryText';
import { fetchItemById, createReturn } from '@/lib/inventoryService';
import { updateTransactionLine } from '@/lib/inventoryCorrections';

const TXN = base44.entities.InventoryTransaction;

/** Fields the audit trail reports, with the labels the UI uses. */
const AUDITED_FIELDS = {
  transaction_date: 'Issuance Date',
  item_sn: 'Item Code',
  item_name: 'Item Name',
  unit: 'Unit',
  quantity_abs: 'Quantity Issued',
  iv_no: 'I/V No.',
  site: 'Site',
  store: 'Store',
  remarks: 'Remarks',
};

/** A historical entry never moves stock (quantity 0); a real issue does not. */
export const isHistoricalLine = (t) => t?.is_historical === true || Number(t?.quantity || 0) === 0;

const changesBetween = (before, after) => Object.entries(AUDITED_FIELDS)
  .map(([field, label]) => ({
    field: label,
    from: String(before?.[field] ?? ''),
    to: String(after?.[field] ?? ''),
  }))
  .filter(c => c.from !== c.to);

const auditEntry = ({ changeType, before, after, reason, user, employee, relatedId }) => ({
  edited_by: user?.email || '',
  edited_by_name: user?.full_name || user?.email || '',
  edited_at: new Date().toISOString(),
  reason: reason || '',
  change_type: changeType,
  personnel_id: employee?.id || '',
  employee_name_snapshot: employee?.name || '',
  item_id: after?.item_id || before?.item_id || '',
  related_transaction_id: relatedId || '',
  changes: changesBetween(before, after),
});

async function logActivity(txn, user, previous, updated, reason, changeType) {
  await base44.entities.ActivityLog.create({
    action: previous?.id ? 'update' : 'create',
    entity_name: 'InventoryTransaction',
    entity_id: txn?.id || '',
    performed_by: user?.email || '',
    record_name: `${textValue(txn?.item_sn)} — ${textValue(txn?.item_name)} · ${txn?.employee_name || ''}`,
    changed_fields: Object.values(AUDITED_FIELDS),
    record_snapshot: {
      change_type: changeType,
      personnel_id: employee_idOf(txn),
      previous_values: previous || {},
      new_values: updated || {},
      edit_reason: reason || '',
    },
  }).catch(() => {});
}

const employee_idOf = (t) => t?.employee_id || '';

const employeeSnapshot = (employee) => ({
  pid: employee?.pid || '',
  employee_id: employee?.id || '',
  employee_name: employee?.name || '',
  company: employee?.company || '',
  department: employee?.department || '',
  designation: employee?.position_application || employee?.designation_org_chart || '',
});

/** Every issue and return recorded for one employee, keyed by their records. */
export async function fetchEmployeeIssuance(employeeId) {
  if (!employeeId) return { issued: [], returns: [] };
  const [issuedRes, returnRes] = await Promise.all([
    TXN.filter({ employee_id: employeeId, transaction_type: 'STOCK_OUT' }, { sort: '-transaction_date', limit: 1000 }),
    TXN.filter({ employee_id: employeeId, transaction_type: 'RETURN' }, { sort: '-transaction_date', limit: 1000 }),
  ]);
  const issued = (issuedRes.items || [])
    .filter(t => !t.is_deleted)
    .map(t => ({ ...t, item_sn: textValue(t.item_sn), item_name: textValue(t.item_name), unit: textValue(t.unit) }));
  const returns = (returnRes.items || []).filter(t => !t.is_deleted);
  return { issued, returns };
}

/** Each issued line with what came back and what is still outstanding. */
export function buildIssuanceRows(issued = [], returns = []) {
  return issued.map(line => {
    const lineReturns = returns.filter(r => r.return_of === line.id);
    const returnedQty = lineReturns.reduce((sum, r) => sum + (r.quantity_abs || 0), 0);
    const outstandingQty = Math.max(0, (line.quantity_abs || 0) - returnedQty);
    return { line, returns: lineReturns, returnedQty, outstandingQty };
  });
}

/** Voucher numbers already used for this employee — offered when linking one. */
export const existingVouchers = (issued = []) => [...new Set(
  issued.map(t => (t.iv_no || '').trim()).filter(Boolean)
)].sort();

/**
 * Possible duplicates of a historical issue line: the same item on the same
 * I/V, or the same item, date and quantity already recorded for this employee.
 */
export async function findDuplicateIssuances({ employeeId, itemId, ivNo, transactionDate, quantity, excludeId }) {
  if (!employeeId || !itemId) return [];
  const res = await TXN.filter({ employee_id: employeeId, transaction_type: 'STOCK_OUT' }, { limit: 1000 });
  const qty = Number(quantity) || 0;
  const voucher = (ivNo || '').trim().toLowerCase();

  return (res.items || [])
    .filter(t => !t.is_deleted && t.id !== excludeId && t.item_id === itemId)
    .map(t => {
      const sameVoucher = !!voucher && (t.iv_no || '').trim().toLowerCase() === voucher;
      const sameLine = t.transaction_date === transactionDate && (t.quantity_abs || 0) === qty;
      if (!sameVoucher && !sameLine) return null;
      return {
        id: t.id,
        transaction_date: t.transaction_date,
        iv_no: t.iv_no || '',
        item_sn: textValue(t.item_sn),
        quantity_abs: t.quantity_abs || 0,
        is_historical: isHistoricalLine(t),
        reason: sameVoucher ? 'Same item on the same I/V No.' : 'Same item, date and quantity',
      };
    })
    .filter(Boolean);
}

/**
 * Add a historical issue line, or correct an existing one.
 *
 * @param {object|null} line     the line being corrected (null = new historical entry)
 * @param {object} employee      Master List employee record
 * @param {object} values        item_id, quantity, transaction_date, iv_no, site, store, remarks
 * @param {object} user          current app user
 * @param {string} reason        required correction reason
 */
export async function saveHistoricalIssuance({ line, employee, values, user, reason }) {
  if (!employee?.id) throw new Error('The employee record was not found.');
  if (!values?.item_id) throw new Error('Select the item that was issued.');
  const quantity = Number(values.quantity);
  if (!quantity || quantity <= 0) throw new Error('Enter a quantity greater than zero.');
  if (!values.transaction_date) throw new Error('Issuance date is required.');
  if (!reason?.trim()) throw new Error('A reason is required for this historical change.');

  const item = await fetchItemById(values.item_id);
  if (!item) throw new Error('Item not found.');

  const base = {
    transaction_date: values.transaction_date,
    item_id: values.item_id,
    item_sn: textValue(item.item_sn),
    item_name: textValue(item.item_name),
    unit: textValue(item.unit),
    iv_no: (values.iv_no || '').trim(),
    site: values.site || '',
    store: values.store || '',
    remarks: values.remarks || '',
    ...employeeSnapshot(employee),
  };

  if (line?.id) {
    if (!isHistoricalLine(line)) {
      // A genuinely recorded issue — the module's existing correction rules
      // move stock by the difference only and keep the audit trail.
      return updateTransactionLine({
        original: line,
        patch: { ...base, item_id: values.item_id, quantity },
        reason,
        user,
      });
    }
    const editedAt = new Date().toISOString();
    const after = {
      ...base,
      quantity: 0,
      quantity_abs: quantity,
      is_historical: true,
      last_edited_by: user?.email || '',
      last_edited_by_name: user?.full_name || user?.email || '',
      last_edited_at: editedAt,
      edit_history: [
        ...(Array.isArray(line.edit_history) ? line.edit_history : []),
        auditEntry({
          changeType: 'Historical Correction',
          before: line,
          after: { ...base, quantity_abs: quantity },
          reason,
          user,
          employee,
          relatedId: line.id,
        }),
      ],
    };
    const saved = await TXN.update(line.id, after);
    await logActivity(saved, user, line, after, reason, 'Historical Correction');
    return saved;
  }

  const created = await TXN.create({
    ...base,
    transaction_type: 'STOCK_OUT',
    quantity: 0,
    quantity_abs: quantity,
    is_historical: true,
    is_deleted: false,
    created_by: user?.email || '',
    created_by_name: user?.full_name || user?.email || '',
    edit_history: [
      auditEntry({
        changeType: 'Historical Entry',
        before: {},
        after: { ...base, quantity_abs: quantity },
        reason,
        user,
        employee,
      }),
    ],
  });
  await logActivity(created, user, null, { ...base, quantity_abs: quantity }, reason, 'Historical Entry');
  return created;
}

/**
 * Record a return against an issued line.
 *
 * A historical issue is returned historically (no stock movement). A line that
 * was a real issue uses the existing Return Items rules, so the units go back
 * into available stock and the movement stays traceable.
 */
export async function saveHistoricalReturn({ line, employee, values, user, reason }) {
  if (!line?.id) throw new Error('The issued line was not found.');
  if (!employee?.id) throw new Error('The employee record was not found.');
  const quantity = Number(values?.quantity);
  if (!quantity || quantity <= 0) throw new Error('Enter a returned quantity greater than zero.');
  if (!values?.transaction_date) throw new Error('Return date is required.');
  if (!reason?.trim()) throw new Error('A reason is required for this return.');

  const existing = await TXN.filter({ return_of: line.id, transaction_type: 'RETURN' }, { limit: 1000 });
  const already = (existing.items || [])
    .filter(r => !r.is_deleted)
    .reduce((sum, r) => sum + (r.quantity_abs || 0), 0);
  const outstanding = Math.max(0, (line.quantity_abs || 0) - already);
  if (quantity > outstanding) {
    throw new Error(`Only ${outstanding} unit(s) of ${textValue(line.item_sn)} remain outstanding.`);
  }

  const item = await fetchItemById(line.item_id);
  const base = {
    transaction_date: values.transaction_date,
    item_id: line.item_id,
    item_sn: textValue(item?.item_sn) || line.item_sn || '',
    item_name: textValue(item?.item_name) || line.item_name || '',
    unit: textValue(item?.unit) || line.unit || '',
    store: values.store || '',
    return_of: line.id,
    return_reason: reason,
    remarks: values.remarks || '',
    ...employeeSnapshot(employee),
  };

  if (!isHistoricalLine(line)) {
    const created = await createReturn({
      ...base,
      quantity,
      quantity_abs: quantity,
      original_txn_id: line.id,
    }, user);
    return created;
  }

  const created = await TXN.create({
    ...base,
    transaction_type: 'RETURN',
    quantity: 0,
    quantity_abs: quantity,
    is_historical: true,
    is_deleted: false,
    created_by: user?.email || '',
    created_by_name: user?.full_name || user?.email || '',
    edit_history: [
      auditEntry({
        changeType: 'Historical Return',
        before: {},
        after: { ...base, quantity_abs: quantity },
        reason,
        user,
        employee,
        relatedId: line.id,
      }),
    ],
  });
  await logActivity(created, user, null, { ...base, quantity_abs: quantity }, reason, 'Historical Return');
  return created;
}