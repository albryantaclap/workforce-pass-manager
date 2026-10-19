// Centralized Timesheet builder — produces the per-employee daily matrix and
// summary used by both the Excel (Timesheet) and PDF (by Employee) exports.
// It reuses the SAME attendance engine used by Daily Attendance, Time Entries,
// COMO Camp, and the Scanner — no separate attendance calculation.

import {
  dayKey, isWorkingDay, isHoliday, resolveShift,
  getFirstIn, getFinalOut, calculateDurationFromRecord, calculateDailyStatus,
  formatTimeShort, isSplitEffective,
} from './attendanceEngine';

// Format minutes as cumulative HH:MM (does not reset after 24h).
export const formatHHMM = (mins) => {
  if (!mins || mins <= 0) return '-';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
};

// List of YYYY-MM-DD dates between two dates (inclusive).
export const listDates = (from, to) => {
  const dates = [];
  const [y1, m1, d1] = from.split('-').map(Number);
  const [y2, m2, d2] = to.split('-').map(Number);
  const cur = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (cur <= end) {
    const ds = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
    dates.push(ds);
    cur.setDate(cur.getDate() + 1);
  }
  return dates;
};

// Build the punch/status string for a single day's record.
// Split shift: "FIRST IN-FIRST OUT / SECOND IN-FINAL OUT"
// Normal: "First In-Final Out"
// Only pairs with both endpoints are shown; missing times are never fabricated.
const buildPunchString = (rec, shift, dateStr) => {
  const fi = formatTimeShort(getFirstIn(rec));
  const fo = formatTimeShort(getFinalOut(rec));
  const split = isSplitEffective(shift, dateStr) && (rec.first_out_at || rec.second_in_at);
  if (split) {
    const parts = [];
    if (rec.first_out_at) parts.push(`${fi}-${formatTimeShort(rec.first_out_at)}`);
    if (rec.second_in_at && getFinalOut(rec)) parts.push(`${formatTimeShort(rec.second_in_at)}-${fo}`);
    return parts.join(' / ') || fi;
  }
  if (fo && fo !== '—') return `${fi}-${fo}`;
  return fi;
};

// Build a single day cell for an employee.
const buildDayCell = (emp, dateStr, rec, shift, settings, holidays) => {
  const dayName = dayKey(dateStr);
  const holiday = isHoliday(dateStr, holidays);
  const working = isWorkingDay(dateStr, settings);
  // Always recalculate live from the punches (never the stored field) so the
  // export matches Time Entries / Attendance Reports exactly.
  const status = calculateDailyStatus(rec || { attendance_date: dateStr }, shift, settings, holidays);

  if (status === 'On Leave') return { date: dateStr, dayName, punch: 'L', totalH: '-', status, durationMinutes: 0 };

  const firstIn = rec ? getFirstIn(rec) : '';
  if (firstIn) {
    const punch = buildPunchString(rec, shift, dateStr);
    const dur = calculateDurationFromRecord(rec);
    return { date: dateStr, dayName, punch, totalH: formatHHMM(dur), status, durationMinutes: dur };
  }

  if (holiday) return { date: dateStr, dayName, punch: 'H', totalH: '-', status: 'Holiday', durationMinutes: 0 };
  if (!working) return { date: dateStr, dayName, punch: 'OFF', totalH: '-', status: 'Rest Day', durationMinutes: 0 };
  return { date: dateStr, dayName, punch: 'A', totalH: '-', status: 'Absent', durationMinutes: 0 };
};

// Aggregate per-day cells into Present / Absent / Late / Leave / Total Hrs.
const summarize = (days) => {
  let present = 0, absent = 0, late = 0, leave = 0, totalMinutes = 0;
  for (const d of days) {
    switch (d.status) {
      case 'Present':
      case 'Half Day':
      case 'Missing Check-out':
      case 'Incomplete':
      case 'First In Completed':
      case 'First Out Completed':
      case 'Second In Completed':
        present++; totalMinutes += d.durationMinutes; break;
      case 'Late':
        late++; totalMinutes += d.durationMinutes; break;
      case 'On Leave':
        leave++; break;
      case 'Absent':
        absent++; break;
      default: break; // Rest Day, Holiday
    }
  }
  return { present, absent, late, leave, totalMinutes };
};

// Build the full timesheet matrix for a set of employees over a date range.
// `records` is the raw AttendanceRecord list (already fetched in bulk).
export const buildTimesheets = (employees, records, settings, shifts, assignments, holidays, dateFrom, dateTo) => {
  const dates = listDates(dateFrom, dateTo);
  const recMap = new Map();
  for (const r of records) {
    if (r.is_deleted) continue;
    recMap.set(`${r.personnel_id}|${r.attendance_date}`, r);
  }
  return employees.map((emp) => {
    const shift = resolveShift(emp, assignments, shifts, settings);
    const days = dates.map((dateStr) => buildDayCell(emp, dateStr, recMap.get(`${emp.id}|${dateStr}`), shift, settings, holidays));
    // Site Location = the branch recorded at the scanner for this employee's
    // attendance in the range (never the camp or current location). A multi-day
    // range spanning several branches lists them together.
    const siteLocations = [...new Set(
      dates.map((dateStr) => recMap.get(`${emp.id}|${dateStr}`)?.site_location).filter(Boolean)
    )];
    return { emp, shift, days, summary: summarize(days), siteLocations, siteLocation: siteLocations.join(' / ') };
  });
};

// Filter employees by the standard personnel filter set (company/department/manager/search).
// Branch / Location is applied against the attendance records, not the employee.
export const filterEmployeesForReport = (employees, f = {}) => {
  const s = (f.search || '').toLowerCase();
  return employees.filter((e) => {
    if (!e.is_active && e.is_active !== undefined) {
      // keep inactive employees too — exports may include historical personnel
    }
    if (f.company && e.company !== f.company) return false;
    if (f.department && e.department !== f.department) return false;
    // Branch / Location is matched against the branch recorded on the attendance
    // records (see personnelAtBranch / sameSiteLocation in attendanceEngine).
    if (f.manager && e.assigned_manager_name !== f.manager) return false;
    // Note: attendance-status filtering is applied per-day from records, not here.
    if (s) {
      const hay = `${e.name || ''} ${e.qid_no || ''} ${e.pid || ''} ${e.staff_no || ''} ${e.position_application || ''} ${e.company || ''}`.toLowerCase();
      if (!hay.includes(s)) return false;
    }
    return true;
  });
};