import ExcelJS from 'exceljs';

const CLR = {
  navyBg: '1E293B', navyFg: 'FFFFFFFF',
  colHdr: 'FFF1F5F9', alt: 'FFF8FAFC',
  gp: 'FFBBF7D0', pid: 'FFE9D5FF',
};

function fill(hex) { return { type: 'pattern', pattern: 'solid', fgColor: { argb: hex } }; }
function border() {
  const s = { style: 'thin', color: { argb: 'FF000000' } };
  return { top: s, left: s, bottom: s, right: s };
}

export async function exportRenewalHistoryExcel({ rows, periodLabel, isoLabel }) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Renewal History');

  ws.columns = [
    { header: '#', key: 'no', width: 6 },
    { header: 'Personnel', key: 'name', width: 28 },
    { header: 'Company', key: 'company', width: 20 },
    { header: 'Document Type', key: 'documentType', width: 14 },
    { header: 'Renewal No.', key: 'renewalNo', width: 11 },
    { header: 'Entry Type', key: 'entryType', width: 16 },
    { header: 'Document No.', key: 'documentNumber', width: 14 },
    { header: 'Issue / Submitted', key: 'issueDate', width: 16 },
    { header: 'Received', key: 'receivedDate', width: 14 },
    { header: 'Expiry', key: 'expiryDate', width: 14 },
    { header: 'Recorded Status', key: 'recordedStatus', width: 18 },
    { header: 'Renewal Date', key: 'renewalDate', width: 14 },
    { header: 'Recorded By', key: 'updatedBy', width: 24 },
    { header: 'Remarks', key: 'remarks', width: 26 },
  ];

  // Title rows
  ws.mergeCells(1, 1, 1, 14);
  const t1 = ws.getCell(1, 1);
  t1.value = 'DOCUMENT RENEWAL HISTORY REPORT';
  t1.font = { name: 'Arial', size: 14, bold: true, color: { argb: CLR.navyFg } };
  t1.fill = fill(CLR.navyBg); t1.alignment = { horizontal: 'center', vertical: 'middle' };
  t1.border = border();
  ws.getRow(1).height = 26;

  ws.mergeCells(2, 1, 2, 14);
  const t2 = ws.getCell(2, 1);
  t2.value = `Period: ${periodLabel}`;
  t2.font = { name: 'Arial', size: 10, bold: true };
  t2.alignment = { horizontal: 'center', vertical: 'middle' };
  ws.getRow(2).height = 16;

  // Header row at row 3
  const hdrRow = ws.getRow(3);
  hdrRow.height = 18;
  ws.columns.forEach((c, i) => {
    const cell = ws.getCell(3, i + 1);
    cell.value = c.header;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF1E293B' } };
    cell.fill = fill(CLR.colHdr);
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = border();
  });

  rows.forEach((r, i) => {
    const row = ws.getRow(4 + i);
    const vals = {
      no: i + 1,
      name: r.employee_name || '',
      company: r.company || '',
      documentType: r.document_type || '',
      renewalNo: r.renewal_no || '',
      entryType: r.entry_type || '',
      documentNumber: r.document_number || '',
      issueDate: r.issue_date || '',
      receivedDate: r.received_date || '',
      expiryDate: r.expiry_date || '',
      recordedStatus: r.recorded_status || '',
      renewalDate: r.expiry_date || '',
      updatedBy: r.updated_by_name || '',
      remarks: r.remarks || '',
    };
    Object.keys(vals).forEach((k, idx) => {
      const cell = ws.getCell(4 + i, idx + 1);
      cell.value = vals[k];
      cell.font = { name: 'Arial', size: 9 };
      cell.alignment = { horizontal: idx <= 1 ? 'left' : 'center', vertical: 'middle', wrapText: true };
      cell.border = border();
      if (i % 2 === 1) cell.fill = fill(CLR.alt);
    });
    row.commit();
  });

  ws.pageSetup.printArea = `A1:N${4 + rows.length}`;
  ws.pageSetup.repeatRows = '1:3';
  ws.pageSetup.orientation = 'landscape';

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Renewal_History_${isoLabel}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}