import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { filterEmployees, resolveShift, calculateAttendanceStatus, matchesBranch } from "../../shared/attendanceCalc.ts";
import {
  fetchAttendanceRecordsInRange, fetchEmployeesByIds, loadShiftAssignments, attendanceIntegrity,
} from "../../shared/attendanceRecords.ts";
import { loadUserDirectory, resolveScannedBy, needsUserDirectory } from "../../shared/attendanceUsers.ts";

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

    // 1. Settings, holidays, shifts and the COMPLETE shift-assignment table.
    const [settingsRows, holidays, shifts, assignments] = await Promise.all([
      base44.entities.AttendanceSetting.filter({ setting_key: "global" }, undefined, 10),
      base44.entities.AttendanceHoliday.filter({ is_active: true }, undefined, 1000),
      base44.entities.AttendanceShift.list("-created_date", 1000),
      loadShiftAssignments(base44),
    ]);
    const settings = settingsRows[0] || {};
    const now = new Date();

    // 2. Every attendance record in the date range, read to completion.
    //
    //    The range is no longer narrowed to the current attendance roster first:
    //    that silently removed the attendance of anyone who had since become
    //    Inactive (left the project) or been removed from the quota, so their
    //    valid work days vanished from reports and exports. The records are the
    //    source of truth here; personnel data is joined onto them below.
    const range = await fetchAttendanceRecordsInRange(base44, dateFrom, dateTo);
    const allRecords = range.records;

    // 3. Resolve the personnel those records belong to — whatever their current
    //    status — so a name and company stay attached to historical attendance.
    const empMap = await fetchEmployeesByIds(base44, allRecords.map((r) => r.personnel_id));

    // 4. Personnel filters (search, company, department, designation, manager,
    //    DIR/INDIR). Rows whose employee record can no longer be resolved are
    //    KEPT (never dropped) because no filter can be evaluated for them.
    const personnelFilterKeys = ["search", "company", "department", "designation", "manager", "dirIndir"];
    const hasPersonnelFilter = personnelFilterKeys.some((key) => !!filters[key]);
    const allowedIds = hasPersonnelFilter
      ? new Map(filterEmployees([...empMap.values()], filters).map((e: any) => [e.id, true]))
      : null;

    // 5. Build report rows with employee join, calculated status, and apply filters
    let reportRows = allRecords
      .map((r) => {
        const resolved = empMap.get(r.personnel_id);
        const emp = resolved || { name: r.employee_name, company: r.company };
        const shift = resolveShift(emp, assignments, shifts, settings);
        const calcStatus = calculateAttendanceStatus(r, shift, settings, holidays, now);
        // true only when the personnel record itself is gone — the row is still
        // reported (with its stored name) instead of being dropped.
        const unresolved = !resolved;
        return { record: r, emp, calcStatus, unresolved };
      })
      // Personnel filters apply to resolvable employees only; an unresolved row
      // is always kept so attendance can never disappear because a personnel
      // record was deleted.
      .filter(({ record, unresolved }) => {
        if (!allowedIds || unresolved) return true;
        return allowedIds.has(record.personnel_id);
      })
      .filter(({ record, calcStatus }) => {
        // Report type filter (uses calculated status)
        if (reportType === "late") return calcStatus === "Late" || record.is_late;
        if (reportType === "absent") return calcStatus === "Absent";
        if (reportType === "missing")
          return calcStatus === "Missing Check-out" || calcStatus === "Incomplete";
        if (reportType === "overtime") return (record.overtime_minutes || 0) > 0;
        return true;
      })
      .filter(({ calcStatus }) => {
        // Status filter (uses calculated status)
        if (!status) return true;
        return calcStatus === status;
      })
      // Branch / Location filter — the branch recorded for that day's attendance
      // (Attendance Settings → Branch / Work Locations).
      .filter(({ record }) => matchesBranch(record, filters.branch));

    // 5. Sort by date descending, then by name
    reportRows.sort((a, b) => {
      const dateCmp = (b.record.attendance_date || "").localeCompare(a.record.attendance_date || "");
      if (dateCmp !== 0) return dateCmp;
      return (a.emp?.name || "").localeCompare(b.emp?.name || "");
    });

    // 6. Scanned By — WHO performed each punch, resolved from the User entity
    //    with ONE batched lookup per request (never one query per row), so the
    //    table and the export both carry the per-punch account.
    let userDir: any = null;
    const withScannedBy = async (rowsToSend: any[]) => {
      if (needsUserDirectory(rowsToSend.map((r) => r.record))) {
        if (!userDir) userDir = await loadUserDirectory(base44);
      }
      const dir = userDir || { byId: new Map(), byEmail: new Map() };
      return rowsToSend.map((r) => ({ ...r, scanned_by: resolveScannedBy(r.record, dir) }));
    };

    // 7. Paginate (or return all for export)
    const total = reportRows.length;

    // 9. Data-quality facts about the range that was read — returned with every
    //    answer so a short or double-counted number can never pass unnoticed.
    const integrity = {
      ...attendanceIntegrity(allRecords, empMap),
      read_complete: range.complete,
      reported_rows: total,
    };

    if (exportAll) {
      return Response.json({
        rows: await withScannedBy(reportRows),
        total,
        page: 1,
        pageSize: total,
        totalPages: 1,
        integrity,
      });
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const pageRows = reportRows.slice(startIdx, startIdx + pageSize);

    return Response.json({
      rows: await withScannedBy(pageRows),
      total,
      page: safePage,
      pageSize,
      totalPages,
      integrity,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}