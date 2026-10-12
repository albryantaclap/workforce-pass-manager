import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { checkPermission } from '../../shared/permissionCheck.ts';
import { DOC_TYPES } from '../../shared/renewalHistory.ts';

/**
 * Manual, audited correction of a single renewal-history entry by an authorized
 * administrator. Corrections update the historical record in place and append an
 * audit entry to `corrections` — they never create a new renewal and never touch
 * the Employee record, so a correction is always distinguishable from a renewal.
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { entryId, fields, reason } = await req.json();
    if (!entryId || !fields) return Response.json({ error: 'Invalid request' }, { status: 400 });

    const entry = await base44.asServiceRole.entities.DocumentRenewalHistory.get(entryId);
    if (!entry) return Response.json({ error: 'Entry not found' }, { status: 404 });

    const doc = DOC_TYPES[entry.document_type as keyof typeof DOC_TYPES];
    if (!doc) return Response.json({ error: 'Unknown document type' }, { status: 400 });

    const perm = await checkPermission(base44, user, doc.editPerm);
    if (!perm.allowed) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const allowed = ['document_number', 'issue_date', 'received_date', 'expiry_date', 'recorded_status', 'remarks'];
    const changes: Array<{ field: string; from: string; to: string }> = [];
    const update: Record<string, any> = {};
    for (const f of allowed) {
      if (f in fields) {
        const from = String(entry[f] ?? '');
        const to = String(fields[f] ?? '');
        if (from !== to) {
          update[f] = fields[f] ?? '';
          changes.push({ field: f, from, to });
        }
      }
    }

    if (changes.length === 0) return Response.json({ success: true, action: 'none' });

    update.corrections = [
      ...(entry.corrections || []),
      {
        corrected_by: user.email || '',
        corrected_by_name: user.full_name || '',
        corrected_at: new Date().toISOString(),
        reason: (reason || 'Manual admin correction').trim(),
        changes,
      },
    ];

    const updated = await base44.asServiceRole.entities.DocumentRenewalHistory.update(entryId, update);
    return Response.json({ success: true, action: 'corrected', entry: updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});