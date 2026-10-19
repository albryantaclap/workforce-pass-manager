// Shared attendance calculation and filtering functions used by backend functions.
// Extracted to avoid duplication between getEmployeeSummary and getAttendanceReport.

export function calcDuration(a: string, b: string): number {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.max(0, Math.round(ms / 60000));
}

// FINAL OUT is read from its OWN field. check_out_at is a backward-compat mirror:
// it is the day's OUT only for a genuine single-session record — one with no first
// out and no second in. As soon as a break punch exists, a check_out_at that merely
// mirrors another punch is never treated as a FINAL OUT, so one punch timestamp is
// never inferred from a different punch.
export function getFinalOut(record: any): string {
  if (!record) return "";
  if (record.final_out_at) return record.final_out_at;
  if (record.first_out_at || record.second_in_at) return "";
  return record.check_out_at || "";
}

export function calculateDurationFromRecord(record: any): number {
  if (!record) return 0;
  const firstIn = record.first_in_at || record.check_in_at || "";
  const finalOut = getFinalOut(record);
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

// Centralized daily status — mirrors calculateDailyStatus in attendanceEngine.js.
//
// Punches always take precedence over the schedule: Holiday / Rest Day are only
// reported when there is NO punch for the attendance date. While the shift is
// still running the status follows the punch progression (First In → First Out
// → Second In); once the whole shift/punch window has finished it is finalized
// from the completed IN/OUT pairs and the actual worked duration.
export function calculateDailyStatus(record: any, shift: any, settings: any, holidays: any[], now: Date = new Date()): string {
  const dateStr = record?.attendance_date;
  const firstIn = record?.first_in_at || record?.check_in_at || "";
  const firstOut = record?.first_out_at || "";
  const secondIn = record?.second_in_at || "";
  const finalOut = getFinalOut(record);
  const isSplit = !!(shift && isSplitEffective(shift, dateStr));
  // The strict sequence applies to punch-sequence records only; COMO Camp and
  // Personnel Form sessions keep exactly their previous behaviour.
  const splitSequence = isSplit && !isSingleSessionSource(record);
  const finished = shift ? hasShiftExpired(shift, dateStr, settings?.auto_close_buffer_minutes ?? 120, now) : true;
  const halfDayMin = (settings?.half_day_threshold_hours ?? 4) * 60;
  const duration = calculateDurationFromRecord(record);

  // 1. No punch at all → the schedule decides.
  if (!firstIn) {
    if (isHoliday(dateStr, holidays)) return "Holiday";
    if (!isWorkingDay(dateStr, settings)) return "Rest Day";
    if (isSplit && !finished) return "Not Checked In";
    return "Absent";
  }

  // 2. Shift still running → report the latest punch reached.
  if (!finished && !finalOut) {
    if (secondIn) return "Second In Completed";
    if (firstOut) return "First Out Completed";
    return "First In Completed";
  }

  // 3. Shift finished → finalize from the completed punches and worked duration.
  //    For a split shift the day is only complete when every REQUIRED stage exists,
  //    so a FINAL OUT that jumped a missing FIRST OUT / SECOND IN is never Present
  //    or Half Day — it stays Incomplete.
  const sequenceComplete = splitSequence
    ? !!finalOut
      && (!isPunchRequired("FIRST_OUT", shift) || !!firstOut)
      && (!isPunchRequired("SECOND_IN", shift) || !!secondIn)
    : (!!finalOut && (!firstOut || !!secondIn));
  if (sequenceComplete) {
    if (isSplit) return "Present";
    if (shift) {
      const bounds = resolveShiftBounds(shift, dateStr);
      if (bounds) {
        const grace = (shift.grace_minutes ?? 0) * 60000;
        if (new Date(firstIn).getTime() - (bounds.start.getTime() + grace) > 0) return "Late";
      }
    }
    return duration > 0 && duration < halfDayMin ? "Half Day" : "Present";
  }
  if (!splitSequence && duration >= halfDayMin) return "Half Day";
  return isSplit ? "Incomplete" : "Missing Check-out";
}

// Centralized attendance status resolver for backend functions — the status is
// always recalculated live so every page, filter, KPI and export shows exactly
// the same value as the frontend display (calculateAttendanceState).
export function calculateAttendanceStatus(
  record: any, shift: any, settings: any, holidays: any[], now: Date = new Date()
): string {
  if (!record) return "Absent";
  const manualOverride = record.manual_status_override || "";
  if (manualOverride) return manualOverride;
  return calculateDailyStatus(record, shift, settings, holidays, now);
}

// ── Punch-sequence validation (mirrors attendanceEngine.js) ───────────────
// The punch sequence is authoritative on the server too: FIRST IN → FIRST OUT →
// SECOND IN → FINAL OUT. A punch may never jump over an earlier required punch,
// and the punches must be chronologically ordered as FULL datetimes (clock time
// alone is never compared, so cross-midnight sequences stay valid).
export const PUNCH_KEYS = ["FIRST_IN", "FIRST_OUT", "SECOND_IN", "FINAL_OUT"];
const PUNCH_LABELS: Record<string, string> = {
  FIRST_IN: "FIRST IN", FIRST_OUT: "FIRST OUT", SECOND_IN: "SECOND IN", FINAL_OUT: "FINAL OUT",
};

// COMO Camp / Personnel Form sessions are single IN→OUT sessions by design and
// stay independent of the split-shift sequence (mirrors attendanceEngine.js).
export const SINGLE_SESSION_SOURCES = ["COMO Camp", "Personnel Form"];

export function isSingleSessionSource(record: any): boolean {
  return SINGLE_SESSION_SOURCES.includes(record?.source_page || "") || record?.source === "COMO Camp";
}

export function isPunchRequired(punchKey: string, shift: any): boolean {
  if (punchKey === "FIRST_IN" || punchKey === "FINAL_OUT") return true;
  if (punchKey === "FIRST_OUT") return shift?.split_first_out_required !== false;
  if (punchKey === "SECOND_IN") return shift?.split_second_in_required !== false;
  return false;
}

// Resolve a "HH:mm" time onto the shift's attendance date, advancing to the next
// calendar day when the wall-clock time is earlier than the shift start.
function resolvePunchDateTime(timeStr: string, shift: any, attendanceDate: string, forceSameDay = false): Date | null {
  if (!timeStr || !attendanceDate) return null;
  const [y, m, d] = attendanceDate.split("-").map(Number);
  const [ph, pm] = timeStr.split(":").map(Number);
  let dayOffset = 0;
  if (!forceSameDay) {
    const ref = shift?.split_first_in_start || shift?.start_time || "00:00";
    const [sh, sm] = ref.split(":").map(Number);
    if (ph < sh || (ph === sh && pm < sm)) dayOffset = 1;
  }
  return qatarDateFromParts(y, m - 1, d + dayOffset, ph, pm);
}

export function resolvePunchWindow(punchKey: string, shift: any, attendanceDate: string): { earliest: Date | null; latest: Date | null } {
  if (!isSplitEffective(shift, attendanceDate)) return { earliest: null, latest: null };
  const eb = (min: number) => (min || 0) * 60000;
  if (punchKey === "FIRST_IN") {
    const start = resolvePunchDateTime(shift.split_first_in_start, shift, attendanceDate, true);
    const cutoff = resolvePunchDateTime(shift.split_first_in_cutoff, shift, attendanceDate, true);
    if (!start || !cutoff) return { earliest: null, latest: null };
    return { earliest: new Date(start.getTime() - eb(shift.split_first_in_enable_before_min)), latest: cutoff };
  }
  if (punchKey === "FIRST_OUT") {
    const target = resolvePunchDateTime(shift.split_first_out_target, shift, attendanceDate);
    if (!target) return { earliest: null, latest: null };
    return {
      earliest: new Date(target.getTime() - eb(shift.split_first_out_enable_before_min)),
      latest: new Date(target.getTime() + (shift.split_first_out_window_min || 0) * 60000),
    };
  }
  if (punchKey === "SECOND_IN") {
    const target = resolvePunchDateTime(shift.split_second_in_target, shift, attendanceDate);
    if (!target) return { earliest: null, latest: null };
    return {
      earliest: new Date(target.getTime() - eb(shift.split_second_in_enable_before_min)),
      latest: new Date(target.getTime() + (shift.split_second_in_window_min || 0) * 60000),
    };
  }
  if (punchKey === "FINAL_OUT") {
    const earliestT = resolvePunchDateTime(shift.split_final_out_earliest, shift, attendanceDate);
    const latestT = resolvePunchDateTime(shift.split_final_out_latest, shift, attendanceDate);
    if (!earliestT || !latestT) return { earliest: null, latest: null };
    return { earliest: new Date(earliestT.getTime() - eb(shift.split_final_out_enable_before_min)), latest: latestT };
  }
  return { earliest: null, latest: null };
}

export function validatePunchSequence(
  record: any, shift: any, _settings: any, opts: { enforceWindows?: boolean } = {}
): { blocked: string[]; warnings: string[] } {
  const blocked: string[] = [];
  const warnings: string[] = [];
  const dateStr = record?.attendance_date || "";
  // "strictSplit" = the split-shift sequence applies. Single-session sources
  // (COMO Camp / Personnel Form) keep their own 2-punch semantics.
  const strictSplit = !!(shift && isSplitEffective(shift, dateStr)) && !isSingleSessionSource(record);
  const values: Record<string, string> = {
    FIRST_IN: record?.first_in_at || record?.check_in_at || "",
    FIRST_OUT: record?.first_out_at || "",
    SECOND_IN: record?.second_in_at || "",
    // Read through getFinalOut: a FINAL OUT that exists only as a mirror of another
    // punch is not a punch, so it can never raise a sequence error.
    FINAL_OUT: getFinalOut(record),
  };
  const stamp = (iso: string) => {
    if (!iso) return "—";
    try {
      return `${new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Qatar" })} ${new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Qatar" })}`;
    } catch { return iso; }
  };
  const provided = PUNCH_KEYS.filter((k) => values[k]);

  if (!values.FIRST_IN && provided.length) {
    blocked.push("FIRST IN is required when any other punch is provided.");
  }

  for (let i = 1; i < provided.length; i++) {
    const prev = provided[i - 1];
    const cur = provided[i];
    if (new Date(values[cur]).getTime() < new Date(values[prev]).getTime()) {
      blocked.push(
        `${PUNCH_LABELS[cur]} (${stamp(values[cur])}) cannot be earlier than ${PUNCH_LABELS[prev]} (${stamp(values[prev])}). Compare the full date and time — a cross-midnight punch only moves the calendar date forward.`
      );
    }
  }

  PUNCH_KEYS.forEach((key, idx) => {
    if (!values[key]) return;
    const missing = PUNCH_KEYS.slice(0, idx).find((earlier: string) => {
      if (values[earlier]) return false;
      return strictSplit ? isPunchRequired(earlier, shift) : earlier === "FIRST_IN";
    });
    if (missing) {
      blocked.push(
        `Expected punch: ${PUNCH_LABELS[missing]} has not been completed for this attendance record. Do not record ${PUNCH_LABELS[key]} before it.`
      );
    }
  });

  if (opts.enforceWindows && strictSplit) {
    for (const key of PUNCH_KEYS) {
      if (!values[key]) continue;
      const { earliest, latest } = resolvePunchWindow(key, shift, dateStr);
      if (!earliest || !latest) continue;
      const t = new Date(values[key]).getTime();
      if (t < earliest.getTime() || t > latest.getTime()) {
        warnings.push(
          `${PUNCH_LABELS[key]} at ${stamp(values[key])} is outside its configured shift window (${stamp(earliest.toISOString())} – ${stamp(latest.toISOString())}).`
        );
      }
    }
  }

  return { blocked, warnings };
}

// Branch / Location filter. The branch list comes from Attendance Settings →
// Branch / Work Locations and is matched against the site location recorded on the
// attendance record itself (the branch the supervisor selected at the scanner).
// The legacy employee current_location (COMO CAMP / OUTSIDE / QATAR) never drives
// this filter.
const normalizeBranch = (v: any) => String(v || "").trim().toLowerCase();

export function matchesBranch(record: any, branch?: string): boolean {
  if (!branch) return true;
  return normalizeBranch(record?.site_location) === normalizeBranch(branch);
}

// Apply personnel filters (search, company, department, designation, manager)
// to an employee array. Manager filter uses assigned_manager_name to match the
// dropdown values. Branch / Location is NOT applied here — an employee's branch is
// the site they actually attended, so it is applied per record via matchesBranch().
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
  // (Branch / Location is applied per attendance record — see matchesBranch above.)
  if (filters.dirIndir) result = result.filter((e) => e.dir_indir === filters.dirIndir);
  return result;
}