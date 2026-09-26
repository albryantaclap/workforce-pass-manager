import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";

// Returns unique filter values (companies, departments, designations, branches,
// managers) from active employees. Called once and cached on the frontend for
// 5 minutes, so the filter bar dropdowns don't require loading the full employee
// list on every page navigation.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const employees = await base44.entities.Employee.filter(
      { personnel_status: "Active on Site", is_active: { $ne: false } },
      "name", 100000
    );

    const unique = (field: string) =>
      [...new Set(employees.map((e: any) => e[field]).filter(Boolean))].sort();

    return Response.json({
      companies: unique("company"),
      departments: unique("department"),
      designations: unique("position_application"),
      branches: unique("current_location"),
      managers: [...new Set(employees.map((e: any) => e.assigned_manager_name).filter(Boolean))].sort(),
    });
  } catch (err: any) {
    return Response.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}