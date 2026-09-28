/**
 * Correcting a recorded Stock In / Stock Out line.
 *
 * The original line is reversed and the corrected one applied in the same
 * update, so available stock moves by the difference only and a corrected
 * delivery or issue is never counted twice. Warranty rows, issued assets and
 * the parent document are kept in step with the correction.
 */
import { base44 } from '@/api/base44Client';
import { textValue } from '@/lib/inventoryText';
import {
  buildWarrantyRows, validateWarrantyLine, issuedAssetsFor, isActiveWarranty,
} from '@/lib/warranty';
import {
  fetchItemById, fetchTransactions, calculateAvailableStock, assignIssuedAssets,
} from '@/lib/inventoryService';

const TXN = base44.entities.InventoryTransaction;
const DOC = base44.entities.InventoryDocument;
const WR = base44.entities.InventoryWarranty;

/** One recorded line, with item text normalised like every other ledger read. */
export async function fetchTransactionById(id) {
  const t = await TXN.get(id);
  return t ? { ...t, item_name: textValue(t.item_name), unit: textValue(t.unit) } : null;
}

/**
 * The warranty rows that belong to one recorded line.
 * Stock In  → the receipt (batch) or the serialized assets of that exact line.
 * Stock Out → the assets issued under that I/V to that employee, and the item's
 *             warranty when the issued units are not serialized.
 */
export function warrantiesForTransaction(warranties = [], txn) {
  if (!txn) return [];
  if (txn.transaction_type === 'STOCK_IN') {
    return warranties.filter(w => isActiveWarranty(w) && w.batch_txn_id === txn.id);
  }
  const issued = issuedAssetsFor(warranties, txn.employee_id, txn.item_id, txn.iv_no);
  if (issued.length) return issued;
  return warranties.filter(w => isActiveWarranty(w) && w.item_id === txn.item_id);
}

/** Labels of the fields written to the correction audit trail. */
const AUDITED_FIELDS = {
  transaction_date: 'Date', item_sn: 'Item S.N.', item_name: 'Item Name', unit: 'Unit',
  quantity_abs: 'Quantity', dn_no: 'D/N No.', mrf_no: 'MRF No.', lpo: 'LPO', supplier: 'Supplier',
  iv_no: 'I/V No.', site: 'Site', store: 'Store', pid: 'PID No.', employee_name: 'Employee Name',
  company: 'Company', remarks: 'Remarks',
};

const auditedSnapshot = (t) => Object.fromEntries(
  Object.keys(AUDITED_FIELDS).map(f => [f, t?.[f] ?? ''])
);

function buildChanges(before, after) {
  const changes = [];
  for (const [field, label] of Object.entries(AUDITED_FIELDS)) {
    const from = String(before?.[field] ?? '');
    const to = String(after?.[field] ?? '');
    if (from !== to) changes.push({ field: label, from, to });
  }
  return changes;
}

/**
 * Correct a recorded Stock In / Stock Out line.
 *
 * The original line is reversed and the corrected one applied in the same
 * update, so available stock moves by the difference only:
 *   Stock In 10 → 15  = available +5      Stock Out 5 → 3 = available +2
 * If the item itself is changed, the line is reversed from the old item and
 * applied to the new one. No second stock movement is ever created, and every
 * correction is written to the line's audit trail (edited by, edited date and
 * time, previous values, new values).
 */
export async function updateTransactionLine({ original, patch, warranty = null, reason = '', user }) {
  const isStockOut = original.transaction_type === 'STOCK_OUT';
  const quantity = Math.abs(Number(patch.quantity) || 0);
  if (!original?.id) throw new Error('The record to correct was not found.');
  if (!quantity) throw new Error('Enter a quantity greater than zero.');
  if (!patch.transaction_date) throw new Error('Date is required.');

  const itemId = patch.item_id || original.item_id;
  const item = await fetchItemById(itemId);
  if (!item) throw new Error('Item not found.');

  // The ledger without the corrected line — every balance below therefore
  // already has the original movement removed from the picture.
  const ledger = (await fetchTransactions({})).filter(t => t.id !== original.id);
  const balanceBefore = calculateAvailableStock(ledger, itemId);
  if (isStockOut && quantity > balanceBefore) {
    throw new Error(
      `Insufficient stock for ${item.item_sn}. Available once this issue is corrected: ${balanceBefore}, requested: ${quantity}.`
    );
  }

  const signed = isStockOut ? -quantity : quantity;
  const editedAt = new Date().toISOString();
  const editedBy = user?.email || '';
  const editedByName = user?.full_name || user?.email || '';

  const after = {
    transaction_date: patch.transaction_date,
    item_id: itemId,
    item_sn: textValue(item.item_sn) || original.item_sn || '',
    item_name: textValue(item.item_name) || original.item_name || '',
    unit: textValue(item.unit) || original.unit || '',
    quantity: signed,
    quantity_abs: quantity,
    dn_no: isStockOut ? '' : (patch.dn_no || ''),
    mrf_no: isStockOut ? '' : (patch.mrf_no || ''),
    lpo: isStockOut ? '' : (patch.lpo || ''),
    supplier: isStockOut ? '' : (patch.supplier || ''),
    iv_no: isStockOut ? (patch.iv_no || '') : '',
    site: isStockOut ? (patch.site || '') : '',
    store: patch.store || '',
    pid: isStockOut ? (patch.pid || '') : '',
    employee_id: isStockOut ? (patch.employee_id || '') : '',
    employee_name: isStockOut ? (patch.employee_name || '') : '',
    company: isStockOut ? (patch.company || '') : '',
    department: isStockOut ? (patch.department || '') : '',
    designation: isStockOut ? (patch.designation || '') : '',
    previous_balance: balanceBefore,
    new_balance: balanceBefore + signed,
    last_edited_by: editedBy,
    last_edited_by_name: editedByName,
    last_edited_at: editedAt,
    edit_history: [
      ...(Array.isArray(original.edit_history) ? original.edit_history : []),
      {
        edited_by: editedBy,
        edited_by_name: editedByName,
        edited_at: editedAt,
        reason: reason || '',
        changes: buildChanges(original, { ...after, quantity_abs: quantity }),
      },
    ],
  };
  if (isStockOut) {
    after.dn_file_url = '';
    if (patch.voucher_file_url !== undefined) after.voucher_file_url = patch.voucher_file_url || '';
  } else {
    after.voucher_file_url = '';
    if (patch.dn_file_url !== undefined) after.dn_file_url = patch.dn_file_url || '';
  }

  const saved = await TXN.update(original.id, after);

  // Keep the rest of the module truthful about this movement.
  await syncDocumentTotals(original, after, isStockOut);
  if (isStockOut) {
    await relinkIssuedAssets(original, saved, user);
  } else if (warranty) {
    await syncReceiptWarranty(original, saved, warranty, item, reason, user);
  }

  await base44.entities.ActivityLog.create({
    action: 'update',
    entity_name: 'InventoryTransaction',
    entity_id: original.id,
    performed_by: editedBy,
    record_name: `${after.item_sn} — ${after.item_name}`,
    changed_fields: after.edit_history[after.edit_history.length - 1].changes.map(c => c.field),
    record_snapshot: {
      previous_values: auditedSnapshot(original),
      new_values: auditedSnapshot(saved),
      edit_reason: reason || '',
    },
  }).catch(() => {});

  return saved;
}

/**
 * A line inside a multi-line D/N or I/V shares its document fields with the
 * rest of the document, so the header and the other lines are kept in step.
 */
async function syncDocumentTotals(original, after, isStockOut) {
  if (!original.document_id) return;
  const siblings = (await TXN.filter({ document_id: original.document_id }, '-created_date', 500))
    .filter(s => s.id !== original.id && !s.is_deleted);

  const shared = isStockOut
    ? { iv_no: after.iv_no, site: after.site, store: after.store, transaction_date: after.transaction_date }
    : { dn_no: after.dn_no, mrf_no: after.mrf_no, lpo: after.lpo, supplier: after.supplier, store: after.store, transaction_date: after.transaction_date };

  if (siblings.length) {
    await TXN.bulkUpdate(siblings.map(s => ({ id: s.id, ...shared }))).catch(() => {});
  }

  await DOC.update(original.document_id, {
    ...shared,
    document_no: isStockOut ? after.iv_no : after.dn_no,
    document_date: after.transaction_date,
    remarks: after.remarks,
    item_count: siblings.length + 1,
    total_quantity: siblings.reduce((sum, s) => sum + (s.quantity_abs || 0), 0) + (after.quantity_abs || 0),
  }).catch(() => {});
}

/**
 * Stock Out correction — the assets issued by the original line are released
 * back to the store, then linked again for the corrected values (quantity,
 * item or employee). Warranty dates and history are never touched.
 */
async function relinkIssuedAssets(original, updated, user) {
  const all = (await WR.list('-created_date', 100000)).filter(w =>
    !w.is_deleted && !!w.serial_no && w.item_id === original.item_id && w.asset_status === 'Issued' &&
    (!original.employee_id || w.issued_to_employee_id === original.employee_id) &&
    (!original.iv_no || w.issued_iv_no === original.iv_no)
  );
  const released = all.slice(0, Number(original.quantity_abs) || 0);

  if (released.length) {
    await WR.bulkUpdate(released.map(w => ({
      id: w.id,
      asset_status: 'In Store',
      current_location: original.store || w.current_location || '',
      issued_to_employee_id: '', issued_to_name: '', issued_company: '', issued_date: '', issued_iv_no: '',
      movement_history: [
        ...(w.movement_history || []),
        {
          date: updated.transaction_date,
          action: 'Corrected',
          detail: `Issue ${original.iv_no ? `${original.iv_no} ` : ''}corrected — asset released back to store`,
          by: user?.email || '',
        },
      ],
    })));
  }

  await assignIssuedAssets([updated], {
    document_no: updated.iv_no,
    site: updated.site,
    store: updated.store,
    employee_id: updated.employee_id,
    employee_name: updated.employee_name,
    company: updated.company,
    document_date: updated.transaction_date,
  }, user, []);
}

/**
 * Stock In correction — the warranty register is kept in step with the receipt.
 * Existing warranty rows are updated in place (never cloned, never duplicated),
 * serials added to the receipt get their own row, and serials taken off it are
 * retired — unless the asset is currently with an employee.
 */
async function syncReceiptWarranty(original, after, line, item, reason, user) {
  const existing = (await WR.list('-created_date', 100000))
    .filter(w => !w.is_deleted && w.batch_txn_id === original.id);

  const next = {
    ...line,
    item_id: after.item_id, item_sn: after.item_sn, item_name: after.item_name,
    unit: after.unit, quantity: after.quantity_abs,
  };

  if (!next.warranty_applicable) {
    if (existing.length) {
      await WR.bulkUpdate(existing.map(w => ({
        id: w.id, is_deleted: true, deleted_by: user?.email || '',
        deletion_reason: reason || 'Warranty removed while correcting this receipt',
      })));
    }
    return;
  }

  validateWarrantyLine(next);

  const ctx = {
    batchTxnId: original.id,
    documentId: original.document_id || '',
    documentNo: after.dn_no || '',
    date: after.transaction_date,
    supplier: after.supplier,
    mrfNo: after.mrf_no,
    lpo: after.lpo,
    store: after.store,
    category: textValue(item.category),
    createdBy: user?.email || '',
    createdByName: user?.full_name || user?.email || '',
  };

  if (!existing.length) {
    const created = buildWarrantyRows(next, ctx);
    if (created.length) await WR.bulkCreate(created);
    return;
  }

  const serials = (Array.isArray(next.serials) ? next.serials : [])
    .filter(s => String(s?.serial_no || '').trim());
  const note = {
    date: after.transaction_date,
    action: 'Corrected',
    detail: `Warranty corrected on ${after.dn_no ? `D/N ${after.dn_no}` : 'this receipt'}`,
    by: user?.email || '',
  };
  const shared = {
    item_id: after.item_id, item_sn: after.item_sn, item_name: after.item_name, unit: after.unit,
    document_no: after.dn_no || '', stock_in_date: after.transaction_date,
    supplier: after.supplier || '', mrf_no: after.mrf_no || '', lpo: after.lpo || '', store: after.store || '',
    warranty_remarks: next.warranty_remarks || '', warranty_file_url: next.warranty_file_url || '',
  };

  const updates = [];
  const kept = [];
  for (const row of existing) {
    const serial = serials.find(s =>
      String(s.serial_no).trim().toLowerCase() === String(row.serial_no || '').trim().toLowerCase()
    );
    if (!row.serial_no) {
      updates.push({
        id: row.id, ...shared,
        quantity: after.quantity_abs,
        warranty_start_date: next.warranty_start_date || '',
        warranty_period: Number(next.warranty_period) || 0,
        warranty_period_unit: next.warranty_period_unit || 'Months',
        warranty_expiry_date: next.warranty_expiry_date || '',
        warranty_expiry_overridden: !!next.warranty_expiry_overridden,
        warranty_ref_no: next.warranty_ref_no || '',
        current_location: after.store || row.current_location || '',
        movement_history: [...(row.movement_history || []), note],
      });
    } else if (serial) {
      kept.push(serial.serial_no);
      updates.push({
        id: row.id, ...shared, quantity: 1,
        warranty_start_date: serial.warranty_start_date || '',
        warranty_period: Number(serial.warranty_period) || 0,
        warranty_period_unit: serial.warranty_period_unit || 'Months',
        warranty_expiry_date: serial.warranty_expiry_date || '',
        warranty_ref_no: serial.warranty_ref_no || '',
        movement_history: [...(row.movement_history || []), note],
      });
    } else if (row.asset_status === 'In Store') {
      updates.push({
        id: row.id, is_deleted: true, deleted_by: user?.email || '',
        deletion_reason: reason || 'Serial No. removed while correcting this receipt',
      });
    } else {
      kept.push(row.serial_no);
    }
  }

  const hasBatch = existing.some(r => !r.serial_no);
  const added = serials.filter(s => !kept.some(k => String(k).toLowerCase() === String(s.serial_no).trim().toLowerCase()));

  if (!serials.length && !hasBatch) {
    const created = buildWarrantyRows(next, ctx);
    if (created.length) await WR.bulkCreate(created);
  } else if (added.length) {
    await WR.bulkCreate(buildWarrantyRows({ ...next, serials: added }, ctx));
  }
  if (updates.length) await WR.bulkUpdate(updates);
}