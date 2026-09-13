// Timesheet Excel exporter — builds the monthly matrix layout described in the
// spec: employee info columns, two columns per calendar day (punch/status +
// Total H), and a summary section at the far right. Uses exceljs.

import ExcelJS from 'exceljs';
import { formatHHMM } from './timesheetBuilder';

const BORDER = {
  top: { style: 'thin', color: { argb: 'FFB0B7C3' } },
  left: { style: 'thin', color: { argb: 'FFB0B7C3' } },
  bottom: { style: 'thin', color: { argb: 'FFB0B7C3' } },
  right: { style: 'thin', color: { argb: 'FFB0B7C3' } },
};

const HEADER_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A8A' } };
const ALT_FILL = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F6FC' } };

const empRow = (emp) => [
  emp.name || '',
  emp.company || '',
  emp.pid || '',
  emp.qid_no || '',
  emp.approval_date || '',
  emp.position_application || emp.designation_org_chart || '',
  emp.department || '',
];

export async function exportTimesheetExcel(timesheets, periodLabel) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Workforce Pass Manager';
  const ws = wb.addWorksheet('Timesheet', {
    views: [{ state: 'frozen', xSplit: 7, ySplit: 2 }],
    pageSetup: { orientation: 'landscape', fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
  });

  const infoHeaders = ['Employee Name', 'Company Name', 'PID No.', 'QID No.', 'Joining Date', 'Designation', 'Department'];
  const summaryHeaders = ['Present', 'Absent', 'Late', 'Leave', 'Total Hrs'];
  const days = timesheets[0]?.days || [];

  // Title row
  const titleRow = ws.addRow([`Timesheet — ${periodLabel}`]);
  titleRow.height = 22;
  titleRow.eachCell((cell, i) => {
    cell.font = { bold: true, size: 13, color: { argb: 'FF1F3A8A' } };
    cell.alignment = { vertical: 'middle' };
  });

  // Header row: info | (dayNum, Total H) per day | summary
  const header = [...infoHeaders];
  for (const d of days) {
    header.push(String(parseInt(d.date.split('-')[2], 10)));
    header.push('Total H');
  }
  header.push(...summaryHeaders);
  const hRow = ws.addRow(header);
  hRow.height = 18;
  hRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 9 };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = BORDER;
  });

  // Data rows
  timesheets.forEach((ts, idx) => {
    const row = empRow(ts.emp);
    for (const d of ts.days) {
      row.push(d.punch);
      row.push(d.totalH);
    }
    row.push(ts.summary.present, ts.summary.absent, ts.summary.late, ts.summary.leave, formatHHMM(ts.summary.totalMinutes));
    const r = ws.addRow(row);
    r.height = 16;
    const fill = idx % 2 === 1 ? ALT_FILL : undefined;
    r.eachCell((cell, ci) => {
      cell.border = BORDER;
      cell.alignment = { vertical: 'middle', horizontal: ci < 7 ? 'left' : 'center' };
      cell.font = { size: 9 };
      if (fill) cell.fill = fill;
    });
  });

  // Column widths
  ws.columns.forEach((col, i) => {
    if (i < 7) col.width = 18;
    else if (i < 7 + days.length * 2) col.width = 13;
    else col.width = 9;
  });

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Timesheet_${periodLabel.replace(/\s+/g, '_')}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};