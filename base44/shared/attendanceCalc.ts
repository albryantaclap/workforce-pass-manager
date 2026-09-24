// Shared attendance calculation and filtering functions used by backend functions.
// Extracted to avoid duplication between getEmployeeSummary and getAttendanceReport.

export function calcDuration(a: string, b: string): number {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

export function calculateDurationFromRecord(record: any): number {
  if (!record) return 0;
  const firstIn = record.first_in_at || record.check_in_at || "";
  const finalOut = record.final_out_at || record.check_out_at || "";
  let total = 0;
  if (record.first_in_at && record.first_out_at) {
    total += calcDuration(record.first_in_at, record.first_out_at);
  }
  if (record.second_in_at && record.final_out_at) {
    total += calcDuration(record.second_in_at, record.final_out_at);
  }
  if (!record.first_out_at && !record.second_in_at && firstIn && finalOut) {
    total = calcDuration(firstIn, finalOut);
  }
  return total;
}

const DAY_KEYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function dayKey(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return DAY_KEYS[new Date(y, m - 1, d).getDay()];
}

export function isWorkingDay(dateStr: string, settings: any): boolean {
  const days = settings?.working_days || ["Sun", "Mon", "Tue", "Wed", "Thu"];
  return days.includes(dayKey(dateStr));
}

export function isHoliday(dateStr: string, holidays: any[]): any {
  if (!dateStr || !holidays?.length) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const monthDay = `${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return holidays.find((h) => {
    if (!h.is_active) return false;
    if (h.repeat_yearly) return h.holiday_date?.slice(5) === monthDay;
    return h.holiday_date === dateStr;
  }) || null;
}

// ── Shift resolution & status calculation (mirrors attendanceEngine.js) ──
// Used by backend functions so KPIs and filtering use the SAME live status
// calculation as the frontend display (calculateAttendanceState).

const QATAR_OFFSET_MIN = 180;
const qatarDateFromParts = (y: number, monthIdx: number, d: number, h: number, mm: number) =>
  new Date(Date.UTC(y, monthIdx, d, h, mm, 0, 0) - QATAR_OFFSET_MIN * 60000);

export function resolveShiftBounds(shift: any, attendanceDate: string): { start: Date; end: Date } | null {
  if (!shift || !attendanceDate) return null;
  const [y, m, d] = attendanceDate.split("-").map(Number);
  const [sh, sm] = (shift.start_time || "00:00").split(":").map(Number);
  const [eh, em] = (shift.end_time || "00:00").split(":").map(Number);
  const start = qatarDateFromParts(y, m - 1, d, sh, sm);
  let end = qatarDateFromParts(y, m - 1, d, eh, em);
  if (shift.cross_midnight) {
    end = qatarDateFromParts(y, m - 1, d + 1, eh, em);
  }
  if (!shift.cross_midnight && end <= start) {
    end = qatarDateFromParts(y, m - 1, d + 1, eh, em);
  }
  return { start, end };
}

export function hasShiftExpired(shift: any, attendanceDate: string, bufferMinutes: number = 0, now: Date = new Date()): boolean {
  const bounds = resolveShiftBounds(shift, attendanceDate);
  if (!bounds) return false;
  return now >= new Date(bounds.end.getTime() + (bufferMinutes || 0) * 60000);
}

export function isSplitEffective(shift: any, attendanceDate: string): boolean {
  if (!shift?.split_shift_enabled || !attendanceDate) return false;
  if (shift.split_effective_from && attendanceDate < shift.split_effective_from) return false;
  if (shift.split_effective_to && attendanceDate > shift.split_effective_to) return false;
  return true;
}

export function resolveShift(emp: any, assignments: any[], shifts: any[], settings: any): any {
  if (!emp) return null;
  const shiftMap = new Map(shifts.filter((s) => s.is_active !== false).map((s) => [s.id, s]));
  const tryResolve = (a: any) => {
    const shift = shiftMap.get(a.shift_id);
    if (!shift) return null;
    return { ...shift, _assignment: a };
  };
  const empAssign = assignments.find((a) => a.is_active !== false && a.assignment_type === "employee" && a.personnel_id === emp.id);
  if (empAssign) { const s = tryResolve(empAssign); if (s) return s; }
  if (emp.current_location) {
    const branchAssign = assignments.find((a) => a.is_active !== false && a.assignment_type === "branch" && a.branch_location === emp.current_location);
    if (branchAssign) { const s = tryResolve(branchAssign); if (s) return s; }
  }
  if (emp.department) {
    const deptAssign = assignments.find((a) => a.is_active !== false && a.assignment_type === "department" && a.department === emp.department);
    if (deptAssign) { const s = tryResolve(deptAssign); if (s) return s; }
  }
  if (emp.company) {
    const coAssign = assignments.find((a) => a.is_active !== false && a.assignment_type === "company" && a.company === emp.company);
    if (coAssign) { const s = tryResolve(coAssign); if (s) return s; }
  }
  if (settings) {
    return {
      id: "default", shift_name: "Default Shift",
      start_time: settings.default_shift_start || "07:00",
      end_time: settings.default_shift_end || "17:00",
      cross_midnight: false,
    };
  }
  return null;
}

// Normal-shift daily status — mirrors the fixed calculateDailyStatus in attendanceEngine.js.
// Returns "First In Completed" when clock-in exists but checkout is blank AND the
// shift is still ongoing. Only returns "Missing Check-out" after the shift + buffer
// has passed.
export function calculateDailyStatus(record: any, shift: any, settings: any, holidays: any[], now: Date = new Date()): string {
  const dateStr = record?.attendance_date;
  const holiday = isHoliday(dateStr, holidays);
  if (holiday) return "Holiday";
  if (!isWorkingDay(dateStr, settings)) return "Rest Day";

  const firstIn = record?.first_in_at || record?.check_in_at || "";
  if (!firstIn) return "Absent";

  const finalOut = record?.final_out_at || record?.check_out_at || "";
  if (!finalOut) {
    if (shift && !hasShiftExpired(shift, dateStr, settings?.auto_close_buffer_minutes ?? 120, now)) {
      return "First In Completed";
    }
    return "Missing Check-out";
  }

  // Has first in and final out — check for late
  if (shift) {
    const bounds = resolveShiftBounds(shift, dateStr);
    if (bounds) {
      const grace = (shift.grace_minutes ?? 0) * 60000;
      const checkIn = new Date(firstIn);
      const lateMs = checkIn.getTime() - (bounds.start.getTime() + grace);
      if (lateMs > 0) return "Late";
    }
  }

  // Check half-day threshold
  const duration = calculateDurationFromRecord(record);
  const halfDayThreshold = (settings?.half_day_threshold_hours ?? 4) * 60;
  if (duration > 0 && duration < halfDayThreshold) return "Half Day";

  return "Present";
}

// Centralized attendance status resolver for backend functions.
// Returns the effective status: manual override > split-shift stored status >
// normal-shift calculated status. This ensures the backend KPIs and filtering
// use the same status as the frontend display (calculateAttendanceState).
export function calculateAttendanceStatus(
  record: any, shift: any, settings: any, holidays: any[], now: Date = new Date()
): string {
  if (!record) return "Absent";
  const manualOverride = record.manual_status_override || "";
  if (manualOverride) return manualOverride;

  // For split shifts, the stored calculated_status is already correct (set by
  // the split-shift punch processor which uses the live split progression logic).
  if (shift && isSplitEffective(shift, record.attendance_date)) {
    return record.calculated_status || record.attendance_status || "Present";
  }

  // For normal shifts, recalculate using the fixed logic.
  return calculateDailyStatus(record, shift, settings, holidays, now);
}

// Apply personnel filters (search, company, department, designation, manager,
// branch, dirIndir) to an employee array. Manager filter uses assigned_manager_name
// to match the dropdown values.
export function filterEmployees(employees: any[], filters: any): any[] {
  let result = employees;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter((emp) => {
      const hay = `${emp.name || ""} ${emp.qid_no || ""} ${emp.pid || ""} ${emp.position_application || ""} ${emp.company || ""}`.toLowerCase();
      return hay.includes(q);
    });
  }
  if (filters.company) result = result.filter((e) => e.company === filters.company);
  if (filters.department) result = result.filter((e) => e.department === filters.department);
  if (filters.designation) result = result.filter((e) => e.position_application === filters.designation);
  if (filters.manager) result = result.filter((e) => e.assigned_manager_name === filters.manager);
  if (filters.branch) result = result.filter((e) => e.current_location === filters.branch);
  if (filters.dirIndir) result = result.filter((e) => e.dir_indir === filters.dirIndir);
  return result;
}