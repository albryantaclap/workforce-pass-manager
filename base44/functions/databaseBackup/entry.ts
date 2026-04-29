import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

const BATCH_SIZE = 500;

async function fetchAllEmployees(base44, filterFrom, filterTo) {
  const allRecords = [];
  let skip = 0;
  while (true) {
    const batch = await base44.asServiceRole.entities.Employee.list('-created_date', BATCH_SIZE, skip);
    if (!batch || batch.length === 0) break;

    // Apply date filters if provided
    const filtered = batch.filter(emp => {
      if (!filterFrom && !filterTo) return true;
      const createdDate = emp.created_date ? emp.created_date.split('T')[0] : null;
      if (!createdDate) return true;
      if (filterFrom && createdDate < filterFrom) return false;
      if (filterTo && createdDate > filterTo) return false;
      return true;
    });

    allRecords.push(...filtered);
    if (batch.length < BATCH_SIZE) break;
    skip += BATCH_SIZE;
  }
  return allRecords;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin' && user.role !== 'owner' && user.collaborator_role !== 'editor' && user.collaborator_role !== 'owner') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const payload = await req.json();
    const { action } = payload;

    // ─── CREATE BACKUP ────────────────────────────────────────────────────
    if (action === 'create_backup') {
      const { filter_from, filter_to, notes } = payload;

      const employees = await fetchAllEmployees(base44, filter_from, filter_to);

      // Build JSON content
      const backupData = {
        meta: {
          created_at: new Date().toISOString(),
          created_by: user.email,
          filter_from: filter_from || null,
          filter_to: filter_to || null,
          record_count: employees.length,
          version: '1.0',
        },
        employees,
      };

      const jsonString = JSON.stringify(backupData);
      const byteSize = new TextEncoder().encode(jsonString).length;

      // Upload to storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `backup_employees_${timestamp}.json`;

      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], filename, { type: 'application/json' });
      const { file_url } = await base44.asServiceRole.integrations.Core.UploadFile({ file });

      // Save record
      const record = await base44.asServiceRole.entities.BackupRecord.create({
        filename,
        file_url,
        file_size_bytes: byteSize,
        record_count: employees.length,
        created_by_email: user.email,
        filter_from: filter_from || null,
        filter_to: filter_to || null,
        status: 'completed',
        notes: notes || '',
      });

      // Log to ActivityLog
      await base44.asServiceRole.entities.ActivityLog.create({
        action: 'create',
        entity_name: 'BackupRecord',
        entity_id: record.id,
        performed_by: user.email,
        record_snapshot: { filename, record_count: employees.length },
        changed_fields: [],
        record_name: filename,
      });

      return Response.json({ success: true, backup: record, record_count: employees.length });
    }

    // ─── RESTORE BACKUP ────────────────────────────────────────────────────
    if (action === 'restore_backup') {
      const { file_url, backup_id } = payload;
      if (!file_url) return Response.json({ error: 'file_url required' }, { status: 400 });

      // Fetch the backup file
      const res = await fetch(file_url);
      if (!res.ok) return Response.json({ error: 'Failed to fetch backup file' }, { status: 400 });
      const backupData = await res.json();

      const employees = backupData.employees || [];
      let inserted = 0;
      let skipped = 0;
      let updated = 0;

      // Process in batches
      for (let i = 0; i < employees.length; i += BATCH_SIZE) {
        const batch = employees.slice(i, i + BATCH_SIZE);

        for (const emp of batch) {
          // Strip platform fields, keep only data fields
          const { id, created_date, updated_date, created_by, created_by_id, entity_name, app_id, is_sample, is_deleted, deleted_date, environment, ...empData } = emp;

          // Check for duplicate by qid_no if available
          if (empData.qid_no) {
            const existing = await base44.asServiceRole.entities.Employee.filter({ qid_no: empData.qid_no });
            if (existing && existing.length > 0) {
              // Update existing record
              await base44.asServiceRole.entities.Employee.update(existing[0].id, empData);
              updated++;
              continue;
            }
          }

          await base44.asServiceRole.entities.Employee.create(empData);
          inserted++;
        }
      }

      // Log restore action
      await base44.asServiceRole.entities.ActivityLog.create({
        action: 'update',
        entity_name: 'BackupRecord',
        entity_id: backup_id || 'manual',
        performed_by: user.email,
        record_snapshot: { inserted, updated, skipped },
        changed_fields: ['restore'],
        record_name: `Restore: ${inserted} inserted, ${updated} updated`,
      });

      return Response.json({ success: true, inserted, updated, skipped, total: employees.length });
    }

    // ─── DELETE BACKUP ────────────────────────────────────────────────────
    if (action === 'delete_backup') {
      const { backup_id } = payload;
      if (!backup_id) return Response.json({ error: 'backup_id required' }, { status: 400 });

      await base44.asServiceRole.entities.BackupRecord.delete(backup_id);

      await base44.asServiceRole.entities.ActivityLog.create({
        action: 'delete',
        entity_name: 'BackupRecord',
        entity_id: backup_id,
        performed_by: user.email,
        record_snapshot: {},
        changed_fields: [],
        record_name: `Deleted backup: ${backup_id}`,
      });

      return Response.json({ success: true });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});