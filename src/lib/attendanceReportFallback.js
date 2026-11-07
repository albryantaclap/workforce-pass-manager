import { base44 } from '@/api/base44Client';
import {
  resolveShift, calculateDailyStatus, getFinalOut, sameSiteLocation,
} from '@/lib/attendanceEngine';
import { readAllAttendanceRecords, readWithRetry } from '@/lib/attendanceFullRead';

// (paging, retry and full-range reading now live in @/lib/attendanceFullRead —
//  the single place that retrieves a complete attendance dataset.)

/**
 * Browser-side builder for the Attendance Reports table.
 *
 * Why it exists: every backend function on this app shares one entity read
 * budget, and when that budget is exhausted the report request fails outright —
 * the table then looked empty even though the attendance was there. This builder
 * reads the same records directly (the caller's own budget), applies the exact
 * same rules as the server, and lets the table show the real data while the
 * server call is unable to answer.
 */

const CHUNK = 500;

const readRange = (dateFrom, dateTo) => readAllAttendanceRecords({ from: dateFrom, to: dateTo });

async function readEmployees(ids) {
  const map = new Map();
  const unique = [...new Set(ids.filter(Boolean))];
  for (let i = 0; i < unique.length; i += CHUNK) {
    const rows = await readWithRetry(() => base44.entities.Employee.filter(
      { id: { $in: unique.slice(i, i + CHUNK) } }, 'name', 1000
    ));
    (Array.isArray(rows) ? rows : (rows.items || [])).forEach((e) => map.set(e.id, e));
  }
  return map;
}

const matchPersonnel = (emp, filters) => {
  if (!emp) return true;
  if (filters.company && emp.company !== filters.company) return false;
  if (filters.department && emp.department !== filters.department) return false;
  if (filters.designation && emp.position_application !== filters.designation) return false;
  if (filters.manager && emp.assigned_manager_name !== filters.manager) return false;
  if (filters.dirIndir && emp.dir_indir !== filters.dirIndir) return false;
  if (filters.search) {
    const q = filters.search.toLowerCase();
    const hay = `${emp.name || ''} ${emp.qid_no || ''} ${emp.pid || ''} ${emp.position_application || ''} ${emp.company || ''}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
};

// WHO scanned: the record keeps the display names of the accounts that punched.
const scannedByFor = (record) => {
  const names = [record.checked_in_by_name, record.checked_out_by_name].filter(Boolean);
  const unique = [...new Set(names)];
  if (unique.length === 0) return { label: '—', detail: [] };
  return { label: unique.join(' / '), detail: [] };
};

export async function buildReportRowsLocally({
  dateFrom, dateTo, reportType = 'daily', status = '', filters = {},
  settings, shifts = [], assignments = [], holidays = [],
}) {
  const records = await readRange(dateFrom, dateTo);
  const empMap = await readEmployees(records.map((r) => r.personnel_id));
  const now = new Date();

  const rows = records.map((record) => {
    const resolved = empMap.get(record.personnel_id);
    const emp = resolved || { name: record.employee_name, company: record.company };
    const shift = resolveShift(emp, assignments, shifts, settings);
    const calcStatus = calculateDailyStatus(record, shift, settings, holidays, now);
    return { record, emp, calcStatus, unresolved: !resolved, scanned_by: scannedByFor(record) };
  })
    .filter(({ emp, unresolved }) => unresolved || matchPersonnel(emp, filters))
    .filter(({ record, calcStatus }) => {
      if (reportType === 'late') return calcStatus === 'Late' || record.is_late;
      if (reportType === 'absent') return calcStatus === 'Absent';
      if (reportType === 'missing') return calcStatus === 'Missing Check-out' || calcStatus === 'Incomplete';
      if (reportType === 'overtime') return (record.overtime_minutes || 0) > 0;
      return true;
    })
    .filter(({ calcStatus }) => (status ? calcStatus === status : true))
    .filter(({ record }) => (filters.branch ? sameSiteLocation(record.site_location, filters.branch) : true));

  rows.sort((a, b) => {
    const dateCmp = (b.record.attendance_date || '').localeCompare(a.record.attendance_date || '');
    if (dateCmp !== 0) return dateCmp;
    return (a.emp?.name || '').localeCompare(b.emp?.name || '');
  });

  return rows;
}