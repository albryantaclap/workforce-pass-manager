/**
 * Shared renewal-history logic for the Gate Pass (RLIC) and Project ID modules.
 *
 * A renewal history entry is a snapshot of the document fields at the moment a
 * genuine renewal was recorded. The "renewal key" defines what counts as a new
 * renewal vs a correction of the existing record:
 *   - Gate Pass  → the expiry date.
 *   - Project ID → the PID number + the expiry date (the number can change).
 *
 * Anything else that changes (submitted/issue date, received date, status) is a
 * correction of the latest entry — it is audited but never creates a new renewal.
 */

export const DOC_TYPES = {
  'Gate Pass': {
    editPerm: 'workforce.gatepass.edit',
    viewPerm: 'workforce.gatepass.view',
  },
  'Project ID': {
    editPerm: 'workforce.project_id.edit',
    viewPerm: 'workforce.project_id.view',
  },
} as const;

const SNAPSHOT_FIELDS = [
  'document_number',
  'issue_date',
  'received_date',
  'expiry_date',
  'recorded_status',
] as const;

/** Build the document snapshot from an Employee record (the NEW state after save). */
export function buildSnapshot(documentType: string, emp: any) {
  if (documentType === 'Gate Pass') {
    return {
      document_number: '',
      issue_date: (emp.gate_pass_issue_date || '') as string,
      received_date: (emp.gate_pass_received_date || '') as string,
      expiry_date: (emp.gate_pass_expiry || '') as string,
      recorded_status: (emp.rlic_status || '') as string,
    };
  }
  return {
    document_number: (emp.pid || '') as string,
    issue_date: (emp.pid_issue_date || '') as string,
    received_date: '',
    expiry_date: (emp.pid_expiry || '') as string,
    recorded_status: (emp.pid_status || '') as string,
  };
}

/** The key that defines a renewal. Empty key = no renewal (falls back to correction). */
export function renewalKey(documentType: string, snap: any): string {
  if (documentType === 'Gate Pass') return snap.expiry_date || '';
  return `${snap.document_number || ''}||${snap.expiry_date || ''}`;
}

/** Whether the snapshot carries enough data to record a first issuance. */
export function hasMeaningfulData(documentType: string, snap: any): boolean {
  if (documentType === 'Gate Pass') {
    return Boolean(snap.expiry_date || snap.issue_date || snap.received_date);
  }
  return Boolean(snap.expiry_date || snap.issue_date || snap.document_number);
}

/** Fields that differ between the latest history entry and the new snapshot. */
export function diffSnapshot(latest: any, snap: any) {
  const out: Array<{ field: string; from: string; to: string }> = [];
  for (const f of SNAPSHOT_FIELDS) {
    const a = String(latest[f] ?? '');
    const b = String(snap[f] ?? '');
    if (a !== b) out.push({ field: f, from: a, to: b });
  }
  return out;
}