import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

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
    const record_name = record?.name || entity_id;
    const performed_by = record?.created_by || 'unknown';

    // Log to ActivityLog
    await base44.asServiceRole.entities.ActivityLog.create({
      action,
      entity_name: 'Employee',
      entity_id,
      performed_by,
      record_snapshot: record || {},
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