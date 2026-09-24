import { createClientFromRequest } from 'npm:@base44/sdk@0.8.49';
import { checkPermission } from '../../shared/permissionCheck.ts';

// Backend authorization for attendance record soft-delete.
// Checks attendance.entries.delete permission before performing the operation.
// A user without the permission receives 403 Forbidden even if they call the
// endpoint directly.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { allowed } = await checkPermission(base44, user, 'attendance.entries.delete');
    if (!allowed) {
      return Response.json({ error: 'Forbidden: Delete permission required for Time Entries' }, { status: 403 });
    }

    const { recordId, reason } = await req.json();
    if (!recordId) return Response.json({ error: 'Record ID is required' }, { status: 400 });
    if (!reason?.trim()) return Response.json({ error: 'A deletion reason is required' }, { status: 400 });

    // Fetch the record (user-scoped — RLS may restrict access)
    const rec = await base44.entities.AttendanceRecord.get(recordId);

    // Soft-delete
    await base44.entities.AttendanceRecord.update(recordId, {
      is_deleted: true,
      deleted_at: new Date().toISOString(),
      deleted_by: user?.email || '',
      deletion_reason: reason.trim(),
    });

    // Log activity (service role to ensure the log is always written)
    await base44.asServiceRole.entities.ActivityLog.create({
      action: 'delete',
      entity_name: 'AttendanceRecord',
      entity_id: recordId,
      performed_by: user?.email || '',
      record_name: rec?.employee_name || '',
      record_snapshot: { reason: reason.trim(), deleted_by: user?.email || '' },
      changed_fields: ['is_deleted'],
    });

    return Response.json({ action: 'deleted', recordId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});