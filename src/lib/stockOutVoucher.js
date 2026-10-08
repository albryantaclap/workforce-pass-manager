/**
 * Saving an edited Store Issue Voucher (I/V) — one voucher, any number of item
 * lines, each line issued to its own employee.
 *
 * Stock only ever moves by the difference:
 *   • a line whose quantity drops returns the difference to available stock,
 *   • a line whose quantity rises takes the extra from available stock,
 *   • a removed line returns all of its units (soft delete — history is kept),
 *   • an added line is written under the SAME voucher header, never a new one.
 * Every changed line keeps its own audit trail (who, when, why, old → new), and
 * the same item may sit on several lines without a double deduction because the
 * voucher's totals are validated per item, not per line.
 */
import { base44 } from '@/api/base44Client';
import { textValue } from '@/lib/inventoryText';
import { updateTransactionLine } from '@/lib/inventoryCorrections';
import {
  fetchTransactions, fetchItemById, calculateAvailableStock, assignIssuedAssets,
} from '@/lib/inventoryService';

const TXN = base44.entities.InventoryTransaction;
const DOC = base44.entities.InventoryDocument;
const WR = base44.entities.InventoryWarranty;

const qtyOf = (value) => Math.abs(Number(value) || 0);
const displayName = (user) => user?.full_name || user?.email || '';

/** The employee fields one issue line carries. */
const employeeFields = (line) => ({
  pid: line.pid || '',
  employee_id: line.employee_id || '',
  employee_name: line.employee_name || '',
  company: line.company || '',
  department: line.department || '',
  designation: line.designation || '',
});

/** Hand the serialized assets of a line back to the store. */
async function releaseIssuedAssets(original, { date, user }) {
  const held = (await WR.list('-created_date', 100000)).filter(w =>
    !w.is_deleted && !!w.serial_no && w.item_id === original.item_id && w.asset_status === 'Issued' &&
    (!original.employee_id || w.issued_to_employee_id === original.employee_id) &&
    (!original.iv_no || w.issued_iv_no === original.iv_no)
  );
  const released = held.slice(0, qtyOf(original.quantity_abs));
  if (!released.length) return;
  await WR.bulkUpdate(released.map(w => ({
    id: w.id,
    asset_status: 'In Store',
    current_location: original.store || w.current_location || '',
    issued_to_employee_id: '', issued_to_name: '', issued_company: '', issued_date: '', issued_iv_no: '',
    movement_history: [
      ...(w.movement_history || []),
      {
        date: date || '',
        action: 'Corrected',
        detail: `${original.item_sn} taken off ${original.iv_no ? `I/V ${original.iv_no}` : 'this issue'} — asset returned to store`,
        by: user?.email || '',
      },
    ],
  })));
}

/** A line removed from the voucher: its units go back and the row is retained. */
async function dissolveIssueLine(original, { date, reason, user }) {
  await releaseIssuedAssets(original, { date, user });
  const editedAt = new Date().toISOString();
  const by = user?.email || '';
  await TXN.update(original.id, {
    is_deleted: true,
    deleted_by: by,
    deletion_reason: reason || 'Item line removed while editing this issue voucher',
    last_edited_by: by,
    last_edited_by_name: displayName(user),
    last_edited_at: editedAt,
    edit_history: [
      ...(Array.isArray(original.edit_history) ? original.edit_history : []),
      {
        edited_by: by,
        edited_by_name: displayName(user),
        edited_at: editedAt,
        reason: reason || '',
        changes: [{
          field: 'Item line',
          from: `${original.item_sn} — ${original.quantity_abs} ${textValue(original.unit) || ''}`.trim(),
          to: 'removed from the voucher (units returned to stock)',
        }],
      },
    ],
  });
}

/** A new line added to an existing voucher, under the same header. */
async function addIssueLine({ header, line, ledger, user, reason }) {
  const item = await fetchItemById(line.item_id);
  if (!item) throw new Error('Item not found.');
  const qty = qtyOf(line.quantity);
  const available = calculateAvailableStock(ledger, line.item_id);
  const created = await TXN.create({
    transaction_date: header.transaction_date,
    transaction_type: 'STOCK_OUT',
    document_id: header.document_id,
    item_id: line.item_id,
    item_sn: textValue(item.item_sn) || line.item_sn || '',
    item_name: textValue(item.item_name) || line.item_name || '',
    unit: textValue(item.unit) || line.unit || '',
    quantity: -qty,
    quantity_abs: qty,
    iv_no: header.iv_no || '',
    site: header.site || '',
    store: header.store || '',
    ...employeeFields(line),
    previous_balance: available,
    new_balance: available - qty,
    voucher_file_url: header.voucher_file_url || '',
    remarks: line.remarks || '',
    created_by: user?.email || '',
    created_by_name: displayName(user),
  });

  // Keep the running ledger truthful for any further line added in this save.
  ledger.push(created);

  await assignIssuedAssets([created], {
    document_no: header.iv_no || '',
    site: header.site || '',
    store: header.store || '',
    document_date: header.transaction_date,
    employee_id: line.employee_id || '',
    employee_name: line.employee_name || '',
    company: line.company || '',
  }, user, [line]);

  await base44.entities.ActivityLog.create({
    action: 'create',
    entity_name: 'InventoryTransaction',
    entity_id: created.id,
    performed_by: user?.email || '',
    record_name: `${created.item_sn} — ${created.item_name}`,
    changed_fields: ['new line'],
    record_snapshot: { new_values: created, edit_reason: reason || '', voucher: header.iv_no || '' },
  }).catch(() => {});

  return created;
}

/**
 * A one-line legacy issue has no document header. The voucher it belongs to gets
 * its header the first time it is edited, and its existing lines are stamped
 * with it — no second header is ever created for the same voucher.
 */
async function ensureVoucherHeader(header, originalLines, user) {
  if (header.document_id) return header.document_id;
  const doc = await DOC.create({
    document_no: header.iv_no || '',
    document_type: 'STOCK_OUT',
    document_date: header.transaction_date,
    site: header.site || '',
    store: header.store || '',
    remarks: header.remarks || '',
    file_url: header.voucher_file_url || '',
    item_count: originalLines.length,
    total_quantity: originalLines.reduce((sum, l) => sum + qtyOf(l.quantity_abs), 0),
    created_by: user?.email || '',
    created_by_name: displayName(user),
  });
  if (originalLines.length) {
    await TXN.bulkUpdate(originalLines.map(l => ({ id: l.id, document_id: doc.id })));
  }
  return doc.id;
}

/** Header totals and shared voucher fields always describe what is really stored. */
async function syncVoucherHeader(header) {
  const lines = (await TXN.filter({ document_id: header.document_id }, '-created_date', 500))
    .filter(l => !l.is_deleted);
  await DOC.update(header.document_id, {
    document_no: header.iv_no || '',
    document_date: header.transaction_date,
    site: header.site || '',
    store: header.store || '',
    remarks: header.remarks || '',
    file_url: header.voucher_file_url || '',
    item_count: lines.length,
    total_quantity: lines.reduce((sum, l) => sum + qtyOf(l.quantity_abs), 0),
  }).catch(() => {});
}

/**
 * Save an edited issue voucher.
 *
 * @param header        { document_id, transaction_date, iv_no, site, store, remarks, voucher_file_url }
 * @param originalLines the lines currently stored for this voucher
 * @param lines         the edited lines ({ id } present = existing line)
 */
export async function saveStockOutVoucher({ header, originalLines = [], lines = [], reason = '', user }) {
  if (!lines.length) throw new Error('A voucher keeps at least one item line.');
  for (const l of lines) {
    if (!l.item_id) throw new Error('Select an item on every line.');
    if (!Number(l.quantity) || Number(l.quantity) <= 0) {
      throw new Error(`Enter a quantity for ${l.item_sn || l.item_name || 'every line'}.`);
    }
  }

  const documentId = await ensureVoucherHeader(header, originalLines, user);
  const voucher = { ...header, document_id: documentId };

  // The ledger without this voucher's own lines: every balance below therefore
  // already has the voucher's original movement removed from the picture.
  const originalIds = new Set(originalLines.map(l => l.id));
  const ledger = (await fetchTransactions({})).filter(t => !originalIds.has(t.id));

  // One validation per item — the same item may now be issued on several lines.
  const requested = new Map();
  for (const l of lines) requested.set(l.item_id, (requested.get(l.item_id) || 0) + qtyOf(l.quantity));
  for (const [itemId, qty] of requested) {
    const available = calculateAvailableStock(ledger, itemId);
    if (qty > available) {
      const item = await fetchItemById(itemId);
      throw new Error(
        `Only ${available} ${textValue(item?.unit) || ''} available for ${textValue(item?.item_name) || itemId} — this voucher requests ${qty}.`.replace('  ', ' ')
      );
    }
  }

  const keepIds = new Set(lines.filter(l => l.id && originalIds.has(l.id)).map(l => l.id));
  const shared = {
    transaction_date: voucher.transaction_date,
    iv_no: voucher.iv_no || '',
    site: voucher.site || '',
    store: voucher.store || '',
  };

  // 1 — lines taken off the voucher first, so their units are available again.
  for (const original of originalLines.filter(l => !keepIds.has(l.id))) {
    await dissolveIssueLine(original, { date: voucher.transaction_date, reason, user });
  }

  // 2 — corrections, smallest quantities first, so a line that grows can use the
  //     units a sibling line released in the same save.
  const originalsById = new Map(originalLines.map(l => [l.id, l]));
  const edits = lines
    .map((line, index) => ({ line, index, original: line.id ? originalsById.get(line.id) : null }))
    .sort((a, b) => {
      const delta = (x) => (x.original ? qtyOf(x.line.quantity) - qtyOf(x.original.quantity_abs) : Number.MAX_SAFE_INTEGER);
      return delta(a) - delta(b) || a.index - b.index;
    });

  let updated = 0;
  let added = 0;
  for (const { line, original } of edits) {
    if (original) {
      await updateTransactionLine({
        original,
        patch: {
          ...shared,
          item_id: line.item_id,
          quantity: qtyOf(line.quantity),
          remarks: line.remarks || '',
          ...employeeFields(line),
          voucher_file_url: voucher.voucher_file_url || '',
        },
        reason,
        user,
      });
      updated += 1;
    } else {
      await addIssueLine({ header: voucher, line, ledger, user, reason });
      added += 1;
    }
  }

  // 3 — the header always matches the lines that are really stored.
  if (added) await syncVoucherHeader(voucher);

  return { updated, added, removed: originalLines.length - keepIds.size, documentId };
}