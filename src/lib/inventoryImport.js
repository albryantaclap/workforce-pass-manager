import { textValue } from '@/lib/inventoryText';

// Shared inventory workbook parser (used by the Import and Repair dialogs).
//
// Every cell is read through cellText()/cellNumber()/cellDate() instead of
// String(cell.value): ExcelJS returns rich text ({richText:[...]}), formulas
// ({formula, result}), hyperlinks ({text, hyperlink}) and dates as objects, and
// stringifying those is what stored the literal "[object Object]" on the
// imported inventory records.
export const MASTER_SHEET = 'MASTER FILE';
export const DETAILS_SHEET = 'INVENTORY DETAILS';

export const cellText = (value) => textValue(value);

export const cellNumber = (value) => {
  if (typeof value === 'number') return value;
  const parsed = Number(textValue(value));
  return Number.isFinite(parsed) ? parsed : 0;
};

export const cellDate = (value) => {
  if (!value) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'object' && value.result instanceof Date) return value.result.toISOString().slice(0, 10);
  return textValue(value).slice(0, 10);
};

// MASTER FILE → items, INVENTORY DETAILS → stock in (IN) / stock out (OUT).
export const parseInventoryWorkbook = (workbook) => {
  const masterSheet = workbook.getWorksheet(MASTER_SHEET);
  const invSheet = workbook.getWorksheet(DETAILS_SHEET);
  const items = [];
  const stockIn = [];
  const stockOut = [];
  const errors = [];

  if (masterSheet) {
    masterSheet.eachRow((row, rowNum) => {
      if (rowNum === 1) return; // header
      const sn = cellText(row.getCell(2).value);
      const desc = cellText(row.getCell(3).value);
      const uom = cellText(row.getCell(4).value);
      if (sn && desc) {
        items.push({
          item_sn: sn,
          item_name: desc,
          unit: uom || 'NOS',
          category: '',
          min_stock_level: 0,
        });
      }
    });
  }

  if (invSheet) {
    invSheet.eachRow((row, rowNum) => {
      if (rowNum <= 3) return; // headers

      // IN section: cols 2-12 (date, item_sn, item_name, unit, dn, mrf, lpo, supplier, store, qty, remarks)
      const inDate = cellDate(row.getCell(2).value);
      const inSn = cellText(row.getCell(4).value);
      const inQty = cellNumber(row.getCell(12).value);
      if (inDate && inSn && inQty) {
        stockIn.push({
          transaction_date: inDate,
          item_sn: inSn,
          item_name: cellText(row.getCell(5).value),
          unit: cellText(row.getCell(6).value) || 'NOS',
          dn_no: cellText(row.getCell(7).value),
          mrf_no: cellText(row.getCell(8).value),
          lpo: cellText(row.getCell(9).value),
          supplier: cellText(row.getCell(10).value),
          store: cellText(row.getCell(11).value),
          quantity: inQty,
        });
      }

      // OUT section: cols 15-25 (date, item_sn, item_name, unit, iv, site, pid, emp_name, company, qty, remarks)
      const outDate = cellDate(row.getCell(15).value);
      const outSn = cellText(row.getCell(17).value);
      const outQty = cellNumber(row.getCell(25).value);
      if (outDate && outSn && outQty) {
        stockOut.push({
          transaction_date: outDate,
          item_sn: outSn,
          item_name: cellText(row.getCell(18).value),
          unit: cellText(row.getCell(19).value) || 'NOS',
          iv_no: cellText(row.getCell(20).value),
          site: cellText(row.getCell(21).value),
          pid: cellText(row.getCell(22).value),
          employee_name: cellText(row.getCell(23).value),
          company: cellText(row.getCell(24).value),
          quantity: outQty,
        });
      }
    });
  }

  const snSet = new Set();
  items.forEach((i) => {
    if (snSet.has(i.item_sn)) errors.push(`Duplicate Item S.N. in MASTER FILE: ${i.item_sn}`);
    snSet.add(i.item_sn);
  });
  stockIn.forEach((s) => {
    if (!snSet.has(s.item_sn)) errors.push(`Stock In references unknown Item S.N.: ${s.item_sn}`);
  });
  stockOut.forEach((s) => {
    if (!snSet.has(s.item_sn)) errors.push(`Stock Out references unknown Item S.N.: ${s.item_sn}`);
  });

  return { items, stockIn, stockOut, errors, hasMaster: !!masterSheet, hasDetails: !!invSheet };
};