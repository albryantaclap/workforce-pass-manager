import React from 'react';
import { Button } from '@/components/ui/button';
import { X, Printer } from 'lucide-react';
import { computePassStatus, formatDate } from '@/utils/constants';
import { ALL_PERSONNEL_COLUMNS } from './ReportConfigModal';

// ── helpers ───────────────────────────────────────────────────────────────
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
const PIE_COLORS = ['#3b82f6','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#84cc16'];
const statColorMap = { 'text-green-600': '#16a34a', 'text-amber-600': '#d97706', 'text-red-600': '#dc2626', 'text-purple-600': '#9333ea', 'text-blue-600': '#2563eb', 'text-slate-500': '#64748b', 'text-slate-600': '#475569' };

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

function buildLocationPieHTML(locationCounts) {
  const locTotal = locationCounts.reduce((s, l) => s + l.count, 0);
  if (!locTotal) return '<p style="color:#94a3b8;font-size:10px">No data</p>';
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
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
    const result = { path, color: PIE_COLORS[i % PIE_COLORS.length], label: `${item.name} (${item.count})` };
    startAngle = endAngle;
    return result;
  });
  const svgSlices = slices.map(s => `<path d="${s.path}" fill="${s.color}" stroke="white" stroke-width="1.5"/>`).join('');
  const legendHTML = locationCounts.map((item, i) => `
    <div style="display:flex;align-items:center;gap:5px;margin-bottom:4px;font-size:9px">
      <div style="width:10px;height:10px;border-radius:2px;background:${PIE_COLORS[i % PIE_COLORS.length]};flex-shrink:0"></div>
      <span style="color:#475569">${item.name}</span>
      <span style="font-weight:700;color:#1e293b;margin-left:auto">${item.count}</span>
    </div>`).join('');
  return `
    <div style="display:flex;align-items:flex-start;gap:16px;flex-wrap:wrap">
      <svg width="160" height="160" viewBox="0 0 160 160">${svgSlices}</svg>
      <div style="flex:1;min-width:100px">${legendHTML}</div>
    </div>`;
}

// ── cell value resolver ───────────────────────────────────────────────────
function getCellValue(e, colId) {
  if (colId === 'rlic_status_computed') {
    const s = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    return s === 'VALID RLIC PASS' ? 'Valid' : s === 'EXPIRED RLIC PASS' ? 'Expired' : s === 'SOON TO EXPIRE' ? 'Soon' : s === 'NO RLIC PASS' ? 'No Pass' : s || '—';
  }
  if (colId === 'pid_status_computed') {
    const s = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    return s === 'VALID PID PASS' ? 'Valid' : s === 'EXPIRED PID PASS' ? 'Expired' : s === 'SOON TO EXPIRE' ? 'Soon' : s === 'NO PID PASS' ? 'No Pass' : s || '—';
  }
  if (colId === 'is_active') return e.is_active === false ? 'Inactive' : 'Active';
  if (colId === 'assigned_manager_name') return e.assigned_manager_name || '—';
  if (['gate_pass_issue_date','gate_pass_expiry','pid_expiry','pp_expiry'].includes(colId)) return e[colId] ? formatDate(e[colId]) : '—';
  return e[colId] || '—';
}

function getCellColor(e, colId) {
  if (colId === 'ftw_result') {
    if (e.ftw_result === 'ACCEPTED') return '#16a34a';
    if (e.ftw_result === 'REJECTED') return '#dc2626';
  }
  if (colId === 'rlic_status_computed') {
    const s = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    if (s === 'VALID RLIC PASS') return '#16a34a';
    if (s === 'EXPIRED RLIC PASS') return '#dc2626';
    if (s === 'SOON TO EXPIRE') return '#d97706';
  }
  if (colId === 'pid_status_computed') {
    const s = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    if (s === 'VALID PID PASS') return '#16a34a';
    if (s === 'EXPIRED PID PASS') return '#dc2626';
    if (s === 'SOON TO EXPIRE') return '#d97706';
  }
  if (colId === 'training_status' && e.training_status === 'DONE') return '#16a34a';
  return '#1e293b';
}

// ── Onboarding priority sort ──────────────────────────────────────────────
const _W_MED   = { 'ACCEPTED': 1, 'RE-ASSESS': 2, 'WAITING TR APPROVAL': 3, 'REJECTED': 5 };
const _W_GP    = { 'VALID RLIC PASS': 1, 'SOON TO EXPIRE': 2, 'UNDER PROCESS': 3, 'WAITING MOI APPROVAL': 4, 'DVC SENT': 5, 'HOLDING ACTIVE GP': 6, 'EXPIRED RLIC PASS': 7, 'NO RLIC PASS': 9 };
const _W_TRAIN = { 'DONE': 1, 'ON-GOING': 2, 'ONGOING': 2, 'ON GOING': 2, 'SCHEDULED': 3, 'NOT REQUIRED': 4, 'PENDING': 5 };
const _W_PID   = { 'VALID PID PASS': 1, 'SOON TO EXPIRE': 2, 'RENEWAL UNDER PROCESS': 3, 'EXPIRED PID PASS': 5, 'NO PID PASS': 6 };

function _wScore(emp) {
  const ftw    = (emp.ftw_result || '').trim().toUpperCase();
  const effGP  = (computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status) || '').toUpperCase();
  const effPID = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase();
  const train  = (emp.training_status || '').trim().toUpperCase();
  const medOk  = ftw === 'ACCEPTED';
  const gpOk   = effGP === 'VALID RLIC PASS' || effGP === 'SOON TO EXPIRE';
  const trainOk= train === 'DONE';
  const pidOk  = effPID === 'VALID PID PASS' || effPID === 'SOON TO EXPIRE';
  if (medOk && gpOk && trainOk && pidOk) return 4;
  if (medOk && gpOk && trainOk)          return 3;
  if (medOk && gpOk)                     return 2;
  if (medOk)                             return 1;
  return 0;
}

function _wSubRanks(emp) {
  const ftw    = (emp.ftw_result || '').trim().toUpperCase();
  const effGP  = (computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status) || '').toUpperCase();
  const rawGP  = (emp.rlic_status || '').trim().toUpperCase();
  const gpKey  = ['VALID RLIC PASS','SOON TO EXPIRE','EXPIRED RLIC PASS','NO RLIC PASS'].includes(effGP) ? effGP : rawGP;
  const train  = (emp.training_status || '').trim().toUpperCase();
  const effPID = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase();
  const rawPID = (emp.pid_status || '').trim().toUpperCase();
  const pidKey = ['VALID PID PASS','SOON TO EXPIRE','EXPIRED PID PASS','NO PID PASS'].includes(effPID) ? effPID : rawPID;
  return [_W_MED[ftw] ?? 4, _W_GP[gpKey] ?? 9, _W_TRAIN[train] ?? 9, _W_PID[pidKey] ?? 9];
}

const sortByOnboardingPriority = (rows) => [...rows].sort((a, b) => {
  const sa = _wScore(a), sb = _wScore(b);
  if (sb !== sa) return sb - sa;
  const ra = _wSubRanks(a), rb = _wSubRanks(b);
  for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i] - rb[i];
  return (a.name || '').localeCompare(b.name || '');
});

// ── HTML builder ──────────────────────────────────────────────────────────
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
  .summary-grid { display: flex; flex-wrap: nowrap; gap: 10px; margin-bottom: 20px; justify-content: center; align-items: stretch; }
  .summary-card { border: 2px solid #e2e8f0; border-radius: 8px; padding: 12px; flex: 1 1 0; min-width: 0; }
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

function buildReportHTML(filtered, categoryCards, today, companyFilter, config, selectedManagerIds, managers) {
  const { reportType, dashSections, grouping, selectedCols } = config;
  const showSummary = reportType !== 'personnel';
  const showPersonnel = reportType !== 'summary';

  // ── resolve ordered columns ──
  const colDefs = ALL_PERSONNEL_COLUMNS.filter(c => selectedCols.includes(c.id));

  // ── card icons / colors ──
  const cardIconEmojis = { 'Medical Data': '🩺', 'Gate Pass (RLIC)': '🛡️', 'Project ID': '🪪', 'Training': '🎓' };
  const cardBorderColors = { 'Medical Data': '#3b82f6', 'Gate Pass (RLIC)': '#10b981', 'Project ID': '#8b5cf6', 'Training': '#f97316' };
  const cardBgColors = { 'Medical Data': '#eff6ff', 'Gate Pass (RLIC)': '#ecfdf5', 'Project ID': '#f5f3ff', 'Training': '#fff7ed' };

  // ── summary cards HTML ──
  const SECTION_CARD_MAP = { medical: 'Medical Data', gatepass: 'Gate Pass (RLIC)', training: 'Training', projectid: 'Project ID' };
  let summaryCardsHTML = '';
  if (showSummary && dashSections.some(s => ['medical','gatepass','training','projectid'].includes(s))) {
    const includedCards = categoryCards.filter(card => {
      const secId = Object.keys(SECTION_CARD_MAP).find(k => SECTION_CARD_MAP[k] === card.title);
      return secId && dashSections.includes(secId);
    });
    if (includedCards.length) {
      summaryCardsHTML = `<h2>Dashboard Summary${companyFilter?.length > 0 ? ` — ${companyFilter.join(', ')}` : ''}</h2>
        <div class="summary-grid">
          ${includedCards.map(card => {
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
                ${card.overallTotal !== undefined ? `<div style="text-align:right;border-left:2px solid #e2e8f0;padding-left:10px"><div style="font-size:16px;font-weight:700;color:#94a3b8">${card.overallTotal}</div><div style="font-size:9px;color:#94a3b8">Overall Total</div></div>` : ''}
              </div>` : '';
            return `<div class="summary-card" style="border-color:${border}">
              <div class="card-header"><div class="card-icon" style="background:${bg}">${emoji}</div><span class="card-title">${card.title}</span></div>
              ${combinedHTML}${statsHTML}
            </div>`;
          }).join('')}
        </div>`;
    }
  }

  // ── charts / visual overview ──
  let chartsHTML = '';
  if (showSummary) {
    const byCompany = groupBy(filtered, 'company');
    const byDepartment = groupBy(filtered, 'department');
    const companyCounts = Object.entries(byCompany).map(([name, rows]) => ({ name, count: rows.length })).sort((a, b) => b.count - a.count);
    const deptCounts = Object.entries(byDepartment).map(([name, rows]) => ({ name, count: rows.length })).sort((a, b) => b.count - a.count);
    const positionCounts = Object.entries(filtered.reduce((acc, e) => {
      const p = e.designation_org_chart || 'Unknown';
      if (!acc[p]) acc[p] = { tl: 0, md: 0, gp: 0, tr: 0, pd: 0 };
      acc[p].tl++;
      if ((e.ftw_result || '').trim().toUpperCase() === 'ACCEPTED') acc[p].md++;
      const gpS = (computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status) || '').toUpperCase();
      if (gpS === 'VALID RLIC PASS' || gpS === 'SOON TO EXPIRE') acc[p].gp++;
      if ((e.training_status || '').trim().toUpperCase() === 'DONE') acc[p].tr++;
      const pdS = (computePassStatus(e.pid_expiry, 'pid', e.pid_status) || '').toUpperCase();
      if (pdS === 'VALID PID PASS' || pdS === 'SOON TO EXPIRE') acc[p].pd++;
      return acc;
    }, {})).sort((a, b) => b[1].tl - a[1].tl).map(([name, stats]) => ({ name, ...stats }));
    const DIRINDIR_SET = new Set(['DIR','INDIR']);
    const locationCounts = Object.entries(filtered.reduce((acc, e) => { const loc = (e.current_location || 'Unknown').trim().toUpperCase(); if (DIRINDIR_SET.has(loc)) return acc; const d = e.current_location ? e.current_location.trim() : 'Unknown'; acc[d] = (acc[d] || 0) + 1; return acc; }, {})).sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count }));
    const statusOverview = [
      { label: 'RLIC Valid', count: filtered.filter(e => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status) === 'VALID RLIC PASS').length },
      { label: 'RLIC Expired', count: filtered.filter(e => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status) === 'EXPIRED RLIC PASS').length },
      { label: 'PID Valid', count: filtered.filter(e => computePassStatus(e.pid_expiry, 'pid', e.pid_status) === 'VALID PID PASS').length },
      { label: 'PID Expired', count: filtered.filter(e => computePassStatus(e.pid_expiry, 'pid', e.pid_status) === 'EXPIRED PID PASS').length },
      { label: 'Medical OK', count: filtered.filter(e => e.ftw_result === 'ACCEPTED').length },
      { label: 'Training Done', count: filtered.filter(e => e.training_status === 'DONE').length },
    ];
    const dirCount = filtered.filter(e => (e.dir_indir || '').trim().toUpperCase() === 'DIR').length;
    const indirCount = filtered.filter(e => (e.dir_indir || '').trim().toUpperCase() === 'INDIR').length;
    const statusColorFn = (label) => label.includes('Valid') || label.includes('Medical OK') || label.includes('Training Done') ? '#10b981' : label.includes('Expired') ? '#ef4444' : '#f59e0b';

    const sectionBoxes = [];

    if (dashSections.includes('company_headcount')) {
      const companyStats = Object.entries(byCompany).map(([name, rows]) => {
        const tl = rows.length;
        const md = rows.filter(e => (e.ftw_result || '').trim().toUpperCase() === 'ACCEPTED').length;
        const gp = rows.filter(e => { const s = (computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status) || '').toUpperCase(); return s === 'VALID RLIC PASS' || s === 'SOON TO EXPIRE'; }).length;
        const tr = rows.filter(e => (e.training_status || '').trim().toUpperCase() === 'DONE').length;
        const pd = rows.filter(e => { const s = (computePassStatus(e.pid_expiry, 'pid', e.pid_status) || '').toUpperCase(); return s === 'VALID PID PASS' || s === 'SOON TO EXPIRE'; }).length;
        return { name, tl, md, gp, tr, pd };
      }).sort((a, b) => b.tl - a.tl);
      const maxCoTL = Math.max(...companyStats.map(c => c.tl), 1);
      const coHdrRow = `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0">
        <div style="width:130px;flex-shrink:0"></div>
        <div style="flex:1"></div>
        <div style="display:flex;gap:0;width:144px;flex-shrink:0">
          <div style="width:36px;text-align:center;font-size:8px;font-weight:700;color:#475569">TOTAL</div>
          <div style="width:27px;text-align:center;font-size:8px;font-weight:700;color:#3b82f6">MD</div>
          <div style="width:27px;text-align:center;font-size:8px;font-weight:700;color:#10b981">GP</div>
          <div style="width:27px;text-align:center;font-size:8px;font-weight:700;color:#f97316">TR</div>
          <div style="width:27px;text-align:center;font-size:8px;font-weight:700;color:#8b5cf6">PD</div>
        </div>
      </div>`;
      const coRows = companyStats.map((c, i) => {
        const pct = Math.max(2, Math.round((c.tl / maxCoTL) * 100));
        const color = PALETTE[i % PALETTE.length];
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
          <div style="width:130px;font-size:9px;color:#475569;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${c.name}">${c.name}</div>
          <div style="flex:1;background:#f1f5f9;border-radius:3px;height:14px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:3px;min-width:2px"></div>
          </div>
          <div style="display:flex;gap:0;width:144px;flex-shrink:0">
            <div style="width:36px;text-align:center;font-size:14px;font-weight:700;color:#1e293b">${c.tl}</div>
            <div style="width:27px;text-align:center;font-size:14px;font-weight:600;color:#2563eb">${c.md}</div>
            <div style="width:27px;text-align:center;font-size:14px;font-weight:600;color:#059669">${c.gp}</div>
            <div style="width:27px;text-align:center;font-size:14px;font-weight:600;color:#ea580c">${c.tr}</div>
            <div style="width:27px;text-align:center;font-size:14px;font-weight:600;color:#7c3aed">${c.pd}</div>
          </div>
        </div>`;
      }).join('');
      sectionBoxes.push(`<div class="chart-box"><div class="chart-title">📊 Headcount by Company</div>${coHdrRow}${coRows}</div>`);
    }
    if (dashSections.includes('location_summary')) sectionBoxes.push(`<div class="chart-box"><div class="chart-title">📍 Location / Mobilized</div>${buildLocationPieHTML(locationCounts)}</div>`);
    if (dashSections.includes('status_overview')) sectionBoxes.push(`<div class="chart-box"><div class="chart-title">📈 Pass & Status Overview</div>${buildBarChartHTML(statusOverview, Math.max(...statusOverview.map(c=>c.count),1), statusColorFn)}</div>`);
    if (dashSections.includes('department_summary')) sectionBoxes.push(`<div class="chart-box"><div class="chart-title">🏗️ Personnel by Department</div>${buildBarChartHTML(deptCounts, Math.max(...deptCounts.map(c=>c.count),1), null)}</div>`);
    if (dashSections.includes('position_summary')) {
      const maxTL = Math.max(...positionCounts.map(p => p.tl), 1);
      const posHalfL = positionCounts.slice(0, Math.ceil(positionCounts.length / 2));
      const posHalfR = positionCounts.slice(Math.ceil(positionCounts.length / 2));
      const colHdrCell = `<div style="display:flex;align-items:center;gap:6px;padding-bottom:4px;border-bottom:1px solid #e2e8f0">
        <div style="width:130px;flex-shrink:0"></div>
        <div style="flex:1"></div>
        <div style="display:flex;gap:0;width:144px;flex-shrink:0">
          <div style="width:36px;text-align:center;font-size:8px;font-weight:700;color:#475569">TOTAL</div>
          <div style="width:27px;text-align:center;font-size:8px;font-weight:700;color:#3b82f6">MD</div>
          <div style="width:27px;text-align:center;font-size:8px;font-weight:700;color:#10b981">GP</div>
          <div style="width:27px;text-align:center;font-size:8px;font-weight:700;color:#f97316">TR</div>
          <div style="width:27px;text-align:center;font-size:8px;font-weight:700;color:#8b5cf6">PD</div>
        </div>
      </div>`;
      const globalHdr = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 32px;margin-bottom:6px">${colHdrCell}${colHdrCell}</div>`;
      const buildPosRows = (items) => items.map(p => {
        const pct = Math.max(2, Math.round((p.tl / maxTL) * 100));
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
          <div style="width:130px;font-size:9px;color:#475569;text-align:right;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.name}">${p.name}</div>
          <div style="flex:1;background:#f1f5f9;border-radius:3px;height:12px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:#3b82f6;border-radius:3px;min-width:2px"></div>
          </div>
          <div style="display:flex;gap:0;width:144px;flex-shrink:0">
            <div style="width:36px;text-align:center;font-size:14px;font-weight:700;color:#1e293b">${p.tl}</div>
            <div style="width:27px;text-align:center;font-size:14px;font-weight:600;color:#2563eb">${p.md}</div>
            <div style="width:27px;text-align:center;font-size:14px;font-weight:600;color:#059669">${p.gp}</div>
            <div style="width:27px;text-align:center;font-size:14px;font-weight:600;color:#ea580c">${p.tr}</div>
            <div style="width:27px;text-align:center;font-size:14px;font-weight:600;color:#7c3aed">${p.pd}</div>
          </div>
        </div>`;
      }).join('');
      sectionBoxes.push(`<div class="chart-box" style="grid-column:1/-1"><div class="chart-title">👤 Counts by Position</div>${globalHdr}<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 32px">${buildPosRows(posHalfL)}${buildPosRows(posHalfR)}</div></div>`);
    }
    if (dashSections.includes('dirindir')) sectionBoxes.push(`<div class="chart-box"><div class="chart-title">↔️ DIR / INDIR Summary</div>
      <div style="display:flex;gap:12px;padding:8px 0">
        <div style="flex:1;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:12px;text-align:center"><div style="font-size:9px;color:#3b82f6;font-weight:600;margin-bottom:4px">DIR</div><div style="font-size:22px;font-weight:800;color:#1d4ed8">${dirCount}</div></div>
        <div style="flex:1;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:6px;padding:12px;text-align:center"><div style="font-size:9px;color:#475569;font-weight:600;margin-bottom:4px">INDIR</div><div style="font-size:22px;font-weight:800;color:#334155">${indirCount}</div></div>
      </div></div>`);

    if (sectionBoxes.length) chartsHTML = `<h2>Visual Overview</h2><div class="charts-2col">${sectionBoxes.join('')}</div>`;
  }

  // ── personnel table builder ──
  let personnelHTML = '';
  if (showPersonnel && colDefs.length > 0) {
    const headerCells = `<tr><th style="width:32px;text-align:center">#</th>${colDefs.map(c => `<th>${c.label}</th>`).join('')}</tr>`;
    const thead = `<thead>${headerCells}</thead>`;

    const buildRows = (rows) => sortByOnboardingPriority(rows).map((e, i) => {
      const bg = i % 2 === 0 ? '#fff' : '#f8fafc';
      const cells = colDefs.map(c => {
        const val = getCellValue(e, c.id);
        const color = getCellColor(e, c.id);
        return `<td style="background:${bg};color:${color}">${val}</td>`;
      }).join('');
      return `<tr><td style="background:${bg};text-align:center;color:#94a3b8;font-size:9px">${i + 1}</td>${cells}</tr>`;
    }).join('');

    if (grouping === 'company') {
      const byCompany = groupBy(filtered, 'company');
      personnelHTML = `<h2>Personnel by Company</h2>` +
        Object.entries(byCompany).sort((a, b) => b[1].length - a[1].length).map(([co, rows]) =>
          `<h3>${co} (${rows.length})</h3><table>${thead}<tbody>${buildRows(rows)}</tbody></table>`
        ).join('');
    } else if (grouping === 'department') {
      const byDept = groupBy(filtered, 'department');
      personnelHTML = `<h2>Personnel by Department</h2>` +
        Object.entries(byDept).sort((a, b) => b[1].length - a[1].length).map(([dept, rows]) =>
          `<h3>${dept} (${rows.length})</h3><table>${thead}<tbody>${buildRows(rows)}</tbody></table>`
        ).join('');
    } else if (grouping === 'position') {
      const byPos = groupBy(filtered, 'designation_org_chart');
      personnelHTML = `<h2>Personnel by Position</h2>` +
        Object.entries(byPos).sort((a, b) => b[1].length - a[1].length).map(([pos, rows]) =>
          `<h3>${pos} (${rows.length})</h3><table>${thead}<tbody>${buildRows(rows)}</tbody></table>`
        ).join('');
    } else {
      personnelHTML = `<h2>All Personnel (${filtered.length})</h2><table>${thead}<tbody>${buildRows(filtered)}</tbody></table>`;
    }
  }

  // ── manager header ──
  let managerHeaderHTML = '';
  if (!selectedManagerIds || selectedManagerIds.length === 0) {
    managerHeaderHTML = `<div style="text-align:right;font-size:10px;color:#475569;margin-bottom:4px"><span style="font-weight:600">Manager:</span> All Managers</div>`;
  } else {
    const managerNames = selectedManagerIds.map(id => {
      const m = (managers || []).find(m => m.id === id);
      return m ? m.label.toUpperCase() : id;
    });
    if (managerNames.length === 1) {
      managerHeaderHTML = `<div style="text-align:right;font-size:10px;color:#475569;margin-bottom:4px"><span style="font-weight:600">Manager:</span> ${managerNames[0]}</div>`;
    } else {
      managerHeaderHTML = `<div style="text-align:right;font-size:10px;color:#475569;margin-bottom:4px"><span style="font-weight:600">Managers:</span> ${managerNames.join(', ')}</div>`;
    }
  }

  return `
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2px">
        <h1>GSO Qatar — Workforce Status Report</h1>
        ${managerHeaderHTML}
      </div>
      <div class="meta">Generated: ${today} &nbsp;|&nbsp; Total Personnel: <strong>${filtered.length}</strong></div>
      ${summaryCardsHTML}
      ${chartsHTML}
      ${personnelHTML}
    </div>`;
}

// ── component ─────────────────────────────────────────────────────────────
export default function DashboardReport({ filtered, categoryCards, onClose, companyFilter, config, selectedManagerIds, managers }) {
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const reportHTML = buildReportHTML(filtered, categoryCards, today, companyFilter, config, selectedManagerIds, managers);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1100,height=800');
    win.document.write(`<!DOCTYPE html><html><head><title>GSO Qatar Workforce Report</title><style>${CSS}</style></head><body>${reportHTML}<script>setTimeout(() => window.print(), 300);<\/script></body></html>`);
    win.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="text-lg font-bold">Workforce Report Preview</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{filtered.length} personnel · {config.reportType === 'combined' ? 'Combined' : config.reportType === 'summary' ? 'Summary Only' : 'Personnel Only'}</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>
        <div className="overflow-auto p-2">
          <style>{CSS}</style>
          <div dangerouslySetInnerHTML={{ __html: reportHTML }} />
        </div>
      </div>
    </div>
  );
}