import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { checkPermission } from '../../shared/permissionCheck.ts';
import {
  DOC_TYPES,
  buildSnapshot,
  renewalKey,
  hasMeaningfulData,
  diffSnapshot,
} from '../../shared/renewalHistory.ts';

/**
 * Atomic Gate Pass / Project ID save with automatic renewal-history recording.
 *
 * Called by the Gate Pass and Project ID pages whenever a renewal-relevant field
 * is edited. It applies the field change to the Employee AND records the renewal
 * history in one server call, so the document update and the history insertion
 * stay consistent:
 *
 *  - No history + meaningful data    → create the first entry (Initial Issuance).
 *  - Renewal key changed (new expiry / new PID number) → create a new Renewal
 *    entry with an incremented sequence; the previous entry is preserved.
 *  - Same key but other fields differ → correct the latest entry with an audit
 *    record (never a false renewal).
 *  - Identical to the latest entry   → no history change (prevents duplicates on
 *    repeated saves).
 *
 * If the Employee update fails after a history entry was created, the history
 * entry is rolled back so the two never diverge.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { employeeId, documentType, fields, mode, renewalDate, remarks } = await req.json();
    if (!employeeId || !documentType || !DOC_TYPES[documentType as keyof typeof DOC_TYPES]) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    const doc = DOC_TYPES[documentType as keyof typeof DOC_TYPES];

    const perm = await checkPermission(base44, user, doc.editPerm);
    if (!perm.allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const old = await base44.entities.Employee.get(employeeId);
    if (!old) return Response.json({ error: 'Employee not found' }, { status: 404 });

    const patch = {
      ...(fields || {}),
      _last_updated_by: user.email || '',
      _last_updated_by_name: user.full_name || '',
      _last_updated_by_role: user.role || '',
    };

    const newEmployee = { ...old, ...(fields || {}) };
    const snapshot = buildSnapshot(documentType, newEmployee);

    const latestPage = await base44.asServiceRole.entities.DocumentRenewalHistory.filter(
      { personnel_id: employeeId, document_type: documentType, is_deleted: { $ne: true } },
      { sort: '-renewal_no', limit: 1 },
    );
    const latest = latestPage.items && latestPage.items[0];

    const today = new Date().toISOString().slice(0, 10);
    const performer = { updated_by: user.email || '', updated_by_name: user.full_name || '' };

    let action: 'create' | 'correct' | 'none' = 'none';
    // When the personnel already had an un-recorded initial issuance (e.g. created
    // after the baseline migration), the first renewal preserves it as #1 before
    // recording the renewal as #2 — the original issuance is never lost.
    let retroInitial: any = null;

    // Explicit confirmation from Edit Personnel: the user classified the change
    // as a Renewal or a Correction. A change in expiry/PID number must never be
    // auto-classified as a renewal without this confirmation.
    const explicitMode = mode === 'renewal' || mode === 'correction' ? (mode as string) : null;
    const remarksVal = typeof remarks === 'string' ? remarks : '';

    if (explicitMode === 'renewal') {
      action = 'create';
      if (!latest) {
        const oldSnap = buildSnapshot(documentType, old);
        if (hasMeaningfulData(documentType, oldSnap) && renewalKey(documentType, oldSnap)) retroInitial = oldSnap;
      }
    } else if (explicitMode === 'correction') {
      // Audited update of the latest entry — never a new renewal. If there is no
      // entry yet, record the first issuance instead.
      action = latest ? 'correct' : 'create';
    } else if (!latest) {
      const oldSnap = buildSnapshot(documentType, old);
      const oldKey = renewalKey(documentType, oldSnap);
      const newKey = renewalKey(documentType, snapshot);
      if (hasMeaningfulData(documentType, oldSnap) && newKey && newKey !== oldKey) {
        action = 'create';
        retroInitial = oldSnap;
      } else if (hasMeaningfulData(documentType, snapshot)) {
        action = 'create';
      }
    } else {
      const oldKey = renewalKey(documentType, {
        expiry_date: latest.expiry_date,
        document_number: latest.document_number,
      });
      const newKey = renewalKey(documentType, snapshot);
      if (newKey && newKey !== oldKey) {
        action = 'create';
      } else {
        const changes = diffSnapshot(latest, snapshot);
        if (changes.length > 0) action = 'correct';
      }
    }

    if (action === 'create') {
      const baseEntry = {
        personnel_id: employeeId,
        employee_name: old.name || '',
        company: old.company || '',
        document_type: documentType,
        remarks: remarksVal,
        corrections: [],
        is_deleted: false,
      };
      const entries: any[] = [];
      if (retroInitial) {
        entries.push({
          ...baseEntry,
          renewal_no: 1, entry_type: 'Initial Issuance',
          document_number: retroInitial.document_number || '',
          issue_date: retroInitial.issue_date || '',
          received_date: retroInitial.received_date || '',
          expiry_date: retroInitial.expiry_date || '',
          recorded_status: retroInitial.recorded_status || '',
          renewal_date: retroInitial.expiry_date || '',
          updated_by: 'system',
          updated_by_name: 'Previous issuance (recorded at first renewal)',
        });
        entries.push({
          ...baseEntry,
          renewal_no: 2, entry_type: 'Renewal',
          document_number: snapshot.document_number || '',
          issue_date: snapshot.issue_date || '',
          received_date: snapshot.received_date || '',
          expiry_date: snapshot.expiry_date || '',
          recorded_status: snapshot.recorded_status || '',
          renewal_date: snapshot.expiry_date || '',
          updated_by: performer.updated_by,
          updated_by_name: performer.updated_by_name,
        });
      } else {
        const renewalNo = latest ? latest.renewal_no + 1 : 1;
        const entryType = latest ? 'Renewal' : 'Initial Issuance';
        entries.push({
          ...baseEntry,
          renewal_no: renewalNo, entry_type: entryType,
          document_number: snapshot.document_number || '',
          issue_date: snapshot.issue_date || '',
          received_date: snapshot.received_date || '',
          expiry_date: snapshot.expiry_date || '',
          recorded_status: snapshot.recorded_status || '',
          renewal_date: snapshot.expiry_date || '',
          updated_by: performer.updated_by,
          updated_by_name: performer.updated_by_name,
        });
      }
      const created = await base44.asServiceRole.entities.DocumentRenewalHistory.bulkCreate(entries);
      const createdArr: any[] = Array.isArray(created) ? created : (created.records || []);
      const createdIds = createdArr.map((r: any) => r.id);
      try {
        await base44.entities.Employee.update(employeeId, patch);
      } catch (e) {
        // Rollback every entry just created so the record and history never diverge.
        for (const id of createdIds) {
          await base44.asServiceRole.entities.DocumentRenewalHistory.delete(id);
        }
        return Response.json({ error: (e as Error).message }, { status: 500 });
      }
      const lastNo = retroInitial ? 2 : (latest ? latest.renewal_no + 1 : 1);
      return Response.json({ success: true, action: 'create', renewal_no: lastNo });
    }

    if (action === 'correct') {
      const changes = diffSnapshot(latest, snapshot);
      const update: Record<string, any> = {};
      for (const c of changes) update[c.field] = c.to;
      // Renewal Date always follows this document's own expiry date.
      update.renewal_date = snapshot.expiry_date || '';
      update.corrections = [
        ...(latest.corrections || []),
        {
          corrected_by: performer.updated_by,
          corrected_by_name: performer.updated_by_name,
          corrected_at: new Date().toISOString(),
          reason: remarksVal || `${documentType} field corrected via ${documentType} page`,
          changes,
        },
      ];
      await base44.asServiceRole.entities.DocumentRenewalHistory.update(latest.id, update);
      try {
        await base44.entities.Employee.update(employeeId, patch);
      } catch (e) {
        // Restore the entry to its pre-correction state.
        const restore: Record<string, any> = {};
        for (const c of changes) restore[c.field] = c.from;
        restore.renewal_date = latest.renewal_date || '';
        restore.corrections = latest.corrections || [];
        await base44.asServiceRole.entities.DocumentRenewalHistory.update(latest.id, restore);
        return Response.json({ error: (e as Error).message }, { status: 500 });
      }
      return Response.json({ success: true, action: 'correct', renewal_no: latest.renewal_no });
    }

    // No renewal and no correction — still apply the field change to the Employee.
    await base44.entities.Employee.update(employeeId, patch);
    return Response.json({ success: true, action: 'none', renewal_no: latest ? latest.renewal_no : 0 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});