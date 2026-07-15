import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

// Internal meta fields set by the frontend during save — they are NOT meaningful
// "changed fields" for the audit trail and should not appear in the log display.
const META_FIELDS = new Set([
  '_last_updated_by', '_last_updated_by_name',
  '_last_updated_by_role', '_last_updated_at', 'updated_date',
]);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const { event, data, old_data, changed_fields } = payload;

    if (!event) {
      return Response.json({ error: 'No event provided' }, { status: 400 });
    }

    const action = event.type; // create, update, delete
    const entity_id = event.entity_id;

    const record = data || old_data;
    const record_name = record?.name || 'Unknown';

    // Resolve who performed the action:
    // 1. _last_updated_by_name = full name set by frontend on save
    // 2. _last_updated_by = email set by frontend on save
    // 3. For creates, fall back to platform-set created_by (email)
    // 4. Final fallback: 'system'
    const performerName = record?._last_updated_by_name || null;
    const performerEmail = record?._last_updated_by || (action === 'create' ? record?.created_by : null) || null;

    // Display name: prefer full name, then email, then 'system'
    const performed_by = performerName || performerEmail || 'system';

    const audit_meta = {
      performer_name: performerName,
      performer_email: performerEmail,
      performer_role: record?._last_updated_by_role || null,
      performed_at: record?._last_updated_at || new Date().toISOString(),
    };

    // Filter out internal meta/audit fields so the audit log only shows real data changes.
    const filteredChanged = (changed_fields || []).filter((f) => !META_FIELDS.has(f));

    // Build per-field diff (previous → new) for updates, including the full before/after snapshots.
    let field_changes = null;
    if (action === 'update' && old_data) {
      field_changes = filteredChanged.map((f) => ({
        field: f,
        previous: old_data[f] ?? null,
        new: record?.[f] ?? null,
      }));
    }

    await base44.asServiceRole.entities.ActivityLog.create({
      action,
      entity_name: 'Employee',
      entity_id,
      performed_by,
      record_snapshot: {
        ...(record || {}),
        _audit_meta: audit_meta,
        _previous_data: old_data || null,
        _field_changes: field_changes,
      },
      changed_fields: filteredChanged,
      record_name,
    });

    // If deleted, save to DeletedEmployee for recovery
    if (action === 'delete' && old_data) {
      await base44.asServiceRole.entities.DeletedEmployee.create({
        original_id: entity_id,
        deleted_by: performed_by,
        deleted_at: new Date().toISOString(),
        employee_data: old_data,
        employee_name: old_data.name || 'Unknown',
        company: old_data.company || '',
        department: old_data.department || '',
        recovered: false,
      });
    }

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});