import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { filterEmployees, isWorkingDay, isHoliday, resolveShift, calculateAttendanceStatus } from "../../shared/attendanceCalc.ts";

// Server-side filtering, pagination, and KPI aggregation for the
// Daily Attendance → Time Entries tab.
//
// Query order: personnel filters → attendance join → showAbsent → status filter
// → KPI aggregation → pagination → return current page + KPIs.
//
// The frontend calls calculateAttendanceState() for each row to get the
// live display status. The status *filter* uses the stored attendance_status
// field (same as the existing frontend filter in DailyAttendance.jsx).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const {
      date = "",
      filters = {},
      showAbsent = true,
      status = "",
      page = 1,
      pageSize = 50,
    } = body;

    // 1. Fetch settings, holidays, shifts, and assignments
    const [settingsRows, holidays, shifts, assignments] = await Promise.all([
      base44.entities.AttendanceSetting.filter({ setting_key: "global" }, undefined, 10),
      base44.entities.AttendanceHoliday.filter({ is_active: true }, undefined, 1000),
      base44.entities.AttendanceShift.list("-created_date", 1000),
      base44.entities.AttendanceShiftAssignment.list("-created_date", 5000),
    ]);
    const settings = settingsRows[0] || {};
    const holiday = isHoliday(date, holidays);
    const workingDay = isWorkingDay(date, settings);
    const now = new Date();

    // 2. Fetch all active employees and apply personnel filters
    const employees = await base44.entities.Employee.filter(
      { personnel_status: { $in: ["Active on Site", ""] }, is_active: { $ne: false } },
      "name", 100000
    );
    const filteredEmps = filterEmployees(employees, filters);

    // 3. Fetch attendance records for the selected date (chunked $in query)
    const empIds = filteredEmps.map((e: any) => e.id);
    const attByPersonnel = new Map<string, any>();
    if (empIds.length > 0 && date) {
      const CHUNK = 200;
      for (let i = 0; i < empIds.length; i += CHUNK) {
        const chunk = empIds.slice(i, i + CHUNK);
        const records = await base44.entities.AttendanceRecord.filter(
          { personnel_id: { $in: chunk }, is_deleted: { $ne: true }, attendance_date: date },
          undefined, 100000
        );
        for (const r of records) {
          if (!attByPersonnel.has(r.personnel_id)) {
            attByPersonnel.set(r.personnel_id, r);
          }
        }
      }
    }

    // 4. Build rows with calculated status for filtering
    //    Uses the centralized calculateAttendanceStatus (same as frontend display)
    //    so KPIs and filtering match the Status column exactly.
    let rows = filteredEmps.map((emp: any) => {
      const att = attByPersonnel.get(emp.id) || null;
      let simpleStatus: string;
      if (att) {
        const shift = resolveShift(emp, assignments, shifts, settings);
        simpleStatus = calculateAttendanceStatus(att, shift, settings, holidays, now);
      } else {
        simpleStatus = holiday ? "Holiday" : (workingDay ? "Absent" : "Rest Day");
      }
      return { emp, att, simpleStatus };
    });

    // 5. Apply showAbsent filter
    if (!showAbsent) {
      rows = rows.filter((r: any) => r.att !== null);
    }

    // 6. Apply status filter
    if (status) {
      rows = rows.filter((r: any) => r.simpleStatus === status);
    }

    // 7. Calculate KPIs for the entire filtered set (same logic as AttendanceKpiCards)
    let present = 0, absent = 0, late = 0, checkedIn = 0, checkedOut = 0;
    let currentlyWorking = 0, missingCheckout = 0, onLeave = 0, restDay = 0;

    for (const { att, simpleStatus } of rows) {
      if (simpleStatus === "Present") present++;
      else if (simpleStatus === "Late") { present++; late++; }
      else if (simpleStatus === "Absent") absent++;
      else if (simpleStatus === "Missing Check-out") { present++; missingCheckout++; }
      else if (simpleStatus === "Incomplete") { present++; missingCheckout++; }
      else if (simpleStatus === "Half Day") { present++; }
      else if (simpleStatus === "On Leave") onLeave++;
      else if (simpleStatus === "Rest Day") restDay++;
      else if (simpleStatus === "Holiday") restDay++;

      const firstIn = att?.first_in_at || att?.check_in_at || "";
      const finalOut = att?.final_out_at || att?.check_out_at || "";
      if (firstIn && !finalOut) { checkedIn++; currentlyWorking++; }
      if (finalOut) checkedOut++;
    }

    const expected = rows.length - onLeave - restDay;
    const rate = expected > 0 ? Math.round((present / expected) * 100) : 0;

    // 8. Paginate
    const total = rows.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const startIdx = (safePage - 1) * pageSize;
    const pageRows = rows.slice(startIdx, startIdx + pageSize);

    // 9. Return rows (with employee + attendance data) + KPIs
    return Response.json({
      rows: pageRows.map(({ emp, att }: any) => ({
        emp: {
          id: emp.id, name: emp.name, photo_url: emp.photo_url || "",
          position_application: emp.position_application || "",
          qid_no: emp.qid_no || "", pid: emp.pid || "",
          company: emp.company || "", department: emp.department || "",
          current_location: emp.current_location || "",
        },
        att: att ? {
          id: att.id,
          first_in_at: att.first_in_at || att.check_in_at || "",
          first_out_at: att.first_out_at || "",
          second_in_at: att.second_in_at || "",
          final_out_at: att.final_out_at || att.check_out_at || "",
          check_in_at: att.check_in_at || "",
          check_out_at: att.check_out_at || "",
          duration_minutes: att.duration_minutes || 0,
          overtime_minutes: att.overtime_minutes || 0,
          attendance_status: att.attendance_status || "",
          manual_status_override: att.manual_status_override || "",
        } : null,
      })),
      total, page: safePage, pageSize, totalPages,
      kpis: {
        total: rows.length, present, absent, late,
        checkedIn, checkedOut, currentlyWorking,
        missingCheckout, onLeave, restDay, rate, expected,
      },
    });
  } catch (err: any) {
    return Response.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}