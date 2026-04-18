import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Printer } from 'lucide-react';
import { computePassStatus } from '@/utils/constants';

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const k = item[key] || 'Unknown';
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

const CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1e293b; background: white; }
  .wrap { padding: 24px; max-width: 1050px; margin: 0 auto; }
  h1 { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 4px; }
  .meta { color: #64748b; font-size: 10px; margin-bottom: 20px; }
  h2 { font-size: 13px; font-weight: 700; color: #334155; margin: 20px 0 8px; border-bottom: 2px solid #e2e8f0; padding-bottom: 4px; }
  h3 { font-size: 11px; font-weight: 700; color: #475569; margin: 14px 0 5px; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #f1f5f9; text-align: left; padding: 5px 7px; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 600; }
  td { padding: 4px 7px; border: 1px solid #cbd5e1; font-size: 10px; }
  tr:nth-child(even) td { background: #f8fafc; }
  .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px; }
  .summary-card { border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px; }
  .card-title { font-size: 10px; font-weight: 700; color: #475569; margin-bottom: 6px; }
  .stat-row { display: flex; justify-content: space-between; font-size: 10px; padding: 2px 0; }
  .stat-val { font-weight: 700; }
  .pos-count-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { page-break-before: auto; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
`;

function buildReportHTML(filtered, categoryCards, today) {
  const byCompany = groupBy(filtered, 'company');
  const byDepartment = groupBy(filtered, 'department');

  // Counts by Position
  const positionCounts = Object.entries(
    filtered.reduce((acc, e) => {
      const pos = e.designation_org_chart || 'Unknown';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  const summaryCardsHTML = categoryCards.map(card => `
    <div class="summary-card">
      <div class="card-title">${card.title}</div>
      ${card.stats.map(s => `<div class="stat-row"><span>${s.label}</span><span class="stat-val">${s.value}</span></div>`).join('')}
    </div>
  `).join('');

  const positionCountsHTML = positionCounts.map(([pos, count], i) => `
    <tr>
      <td style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'}">${pos}</td>
      <td style="background:${i % 2 === 0 ? '#fff' : '#f8fafc'};text-align:right;font-weight:600">${count}</td>
    </tr>
  `).join('');

  const personnelTableRows = (rows) => rows.map((e, i) => {
    const rlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    const pid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    const rlicShort = rlic === 'VALID RLIC PASS' ? 'Valid' : rlic === 'EXPIRED RLIC PASS' ? 'Expired' : rlic === 'SOON TO EXPIRE' ? 'Soon' : rlic === 'NO RLIC PASS' ? 'No Pass' : rlic || '—';
    const pidShort = pid === 'VALID PID PASS' ? 'Valid' : pid === 'EXPIRED PID PASS' ? 'Expired' : pid === 'SOON TO EXPIRE' ? 'Soon' : pid === 'NO PID PASS' ? 'No Pass' : pid || '—';
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    return `<tr>
      <td style="background:${bg}">${e.name}</td>
      <td style="background:${bg}">${e.company || '—'}</td>
      <td style="background:${bg}">${e.designation_org_chart || '—'}</td>
      <td style="background:${bg}">${e.ftw_result || '—'}</td>
      <td style="background:${bg}">${rlicShort}</td>
      <td style="background:${bg}">${pidShort}</td>
      <td style="background:${bg}">${e.training_status || '—'}</td>
    </tr>`;
  }).join('');

  const tableHeader = `<thead><tr>
    <th>Name</th><th>Company</th><th>Position</th><th>Medical</th><th>RLIC</th><th>PID</th><th>Training</th>
  </tr></thead>`;

  const byCompanyHTML = Object.entries(byCompany).sort((a,b) => b[1].length - a[1].length).map(([company, rows]) => `
    <h3>${company} (${rows.length})</h3>
    <table>${tableHeader}<tbody>${personnelTableRows(rows)}</tbody></table>
  `).join('');

  const byDeptHTML = Object.entries(byDepartment).sort((a,b) => b[1].length - a[1].length).map(([dept, rows]) => `
    <h3>${dept} (${rows.length})</h3>
    <table>${tableHeader}<tbody>${personnelTableRows(rows)}</tbody></table>
  `).join('');

  return `
    <div class="wrap">
      <h1>GSO Qatar — Workforce Status Report</h1>
      <div class="meta">Generated: ${today} &nbsp;|&nbsp; Total Personnel: <strong>${filtered.length}</strong></div>

      <h2>Dashboard Summary</h2>
      <div class="summary-grid">${summaryCardsHTML}</div>

      <h2>Counts by Position</h2>
      <table>
        <thead><tr><th>Position / Designation</th><th style="text-align:right">Count</th></tr></thead>
        <tbody>${positionCountsHTML}</tbody>
      </table>

      <h2>Personnel by Company</h2>
      ${byCompanyHTML}

      <h2>Personnel by Department</h2>
      ${byDeptHTML}
    </div>
  `;
}

export default function DashboardReport({ filtered, categoryCards, onClose }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const reportHTML = buildReportHTML(filtered, categoryCards, today);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1100,height=800');
    win.document.write(`<!DOCTYPE html><html><head><title>GSO Qatar Workforce Report</title><style>${CSS}</style></head><body>${reportHTML}<script>setTimeout(() => window.print(), 300);<\/script></body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">Workforce Report Preview</h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>

        {/* Preview — uses same HTML as print */}
        <div className="overflow-auto p-2">
          <style>{CSS}</style>
          <div dangerouslySetInnerHTML={{ __html: reportHTML }} />
        </div>
      </div>
    </div>
  );
}