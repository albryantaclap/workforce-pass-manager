// Timesheet PDF exporter — generates one "EMPLOYEE ATTENDANCE TIMESHEET" page
// per employee, matching the attached PDF layout: header with employee details,
// a Date/Day/Punch-Status/Total-H table (month split into two side-by-side
// halves), and a Present/Absent/Late/Leave/Total Hours summary. Uses jspdf.

import { jsPDF } from 'jspdf';
import { formatHHMM } from './timesheetBuilder';

const fmtFullDate = (ds) => {
  const [y, m, d] = ds.split('-').map(Number);
  return `${String(d).padStart(2, '0')} ${['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][m - 1]}`;
};

const sanitizeName = (name) => (name || 'Employee').replace(/[^A-Za-z0-9_]+/g, '_');

const drawInfoLine = (doc, label, value, x, y) => {
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.setTextColor(110);
  doc.text(label, x, y);
  doc.setFont('helvetica', 'normal'); doc.setTextColor(40);
  doc.text(String(value || '—'), x + 32, y);
};

const drawTable = (doc, rows, x, y, colW, rowH) => {
  const headers = ['Date', 'Day', 'Punch / Status', 'Total H'];
  // header
  doc.setFillColor(31, 58, 138); doc.setTextColor(255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
  let cx = x;
  headers.forEach((h, i) => {
    doc.rect(cx, y, colW[i], rowH, 'F');
    doc.text(h, cx + 1.5, y + rowH - 2);
    cx += colW[i];
  });
  // rows
  doc.setFont('helvetica', 'normal'); doc.setTextColor(30);
  rows.forEach((r, i) => {
    const ry = y + (i + 1) * rowH;
    if (i % 2 === 1) { doc.setFillColor(243, 246, 252); doc.rect(x, ry, colW.reduce((a, b) => a + b, 0), rowH, 'F'); }
    doc.setTextColor(30);
    let cx2 = x;
    doc.text(fmtFullDate(r.date), cx2 + 1.5, ry + rowH - 2); cx2 += colW[0];
    doc.text(r.dayName, cx2 + 1.5, ry + rowH - 2); cx2 += colW[1];
    doc.text(r.punch, cx2 + 1.5, ry + rowH - 2); cx2 += colW[2];
    doc.text(r.totalH, cx2 + 1.5, ry + rowH - 2);
  });
  // border
  doc.setDrawColor(176, 183, 195);
  const totalW = colW.reduce((a, b) => a + b, 0);
  const totalH = (rows.length + 1) * rowH;
  doc.rect(x, y, totalW, totalH);
};

const drawEmployeePage = (doc, ts, periodLabel) => {
  const emp = ts.emp;
  const margin = 10;
  const pageW = doc.internal.pageSize.getWidth();

  // Title
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor(20);
  doc.text('EMPLOYEE ATTENDANCE TIMESHEET', pageW / 2, margin + 5, { align: 'center' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90);
  doc.text(`Period: ${periodLabel}`, pageW / 2, margin + 11, { align: 'center' });

  // Employee info
  let iy = margin + 18;
  const colX = [margin, pageW / 2];
  drawInfoLine(doc, 'Employee Name', emp.name, colX[0], iy);
  drawInfoLine(doc, 'EMP ID.', emp.staff_no || emp.sl_no, colX[1], iy);
  drawInfoLine(doc, 'PID No.', emp.pid, colX[0], iy + 5);
  drawInfoLine(doc, 'QID No.', emp.qid_no, colX[1], iy + 5);
  drawInfoLine(doc, 'Joining Date', emp.approval_date, colX[0], iy + 10);
  drawInfoLine(doc, 'Designation', emp.position_application || emp.designation_org_chart, colX[1], iy + 10);
  drawInfoLine(doc, 'Department', emp.department, colX[0], iy + 15);
  drawInfoLine(doc, 'Period', periodLabel, colX[1], iy + 15);

  // Attendance table — split month into two side-by-side halves
  const days = ts.days;
  const half = Math.ceil(days.length / 2);
  const left = days.slice(0, half);
  const right = days.slice(half);
  const colW = [22, 12, 38, 14];
  const rowH = 6.5;
  const ty = iy + 22;
  drawTable(doc, left, margin, ty, colW, rowH);
  drawTable(doc, right, margin + colW.reduce((a, b) => a + b, 0) + 4, ty, colW, rowH);

  // Summary
  const sy = ty + (Math.max(left.length, right.length) + 1) * rowH + 6;
  const sLabels = ['Present', 'Absent', 'Late', 'Leave', 'Total Hours'];
  const sVals = [ts.summary.present, ts.summary.absent, ts.summary.late, ts.summary.leave, formatHHMM(ts.summary.totalMinutes)];
  const sColW = (pageW - margin * 2) / 5;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(255);
  sLabels.forEach((l, i) => {
    const sx = margin + i * sColW;
    doc.setFillColor(31, 58, 138); doc.rect(sx, sy, sColW - 2, 7, 'F');
    doc.text(l, sx + sColW / 2 - 1, sy + 4.5, { align: 'center' });
  });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(30);
  sVals.forEach((v, i) => {
    const sx = margin + i * sColW;
    doc.text(String(v), sx + sColW / 2 - 1, sy + 13, { align: 'center' });
  });
};

export function exportTimesheetPdf(timesheets, periodLabel, singleEmployeeName) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  timesheets.forEach((ts, idx) => {
    if (idx > 0) doc.addPage();
    drawEmployeePage(doc, ts, periodLabel);
  });
  const fname = timesheets.length === 1
    ? `Timesheet_${sanitizeName(singleEmployeeName || timesheets[0].emp.name)}_${periodLabel.replace(/\s+/g, '_')}.pdf`
    : `Attendance_Timesheets_${periodLabel.replace(/\s+/g, '_')}.pdf`;
  doc.save(fname);
};