import ExcelJS from 'exceljs';

// ── Color palette (matching the print CSS) ──────────────────────────────────
const CLR = {
  navyBg:    '1E293B',
  navyFg:    'FFFFFFFF',
  yellow:    'FFFDE047',
  medical:   'FFBFDBFE',
  medicalBg: 'FFEFF6FF',
  gatepass:  'FFBBF7D0',
  gatepassBg:'FFF0FDF4',
  training:  'FFFED7AA',
  trainingBg:'FFFFF7ED',
  pid:       'FFE9D5FF',
  pidBg:     'FFFAF5FF',
  camp:      'FFFCE7F3',
  campBg:    'FFFDF2F8',
  colHdr:    'FFF1F5F9',
  totalBg:   '1E293B',
  totalFg:   'FFFFFFFF',
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

function align(horiz = 'center', wrap = true) {
  return { horizontal: horiz, vertical: 'middle', wrapText: wrap };
}

function applyCell(cell, value, fillHex, fontObj, alignObj, brd = true) {
  cell.value = value;
  cell.fill = fill(fillHex);
  cell.font = fontObj;
  cell.alignment = alignObj;
  if (brd) cell.border = border();
}

// ── Grand Total summary table ─────────────────────────────────────────────────
function writeGrandTotal(ws, startRow, companyData, assignments, COMPANY_CATEGORIES) {
  // Build manager map
  const managerMap = {};
  for (const a of assignments) {
    for (const co of a.companies) managerMap[co.trim().toUpperCase()] = a.manager_name;
  }

  const companies = Object.keys(companyData).sort((a, b) => {
    const mA = (managerMap[a] || '').toUpperCase();
    const mB = (managerMap[b] || '').toUpperCase();
    const mc = mA.localeCompare(mB);
    if (mc !== 0) return mc;
    return (COMPANY_CATEGORIES[a] || '').localeCompare(COMPANY_CATEGORIES[b] || '');
  });

  // Compute totals
  const companyTotals = {};
  const grand = { pendingMedical: 0, ftw: 0, gpUnder: 0, validGP: 0, trainingScheduled: 0, trainingOnGoing: 0, trainingDone: 0, pid: 0, camp: 0 };
  for (const co of companies) {
    const t = { pendingMedical: 0, ftw: 0, gpUnder: 0, validGP: 0, trainingScheduled: 0, trainingOnGoing: 0, trainingDone: 0, pid: 0, camp: 0 };
    for (const row of Object.values(companyData[co])) for (const k of Object.keys(t)) t[k] += row[k];
    companyTotals[co] = t;
    for (const k of Object.keys(grand)) grand[k] += t[k];
  }

  let r = startRow;

  // Title row
  ws.mergeCells(r, 1, r, 12);
  applyCell(ws.getCell(r, 1), 'GRAND TOTAL — ALL COMPANIES', CLR.navyBg, font(true, 12, CLR.navyFg), align('center'));
  ws.getRow(r).height = 22;
  r++;

  // Group header
  ws.mergeCells(r, 1, r, 1); // COMPANY
  ws.mergeCells(r, 2, r, 2); // CATEGORY
  ws.mergeCells(r, 3, r, 3); // MANAGER
  ws.mergeCells(r, 4, r, 5); applyCell(ws.getCell(r, 4), 'MEDICAL', CLR.medical, font(true, 9), align('center'));
  ws.mergeCells(r, 6, r, 7); applyCell(ws.getCell(r, 6), 'GATEPASS', CLR.gatepass, font(true, 9), align('center'));
  ws.mergeCells(r, 8, r, 10); applyCell(ws.getCell(r, 8), 'TRAINING', CLR.training, font(true, 9), align('center'));
  applyCell(ws.getCell(r, 11), 'PID', CLR.pid, font(true, 9), align('center'));
  applyCell(ws.getCell(r, 12), 'CAMP', CLR.camp, font(true, 9), align('center'));
  [1, 2, 3, 11, 12].forEach(c => { ws.getCell(r, c).fill = fill(CLR.colHdr); ws.getCell(r, c).border = border(); ws.getCell(r, c).alignment = align('center'); });
  ws.getRow(r).height = 16;
  r++;

  // Column header row
  const colHdrs = ['COMPANY', 'CATEGORY', 'MANAGER ASSIGNED', 'PENDING MEDICAL', 'FTW / APPROVED', 'GP UNDER PROCESS', 'VALID GATEPASS', 'SCHEDULED', 'ON-GOING', 'COMPLETED', 'PID', 'CAMP'];
  const colHdrFills = [CLR.colHdr, CLR.colHdr, CLR.colHdr, CLR.medicalBg, CLR.medicalBg, CLR.gatepassBg, CLR.gatepassBg, CLR.trainingBg, CLR.trainingBg, CLR.trainingBg, CLR.pidBg, CLR.campBg];
  colHdrs.forEach((h, i) => {
    applyCell(ws.getCell(r, i + 1), h, colHdrFills[i], font(true, 8), align(i < 3 ? 'left' : 'center'));
  });
  ws.getRow(r).height = 28;
  r++;

  // Data rows
  for (const co of companies) {
    const t = companyTotals[co];
    const vals = [co, COMPANY_CATEGORIES[co] || '', (managerMap[co] || '—').toUpperCase(), t.pendingMedical || '', t.ftw || '', t.gpUnder || '', t.validGP || '', t.trainingScheduled || '', t.trainingOnGoing || '', t.trainingDone || '', t.pid || '', t.camp || ''];
    const rowFills = [CLR.colHdr, CLR.colHdr, CLR.colHdr, CLR.medicalBg, CLR.medicalBg, CLR.gatepassBg, CLR.gatepassBg, CLR.trainingBg, CLR.trainingBg, CLR.trainingBg, CLR.pidBg, CLR.campBg];
    vals.forEach((v, i) => {
      applyCell(ws.getCell(r, i + 1), v, rowFills[i], font(false, 9), align(i < 3 ? 'left' : 'center'));
    });
    ws.getRow(r).height = 16;
    r++;
  }

  // Grand total row
  const gtVals = ['GRAND TOTAL', '', '', grand.pendingMedical || '', grand.ftw || '', grand.gpUnder || '', grand.validGP || '', grand.trainingScheduled || '', grand.trainingOnGoing || '', grand.trainingDone || '', grand.pid || '', grand.camp || ''];
  gtVals.forEach((v, i) => {
    applyCell(ws.getCell(r, i + 1), v, CLR.navyBg, font(true, 10, CLR.navyFg), align(i === 0 ? 'left' : 'center'));
  });
  ws.getRow(r).height = 18;
  r++;

  return r + 1; // blank row gap
}

// ── Per-company detail table ──────────────────────────────────────────────────
function writeCompanyTable(ws, startRow, company, rows, isGrand = false) {
  let r = startRow;

  // Sort designations
  const DESIGNATION_KEYWORD_RANKS = [
    ['GENERAL MANAGER', 0], ['OPERATIONS MANAGER', 1], ['PROJECT MANAGER', 2], ['CONSTRUCTION MANAGER', 3], ['MANAGER', 6],
    ['SENIOR ENGINEER', 10], ['ENGINEER', 11], ['GENERAL FOREMAN', 20], ['FOREMAN', 22], ['SUPERVISOR', 23],
    ['COORDINATOR', 30], ['INSPECTOR', 31], ['OFFICER', 32], ['TECHNICIAN', 41], ['MECHANIC', 42], ['ELECTRICIAN', 43],
    ['WELDER', 44], ['FITTER', 45], ['RIGGER', 46], ['SCAFFOLDER', 47], ['OPERATOR', 61], ['DRIVER', 70], ['HELPER', 80], ['LABOUR', 90], ['UNSPECIFIED', 99],
  ];
  function getRank(d) {
    const u = d.toUpperCase(); let best = 95;
    for (const [kw, rk] of DESIGNATION_KEYWORD_RANKS) { if (u.includes(kw) && rk < best) best = rk; }
    return best;
  }
  const designations = Object.keys(rows).sort((a, b) => { const d = getRank(a) - getRank(b); return d !== 0 ? d : a.localeCompare(b); });
  const totals = { pendingMedical: 0, ftw: 0, gpUnder: 0, validGP: 0, trainingScheduled: 0, trainingOnGoing: 0, trainingDone: 0, pid: 0, camp: 0 };
  for (const d of designations) for (const k of Object.keys(totals)) totals[k] += rows[d][k];

  // Company title
  ws.mergeCells(r, 1, r, 10);
  applyCell(ws.getCell(r, 1), company, CLR.yellow, font(true, 13, 'FF1E293B'), align('center'));
  ws.getRow(r).height = 22;
  r++;

  // Group header
  ws.mergeCells(r, 2, r, 3); applyCell(ws.getCell(r, 2), 'MEDICAL', CLR.medical, font(true, 9), align('center'));
  ws.mergeCells(r, 4, r, 5); applyCell(ws.getCell(r, 4), 'GATEPASS', CLR.gatepass, font(true, 9), align('center'));
  ws.mergeCells(r, 6, r, 8); applyCell(ws.getCell(r, 6), 'TRAINING', CLR.training, font(true, 9), align('center'));
  applyCell(ws.getCell(r, 9), 'PID', CLR.pid, font(true, 9), align('center'));
  applyCell(ws.getCell(r, 10), 'CAMP', CLR.camp, font(true, 9), align('center'));
  ws.getCell(r, 1).fill = fill(CLR.colHdr); ws.getCell(r, 1).border = border();
  ws.getRow(r).height = 16;
  r++;

  // Column header
  const hdrs = ['DESIGNATION', 'PENDING MEDICAL', 'FTW / APPROVED', 'GP UNDER PROCESS', 'VALID GATEPASS', 'SCHEDULED', 'ON-GOING', 'COMPLETED', 'PID', 'CAMP'];
  const hFills = [CLR.colHdr, CLR.medicalBg, CLR.medicalBg, CLR.gatepassBg, CLR.gatepassBg, CLR.trainingBg, CLR.trainingBg, CLR.trainingBg, CLR.pidBg, CLR.campBg];
  hdrs.forEach((h, i) => {
    applyCell(ws.getCell(r, i + 1), h, hFills[i], font(true, 8), align(i === 0 ? 'left' : 'center'));
  });
  ws.getRow(r).height = 28;
  r++;

  // Data rows
  for (const d of designations) {
    const row = rows[d];
    const vals = [d, row.pendingMedical || '', row.ftw || '', row.gpUnder || '', row.validGP || '', row.trainingScheduled || '', row.trainingOnGoing || '', row.trainingDone || '', row.pid || '', row.camp || ''];
    const rFills = [CLR.colHdr, CLR.medicalBg, CLR.medicalBg, CLR.gatepassBg, CLR.gatepassBg, CLR.trainingBg, CLR.trainingBg, CLR.trainingBg, CLR.pidBg, CLR.campBg];
    vals.forEach((v, i) => {
      applyCell(ws.getCell(r, i + 1), v, rFills[i], font(false, 9), align(i === 0 ? 'left' : 'center'));
    });
    ws.getRow(r).height = 16;
    r++;
  }

  // Total row
  const tVals = ['TOTAL', totals.pendingMedical || '', totals.ftw || '', totals.gpUnder || '', totals.validGP || '', totals.trainingScheduled || '', totals.trainingOnGoing || '', totals.trainingDone || '', totals.pid || '', totals.camp || ''];
  tVals.forEach((v, i) => {
    applyCell(ws.getCell(r, i + 1), v, CLR.navyBg, font(true, 10, CLR.navyFg), align(i === 0 ? 'left' : 'center'));
  });
  ws.getRow(r).height = 18;
  r++;

  return r + 1; // blank row gap
}

// ── Main export function ──────────────────────────────────────────────────────
export async function exportGatepassExcel({ companyData, assignments, displayDate, isoDate }) {
  const COMPANY_CATEGORIES = {
    'KM STEEL - MOSTAFA (GSO)': 'STEEL STRUCTURE', 'QTRS - ALAVON (GSO)': 'CIVIL',
    'VMANES (GSO)': 'MECHANICAL & CIVIL', 'GSO QATAR': '', 'INTEGRATED (GSO)': 'STEEL STRUCTURE & CIVIL',
    'TEXON (GSO)': 'LOGISTICS', 'SWAN GLOBAL (GSO)': 'PIPELINE', 'GOOD HIRING': 'CIVIL',
    'GSO LOGISTICS': 'DRIVERS AND OPERATORS', 'KHALED PROJECTS': 'DRIVERS AND OPERATORS',
    'AUTO XPERT': 'DRIVERS AND OPERATORS', 'SIGEL (GSO)': 'MECHANICAL - PIPELINE',
    'CRYSTAL': 'MECHANICAL - PIPELINE', 'ZEAL-IT': 'RIGGERS', 'QSS': 'SECURITY',
    'INFINITY (GSO)': 'STEEL STRUCTURE & CIVIL', 'WENMA': 'SCAFFOLDING', 'MIR (GSO)': 'STEEL STRUCTURE',
    'AL JABER (GSO)': 'HEAVY LIFT', 'AL-RAMSHA (GSO)': 'MECHANICAL - ROTARY',
    'METAL WORLD': 'MECHANICAL & STEEL STRUCTURE', 'ALTHAF (GSO)': 'STEEL STRUCTURE',
    'ALTAF (GSO)': 'STEEL STRUCTURE', 'ARKAN GULF (GSO)': 'ELECTRICAL (NEW)',
    'ANION': 'CATHODIC', 'ENERSERVE (GSO)': 'MECHANICAL & ELECTRICAL',
    'LMV E AND I': 'ELECTRICAL', 'MEGATRONICS (GSO)': 'STEEL STRUCTURE & ELECTRICAL',
    'NTC (GSO)': 'ELECTRICAL', 'SEA QUEEN': 'MECHANICAL & INSTRUMENTATION',
    'ITELLIGENT': 'TELECOMMUNICATION',
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = 'GSO Qatar';
  wb.created = new Date();

  const ws = wb.addWorksheet('Gatepass Report', {
    pageSetup: {
      orientation: 'landscape',
      paperSize: 9, // A4
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
    },
    views: [{ state: 'frozen', xSplit: 0, ySplit: 3 }],
  });

  // Column widths (12 cols for grand total; 10 for company tables — use max 12)
  ws.columns = [
    { width: 28 }, { width: 22 }, { width: 16 },
    { width: 11 }, { width: 11 }, { width: 11 }, { width: 11 },
    { width: 10 }, { width: 10 }, { width: 10 },
    { width: 8  }, { width: 8  },
  ];

  // ── Main title ──
  ws.mergeCells(1, 1, 1, 12);
  applyCell(ws.getCell(1, 1), `GATEPASS DAILY REPORT UPDATE — ${displayDate}`, CLR.navyBg, font(true, 14, CLR.navyFg), align('center'));
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, 12);
  applyCell(ws.getCell(2, 1), `Report Date: ${displayDate}`, 'FFFFFFFF', font(false, 10), align('center'));
  ws.getRow(2).height = 16;

  // blank row
  ws.getRow(3).height = 8;

  let currentRow = 4;

  // ── Grand Total block ──
  currentRow = writeGrandTotal(ws, currentRow, companyData, assignments, COMPANY_CATEGORIES);

  // ── Per-company blocks ──
  const companies = Object.keys(companyData).sort();
  for (const co of companies) {
    currentRow = writeCompanyTable(ws, currentRow, co, companyData[co]);
  }

  // Print area
  ws.pageSetup.printArea = `A1:L${currentRow}`;
  ws.pageSetup.repeatRows = '1:3';

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Gatepass_Daily_Report_${isoDate}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}