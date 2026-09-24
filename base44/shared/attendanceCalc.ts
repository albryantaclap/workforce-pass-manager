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