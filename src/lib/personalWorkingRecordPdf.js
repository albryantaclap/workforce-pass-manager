// Personal Working Record — A4 Portrait PDF exporter.
// Reproduces the "PERSONAL WORKING RECORD" form: project-title header (light
// green), Personal Working Record + Supplier's box, employee info grid, and a
// 28–31 day attendance table (DATE / Time In / Time Out / Time In / Time Out /
// Employee Signature), followed by signature lines and the HR submission note.
//
// Data is read-only: employee fields come from the Master List (Employee) and
// the four daily punches come from existing AttendanceRecord entries. No
// attendance records are created or modified by this report.

import { jsPDF } from 'jspdf';
import { listDates } from './timesheetBuilder';
import { getFirstIn, getFinalOut, formatTimeShort } from './attendanceEngine';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Template palette (matches the reference document)
const GREEN = [217, 234, 211];   // #d9ead3 — project title row
const BLUE = [207, 226, 243];    // #cfe2f3 — Personal Working Record / labels / table header
const PEACH = [244, 204, 204];   // #f4cccc — Supplier's box
const BLACK = [0, 0, 0];
const BORDER = [0, 0, 0];

const setFill = (doc, rgb) => doc.setFillColor(rgb[0], rgb[1], rgb[2]);
const setDraw = (doc, rgb) => doc.setDrawColor(rgb[0], rgb[1], rgb[2]);
const setText = (doc, rgb) => doc.setTextColor(rgb[0], rgb[1], rgb[2]);

const sanitizeName = (name) => (name || 'Employee').replace(/[^A-Za-z0-9_]+/g, '_');

// Build the per-day rows for one employee over a month.
// Each row: { date, dayNum, firstIn, firstOut, secondIn, finalOut }
// Days without punches leave the time cells empty — no records are fabricated.
export const buildPersonalWorkingRecord = (emp, records, year, month) => {
  const from = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const to = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const dates = listDates(from, to);

  const recMap = new Map();
  for (const r of records) {
    if (r.is_deleted) continue;
    if (r.personnel_id === emp.id) recMap.set(r.attendance_date, r);
  }

  return dates.map((dateStr) => {
    const rec = recMap.get(dateStr);
    const [, , d] = dateStr.split('-').map(Number);
    return {
      date: dateStr,
      dayNum: d,
      firstIn: rec ? formatTimeShort(getFirstIn(rec)) : '',
      firstOut: rec ? formatTimeShort(rec.first_out_at) : '',
      secondIn: rec ? formatTimeShort(rec.second_in_at) : '',
      finalOut: rec ? formatTimeShort(getFinalOut(rec)) : '',
    };
  });
};

// Draw a single bordered cell with optional fill and alignment.
const cell = (doc, x, y, w, h, text, { fill, align = 'left', bold = false, size = 8, color = BLACK } = {}) => {
  if (fill) { setFill(doc, fill); doc.rect(x, y, w, h, 'F'); }
  setDraw(doc, BORDER);
  doc.setLineWidth(0.2);
  doc.rect(x, y, w, h);
  if (text !== '' && text != null) {
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    setText(doc, color);
    const tx = align === 'center' ? x + w / 2 : align === 'right' ? x + w - 1.5 : x + 1.5;
    doc.text(String(text), tx, y + h / 2 + size / 3, { align: align === 'center' ? 'center' : align === 'right' ? 'right' : 'left' });
  }
};

// Draw one employee's full A4 portrait page.
const drawEmployeePage = (doc, emp, rows, year, month) => {
  const pageW = doc.internal.pageSize.getWidth();   // 210
  const pageH = doc.internal.pageSize.getHeight();  // 297
  const margin = 10;
  const contentW = pageW - margin * 2;               // 190
  let y = margin;

  // ── Row 1: Project title (light green, full width) ──
  const titleH = 9;
  setFill(doc, GREEN);
  doc.rect(margin, y, contentW, titleH, 'F');
  setDraw(doc, BORDER); doc.setLineWidth(0.2);
  doc.rect(margin, y, contentW, titleH);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setText(doc, BLACK);
  doc.text('RLTO EXPANSION AND OFFPLOT FACILITIES OF THE NORTH FIELD EXPANSION PROJECT (PEC-3)', margin + contentW / 2, y + titleH / 2 + 3, { align: 'center' });
  y += titleH;

  // ── Row 2: "PERSONAL WORKING RECORD" (blue) + Supplier's box (peach) on right ──
  const row2H = 9;
  const supplierW = 34;
  const pwrW = contentW - supplierW;
  // Personal Working Record (left, blue)
  setFill(doc, BLUE);
  doc.rect(margin, y, pwrW, row2H, 'F');
  setDraw(doc, BORDER); doc.setLineWidth(0.2);
  doc.rect(margin, y, pwrW, row2H);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); setText(doc, BLACK);
  doc.text('PERSONAL WORKING RECORD', margin + pwrW / 2, y + row2H / 2 + 3.5, { align: 'center' });
  // Supplier's box (right, peach) — spans row1 + row2 height
  const supplierH = titleH + row2H;
  setFill(doc, PEACH);
  doc.rect(margin + pwrW, margin, supplierW, supplierH, 'F');
  setDraw(doc, BORDER); doc.setLineWidth(0.2);
  doc.rect(margin + pwrW, margin, supplierW, supplierH);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setText(doc, BLACK);
  doc.text("SUPPLIER'S", margin + pwrW + supplierW / 2, margin + 5, { align: 'center' });
  y += row2H;

  // ── Employee info rows ──
  const labelW = 34;
  const qidLabelW = 24;
  const infoH = 8;

  // Row 3: NAME (label + value) | PID NO. (label + value)
  const nameValW = contentW - (labelW * 2) - qidLabelW * 2;
  // left block: NAME label + value
  cell(doc, margin, y, labelW, infoH, 'NAME', { fill: BLUE, bold: true, size: 8 });
  cell(doc, margin + labelW, y, nameValW, infoH, emp.name || '', { size: 9 });
  // right block: PID NO. label + value
  cell(doc, margin + labelW + nameValW, y, qidLabelW, infoH, 'PID NO.', { fill: BLUE, bold: true, size: 8 });
  cell(doc, margin + labelW + nameValW + qidLabelW, y, qidLabelW, infoH, emp.pid || '', { size: 8 });
  y += infoH;

  // Row 4: COMPANY/DESIGNATION (stacked) | QID NO.
  const leftBlockW = labelW + nameValW;
  cell(doc, margin, y, labelW, infoH, 'COMPANY:', { fill: BLUE, bold: true, size: 8 });
  cell(doc, margin + labelW, y, nameValW, infoH, emp.company || '', { size: 8 });
  cell(doc, margin + leftBlockW, y, qidLabelW, infoH, 'QID NO.', { fill: BLUE, bold: true, size: 8 });
  cell(doc, margin + leftBlockW + qidLabelW, y, qidLabelW, infoH, emp.qid_no || '', { size: 8 });
  y += infoH;

  cell(doc, margin, y, labelW, infoH, 'DESIGNATION:', { fill: BLUE, bold: true, size: 8 });
  cell(doc, margin + labelW, y, nameValW, infoH, emp.position_application || emp.designation_org_chart || '', { size: 8 });
  // empty cell under QID NO. to keep grid aligned
  cell(doc, margin + leftBlockW, y, qidLabelW * 2, infoH, '', { size: 8 });
  y += infoH;

  // Row 5: YEAR | MONTH
  const yearLabelW = 20;
  const yearValW = 24;
  const monthLabelW = 24;
  const monthValW = contentW - yearLabelW - yearValW - monthLabelW;
  cell(doc, margin, y, yearLabelW, infoH, 'YEAR', { fill: BLUE, bold: true, size: 8 });
  cell(doc, margin + yearLabelW, y, yearValW, infoH, String(year), { size: 9, align: 'center', bold: true });
  cell(doc, margin + yearLabelW + yearValW, y, monthLabelW, infoH, 'MONTH', { fill: BLUE, bold: true, size: 8 });
  cell(doc, margin + yearLabelW + yearValW + monthLabelW, y, monthValW, infoH, `MONTH OF (${MONTHS[month].toUpperCase()}) ${year}`, { size: 8 });
  y += infoH;

  // ── Attendance table ──
  y += 2;
  // Column widths (mm) — sum = 190
  const colW = [20, 24, 24, 24, 24, 74]; // DATE, Time In, Time Out, Time In, Time Out, Employee Signature
  const headers = ['DATE', 'Time In', 'Time Out', 'Time In', 'Time Out', 'Employee Signature'];
  const rowH = 7;

  // Header row (blue)
  let cx = margin;
  headers.forEach((h, i) => {
    cell(doc, cx, y, colW[i], rowH, h, { fill: BLUE, bold: true, size: 8, align: 'center' });
    cx += colW[i];
  });
  y += rowH;

  // Data rows
  rows.forEach((r) => {
    cx = margin;
    cell(doc, cx, y, colW[0], rowH, String(r.dayNum), { size: 8, align: 'center' }); cx += colW[0];
    cell(doc, cx, y, colW[1], rowH, r.firstIn === '—' ? '' : r.firstIn, { size: 8, align: 'center' }); cx += colW[1];
    cell(doc, cx, y, colW[2], rowH, r.firstOut === '—' ? '' : r.firstOut, { size: 8, align: 'center' }); cx += colW[2];
    cell(doc, cx, y, colW[3], rowH, r.secondIn === '—' ? '' : r.secondIn, { size: 8, align: 'center' }); cx += colW[3];
    cell(doc, cx, y, colW[4], rowH, r.finalOut === '—' ? '' : r.finalOut, { size: 8, align: 'center' }); cx += colW[4];
    cell(doc, cx, y, colW[5], rowH, '', { size: 8 }); cx += colW[5];
    y += rowH;
  });

  // ── Footer: signatures + note ──
  y += 10;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setText(doc, BLACK);
  doc.text('SUPERVISOR NAME & SIGNATURE', margin, y);
  doc.text('MANAGER NAME & SIGNATURE', margin + contentW, y, { align: 'right' });
  // Signature lines below the supervisor / manager labels
  setDraw(doc, BLACK); doc.setLineWidth(0.3);
  doc.line(margin, y + 14, margin + contentW * 0.42, y + 14);
  doc.line(margin + contentW * 0.58, y + 14, margin + contentW, y + 14);
  y += 22;
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9); setText(doc, BLACK);
  doc.text('HR DEPARTMENT SIGNATURE', margin, y);
  doc.line(margin, y + 14, margin + contentW * 0.5, y + 14);
  y += 22;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); setText(doc, BLACK);
  doc.text('The completed timesheets must be submitted to Site HR no later than the 23rd of each month.', margin, y);
};

// Generate the PDF — one A4 portrait page per employee.
export function exportPersonalWorkingRecordPdf(employees, records, year, month) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  employees.forEach((emp, idx) => {
    const rows = buildPersonalWorkingRecord(emp, records, year, month);
    if (idx > 0) doc.addPage();
    drawEmployeePage(doc, emp, rows, year, month);
  });
  const periodLabel = `${MONTHS[month]}_${year}`;
  const fname = employees.length === 1
    ? `Personal_Working_Record_${sanitizeName(employees[0].name)}_${periodLabel}.pdf`
    : `Personal_Working_Records_${periodLabel}.pdf`;
  doc.save(fname);
}