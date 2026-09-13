// Timesheet PDF exporter — generates one "EMPLOYEE ATTENDANCE TIMESHEET" page
// per employee in LANDSCAPE A4, matching the reference layout:
//   - Light blue (#F0F8FF) header/summary cells, black text, dark gray borders
//   - 2×4 employee details grid
//   - Two side-by-side Date/Day/Punch-Status/Total-H tables (01-15 / 16-end)
//   - Centered Present/Absent/Late/Leave/Total Hours summary
//   - Italic footer note (bottom-left)

import { jsPDF } from 'jspdf';
import { formatHHMM } from './timesheetBuilder';

// Palette
const BLUE = [240, 248, 255];   // #F0F8FF — header/summary fill
const ALT  = [240, 248, 255];   // zebra row tint (very light blue)
const BORDER = [102, 102, 102]; // #666666
const BLACK = [0, 0, 0];
const GRAY = [90, 90, 90];

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const fmtDay = (ds) => {
  const [y, m, d] = ds.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${MONTHS[m - 1]}`;
};
const dayName = (ds) => {
  const [y, m, d] = ds.split('-').map(Number);
  return DAYS[new Date(y, m - 1, d).getDay()];
};

const sanitizeName = (name) => (name || 'Employee').replace(/[^A-Za-z0-9_]+/g, '_');

const setFill = (doc, rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
const setDraw = (doc, rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
const setText = (doc, rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

// Draw a single cell: filled rect + border + text (left or center aligned).
const cell = (doc, x, y, w, h, text, { fill, align = 'left', bold = false, size = 8, color = BLACK } = {}) => {
  if (fill) { setFill(doc, fill); doc.rect(x, y, w, h, 'F'); }
  setDraw(doc, BORDER);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  setText(doc, color);
  const tx = align === 'center' ? x + w / 2 : x + 1.5;
  doc.text(String(text == null || text === '' ? '' : text), tx, y + h / 2 + size / 3, { align: align === 'center' ? 'center' : 'left' });
};

// Employee details — 2 rows × 4 label/value pairs.
const drawDetails = (doc, emp, periodLabel, x, y, totalW) => {
  const labelW = 30;
  const pairW = (totalW - labelW * 4) / 4; // value width
  const cols = [
    labelW, pairW, labelW, pairW, labelW, pairW, labelW, pairW,
  ];
  const rows = [
    ['Employee Name', emp.name, 'EMP ID.', emp.staff_no || emp.sl_no || '—', 'PID No.', emp.pid || '—', 'QID No.', emp.qid_no || '—'],
    ['Joining Date', emp.approval_date || '—', 'Designation', emp.position_application || emp.designation_org_chart || '—', 'Department', emp.department || '—', 'Period', periodLabel],
  ];
  const rowH = 7;
  rows.forEach((row, ri) => {
    const ry = y + ri * rowH;
    let cx = x;
    row.forEach((val, ci) => {
      const isLabel = ci % 2 === 0;
      cell(doc, cx, ry, cols[ci], rowH, val, {
        fill: BLUE, bold: isLabel, size: 8, color: isLabel ? GRAY : BLACK, align: 'left',
      });
      cx += cols[ci];
    });
  });
  return y + rows.length * rowH;
};

// Attendance table — Date / Day / Punch-Status / Total H.
const drawTable = (doc, rows, x, y, colW, rowH) => {
  const headers = ['Date', 'Day', 'Punch / Status', 'Total H'];
  // header row
  let cx = x;
  headers.forEach((h, i) => {
    cell(doc, cx, y, colW[i], rowH, h, { fill: BLUE, bold: true, size: 8, align: 'left' });
    cx += colW[i];
  });
  // data rows
  rows.forEach((r, i) => {
    const ry = y + (i + 1) * rowH;
    const zebra = i % 2 === 1 ? ALT : null;
    cx = x;
    cell(doc, cx, ry, colW[0], rowH, fmtDay(r.date), { fill: zebra, size: 8 }); cx += colW[0];
    cell(doc, cx, ry, colW[1], rowH, r.dayName, { fill: zebra, size: 8 }); cx += colW[1];
    cell(doc, cx, ry, colW[2], rowH, r.punch, { fill: zebra, size: 8 }); cx += colW[2];
    cell(doc, cx, ry, colW[3], rowH, r.totalH, { fill: zebra, size: 8, align: 'center' });
  });
  return y + (rows.length + 1) * rowH;
};

// Centered summary table — Present / Absent / Late / Leave / Total Hours.
const drawSummary = (doc, summary, pageW, y) => {
  const labels = ['Present', 'Absent', 'Late', 'Leave', 'Total Hours'];
  const vals = [summary.present, summary.absent, summary.late, summary.leave, formatHHMM(summary.totalMinutes)];
  const colW = 48;
  const totalW = colW * 5;
  const x = (pageW - totalW) / 2;
  const rowH = 7;
  // header
  labels.forEach((l, i) => {
    cell(doc, x + i * colW, y, colW, rowH, l, { fill: BLUE, bold: true, size: 9, align: 'center' });
  });
  // values
  vals.forEach((v, i) => {
    cell(doc, x + i * colW, y + rowH, colW, rowH, v, { size: 10, align: 'center', bold: true });
  });
  return y + rowH * 2;
};

const drawEmployeePage = (doc, ts, periodLabel) => {
  const emp = ts.emp;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;
  const contentW = pageW - margin * 2;

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15); setText(doc, BLACK);
  doc.text('EMPLOYEE ATTENDANCE TIMESHEET', pageW / 2, margin + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); setText(doc, GRAY);
  doc.text(`Period: ${periodLabel}`, pageW / 2, margin + 11, { align: 'center' });

  // Employee details grid
  const dy = margin + 16;
  const afterDetails = drawDetails(doc, emp, periodLabel, margin, dy, contentW);

  // Attendance tables — two side-by-side halves
  const days = ts.days;
  const half = Math.ceil(days.length / 2);
  const left = days.slice(0, half);
  const right = days.slice(half);
  const colW = [22, 14, 78, 23]; // Date, Day, Punch/Status, Total H = 137
  const rowH = 6;
  const gap = 3;
  const tableW = colW.reduce((a, b) => a + b, 0);
  const ty = afterDetails + 4;
  drawTable(doc, left, margin, ty, colW, rowH);
  drawTable(doc, right, margin + tableW + gap, ty, colW, rowH);

  // Summary
  const sy = ty + (Math.max(left.length, right.length) + 1) * rowH + 6;
  drawSummary(doc, ts.summary, pageW, sy);

  // Footer note
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); setText(doc, GRAY);
  doc.text('Note: Attendance entries and summary above are reproduced from the data provided.', margin, pageH - 6);
};

export function exportTimesheetPdf(timesheets, periodLabel, singleEmployeeName) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  timesheets.forEach((ts, idx) => {
    if (idx > 0) doc.addPage();
    drawEmployeePage(doc, ts, periodLabel);
  });
  const fname = timesheets.length === 1
    ? `Timesheet_${sanitizeName(singleEmployeeName || timesheets[0].emp.name)}_${periodLabel.replace(/\s+/g, '_')}.pdf`
    : `Attendance_Timesheets_${periodLabel.replace(/\s+/g, '_')}.pdf`;
  doc.save(fname);
}