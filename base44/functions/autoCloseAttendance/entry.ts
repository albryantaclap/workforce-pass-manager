import { createClientFromRequest } from "npm:@base44/sdk@0.8.38";
import { getFinalOut } from "../../shared/attendanceCalc.ts";

// Auto-close expired open attendance sessions (Day Reset Logic).
//
// This function finds all open attendance sessions where the assigned shift
// has ended + buffer period has passed, and closes them as "Missing Check-out".
//
// Key principles:
//   - Never fabricates or modifies existing punch timestamps
//   - Preserves all recorded punches (first_in, first_out, second_in, final_out)
//   - Only changes status from "open" to "completed" and sets attendance_status
//   - Calculates duration from available punch pairs only
//   - Releases the employee for the next scheduled shift
//
// Called by a scheduled workflow (hourly) and can also be invoked manually.

function resolveShiftBounds(shift: any, attendanceDate: string) {
  if (!shift || !attendanceDate) return null;
  const [y, m, d] = attendanceDate.split("-").map(Number);
  const [sh, sm] = (shift.start_time || "00:00").split(":").map(Number);
  const [eh, em] = (shift.end_time || "00:00").split(":").map(Number);
  const start = new Date(y, m - 1, d, sh, sm, 0, 0);
  let end = new Date(y, m - 1, d, eh, em, 0, 0);
  if (shift.cross_midnight) {
    end = new Date(y, m - 1, d + 1, eh, em, 0, 0);
  }
  if (!shift.cross_midnight && end <= start) {
    end = new Date(y, m - 1, d + 1, eh, em, 0, 0);
  }
  return { start, end };
}

function hasShiftExpired(shift: any, attendanceDate: string, bufferMinutes: number) {
  const bounds = resolveShiftBounds(shift, attendanceDate);
  if (!bounds) return false;
  const now = new Date();
  return now >= new Date(bounds.end.getTime() + (bufferMinutes || 0) * 60000);
}

function calculateDuration(record: any) {
  if (!record) return 0;
  // Backward-compat fallbacks: old records have check_in_at/check_out_at but not first_in_at/final_out_at
  const firstIn = record.first_in_at || record.check_in_at || "";
  const finalOut = getFinalOut(record);
  let total = 0;
  const calc = (a: string, b: string) => {
    if (!a || !b) return 0;
    const ms = new Date(b).getTime() - new Date(a).getTime();
    return Math.max(0, Math.round(ms / 60000));
  };
  if (record.first_in_at && record.first_out_at) {
    total += calc(record.first_in_at, record.first_out_at);
  }
  if (record.second_in_at && record.final_out_at) {
    total += calc(record.second_in_at, record.final_out_at);
  }
  // Single session (no split): first_in → final_out (with fallback to check_in/check_out)
  if (!record.first_out_at && !record.second_in_at && firstIn && finalOut) {
    total = calc(firstIn, finalOut);
  }
  return total;
}

function getMissingPunchLabel(record: any) {
  if (!record) return "";
  // Backward-compat: fall back to check_in_at/check_out_at for old records
  const firstIn = record.first_in_at || record.check_in_at || "";
  const finalOut = getFinalOut(record);
  if (!firstIn) return "Missing First Punch In";
  if (record.first_out_at && !record.second_in_at && !finalOut) return "Missing Final Punch Out";
  if (record.first_out_at && record.second_in_at && !record.final_out_at) return "Missing Final Punch Out";
  if (record.first_out_at && !record.second_in_at) return ""; // single session complete
  if (!record.first_out_at) return "Missing First Punch Out";
  if (!record.second_in_at) return "Missing Second Punch In";
  if (!record.final_out_at) return "Missing Final Punch Out";
  return "";
}

function resolveShiftForRecord(record: any, assignments: any[], shifts: any[], settings: any, emp?: any) {
  const shiftMap = new Map(shifts.filter((s: any) => s.is_active !== false).map((s: any) => [s.id, s]));
  const tryResolve = (a: any) => shiftMap.get(a.shift_id);

  // Employee-specific
  const empAssign = assignments.find((a: any) =>
    a.is_active !== false && a.assignment_type === "employee" && a.personnel_id === record.personnel_id
  );
  if (empAssign) { const s = tryResolve(empAssign); if (s) return s; }

  // Branch — prefer employee's current_location, fall back to record's work_location
  const branchLocation = emp?.current_location || record.work_location;
  if (branchLocation) {
    const branchAssign = assignments.find((a: any) =>
      a.is_active !== false && a.assignment_type === "branch" && a.branch_location === branchLocation
    );
    if (branchAssign) { const s = tryResolve(branchAssign); if (s) return s; }
  }

  // Department — from the employee record (not available on the attendance record)
  if (emp?.department) {
    const deptAssign = assignments.find((a: any) =>
      a.is_active !== false && a.assignment_type === "department" && a.department === emp.department
    );
    if (deptAssign) { const s = tryResolve(deptAssign); if (s) return s; }
  }

  // Company
  if (record.company) {
    const coAssign = assignments.find((a: any) =>
      a.is_active !== false && a.assignment_type === "company" && a.company === record.company
    );
    if (coAssign) { const s = tryResolve(coAssign); if (s) return s; }
  }

  // Global default
  return {
    id: "default",
    shift_name: "Default Shift",
    start_time: settings?.default_shift_start || "07:00",
    end_time: settings?.default_shift_end || "17:00",
    cross_midnight: false,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Load settings
    const settingsRows = await base44.entities.AttendanceSetting.list(undefined, 10);
    const settings = settingsRows[0] || {
      auto_close_open_sessions: true,
      auto_close_buffer_minutes: 120,
      default_shift_start: "07:00",
      default_shift_end: "17:00",
    };

    if (!settings.auto_close_open_sessions) {
      return Response.json({ message: "Auto-close is disabled in settings.", closed: 0 });
    }

    const buffer = settings.auto_close_buffer_minutes ?? 120;

    // Load shifts and assignments
    const [shifts, assignments] = await Promise.all([
      base44.entities.AttendanceShift.list(undefined, 1000),
      base44.entities.AttendanceShiftAssignment.list(undefined, 5000),
    ]);

    // Find open, non-deleted attendance sessions (limited per run to avoid rate limits;
    // the hourly workflow will process remaining sessions in subsequent runs)
    const openRecords = await base44.entities.AttendanceRecord.filter(
      { status: "open", is_deleted: { $ne: true } },
      "-attendance_date", 100
    );

    let closedCount = 0;
    const closedDetails: any[] = [];
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const empCache = new Map<string, any>();
    const getEmp = async (id: string) => {
      if (empCache.has(id)) return empCache.get(id);
      try {
        const emp = await base44.entities.Employee.get(id);
        empCache.set(id, emp);
        return emp;
      } catch {
        empCache.set(id, null);
        return null;
      }
    };

    for (const rec of openRecords) {
      const emp = await getEmp(rec.personnel_id);
      const shift = resolveShiftForRecord(rec, assignments, shifts, settings, emp);
      if (!hasShiftExpired(shift, rec.attendance_date, buffer)) continue;

      const missingLabel = getMissingPunchLabel(rec);
      const duration = calculateDuration(rec);
      const updates: any = {
        status: "completed",
        attendance_status: "Missing Check-out",
        duration_minutes: duration,
      };
      // Backward-compat sync ONLY — no punch timestamp is ever fabricated here.
      // check_out_at mirrors a real FINAL OUT (never a first out), and an existing
      // check_out_at is never promoted into final_out_at: a missing FINAL OUT stays
      // missing, so auto-close can never invent one out of a first out.
      if (!rec.first_in_at && rec.check_in_at) updates.first_in_at = rec.check_in_at;
      if (!rec.check_out_at && rec.final_out_at) updates.check_out_at = rec.final_out_at;

      await base44.entities.AttendanceRecord.update(rec.id, updates);
      await sleep(100); // small delay to avoid rate limits

      // Log activity
      try {
        await base44.entities.ActivityLog.create({
          action: "update",
          entity_name: "AttendanceRecord",
          entity_id: rec.id,
          performed_by: "system",
          record_name: rec.employee_name || "",
          record_snapshot: {
            ...updates,
            auto_closed: true,
            missing_label: missingLabel,
            previous_status: "open",
            reason: `Auto-closed: shift expired (${missingLabel})`,
          },
          changed_fields: ["status", "attendance_status", "duration_minutes"],
        });
      } catch { /* non-fatal */ }

      closedCount++;
      closedDetails.push({
        id: rec.id,
        employee: rec.employee_name,
        date: rec.attendance_date,
        missing_label: missingLabel,
      });
    }

    return Response.json({
      message: `Auto-close complete. ${closedCount} session(s) closed.`,
      closed: closedCount,
      details: closedDetails,
    });
  } catch (error) {
    return Response.json(
      { error: error.message || "Auto-close failed", stack: error.stack },
      { status: 500 }
    );
  }
});