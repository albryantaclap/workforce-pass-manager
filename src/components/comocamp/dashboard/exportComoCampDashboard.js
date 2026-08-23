import ExcelJS from 'exceljs';
import {
  aggregateAll, complianceItems, PID_EXPIRY_GROUPS,
} from './comoCampAggregations';
import { computePassStatus, formatDate } from '@/utils/constants';

const fmtDt = () => new Date().toLocaleString();

/** Multi-sheet Excel workbook of the entire dashboard + filtered personnel. */
export async function exportDashboardExcel({ data, isComo, filters }) {
  const agg = aggregateAll(data);
  const wb = new ExcelJS.Workbook();
  wb.creator = 'GSO QATAR Workforce Pass Manager';
  wb.created = new Date();

  // ── Summary ──
  const ws = wb.addWorksheet('Summary');
  ws.columns = [{ header: 'Metric', key: 'metric', width: 44 }, { header: 'Value', key: 'value', width: 16 }];
  const completionPct = agg.kpi.total ? Math.round((agg.fullyComplete / agg.kpi.total) * 100) : 0;
  const rows = [
    ['Report', isComo ? 'GSO QATAR — COMO CAMP PERSONNEL DASHBOARD' : 'GSO QATAR — WORK LOCATION PERSONNEL DASHBOARD'],
    ['Generated', fmtDt()],
    ['Selected Tab', isComo ? 'COMO Camp' : 'All Locations'],
    ['Applied Filters', filters.join(' · ') || 'None'],
    ['Total Filtered Personnel', agg.kpi.total],
    ['Medical Accepted', agg.kpi.medAccepted],
    ['Medical Pending / Not Accepted', agg.kpi.medPending],
    ['Gate Pass Valid / Soon', agg.kpi.gpValid],
    ['Gate Pass Under Process / No Pass', agg.kpi.gpUnderProcess + agg.kpi.gpNoPass],
    ['Training Done', agg.kpi.trainDone],
    ['Training On-Going', agg.kpi.trainOnGoing],
    ['Training Pending / To Be Scheduled', agg.kpi.trainPending],
    ['PID Valid / Soon', agg.kpi.pidValid],
    ['PID Soon', agg.kpi.pidSoon],
    ['PID Expired', agg.kpi.pidExpired],
    ['PID Renewal Under Process', agg.kpi.pidRenewal],
    ['No PID', agg.kpi.noPid],
    ['Fully Complete', agg.fullyComplete],
    ['Completion %', completionPct + '%'],
    ['Missing Medical', agg.missingMed],
    ['Missing / Invalid Gate Pass', agg.missingGp],
    ['Training Incomplete', agg.missingTrain],
    ['Missing / Invalid PID', agg.missingPid],
  ];
  rows.forEach((r) => ws.addRow({ metric: r[0], value: r[1] }));
  ws.getRow(1).font = { bold: true };

  // ── Compliance sheets ──
  const addComplianceSheet = (name, items) => {
    const s = wb.addWorksheet(name);
    s.columns = [
      { header: name, key: 'label', width: 34 },
      { header: 'Total', key: 'total', width: 10 },
      { header: 'Medical Accepted', key: 'medAccepted', width: 16 },
      { header: 'GP Valid/Soon', key: 'gpValid', width: 14 },
      { header: 'Training Done', key: 'trainDone', width: 14 },
      { header: 'PID Valid/Soon', key: 'pidValid', width: 14 },
      { header: 'Fully Complete', key: 'fullyComplete', width: 14 },
      { header: 'Complete %', key: 'completePct', width: 12 },
    ];
    items.forEach((it) => s.addRow({
      label: it.label, total: it.total, medAccepted: it.medAccepted, gpValid: it.gpValid,
      trainDone: it.trainDone, pidValid: it.pidValid, fullyComplete: it.fullyComplete,
      completePct: it.completePct + '%',
    }));
    s.getRow(1).font = { bold: true };
  };
  addComplianceSheet('Company', complianceItems(agg.byCompany));
  addComplianceSheet('Department', complianceItems(agg.byDepartment));
  addComplianceSheet('Position', complianceItems(agg.byPosition));
  addComplianceSheet('Manager', complianceItems(agg.byManager));

  // ── PID Expiry ──
  const pe = wb.addWorksheet('PID Expiry');
  pe.columns = [{ header: 'Group', key: 'label', width: 24 }, { header: 'Count', key: 'value', width: 10 }];
  PID_EXPIRY_GROUPS.forEach((g) => pe.addRow({ label: g.label, value: agg.pidExpiry[g.key] || 0 }));
  pe.getRow(1).font = { bold: true };

  // ── Personnel Data (all filtered, not just current page) ──
  const pd = wb.addWorksheet('Personnel Data');
  pd.columns = [
    { header: 'Name', key: 'name', width: 28 },
    { header: 'Company', key: 'company', width: 20 },
    { header: 'Department', key: 'department', width: 14 },
    { header: 'QID No', key: 'qid', width: 16 },
    { header: 'PID No', key: 'pidNo', width: 14 },
    { header: 'Medical', key: 'medical', width: 20 },
    { header: 'Gate Pass', key: 'gp', width: 20 },
    { header: 'Training', key: 'training', width: 18 },
    { header: 'PID Status', key: 'pidStatus', width: 20 },
    { header: 'PID Expiry', key: 'pidExpiry', width: 14 },
    { header: 'Work Location', key: 'location', width: 16 },
    { header: 'Assigned Manager', key: 'manager', width: 22 },
    { header: 'Contact', key: 'contact', width: 16 },
  ];
  data.forEach((e) => pd.addRow({
    name: e.name || '', company: e.company || '', department: e.department || '',
    qid: e.qid_no || '', pidNo: e.pid || '',
    medical: e.ftw_result || 'No Medical Record',
    gp: computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status),
    training: e.training_status || 'No Record',
    pidStatus: computePassStatus(e.pid_expiry, 'pid', e.pid_status),
    pidExpiry: formatDate(e.pid_expiry),
    location: e.current_location || '',
    manager: e.assigned_manager_name || 'Unassigned',
    contact: e.contact_details || '',
  }));
  pd.getRow(1).font = { bold: true };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = isComo ? 'COMO_Camp_Dashboard.xlsx' : 'Work_Location_Dashboard.xlsx';
  a.click();
  URL.revokeObjectURL(url);
}

/** Printable A3-landscape PDF report of the dashboard. */
export function printDashboardPdf({ data, isComo, filters }) {
  const agg = aggregateAll(data);
  const title = isComo ? 'GSO QATAR — COMO CAMP PERSONNEL DASHBOARD' : 'GSO QATAR — WORK LOCATION PERSONNEL DASHBOARD';
  const completionPct = agg.kpi.total ? Math.round((agg.fullyComplete / agg.kpi.total) * 100) : 0;

  const kpiRows = [
    ['Total Filtered Personnel', agg.kpi.total],
    ['Medical Accepted', agg.kpi.medAccepted],
    ['Medical Pending / Not Accepted', agg.kpi.medPending],
    ['Gate Pass Valid / Soon', agg.kpi.gpValid],
    ['Gate Pass Under Process / No Pass', agg.kpi.gpUnderProcess + agg.kpi.gpNoPass],
    ['Training Done', agg.kpi.trainDone],
    ['Training On-Going', agg.kpi.trainOnGoing],
    ['Training Pending / To Be Scheduled', agg.kpi.trainPending],
    ['PID Valid / Soon', agg.kpi.pidValid],
    ['PID Soon', agg.kpi.pidSoon],
    ['PID Expired', agg.kpi.pidExpired],
    ['PID Renewal Under Process', agg.kpi.pidRenewal],
    ['No PID', agg.kpi.noPid],
    ['Fully Complete', agg.fullyComplete],
    ['Completion %', completionPct + '%'],
  ];

  const complianceTable = (items) => items.map((it) => `<tr>
    <td>${it.label}</td><td style="text-align:right">${it.total}</td>
    <td style="text-align:right">${it.medAccepted}</td><td style="text-align:right">${it.gpValid}</td>
    <td style="text-align:right">${it.trainDone}</td><td style="text-align:right">${it.pidValid}</td>
    <td style="text-align:right">${it.fullyComplete}</td><td style="text-align:right">${it.completePct}%</td>
  </tr>`).join('');

  const pidExpiryRows = PID_EXPIRY_GROUPS.map((g) => `<tr>
    <td>${g.label}</td><td style="text-align:right">${agg.pidExpiry[g.key] || 0}</td>
  </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title>
  <style>
    @page { size: A3 landscape; margin: 12mm; }
    body { font-family: 'Inter', Arial, sans-serif; color: #1c2025; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    .meta { font-size: 11px; color: #6b7280; margin-bottom: 4px; }
    .filters { font-size: 11px; color: #374151; margin-bottom: 14px; }
    table { border-collapse: collapse; width: 100%; font-size: 11px; margin-bottom: 16px; }
    th, td { border: 1px solid #d1d5db; padding: 5px 8px; }
    th { background: #f1f5f9; text-align: left; font-weight: 600; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 10px; }
    .card h2 { font-size: 13px; margin: 0 0 8px; }
    .section-title { font-size: 14px; font-weight: 700; margin: 18px 0 8px; border-bottom: 2px solid #0047ab; padding-bottom: 3px; }
  </style></head><body>
    <h1>${title}</h1>
    <div class="meta">Generated: ${fmtDt()} · Tab: ${isComo ? 'COMO Camp' : 'All Locations'} · Total Filtered: ${agg.kpi.total}</div>
    <div class="filters"><strong>Filters:</strong> ${filters.join(' · ') || 'None'}</div>
    <div class="section-title">KPI Summary</div>
    <table><tbody>${kpiRows.map((r) => `<tr><td>${r[0]}</td><td style="text-align:right;font-weight:600">${r[1]}</td></tr>`).join('')}</tbody></table>
    <div class="grid">
      <div class="card"><h2>Company Compliance</h2><table><thead><tr><th>Company</th><th>Total</th><th>MD</th><th>GP</th><th>TR</th><th>PID</th><th>Complete</th><th>%</th></tr></thead><tbody>${complianceTable(complianceItems(agg.byCompany))}</tbody></table></div>
      <div class="card"><h2>Department Compliance</h2><table><thead><tr><th>Department</th><th>Total</th><th>MD</th><th>GP</th><th>TR</th><th>PID</th><th>Complete</th><th>%</th></tr></thead><tbody>${complianceTable(complianceItems(agg.byDepartment))}</tbody></table></div>
      <div class="card"><h2>Position Summary</h2><table><thead><tr><th>Position</th><th>Total</th><th>MD</th><th>GP</th><th>TR</th><th>PID</th><th>Complete</th><th>%</th></tr></thead><tbody>${complianceTable(complianceItems(agg.byPosition))}</tbody></table></div>
      <div class="card"><h2>Manager Summary</h2><table><thead><tr><th>Manager</th><th>Total</th><th>MD</th><th>GP</th><th>TR</th><th>PID</th><th>Complete</th><th>%</th></tr></thead><tbody>${complianceTable(complianceItems(agg.byManager))}</tbody></table></div>
    </div>
    <div class="section-title">PID Expiry Monitoring</div>
    <table style="width:50%"><thead><tr><th>Group</th><th>Count</th></tr></thead><tbody>${pidExpiryRows}</tbody></table>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}