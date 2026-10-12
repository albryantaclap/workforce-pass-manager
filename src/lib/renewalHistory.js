import { base44 } from '@/api/base44Client';

/** Fields whose edits are a Gate Pass renewal-relevant change. */
export const GATE_PASS_FIELDS = new Set([
  'gate_pass_issue_date',
  'gate_pass_received_date',
  'gate_pass_expiry',
  'rlic_status',
]);

/** Fields whose edits are a Project ID renewal-relevant change. */
export const PROJECT_ID_FIELDS = new Set([
  'pid',
  'pid_issue_date',
  'pid_expiry',
  'pid_status',
]);

export function isRenewalField(documentType, field) {
  return documentType === 'Gate Pass' ? GATE_PASS_FIELDS.has(field) : PROJECT_ID_FIELDS.has(field);
}

/**
 * Apply a Gate Pass / Project ID field edit atomically with renewal-history
 * recording. Delegates to the syncDocumentRenewal backend function, which checks
 * the corresponding edit permission server-side and decides whether the edit is
 * a renewal (new history entry), a correction (audited update), or a no-op.
 */
export async function syncRenewal({ employeeId, documentType, field, value }) {
  const res = await base44.functions.invoke('syncDocumentRenewal', {
    employeeId,
    documentType,
    fields: { [field]: value === undefined ? null : value },
  });
  return res.data;
}

/**
 * Apply a set of Gate Pass / Project ID field edits with an EXPLICIT, user-confirmed
 * classification. Used by Edit Personnel: the user chooses Renewal or Correction and
 * supplies the actual renewal date (GP Received / PID Issue). Delegates to the
 * syncDocumentRenewal backend function, which records the history atomically.
 */
export async function syncDocumentFields({ employeeId, documentType, fields, mode, renewalDate, remarks }) {
  const res = await base44.functions.invoke('syncDocumentRenewal', {
    employeeId,
    documentType,
    fields,
    mode,
    renewalDate,
    remarks,
  });
  return res.data;
}

/** Read one personnel's renewal history (latest first), server-paginated. */
export async function fetchRenewalHistory({ employeeId, documentType, cursor, limit = 50 }) {
  return base44.entities.DocumentRenewalHistory.filter(
    { personnel_id: employeeId, document_type: documentType, is_deleted: { $ne: true } },
    { sort: '-renewal_no', limit, cursor },
  );
}

/** Admin correction of a single history entry (audited, never a renewal). */
export async function correctHistoryEntry({ entryId, fields, reason }) {
  const res = await base44.functions.invoke('correctRenewalHistoryEntry', { entryId, fields, reason });
  return res.data;
}