import { createClientFromRequest } from "npm:@base44/sdk@0.8.49";
import { filterEmployees, isWorkingDay, isHoliday, resolveShift, calculateAttendanceStatus } from "../../shared/attendanceCalc.ts";

// Server-side aggregation for the Daily Attendance → Dashboard tab.
// Returns KPIs, currently clocked-in list, check-ins by hour, and department
// snapshot — all computed server-side so the frontend doesn't need to load
// the full employee list or process thousands of records in the browser.
//
// KPI logic matches AttendanceKpiCards.jsx exactly (uses stored
// attendance_status field, same counting rules).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { date = "", filters = {} } = body;

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

    // 4. Calculate KPIs + derived data (same logic as frontend components)
    let present = 0, absent = 0, late = 0, checkedIn = 0, checkedOut = 0;
    let currentlyWorking = 0, missingCheckout = 0, onLeave = 0, restDay = 0;
    const clockedIn: any[] = [];
    const hourCounts: Record<number, number> = {};
    const deptMap = new Map<string, { dept: string; total: number; present: number }>();
    const PRESENT_STATUSES = ["Present", "Late", "Half Day", "Missing Check-out", "Incomplete"];

    for (const emp of filteredEmps) {
      const att = attByPersonnel.get(emp.id);
      let status: string;
      if (att) {
        const shift = resolveShift(emp, assignments, shifts, settings);
        status = calculateAttendanceStatus(att, shift, settings, holidays, now);
      } else {
        status = holiday ? "Holiday" : (workingDay ? "Absent" : "Rest Day");
      }

      if (status === "Present") present++;
      else if (status === "Late") { present++; late++; }
      else if (status === "Absent") absent++;
      else if (status === "Missing Check-out") { present++; missingCheckout++; }
      else if (status === "Incomplete") { present++; missingCheckout++; }
      else if (status === "Half Day") { present++; }
      else if (status === "On Leave") onLeave++;
      else if (status === "Rest Day") restDay++;
      else if (status === "Holiday") restDay++;

      const firstIn = att?.first_in_at || att?.check_in_at || "";
      const finalOut = att?.final_out_at || att?.check_out_at || "";
      if (firstIn && !finalOut) {
        checkedIn++; currentlyWorking++;
        clockedIn.push({ emp, since: firstIn });
      }
      if (finalOut) checkedOut++;

      // Check-ins by hour
      if (firstIn) {
        const h = new Date(firstIn).getHours();
        hourCounts[h] = (hourCounts[h] || 0) + 1;
      }

      // Department snapshot
      const dept = emp.department || "Unassigned";
      if (!deptMap.has(dept)) deptMap.set(dept, { dept, total: 0, present: 0 });
      const entry = deptMap.get(dept)!;
      entry.total++;
      if (PRESENT_STATUSES.includes(status)) entry.present++;
    }

    const expected = filteredEmps.length - onLeave - restDay;
    const rate = expected > 0 ? Math.round((present / expected) * 100) : 0;

    // 5. Sort clocked-in by check-in time (oldest first)
    clockedIn.sort((a, b) => new Date(a.since).getTime() - new Date(b.since).getTime());

    // 6. Build check-ins by hour data (same hours as CheckInsByHourChart.jsx)
    const HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
    const hourLabel = (h: number) => {
      const suffix = h < 12 ? "am" : "pm";
      const disp = h <= 12 ? h : h - 12;
      return `${disp}${suffix}`;
    };
    const checkInsByHour = HOURS.map(h => ({ hour: hourLabel(h), count: hourCounts[h] || 0 }));

    // 7. Department snapshot sorted by total descending
    const departments = [...deptMap.values()].sort((a, b) => b.total - a.total);

    return Response.json({
      kpis: {
        total: filteredEmps.length, present, absent, late,
        checkedIn, checkedOut, currentlyWorking,
        missingCheckout, onLeave, restDay, rate, expected,
      },
      clockedIn: clockedIn.slice(0, 100).map(({ emp, since }: any) => ({
        id: emp.id, name: emp.name, photo_url: emp.photo_url || "",
        company: emp.company || "", since,
      })),
      checkInsByHour,
      departments,
    });
  } catch (err: any) {
    return Response.json({ error: err.message || "Internal error" }, { status: 500 });
  }
}