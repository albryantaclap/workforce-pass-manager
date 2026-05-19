import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Printer } from 'lucide-react';
import { computePassStatus } from '@/utils/constants';

// Normalize department names so variants like "STEEL STRUCTURE" and "Steel Structure" merge into one group
function normalizeDept(val) {
  if (!val) return 'Unknown';
  const upper = val.trim().toUpperCase();
  if (upper === 'STEEL STRUCTURE') return 'Steel Structure';
  return val.trim();
}

function groupBy(arr, key) {
  return arr.reduce((acc, item) => {
    const raw = item[key];
    const k = key === 'department' ? normalizeDept(raw) : (raw || 'Unknown');
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {});
}

const PALETTE = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16','#ec4899','#14b8a6'];
const STATUS_COLORS = { 'Valid': '#10b981', 'Soon': '#f59e0b', 'Expired': '#ef4444', 'No Pass': '#94a3b8', 'Accepted': '#10b981', 'Waiting TR Approval': '#f59e0b', 'Rejected': '#ef4444', 'Re-Assess': '#8b5cf6', 'Done': '#10b981', 'N/A': '#94a3b8' };

function buildBarChartHTML(items, maxCount, colorFn) {
  if (!items.length) return '<p style="color:#94a3b8;font-size:10px">No data</p>';
  return items.map((item, i) => {
    const pct = maxCount > 0 ? Math.max(2, Math.round((item.count / maxCount) * 100)) : 2;
    const color = colorFn ? colorFn(item.label || item.name, i) : PALETTE[i % PALETTE.length];
    return `
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
        <div style="width:130px;font-size:9px;color:#475569;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${item.label || item.name}">${item.label || item.name}</div>
        <div style="flex:1;background:#f1f5f9;border-radius:3px;height:14px;overflow:hidden">
          <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;min-width:2px"></div>
        </div>
        <div style="width:28px;font-size:9px;font-weight:700;color:#1e293b;text-align:left;flex-shrink:0">${item.count}</div>
      </div>`;
  }).join('');
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
  .summary-card { border: 2px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .card-icon { width: 28px; height: 28px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
  .card-title { font-size: 10px; font-weight: 700; color: #475569; }
  .stat-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; padding: 3px 0; border-bottom: 1px solid #f1f5f9; }
  .stat-row:last-child { border-bottom: none; }
  .stat-val { font-weight: 700; font-size: 12px; }
  .charts-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
  .chart-box { border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; }
  .chart-title { font-size: 11px; font-weight: 700; color: #334155; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #e2e8f0; }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    h2 { page-break-before: auto; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
    .chart-box { break-inside: avoid; }
    .summary-card { break-inside: avoid; }
  }
`;

function buildReportHTML(filtered, categoryCards, today, companyFilter) {
  const byCompany = groupBy(filtered, 'company');
  const byDepartment = groupBy(filtered, 'department');

  // Company counts
  const companyCounts = Object.entries(byCompany)
    .map(([name, rows]) => ({ name, count: rows.length }))
    .sort((a, b) => b.count - a.count);

  // Department counts
  const deptCounts = Object.entries(byDepartment)
    .map(([name, rows]) => ({ name, count: rows.length }))
    .sort((a, b) => b.count - a.count);

  // Position counts
  const positionCounts = Object.entries(
    filtered.reduce((acc, e) => {
      const pos = e.designation_org_chart || 'Unknown';
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

  // Status overview
  const getRlic = e => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  const getPid = e => computePassStatus(e.pid_expiry, 'pid', e.pid_status);
  const statusOverview = [
    { label: 'RLIC Valid', count: filtered.filter(e => getRlic(e) === 'VALID RLIC PASS').length },
    { label: 'RLIC Expired', count: filtered.filter(e => getRlic(e) === 'EXPIRED RLIC PASS').length },
    { label: 'PID Valid', count: filtered.filter(e => getPid(e) === 'VALID PID PASS').length },
    { label: 'PID Expired', count: filtered.filter(e => getPid(e) === 'EXPIRED PID PASS').length },
    { label: 'Medical OK', count: filtered.filter(e => e.ftw_result === 'ACCEPTED').length },
    { label: 'Training Done', count: filtered.filter(e => e.training_status === 'DONE').length },
  ];

  const cardIconEmojis = { 'Medical Data': '🩺', 'Gate Pass (RLIC)': '🛡️', 'Project ID': '🪪', 'Training': '🎓' };
  const cardBorderColors = { 'Medical Data': '#3b82f6', 'Gate Pass (RLIC)': '#10b981', 'Project ID': '#8b5cf6', 'Training': '#f97316' };
  const cardBgColors = { 'Medical Data': '#eff6ff', 'Gate Pass (RLIC)': '#ecfdf5', 'Project ID': '#f5f3ff', 'Training': '#fff7ed' };
  const statColorMap = { 'text-green-600': '#16a34a', 'text-amber-600': '#d97706', 'text-red-600': '#dc2626', 'text-purple-600': '#9333ea', 'text-blue-600': '#2563eb', 'text-slate-500': '#64748b' };

  const summaryCardsHTML = categoryCards.map(card => {
    const border = cardBorderColors[card.title] || '#e2e8f0';
    const bg = cardBgColors[card.title] || '#f8fafc';
    const emoji = cardIconEmojis[card.title] || '📋';
    const statsHTML = card.stats.map(s => {
      const color = statColorMap[s.color] || '#1e293b';
      return `<div class="stat-row"><span style="color:#64748b">${s.label}</span><span class="stat-val" style="color:${color}">${s.value}</span></div>`;
    }).join('');
    const combinedHTML = card.combined !== undefined ? `
      <div style="display:flex;justify-content:flex-end;align-items:flex-end;gap:10px;margin-bottom:8px">
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:800;color:${border}">${card.combined}</div>
          <div style="font-size:9px;color:#94a3b8">${card.combinedLabel}</div>
        </div>
        ${card.overallTotal !== undefined ? `
        <div style="text-align:right;border-left:2px solid #e2e8f0;padding-left:10px">
          <div style="font-size:16px;font-weight:700;color:#94a3b8">${card.overallTotal}</div>
          <div style="font-size:9px;color:#94a3b8">Overall Total</div>
        </div>` : ''}
      </div>` : '';
    return `
      <div class="summary-card" style="border-color:${border}">
        <div class="card-header">
          <div class="card-icon" style="background:${bg}">${emoji}</div>
          <span class="card-title">${card.title}</span>
        </div>
        ${combinedHTML}
        ${statsHTML}
      </div>`;
  }).join('');

  // Bar chart helpers
  const maxCompany = Math.max(...companyCounts.map(c => c.count), 1);
  const maxDept = Math.max(...deptCounts.map(c => c.count), 1);
  const maxPos = Math.max(...positionCounts.map(c => c.count), 1);
  const maxStatus = Math.max(...statusOverview.map(c => c.count), 1);
  const statusColorFn = (label) => {
    if (label.includes('Valid') || label.includes('Medical OK') || label.includes('Training Done')) return '#10b981';
    if (label.includes('Expired')) return '#ef4444';
    return '#f59e0b';
  };

  // DIR / INDIR counts
  const dirCount = filtered.filter(e => (e.dir_indir || '').trim().toUpperCase() === 'DIR').length;
  const indirCount = filtered.filter(e => (e.dir_indir || '').trim().toUpperCase() === 'INDIR').length;

  // Location / Mobilized counts
  const locationCounts = Object.entries(
    filtered.reduce((acc, e) => {
      const loc = e.current_location || 'Unknown';
      acc[loc] = (acc[loc] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));

  const companyBarHTML = buildBarChartHTML(companyCounts, maxCompany, null);
  const deptBarHTML = buildBarChartHTML(deptCounts, maxDept, null);
  const posBarHTML = buildBarChartHTML(positionCounts, maxPos, null);
  const statusBarHTML = buildBarChartHTML(statusOverview, maxStatus, (label) => statusColorFn(label));

  // Location pie chart as SVG
  const locTotal = locationCounts.reduce((s, l) => s + l.count, 0);
  const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];
  let locationPieHTML = '';
  if (locationCounts.length > 0 && locTotal > 0) {
    const cx = 80, cy = 80, r = 70;
    let startAngle = -Math.PI / 2;
    const slices = locationCounts.map((item, i) => {
      const angle = (item.count / locTotal) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const endAngle = startAngle + angle;
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const large = angle > Math.PI ? 1 : 0;
      const midAngle = startAngle + angle / 2;
      const lx = cx + (r + 18) * Math.cos(midAngle);
      const ly = cy + (r + 18) * Math.sin(midAngle);
      const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
      const result = { path, color: PIE_COLORS[i % PIE_COLORS.length], lx, ly, label: `${item.name} (${item.count})` };
      startAngle = endAngle;
      return result;
    });
    const svgSlices = slices.map(s => `<path d="${s.path}" fill="${s.color}" stroke="white" stroke-width="1.5"/>`).join('');
    const svgLabels = slices.filter(s => s.label).map(s => `<text x="${s.lx}" y="${s.ly}" font-size="7" fill="#334155" text-anchor="middle" dominant-baseline="middle">${s.label}</text>`).join('');
    const legendHTML = locationCounts.map((item, i) => `
      <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;font-size:9px">
        <div style="width:10px;height:10px;border-radius:2px;background:${PIE_COLORS[i % PIE_COLORS.length]};flex-shrink:0"></div>
        <span style="color:#475569">${item.name}</span>
        <span style="font-weight:700;color:#1e293b;margin-left:auto">${item.count}</span>
      </div>`).join('');
    const dirIndirHTML = `
      <div style="display:flex;gap:8px;margin-top:10px;padding-top:8px;border-top:1px solid #e2e8f0">
        <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:6px 10px;text-align:center">
          <div style="font-size:9px;color:#3b82f6;font-weight:600;margin-bottom:2px">DIR</div>
          <div style="font-size:16px;font-weight:800;color:#1d4ed8">${dirCount}</div>
        </div>
        <div style="flex:1;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:6px 10px;text-align:center">
          <div style="font-size:9px;color:#475569;font-weight:600;margin-bottom:2px">INDIR</div>
          <div style="font-size:16px;font-weight:800;color:#334155">${indirCount}</div>
        </div>
        <div style="flex:1;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:6px 10px;text-align:center">
          <div style="font-size:9px;color:#16a34a;font-weight:600;margin-bottom:2px">TOTAL</div>
          <div style="font-size:16px;font-weight:800;color:#15803d">${filtered.length}</div>
        </div>
      </div>`;
    locationPieHTML = `
      <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
        <svg width="160" height="160" viewBox="0 0 160 160">${svgSlices}${svgLabels}</svg>
        <div style="flex:1;min-width:100px">
          ${legendHTML}
          ${dirIndirHTML}
        </div>
      </div>`;
  } else {
    locationPieHTML = '<p style="color:#94a3b8;font-size:10px">No data</p>';
  }

  const RLIC_SORT_ORDER = { 'VALID RLIC PASS': 0, 'SOON TO EXPIRE': 3, 'NO RLIC PASS': 2, 'EXPIRED RLIC PASS': 4 };
  const getRlicSortKey = (e) => {
    const status = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    // Custom statuses (e.g. "Under Process") → slot 1 (between Valid and No Pass)
    return RLIC_SORT_ORDER[status] !== undefined ? RLIC_SORT_ORDER[status] : 1;
  };

  const sortByRlic = (rows) => [...rows].sort((a, b) => getRlicSortKey(a) - getRlicSortKey(b));

  const personnelTableRows = (rows) => sortByRlic(rows).map((e, i) => {
    const rlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    const pid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    const rlicShort = rlic === 'VALID RLIC PASS' ? 'Valid' : rlic === 'EXPIRED RLIC PASS' ? 'Expired' : rlic === 'SOON TO EXPIRE' ? 'Soon' : rlic === 'NO RLIC PASS' ? 'No Pass' : rlic || '—';
    const pidShort = pid === 'VALID PID PASS' ? 'Valid' : pid === 'EXPIRED PID PASS' ? 'Expired' : pid === 'SOON TO EXPIRE' ? 'Soon' : pid === 'NO PID PASS' ? 'No Pass' : pid || '—';
    const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
    const rlicColor = rlicShort === 'Valid' ? '#16a34a' : rlicShort === 'Expired' ? '#dc2626' : rlicShort === 'Soon' ? '#d97706' : '#94a3b8';
    const pidColor = pidShort === 'Valid' ? '#16a34a' : pidShort === 'Expired' ? '#dc2626' : pidShort === 'Soon' ? '#d97706' : '#94a3b8';
    return `<tr>
      <td style="background:${bg};text-align:center;color:#94a3b8;font-size:9px">${i + 1}</td>
      <td style="background:${bg}">${e.name}</td>
      <td style="background:${bg};color:#64748b;font-size:9px">${e.qid_no || '—'}</td>
      <td style="background:${bg}">${e.company || '—'}</td>
      <td style="background:${bg}">${e.designation_org_chart || '—'}</td>
      <td style="background:${bg}">${e.department || '—'}</td>
      <td style="background:${bg};color:${e.ftw_result === 'ACCEPTED' ? '#16a34a' : e.ftw_result === 'REJECTED' ? '#dc2626' : '#1e293b'}">${e.ftw_result || '—'}</td>
      <td style="background:${bg};color:${rlicColor};font-weight:600">${rlicShort}</td>
      <td style="background:${bg};color:${e.training_status === 'DONE' ? '#16a34a' : '#1e293b'}">${e.training_status || '—'}</td>
      <td style="background:${bg};color:${pidColor};font-weight:600">${pidShort}</td>
    </tr>`;
  }).join('');

  const tableHeader = `<thead><tr>
    <th style="width:32px;text-align:center">#</th><th>Name</th><th>QID No.</th><th>Company</th><th>Position</th><th>Department</th><th>Medical</th><th>Gate Pass (RLIC)</th><th>Training</th><th>PID</th>
  </tr></thead>`;

  const byCompanyHTML = Object.entries(byCompany).sort((a, b) => b[1].length - a[1].length).map(([company, rows]) => `
    <h3>${company} (${rows.length})</h3>
    <table>${tableHeader}<tbody>${personnelTableRows(rows)}</tbody></table>
  `).join('');

  const byDeptHTML = Object.entries(byDepartment).sort((a, b) => b[1].length - a[1].length).map(([dept, rows]) => `
    <h3>${dept} (${rows.length})</h3>
    <table>${tableHeader}<tbody>${personnelTableRows(rows)}</tbody></table>
  `).join('');

  return `
    <div class="wrap">
      <h1>GSO Qatar — Workforce Status Report</h1>
      <div class="meta">Generated: ${today} &nbsp;|&nbsp; Total Personnel: <strong>${filtered.length}</strong></div>

      <h2>Dashboard Summary ${companyFilter && companyFilter.length > 0 ? `<span style="font-size:16px;font-weight:800;color:#7c3aed;margin-left:10px">(${companyFilter.join(', ')})</span>` : ''}</h2>
      <div class="summary-grid">${summaryCardsHTML}</div>

      <h2>Visual Overview</h2>
      <div class="charts-2col">
        <div class="chart-box">
          <div class="chart-title">📊 Headcount by Company</div>
          ${companyBarHTML}
        </div>
        <div class="chart-box">
          <div class="chart-title">📍 Location / Mobilized</div>
          ${locationPieHTML}
        </div>
        <div class="chart-box">
          <div class="chart-title">📈 Pass &amp; Status Overview</div>
          ${statusBarHTML}
        </div>
        <div class="chart-box">
          <div class="chart-title">🏗️ Personnel by Department</div>
          ${deptBarHTML}
        </div>
        <div class="chart-box" style="grid-column:1/-1">
          <div class="chart-title">👤 Counts by Position</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 24px">${posBarHTML}</div>
        </div>
      </div>

      <h2>Personnel by Company</h2>
      ${byCompanyHTML}

      <h2>Personnel by Department</h2>
      ${byDeptHTML}
    </div>
  `;
}

export default function DashboardReport({ filtered, categoryCards, onClose, companyFilter }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const reportHTML = buildReportHTML(filtered, categoryCards, today, companyFilter);

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

        {/* Preview — uses same HTML/CSS as print, guaranteed identical */}
        <div className="overflow-auto p-2">
          <style>{CSS}</style>
          <div dangerouslySetInnerHTML={{ __html: reportHTML }} />
        </div>
      </div>
    </div>
  );
}