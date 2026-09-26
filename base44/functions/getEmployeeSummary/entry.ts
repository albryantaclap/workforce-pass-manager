import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import {
  calculateDurationFromRecord,
  isWorkingDay,
  isHoliday,
  filterEmployees,
  resolveShift,
  calculateAttendanceStatus,
} from "../../shared/attendanceCalc.ts";

// Server-side aggregation and pagination for the Daily Attendance → Employee Summary tab.
//
// Query order: personnel filters → date range → attendance aggregation → status condition → pagination
//
// The status filter uses the SAME aggregated values displayed in the summary table
// (Present / Absent / Late / Leave), not a separate personnel status. An employee
// qualifies for a status if they have at least one day with that status in the period.

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      filters = {},
      dateFrom = "",
      dateTo = "",
      status = "",
      page = 1,
      pageSize = 20,
    } = body;

    // 1. Fetch settings, holidays, shifts, and assignments
    const [settingsRows, holidays, shifts, assignments] = await Promise.all([
      base44.entities.AttendanceSetting.filter({ setting_key: "global" }, undefined, 10),
      base44.entities.AttendanceHoliday.filter({ is_active: true }, undefined, 1000),
      base44.entities.AttendanceShift.list("-created_date", 1000),
      base44.entities.AttendanceShiftAssignment.list("-created_date", 5000),
    ]);
    const settings = settingsRows[0] || {};
    const otStartMinutes = (settings.overtime_start_hours ?? 8) * 60;
    const now = new Date();

    // 2. Fetch all active employees
    const employees = await base44.entities.Employee.filter(
      { personnel_status: { $in: ["Active on Site", ""] }, is_active: { $ne: false } },
      "name",
      100000
    );

    // 3. Apply personnel filters (search, company, department, etc.)
    const filteredEmps = filterEmployees(employees, filters);

    // 4. Compute working days in the date range
    const workingDays: string[] = [];
    if (dateFrom && dateTo) {
      const [fy, fm, fd] = dateFrom.split("-").map(Number);
      const [ty, tm, td] = dateTo.split("-").map(Number);
      const start = new Date(fy, fm - 1, fd);
      const end = new Date(ty, tm - 1, td);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const ds = d.toLocaleDateString("en-CA");
        if (isWorkingDay(ds, settings) && !isHoliday(ds, holidays)) {
          workingDays.push(ds);
        }
      }
    }

    // 5. Fetch attendance records for filtered employees in the date range
    //    Use $in with chunking to stay within query size limits.
    const empIds = filteredEmps.map((e) => e.id);
    let allAttendance: any[] = [];
    if (empIds.length > 0 && dateFrom && dateTo) {
      const CHUNK = 200;
      for (let i = 0; i < empIds.length; i += CHUNK) {
        const chunk = empIds.slice(i, i + CHUNK);
        const records = await base44.entities.AttendanceRecord.filter(
          {
            personnel_id: { $in: chunk },
            is_deleted: { $ne: true },
            attendance_date: { $gte: dateFrom, $lte: dateTo },
          },
          "-attendance_date",
          100000
        );
        allAttendance = allAttendance.concat(records);
      }
    }

    // 6. Group attendance by personnel
    const attByPersonnel = new Map<string, any[]>();
    for (const r of allAttendance) {
      if (!attByPersonnel.has(r.personnel_id)) {
        attByPersonnel.set(r.personnel_id, []);
      }
      attByPersonnel.get(r.personnel_id).push(r);
    }

    // 7. Build summary rows with aggregation (same logic as the frontend)
    const summaryRows = filteredEmps.map((emp) => {
      const records = attByPersonnel.get(emp.id) || [];
      const shift = resolveShift(emp, assignments, shifts, settings);
      let present = 0,
        late = 0,
        leave = 0,
        totalMinutes = 0,
        overtimeMinutes = 0;
      const statusCounts: Record<string, number> = {};

      for (const r of records) {
        const s = calculateAttendanceStatus(r, shift, settings, holidays, now);
        statusCounts[s] = (statusCounts[s] || 0) + 1;
        if (s === "Present" || s === "Late" || s === "Half Day" || s === "Missing Check-out") present++;
        if (s === "Late") late++;
        if (s === "On Leave") leave++;
        totalMinutes += calculateDurationFromRecord(r);
        overtimeMinutes += r.overtime_minutes || Math.max(0, calculateDurationFromRecord(r) - otStartMinutes);
      }

      // Absent = working days with no record (minus leave days)
      const daysWithRecord = new Set(records.map((r) => r.attendance_date)).size;
      const absent = Math.max(0, workingDays.length - daysWithRecord - leave);
      const attPct = workingDays.length > 0 ? Math.round((present / workingDays.length) * 100) : 0;

      return {
        id: emp.id,
        name: emp.name,
        photo_url: emp.photo_url || "",
        position_application: emp.position_application || "",
        qid_no: emp.qid_no || "",
        company: emp.company || "",
        department: emp.department || "",
        current_location: emp.current_location || "",
        assigned_manager_name: emp.assigned_manager_name || "",
        workingDays: workingDays.length,
        present,
        absent,
        late,
        leave,
        totalMinutes,
        overtimeMinutes,
        attPct,
        statusCounts,
      };
    });

    // 8. Apply status filter based on aggregated values
    //    The four main statuses map to the summary table columns.
    //    Other statuses check if the employee has any record with that status.
    let filteredRows = summaryRows;
    if (status) {
      filteredRows = summaryRows.filter((row) => {
        if (status === "Present") return row.present > 0;
        if (status === "Absent") return row.absent > 0;
        if (status === "Late") return row.late > 0;
        if (status === "On Leave") return row.leave > 0;
        return (row.statusCounts[status] || 0) > 0;
      });
    }

    // 9. Sort by name
    filteredRows.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    // 10. Paginate
    const total = filteredRows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const pageRows = filteredRows.slice(startIdx, startIdx + pageSize);

    return Response.json({
      rows: pageRows,
      total,
      page: safePage,
      pageSize,
      totalPages,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}