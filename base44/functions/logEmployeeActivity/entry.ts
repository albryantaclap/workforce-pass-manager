import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

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

    // For deletes, data is null — use old_data. For creates/updates, data is available.
    const record = data || old_data;
    const record_name = record?.name || entity_id;

    // Resolve who performed the action:
    // 1. _last_updated_by_name = full name set by frontend on save
    // 2. _last_updated_by = email set by frontend on save
    // 3. For creates, fall back to platform-set created_by (email)
    // 4. Final fallback: 'system'
    const performerName = record?._last_updated_by_name || null;
    const performerEmail = record?._last_updated_by || (action === 'create' ? record?.created_by : null) || null;

    // Display name: prefer full name, then email, then 'system'
    let performed_by = performerName || performerEmail || 'system';

    // Build audit metadata to store alongside the log
    const audit_meta = {
      performer_name: performerName,
      performer_email: performerEmail,
      performer_role: record?._last_updated_by_role || null,
    };

    // Log to ActivityLog
    await base44.asServiceRole.entities.ActivityLog.create({
      action,
      entity_name: 'Employee',
      entity_id,
      performed_by,
      record_snapshot: { ...(record || {}), _audit_meta: audit_meta },
      changed_fields: changed_fields || [],
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