import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * One-time migration of the old status model to the corrected one.
 *
 * OLD: 'Demobilized' was a PERSONNEL status, mutually exclusive with 'Inactive'.
 * NEW: 'Inactive' is the personnel/project status and 'Demobilized' is a COMO
 *      Camp status. A demobilized person stays Inactive and appears in both the
 *      Inactive list and the Demobilized list.
 *
 * For every record still carrying personnel_status = 'Demobilized':
 *   personnel_status  -> 'Inactive'
 *   camp_status       -> 'DEMOBILIZED'
 * plus camp check-out / demobilization / inactive dates and reasons, without
 * touching any other field or creating a duplicate record.
 *
 * Body: { dryRun?: boolean }
 */

const toDateOnly = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('en-CA');
};

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dryRun === true;

    const stays = await base44.asServiceRole.entities.ComoCampStay.list('-check_in_at', 100000);
    const latestStayByPersonnel = new Map();
    for (const stay of stays) {
      if (stay.is_deleted || !stay.personnel_id) continue;
      if (!latestStayByPersonnel.has(stay.personnel_id)) latestStayByPersonnel.set(stay.personnel_id, stay);
    }

    const legacy = await base44.asServiceRole.entities.Employee.filter({ personnel_status: 'Demobilized' }, '-created_date', 100000);

    const updates = legacy.map((emp) => {
      const stay = latestStayByPersonnel.get(emp.id);
      const demobDate = toDateOnly(emp.demobilization_date || emp.status_effective_date || emp.created_date);
      const reason = emp.demobilization_reason || emp.status_reason || '';
      return {
        id: emp.id,
        personnel_status: 'Inactive',
        is_active: false,
        camp_status: 'DEMOBILIZED',
        camp_check_out_at: emp.camp_check_out_at || (stay && stay.check_out_at ? stay.check_out_at : ''),
        demobilized_at: emp.demobilized_at || demobDate,
        demobilization_date: emp.demobilization_date || demobDate,
        demobilization_reason: reason,
        inactive_date: emp.inactive_date || demobDate,
        inactive_reason: emp.inactive_reason || reason,
      };
    });

    if (dryRun) {
      return Response.json({ dryRun: true, toMigrate: updates.length, sample: updates.slice(0, 3) });
    }

    let migrated = 0;
    for (let i = 0; i < updates.length; i += 500) {
      const batch = updates.slice(i, i + 500);
      const res = await base44.asServiceRole.entities.Employee.bulkUpdate(batch);
      migrated += Array.isArray(res) ? res.length : batch.length;
    }

    return Response.json({ migrated, total: updates.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}