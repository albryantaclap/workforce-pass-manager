import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

// One-time migration helper: scans every Employee and ApprovedRecord for
// distinct `work_location` values and creates a matching Work Location lookup
// entry (type = "work_location") for any value not already present.
//
// - Existing employee/approved records are NEVER modified — only lookup entries
//   are created so the stored string values become "linked" to the lookup by
//   value match.
// - Normalization for matching: trim + uppercase. The lookup stores the
//   uppercased value; the original record keeps its raw string (which matches
//   when compared case-insensitively).
// - Soft-deleted lookups are not revived here; only genuinely missing values
//   are seeded.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // 1. Collect distinct work_location values from Employees + ApprovedRecords.
    const distinct = new Set<string>();
    const add = (v?: string | null) => {
      if (!v) return;
      const norm = String(v).trim().toUpperCase();
      if (norm) distinct.add(norm);
    };

    const employees = await base44.asServiceRole.entities.Employee.list('-created_date', 100000);
    for (const e of employees) add(e.work_location);

    const approved = await base44.asServiceRole.entities.ApprovedRecord.list('-created_date', 100000);
    for (const a of approved) add(a.work_location);

    // 2. Fetch existing work_location lookups to avoid duplicates.
    const existing = await base44.asServiceRole.entities.Lookup.filter({ type: 'work_location' }, undefined, 10000);
    const existingValues = new Set(existing.map((l: any) => String(l.value).trim().toUpperCase()));

    // 3. Create the missing entries.
    let createdCount = 0;
    for (const value of distinct) {
      if (existingValues.has(value)) continue;
      await base44.asServiceRole.entities.Lookup.create({
        type: 'work_location',
        value,
        label: value,
        is_builtin: false,
        is_deleted: false,
      });
      createdCount++;
    }

    return Response.json({
      success: true,
      message: `Seeded ${createdCount} Work Location lookup entr${createdCount === 1 ? 'y' : 'ies'} from existing data.`,
      distinctValues: distinct.size,
      createdCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});