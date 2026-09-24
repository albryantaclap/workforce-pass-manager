import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { filterEmployees } from "../../shared/attendanceCalc.ts";

// Server-side filtering and pagination for the Daily Attendance → Attendance Reports tab.
//
// Returns individual attendance records (one per day per employee), joined with
// employee data, filtered by report type and status, then paginated.
// When exportAll=true, returns all matching records without pagination (for CSV export).

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      filters = {},
      dateFrom = "",
      dateTo = "",
      reportType = "daily",
      status = "",
      page = 1,
      pageSize = 20,
      exportAll = false,
    } = body;

    // 1. Fetch all active employees
    const employees = await base44.entities.Employee.filter(
      { personnel_status: "Active", is_active: { $ne: false } },
      "name",
      100000
    );

    // 2. Apply personnel filters (search, company, department, etc.)
    const filteredEmps = filterEmployees(employees, filters);
    const empMap = new Map(filteredEmps.map((e) => [e.id, e]));
    const empIds = filteredEmps.map((e) => e.id);

    // 3. Fetch attendance records for filtered employees in the date range
    let allRecords: any[] = [];
    if (empIds.length > 0) {
      const CHUNK = 200;
      for (let i = 0; i < empIds.length; i += CHUNK) {
        const chunk = empIds.slice(i, i + CHUNK);
        const query: any = {
          personnel_id: { $in: chunk },
          is_deleted: { $ne: true },
        };
        if (dateFrom || dateTo) {
          query.attendance_date = {};
          if (dateFrom) query.attendance_date.$gte = dateFrom;
          if (dateTo) query.attendance_date.$lte = dateTo;
        }
        const records = await base44.entities.AttendanceRecord.filter(
          query,
          "-attendance_date",
          100000
        );
        allRecords = allRecords.concat(records);
      }
    }

    // 4. Build report rows with employee join and apply report type + status filters
    let reportRows = allRecords
      .map((r) => ({
        record: r,
        emp: empMap.get(r.personnel_id) || { name: r.employee_name, company: r.company },
      }))
      .filter(({ record }) => {
        // Report type filter
        if (reportType === "late") return record.attendance_status === "Late" || record.is_late;
        if (reportType === "absent") return record.attendance_status === "Absent";
        if (reportType === "missing")
          return record.attendance_status === "Missing Check-out" || record.attendance_status === "Incomplete";
        if (reportType === "overtime") return (record.overtime_minutes || 0) > 0;
        return true;
      })
      .filter(({ record }) => {
        // Status filter (matches the record's attendance_status)
        if (!status) return true;
        return record.attendance_status === status;
      });

    // 5. Sort by date descending, then by name
    reportRows.sort((a, b) => {
      const dateCmp = (b.record.attendance_date || "").localeCompare(a.record.attendance_date || "");
      if (dateCmp !== 0) return dateCmp;
      return (a.emp?.name || "").localeCompare(b.emp?.name || "");
    });

    // 6. Paginate (or return all for export)
    const total = reportRows.length;
    if (exportAll) {
      return Response.json({
        rows: reportRows,
        total,
        page: 1,
        pageSize: total,
        totalPages: 1,
      });
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const pageRows = reportRows.slice(startIdx, startIdx + pageSize);

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