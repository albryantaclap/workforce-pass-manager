import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { ATTENDANCE_ROSTER_QUERY } from "../../shared/attendanceRoster.ts";

// Returns the filter dropdown values used across Daily Attendance.
// Companies / departments / designations / managers come from the active employee
// roster; Branch / Location comes from the Branch / Work Locations register in
// Attendance Settings. Called once and cached on the frontend for 5 minutes, so
// the filter bar dropdowns don't require loading the full employee list on every
// page navigation.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const [employees, locations] = await Promise.all([
      base44.entities.Employee.filter(ATTENDANCE_ROSTER_QUERY, "name", 100000),
      base44.entities.WorkLocation.list("-created_date", 1000),
    ]);

    const unique = (field: string) =>
      [...new Set(employees.map((e: any) => e[field]).filter(Boolean))].sort();

    return Response.json({
      companies: unique("company"),
      departments: unique("department"),
      designations: unique("position_application"),
      // Branch / Location options come from the Branch / Work Locations register
      // in Attendance Settings (WorkLocation) — never from employee
      // current_location, which only holds camp/office groupings.
      branches: [...new Set(locations.map((l: any) => l.location_name).filter(Boolean))].sort(),
      managers: [...new Set(employees.map((e: any) => e.assigned_manager_name).filter(Boolean))].sort(),
    });
  } catch (err: any) {
    return Response.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}