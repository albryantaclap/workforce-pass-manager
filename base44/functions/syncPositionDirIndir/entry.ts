import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

const VALID_VALUES = ['DIR', 'INDIR'];

// Fields on the Employee (Master List) record that a position row can classify.
function targetFields(type) {
  const fields = [];
  if (type === 'position_application' || type === 'both') fields.push('position_application');
  if (type === 'designation_org_chart' || type === 'both') fields.push('designation_org_chart');
  return fields;
}

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const positionName = String(body?.position_name || '').trim();
    const dirIndir = body?.dir_indir;
    const fields = targetFields(body?.type);

    if (!positionName) return Response.json({ error: 'position_name is required' }, { status: 400 });
    if (!VALID_VALUES.includes(dirIndir)) return Response.json({ error: 'dir_indir must be DIR or INDIR' }, { status: 400 });
    if (fields.length === 0) return Response.json({ error: 'Invalid position type' }, { status: 400 });

    // Match the stored value ignoring surrounding spaces and casing.
    const escaped = positionName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = `^\\s*${escaped}\\s*$`;
    const employees = base44.asServiceRole.entities.Employee;

    // Count distinct personnel matching any of the target fields.
    const matchFilter = fields.length === 1
      ? { [fields[0]]: { $regex: pattern, $options: 'i' } }
      : { $or: fields.map(field => ({ [field]: { $regex: pattern, $options: 'i' } })) };
    const matched = await employees.count(matchFilter);

    // updateMany caps each call, so keep going while records remain (guarded).
    for (const field of fields) {
      let hasMore = true;
      let guard = 0;
      while (hasMore && guard < 40) {
        const result = await employees.updateMany(
          { [field]: { $regex: pattern, $options: 'i' }, dir_indir: { $ne: dirIndir } },
          { $set: { dir_indir: dirIndir } }
        );
        hasMore = !!result?.has_more;
        guard++;
      }
    }

    return Response.json({ success: true, matched, dir_indir: dirIndir });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}