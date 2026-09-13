// Weekly Attendance Report PDF — landscape A4, one row per employee per date
// for the selected week. Reuses the centralized attendance data (no separate
// calculation). Pale-blue header, thin borders, zebra rows, repeating header,
// and a bottom summary (Total Employees / Present / Absent / Late /
// Missing Check-out / Total Worked Hours).

import { jsPDF } from 'jspdf';
import { formatTimeShort, formatMinutes, getFirstIn, getFinalOut } from './attendanceEngine';

const BLUE = [227, 242, 253];   // #e3f2fd — pale blue header
const ALT = [244, 249, 252];    // zebra tint
const BORDER = [74, 123, 165];  // #4a7ba5
const BLACK = [0, 0, 0];
const NAVY = [26, 54, 93];      // #1a365d
const GRAY = [90, 90, 90];
const GRAY_HDR = [238, 238, 238];

const MONTHS_UP = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];

const fmtDateUp = (ds) => {
  const [y, m, d] = ds.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS_UP[m - 1]} ${y}`;
};
const fmtDate = (ds) => {
  const [y, m, d] = ds.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]} ${y}`;
};

const setFill = (doc, rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
const setDraw = (doc, rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
const setText = (doc, rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

const cell = (doc, x, y, w, h, text, { fill, align = 'left', bold = false, size = 7.5, color = BLACK } = {}) => {
  if (fill) { setFill(doc, fill); doc.rect(x, y, w, h, 'F'); }
  setDraw(doc, BORDER); doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  setText(doc, color);
  const tx = align === 'center' ? x + w / 2 : x + 1.2;
  const txt = String(text == null || text === '' ? '—' : text);
  // crude truncate to fit
  const maxChars = Math.floor((w - 2) / (size * 0.18));
  const out = txt.length > maxChars ? txt.slice(0, maxChars - 1) + '…' : txt;
  doc.text(out, tx, y + h / 2 + size / 3, { align: align === 'center' ? 'center' : 'left' });
};

const COLS = [
  { key: 'employee', label: 'EMPLOYEE', w: 48 },
  { key: 'company', label: 'COMPANY', w: 30 },
  { key: 'dept', label: 'DEPT', w: 25 },
  { key: 'date', label: 'DATE', w: 20 },
  { key: 'firstIn', label: 'FIRST IN', w: 18 },
  { key: 'firstOut', label: 'FIRST OUT', w: 18 },
  { key: 'secondIn', label: 'SECOND IN', w: 18 },
  { key: 'finalOut', label: 'FINAL OUT', w: 18 },
  { key: 'duration', label: 'DURATION', w: 16, align: 'center' },
  { key: 'status', label: 'STATUS', w: 28 },
  { key: 'source', label: 'SOURCE', w: 22 },
];

const rowToCells = (r, emp) => ({
  employee: emp?.name || r.employee_name || '—',
  company: emp?.company || r.company || '—',
  dept: emp?.department || '—',
  date: fmtDate(r.attendance_date),
  firstIn: formatTimeShort(getFirstIn(r)),
  firstOut: formatTimeShort(r.first_out_at),
  secondIn: formatTimeShort(r.second_in_at),
  finalOut: formatTimeShort(getFinalOut(r)),
  duration: formatMinutes(r.duration_minutes),
  status: r.attendance_status || '—',
  source: r.source || '—',
});

const buildSummary = (rows) => {
  const employees = new Set();
  let present = 0, absent = 0, late = 0, missing = 0, totalMin = 0;
  for (const { record: r } of rows) {
    employees.add(r.personnel_id);
    const s = r.attendance_status || '';
    if (s === 'Absent') absent++;
    else if (s === 'Late') late++;
    else if (s === 'Missing Check-out' || s === 'Incomplete') missing++;
    else if (['Present', 'Half Day', 'First In Completed', 'First Out Completed', 'Second In Completed'].includes(s)) present++;
    totalMin += r.duration_minutes || 0;
  }
  return {
    totalEmployees: employees.size,
    present, absent, late, missing,
    totalHours: formatMinutes(totalMin),
  };
};

const sortRows = (rows) =>
  rows.slice().sort((a, b) => {
    const ea = a.emp?.company || '', eb = b.emp?.company || '';
    if (ea !== eb) return ea < eb ? -1 : 1;
    const da = a.emp?.department || '', db = b.emp?.department || '';
    if (da !== db) return da < db ? -1 : 1;
    const na = a.emp?.name || a.record.employee_name || '', nb = b.emp?.name || b.record.employee_name || '';
    if (na !== nb) return na < nb ? -1 : 1;
    return (a.record.attendance_date || '').localeCompare(b.record.attendance_date || '');
  });

const filtersLabel = (f) => {
  const parts = [];
  if (f?.company) parts.push(`Company: ${f.company}`);
  if (f?.department) parts.push(`Department: ${f.department}`);
  if (f?.branch) parts.push(`Branch: ${f.branch}`);
  if (f?.manager) parts.push(`Manager: ${f.manager}`);
  if (f?.search) parts.push(`Search: ${f.search}`);
  return parts.join('   ·   ');
};

export function exportWeeklyPdf(rows, dateFrom, dateTo, filters) {
  const sorted = sortRows(rows);
  const summary = buildSummary(sorted);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;
  const totalColW = COLS.reduce((a, c) => a + c.w, 0);

  // Header
  doc.setFont('helvetica', 'bold'); doc.setFontSize(16); setText(doc, NAVY);
  doc.text('GSO QATAR', pageW / 2, margin + 4, { align: 'center' });
  doc.setFontSize(13);
  doc.text('WEEKLY ATTENDANCE REPORT', pageW / 2, margin + 10, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setText(doc, GRAY);
  doc.text(`Period: ${fmtDateUp(dateFrom)} - ${fmtDateUp(dateTo)}`, pageW / 2, margin + 16, { align: 'center' });

  const fl = filtersLabel(filters);
  if (fl) {
    doc.setFontSize(8); setText(doc, GRAY);
    doc.text(fl, pageW / 2, margin + 21, { align: 'center' });
  }

  // Table
  const rowH = 6.5;
  const headerH = 7;
  let y = margin + 25;
  const tableTop = y;
  const drawHeader = (yy) => {
    let cx = margin;
    COLS.forEach((c) => {
      cell(doc, cx, yy, c.w, headerH, c.label, { fill: BLUE, bold: true, size: 7.5, align: 'left' });
      cx += c.w;
    });
  };
  drawHeader(y);
  y += headerH;

  sorted.forEach((row, i) => {
    if (y + rowH > pageH - 16) {
      // bottom border for current page table
      setDraw(doc, BORDER); doc.setLineWidth(0.2);
      doc.rect(margin, tableTop, totalColW, y - tableTop);
      doc.addPage();
      y = margin;
      drawHeader(y);
      y += headerH;
    }
    const zebra = i % 2 === 1 ? ALT : null;
    const vals = rowToCells(row.record, row.emp);
    let cx = margin;
    COLS.forEach((c) => {
      cell(doc, cx, y, c.w, rowH, vals[c.key], { fill: zebra, size: 7.5, align: c.align || 'left' });
      cx += c.w;
    });
    y += rowH;
  });
  // final table border
  setDraw(doc, BORDER); doc.setLineWidth(0.2);
  doc.rect(margin, tableTop, totalColW, y - tableTop);

  // Summary
  const sy = y + 6;
  if (sy + 14 > pageH) {
    doc.addPage();
    y = margin;
  }
  const sLabels = ['Total Employees', 'Present', 'Absent', 'Late', 'Missing Check-out', 'Total Worked Hours'];
  const sVals = [summary.totalEmployees, summary.present, summary.absent, summary.late, summary.missing, summary.totalHours];
  const sColW = contentW / 6;
  // SUMMARY banner
  setFill(doc, BLUE); doc.rect(margin, sy, contentW, 7, 'F');
  setDraw(doc, BORDER); doc.rect(margin, sy, contentW, 7);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setText(doc, BLACK);
  doc.text('SUMMARY', pageW / 2, sy + 5, { align: 'center' });
  sLabels.forEach((l, i) => {
    cell(doc, margin + i * sColW, sy + 7, sColW, 7, l, { fill: GRAY_HDR, bold: true, size: 8, align: 'center' });
  });
  sVals.forEach((v, i) => {
    cell(doc, margin + i * sColW, sy + 14, sColW, 7, v, { size: 9, align: 'center', bold: true });
  });

  // Footer
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); setText(doc, GRAY);
  doc.text('Note: Attendance entries and summary above are generated from the employee\'s attendance records for the selected period.', margin, pageH - 6);

  doc.save(`Weekly_Attendance_${dateFrom}_to_${dateTo}.pdf`);
}