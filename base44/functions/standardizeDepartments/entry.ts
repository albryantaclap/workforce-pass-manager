import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all employees (active and inactive)
    const allEmployees = await base44.asServiceRole.entities.Employee.list('-created_date', 10000);

    const updates = [];
    for (const emp of allEmployees) {
      if (!emp.department) continue;

      const standardized = emp.department.toUpperCase().trim();
      
      // Only update if different from current value
      if (emp.department !== standardized) {
        updates.push({
          id: emp.id,
          department: standardized,
        });
      }
    }

    // Perform bulk updates
    let updateCount = 0;
    for (const update of updates) {
      await base44.asServiceRole.entities.Employee.update(update.id, { department: update.department });
      updateCount++;
    }

    return Response.json({
      success: true,
      message: `Standardized ${updateCount} employee department values to ALL CAPS`,
      totalEmployees: allEmployees.length,
      updatedCount: updateCount,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});