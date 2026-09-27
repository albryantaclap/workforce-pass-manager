/**
 * Inventory Excel Export — generates .xlsx files for items, stock in, stock out,
 * available stock, and transaction history using the same ExcelJS styling
 * pattern as the rest of the GSO Qatar system.
 */
import ExcelJS from 'exceljs';
import { textValue } from '@/lib/inventoryText';

const CLR = {
  headerBg: 'FF1E293B',
  headerFg: 'FFFFFFFF',
  colHdr: 'FFF1F5F9',
  totalBg: 'FF1E293B',
  totalFg: 'FFFFFFFF',
  inBg: 'FFEFF6FF',
  outBg: 'FFFEF2F2',
  lowBg: 'FFFEF3C7',
  outOfBg: 'FFFEE2E2',
};

function fill(hex) {
  return { type: 'pattern', pattern: 'solid', fgColor: { argb: hex } };
}
function border() {
  const s = { style: 'thin', color: { argb: 'FF000000' } };
  return { top: s, left: s, bottom: s, right: s };
}
function font(bold = false, size = 9, color = 'FF1E293B') {
  return { name: 'Arial', size, bold, color: { argb: color } };
}
function align(h = 'center', wrap = true) {
  return { horizontal: h, vertical: 'middle', wrapText: wrap };
}

function applyCell(cell, value, fillHex, fontObj, alignObj, brd = true) {
  cell.value = value;
  if (fillHex) cell.fill = fill(fillHex);
  if (fontObj) cell.font = fontObj;
  if (alignObj) cell.alignment = alignObj;
  if (brd) cell.border = border();
}

function writeTitle(ws, title, colCount) {
  ws.mergeCells(1, 1, 1, colCount);
  const c = ws.getCell(1, 1);
  applyCell(c, title, CLR.headerBg, font(true, 11, CLR.headerFg), align('center', false));
  ws.getRow(1).height = 28;
}

function writeHeaders(ws, headers, row = 3) {
  headers.forEach((h, i) => {
    const c = ws.getCell(row, i + 1);
    applyCell(c, h, CLR.colHdr, font(true, 9), align('center'));
  });
  ws.getRow(row).height = 20;
}

function autoWidth(ws, headers, rows) {
  headers.forEach((h, i) => {
    let maxLen = String(h || '').length;
    rows.forEach(r => {
      const v = r[i];
      const len = v != null ? String(v).length : 0;
      if (len > maxLen) maxLen = len;
    });
    ws.getColumn(i + 1).width = Math.min(Math.max(maxLen + 3, 10), 50);
  });
}

export function exportItemsExcel(items) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Inventory Items');
  const headers = ['Item S.N.', 'Item Name', 'Unit', 'Category', 'Min Stock', 'Status', 'Remarks'];
  writeTitle(ws, 'INVENTORY ITEM MASTER', headers.length);
  writeHeaders(ws, headers);
  const rows = items.map(i => [
    i.item_sn, textValue(i.item_name), textValue(i.unit), textValue(i.category),
    i.min_stock_level || 0,
    i.is_archived ? 'Archived' : 'Active',
    i.remarks || '',
  ]);
  rows.forEach((row, ri) => {
    row.forEach((v, ci) => {
      const c = ws.getCell(ri + 4, ci + 1);
      applyCell(c, v, null, font(false, 9), align(ci === 1 ? 'left' : 'center'));
    });
  });
  autoWidth(ws, headers, rows);
  wb.xlsx.writeBuffer().then(buf => download(buf, 'Inventory_Items.xlsx'));
}

export function exportStockInExcel(transactions) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Stock In');
  const headers = ['Date', 'Item S.N.', 'Item Name', 'Unit', 'D/N No.', 'MRF No.', 'LPO', 'Supplier', 'Store', 'Qty', 'Remarks'];
  writeTitle(ws, 'STOCK IN REPORT', headers.length);
  writeHeaders(ws, headers);
  const rows = transactions
    .filter(t => t.transaction_type === 'STOCK_IN')
    .map(t => [
      t.transaction_date, t.item_sn, textValue(t.item_name), textValue(t.unit),
      t.dn_no, t.mrf_no, t.lpo, t.supplier, t.store,
      t.quantity_abs, t.remarks,
    ]);
  rows.forEach((row, ri) => {
    row.forEach((v, ci) => {
      const c = ws.getCell(ri + 4, ci + 1);
      applyCell(c, v, CLR.inBg, font(false, 9), align(ci === 2 ? 'left' : 'center'));
    });
  });
  autoWidth(ws, headers, rows);
  wb.xlsx.writeBuffer().then(buf => download(buf, 'Stock_In_Report.xlsx'));
}

export function exportStockOutExcel(transactions) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Stock Out');
  const headers = ['Date', 'Item S.N.', 'Item Name', 'Unit', 'I/V No.', 'Site', 'PID', 'Employee Name', 'Company', 'Qty', 'Remarks'];
  writeTitle(ws, 'STOCK OUT REPORT', headers.length);
  writeHeaders(ws, headers);
  const rows = transactions
    .filter(t => t.transaction_type === 'STOCK_OUT')
    .map(t => [
      t.transaction_date, t.item_sn, textValue(t.item_name), textValue(t.unit),
      t.iv_no, t.site, t.pid, t.employee_name, t.company,
      t.quantity_abs, t.remarks,
    ]);
  rows.forEach((row, ri) => {
    row.forEach((v, ci) => {
      const c = ws.getCell(ri + 4, ci + 1);
      applyCell(c, v, CLR.outBg, font(false, 9), align(ci === 2 || ci === 7 ? 'left' : 'center'));
    });
  });
  autoWidth(ws, headers, rows);
  wb.xlsx.writeBuffer().then(buf => download(buf, 'Stock_Out_Report.xlsx'));
}

export function exportAvailableStockExcel(rows) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Available Stock');
  const headers = ['Item S.N.', 'Item Name', 'Unit', 'Stock In', 'Stock Out', 'Available', 'Min Level', 'Status'];
  writeTitle(ws, 'AVAILABLE STOCK REPORT', headers.length);
  writeHeaders(ws, headers);
  rows.forEach((row, ri) => {
    const bg = row.status === 'Out of Stock' ? CLR.outOfBg : row.status === 'Low Stock' ? CLR.lowBg : null;
    row.values.forEach((v, ci) => {
      const c = ws.getCell(ri + 4, ci + 1);
      applyCell(c, v, bg, font(false, 9), align(ci === 1 ? 'left' : 'center'));
    });
  });
  autoWidth(ws, headers, rows.map(r => r.values));
  wb.xlsx.writeBuffer().then(buf => download(buf, 'Available_Stock_Report.xlsx'));
}

export function exportTransactionHistoryExcel(transactions) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Transaction History');
  const headers = ['Date', 'Type', 'Item S.N.', 'Item', 'Qty', 'Prev Balance', 'New Balance', 'Employee/Supplier', 'Ref No.', 'Store/Site', 'Created By', 'Remarks'];
  writeTitle(ws, 'TRANSACTION HISTORY', headers.length);
  writeHeaders(ws, headers);
  const rows = transactions.map(t => [
    t.transaction_date,
    t.transaction_type.replace(/_/g, ' '),
    t.item_sn, textValue(t.item_name),
    (t.transaction_type === 'STOCK_OUT' ? '-' : '') + (t.quantity_abs || 0),
    t.previous_balance, t.new_balance,
    t.transaction_type === 'STOCK_IN' ? (t.supplier || '') : (t.employee_name || ''),
    t.transaction_type === 'STOCK_IN' ? (t.dn_no || t.mrf_no || t.lpo || '') : (t.iv_no || ''),
    t.transaction_type === 'STOCK_IN' ? (t.store || '') : (t.site || ''),
    t.created_by_name || t.created_by || '',
    t.remarks || '',
  ]);
  rows.forEach((row, ri) => {
    row.forEach((v, ci) => {
      const c = ws.getCell(ri + 4, ci + 1);
      const bg = row[1] === 'STOCK IN' ? CLR.inBg : row[1] === 'STOCK OUT' ? CLR.outBg : null;
      applyCell(c, v, bg, font(false, 9), align(ci === 3 ? 'left' : 'center'));
    });
  });
  autoWidth(ws, headers, rows);
  wb.xlsx.writeBuffer().then(buf => download(buf, 'Transaction_History.xlsx'));
}

export function exportEmployeeIssuanceExcel(employee, transactions) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Employee Issuance');
  const headers = ['Date', 'I/V No.', 'Item S.N.', 'Item Name', 'Unit', 'Site', 'Qty', 'Remarks'];
  writeTitle(ws, `EMPLOYEE ISSUANCE — ${employee.name || ''}`, headers.length);
  writeHeaders(ws, headers);

  // Employee info block
  ws.mergeCells(2, 1, 2, headers.length);
  const infoCell = ws.getCell(2, 1);
  const infoText = [
    `PID: ${employee.pid || ''}`,
    `QID: ${employee.qid_no || ''}`,
    `Company: ${employee.company || ''}`,
    `Department: ${employee.department || ''}`,
    `Designation: ${employee.position_application || employee.designation_org_chart || ''}`,
  ].join('  |  ');
  applyCell(infoCell, infoText, CLR.colHdr, font(false, 9), align('left', false));
  ws.getRow(2).height = 18;

  const rows = transactions.map(t => [
    t.transaction_date, t.iv_no || '', t.item_sn || '', textValue(t.item_name),
    textValue(t.unit), t.site || '', t.quantity_abs || 0, t.remarks || '',
  ]);
  rows.forEach((row, ri) => {
    row.forEach((v, ci) => {
      const c = ws.getCell(ri + 4, ci + 1);
      applyCell(c, v, CLR.outBg, font(false, 9), align(ci === 3 ? 'left' : 'center'));
    });
  });

  // Totals row
  const totalRow = rows.length + 4;
  const totalQty = transactions.reduce((s, t) => s + (t.quantity_abs || 0), 0);
  const distinctItems = new Set(transactions.map(t => t.item_id).filter(Boolean)).size;
  ws.mergeCells(totalRow, 1, totalRow, 6);
  applyCell(ws.getCell(totalRow, 1), 'TOTALS', CLR.totalBg, font(true, 9, CLR.totalFg), align('center'));
  applyCell(ws.getCell(totalRow, 7), totalQty, CLR.totalBg, font(true, 9, CLR.totalFg), align('center'));
  applyCell(ws.getCell(totalRow, 8), `${distinctItems} items`, CLR.totalBg, font(true, 9, CLR.totalFg), align('center'));

  autoWidth(ws, headers, rows);
  const safeName = (employee.name || 'employee').replace(/[^a-zA-Z0-9]/g, '_');
  wb.xlsx.writeBuffer().then(buf => download(buf, `Employee_Issuance_${safeName}.xlsx`));
}

function download(buf, filename) {
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}