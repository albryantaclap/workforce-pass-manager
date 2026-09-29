import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Printer, X, FileText, RefreshCw, Search, Download, SlidersHorizontal, ChevronDown } from 'lucide-react';
import { exportGatepassExcel } from '@/utils/exportGatepassExcel';
import { computePassStatus, COMPANIES, DEPARTMENTS, RLIC_STATUSES, PID_STATUSES, TRAINING_STATUSES, MEDICAL_RESULTS, normalizeDate } from '@/utils/constants';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/common/MultiSelect';
import OnboardingMonitoring from '@/components/projection/OnboardingMonitoring';
import ApprovedList from '@/components/projection/ApprovedList';
import { Card } from '@/components/ui/card';

// ── Manager helpers (assigned_manager_id is the single source of truth) ───────
const UNASSIGNED_MANAGER = '__UNASSIGNED__';

function buildManagerOptions(emps, empById) {
  const seen = new Map();
  let hasUnassigned = false;
  for (const e of emps) {
    if (e.assigned_manager_id) {
      if (!seen.has(e.assigned_manager_id)) {
        const mgr = empById.get(e.assigned_manager_id);
        seen.set(e.assigned_manager_id, mgr ? mgr.name : (e.assigned_manager_name || e.assigned_manager_id));
      }
    } else {
      hasUnassigned = true;
    }
  }
  const opts = [...seen.entries()]
    .map(([id, name]) => ({ value: id, label: name }))
    .sort((a, b) => a.label.localeCompare(b.label));
  if (hasUnassigned) opts.push({ value: UNASSIGNED_MANAGER, label: 'Unassigned' });
  return opts;
}

function buildCompanyManagers(emps, empById) {
  const map = {};
  for (const e of emps) {
    const co = (e.company || 'UNKNOWN').trim().toUpperCase();
    if (!map[co]) map[co] = new Set();
    let name = '';
    if (e.assigned_manager_id) {
      const mgr = empById.get(e.assigned_manager_id);
      name = mgr ? mgr.name : (e.assigned_manager_name || '');
    } else {
      name = e.assigned_manager_name || '';
    }
    if (name) map[co].add(name);
  }
  const out = {};
  for (const [co, set] of Object.entries(map)) {
    out[co] = set.size ? [...set].sort().join(', ').toUpperCase() : '—';
  }
  return out;
}

// ── Column structure ──────────────────────────────────────────────────────────
const ZERO_ROW = () => ({
  pendingMedical: 0, ftw: 0,
  gpUnder: 0, validGP: 0,
  trainingScheduled: 0, trainingOnGoing: 0, trainingDone: 0,
  pid: 0, camp: 0
});

function sumRows(rows) {
  const totals = ZERO_ROW();
  for (const r of Object.values(rows)) for (const k of Object.keys(totals)) totals[k] += r[k];
  return totals;
}

function c(v) { return v === 0 ? '' : v; }

// ── Business logic: compute counts per employee ───────────────────────────────
const BUILT_IN_RLIC = new Set(['VALID RLIC PASS', 'EXPIRED RLIC PASS', 'SOON TO EXPIRE', 'NO RLIC PASS']);
const BUILT_IN_PID  = new Set(['VALID PID PASS',  'EXPIRED PID PASS',  'SOON TO EXPIRE', 'NO PID PASS']);

function getEmployeeCounts(emp) {
  const counts = ZERO_ROW();

  // =========================
  // MEDICAL
  // =========================
  const ftw = (emp.ftw_result || '')
    .trim()
    .toUpperCase();

  // FTW / APPROVED
  if (ftw === 'ACCEPTED') {
    counts.ftw = 1;
  }

  // Pending Medical
  // Waiting TR + Re-Assess + New ONLY
  if (
    ftw === 'WAITING TR APPROVAL' ||
    ftw === 'RE-ASSESS' ||
    !emp.ftw_result
  ) {
    counts.pendingMedical = 1;
  }

  // =========================
  // GATEPASS
  // =========================
  const effectiveRlic = computePassStatus(
    emp.gate_pass_expiry,
    'rlic',
    emp.rlic_status
  );

  const rawRlic = (emp.rlic_status || '')
    .trim()
    .toUpperCase();

  // GP UNDER PROCESS
  // Include:
  // UNDER PROCESS + DVC SENT
  if (
    rawRlic === 'UNDER PROCESS' ||
    rawRlic === 'DVC SENT'
  ) {
    counts.gpUnder = 1;
  }

  // VALID GATEPASS
  // Valid + Soon
  if (
    effectiveRlic === 'VALID RLIC PASS' ||
    effectiveRlic === 'SOON TO EXPIRE'
  ) {
    counts.validGP = 1;
  }

  // =========================
  // TRAINING
  // =========================
  const training = (emp.training_status || '')
    .trim()
    .toUpperCase();

  if (training === 'DONE') {
    counts.trainingDone = 1;
  }
  else if (
    training === 'ON-GOING' ||
    training === 'ONGOING' ||
    training === 'ON GOING'
  ) {
    counts.trainingOnGoing = 1;
  }
  else if (training === 'SCHEDULED') {
    counts.trainingScheduled = 1;
  }

  // =========================
  // PID
  // =========================
  const pidStatus = computePassStatus(
    emp.pid_expiry,
    'pid',
    emp.pid_status
  );

  if (
    pidStatus === 'VALID PID PASS' ||
    pidStatus === 'SOON TO EXPIRE'
  ) {
    counts.pid = 1;
  }

  // =========================
  // CAMP
  // =========================
  if (
    (emp.current_location || '')
      .trim()
      .toUpperCase() === 'COMO CAMP'
  ) {
    counts.camp = 1;
  }

  return counts;
}

// ── Build company data structure from live employees ─────────────────────────
function buildCompanyData(employees, companyFilter, extraFilters = {}) {
  const {
    positionFilter = [], departmentFilter = [], dirFilter = 'all',
    gpStatusFilter = [], medicalResultFilter = [], locationFilter = 'all',
    trainingStatusFilter = 'all',
    trainingScheduledFrom = '', trainingScheduledTo = '',
    medicalTrApprovedFrom = '', medicalTrApprovedTo = '',
    gpIssueFrom = '', gpIssueTo = '',
    gpReceivedFrom = '', gpReceivedTo = '',
    pidIssueFrom = '', pidIssueTo = '',
  } = extraFilters;

  const companyData = {};
  for (const emp of employees) {
    if (emp.is_active === false || emp.is_active === null) continue;
    const co = (emp.company || 'UNKNOWN').trim().toUpperCase();
    if (companyFilter !== 'ALL' && co !== companyFilter.toUpperCase()) continue;

    // Extra filters
    if (positionFilter.length > 0 && !positionFilter.includes(emp.designation_org_chart)) continue;
    if (departmentFilter.length > 0) {
      const empDept = (emp.department || '').trim().toLowerCase();
      const match = departmentFilter.some(d => d.trim().toLowerCase() === empDept);
      if (!match) continue;
    }
    if (dirFilter !== 'all') {
      const empDir = (emp.dir_indir || '').trim().toUpperCase();
      if (empDir !== dirFilter.toUpperCase()) continue;
    }
    if (locationFilter.length > 0) {
      const empLoc = (emp.current_location || '').trim().toUpperCase();
      if (!locationFilter.some(l => l.trim().toUpperCase() === empLoc)) continue;
    }
    if (trainingStatusFilter.length > 0) {
      const empTraining = (emp.training_status || '').trim().toUpperCase();
      if (!trainingStatusFilter.some(t => t.trim().toUpperCase() === empTraining)) continue;
    }

    const effectiveRlic = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
    if (gpStatusFilter.length > 0) {
      const empRlic = (effectiveRlic || '').trim().toUpperCase();
      const match = gpStatusFilter.some(s => s.trim().toUpperCase() === empRlic);
      if (!match) continue;
    }

    const ftwResult = (emp.ftw_result || '').trim().toUpperCase();
    if (medicalResultFilter.length > 0) {
      const matchesMed = medicalResultFilter.some(r => r.trim().toUpperCase() === ftwResult)
        || (medicalResultFilter.some(r => r.trim().toUpperCase() === 'NEW') && !emp.ftw_result);
      if (!matchesMed) continue;
    }

    // Date range filters
    const trainSched = emp.training_date_scheduled ? emp.training_date_scheduled.substring(0, 10) : '';
    if (trainingScheduledFrom && (!trainSched || trainSched < trainingScheduledFrom)) continue;
    if (trainingScheduledTo && (!trainSched || trainSched > trainingScheduledTo)) continue;

    const medApproved = emp.ftw_approved_date ? emp.ftw_approved_date.substring(0, 10) : '';
    if (medicalTrApprovedFrom && (!medApproved || medApproved < medicalTrApprovedFrom)) continue;
    if (medicalTrApprovedTo && (!medApproved || medApproved > medicalTrApprovedTo)) continue;

    const gpIssue = emp.gate_pass_issue_date ? emp.gate_pass_issue_date.substring(0, 10) : '';
    if (gpIssueFrom && (!gpIssue || gpIssue < gpIssueFrom)) continue;
    if (gpIssueTo && (!gpIssue || gpIssue > gpIssueTo)) continue;

    const gpReceived = emp.gate_pass_received_date ? emp.gate_pass_received_date.substring(0, 10) : '';
    if (gpReceivedFrom && (!gpReceived || gpReceived < gpReceivedFrom)) continue;
    if (gpReceivedTo && (!gpReceived || gpReceived > gpReceivedTo)) continue;

    const pidIssue = emp.pid_issue_date ? emp.pid_issue_date.substring(0, 10) : '';
    if (pidIssueFrom && (!pidIssue || pidIssue < pidIssueFrom)) continue;
    if (pidIssueTo && (!pidIssue || pidIssue > pidIssueTo)) continue;

    const desig = (emp.designation_org_chart || emp.position_application || 'UNSPECIFIED').trim().toUpperCase();
    if (!companyData[co]) companyData[co] = {};
    if (!companyData[co][desig]) companyData[co][desig] = ZERO_ROW();
    const counts = getEmployeeCounts(emp);
    for (const k of Object.keys(counts)) companyData[co][desig][k] += counts[k];
  }
  return companyData;
}

// ── CSS for preview / print ───────────────────────────────────────────────────
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: Arial, sans-serif; font-size: 10px; background: white; color: #1e293b; }
  .wrap { padding: 16px; }
  .report-title { text-align: center; font-size: 18px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
  .report-date { text-align: center; font-size: 14px; color: #475569; margin-bottom: 16px; }
  .company-block { margin-bottom: 24px; page-break-inside: avoid; margin-left: 0; margin-right: 0; padding-left: 0; padding-right: 0; display: block; overflow-x: visible; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 11px; margin: 0; padding: 0; box-sizing: border-box; }
  td { border: 1px solid black; padding: 3px 3px; text-align: center; word-break: break-word; font-size: 10px; }
  td.left { text-align: left; padding-left: 4px; }
  td.num { font-size: 12px; font-weight: 500; line-height: 1; padding: 3px 2px; }
  .hdr-company { background: #fde047; font-weight: 700; font-size: 14px; text-align: center; letter-spacing: 1px; padding: 4px 2px; }
  .hdr-company.grand { background: #1e293b; color: white; }
  .hdr-group { font-weight: 700; font-size: 9px; text-align: center; padding: 2px; }
  .g-medical  { background: #bfdbfe; }
  .g-gatepass { background: #bbf7d0; }
  .g-training { background: #fed7aa; }
  .g-pid      { background: #e9d5ff; }
  .g-camp     { background: #fce7f3; }
  .hdr-col { background: #f1f5f9; font-weight: 700; font-size: 8.5px; text-align: center; padding: 3px 2px; word-break: break-word; vertical-align: middle; }
  .c-medical  { background: #eff6ff; }
  .c-gatepass { background: #f0fdf4; }
  .c-training { background: #fff7ed; }
  .c-pid      { background: #faf5ff; }
  .c-camp     { background: #fdf2f8; }
  .row-total { background: #1e293b; color: white; font-weight: 700; }
  .grand-total-row { background: #1e293b; color: white; font-weight: 700; }
  @media print {
    @page { size: A3 landscape; margin: 5mm; }
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .company-block { page-break-inside: avoid; }
  }
`;

// ── Designation hierarchy for sorting ────────────────────────────────────────
// Each entry: [keyword, rank]. Lower rank = higher seniority.
// Keyword is checked as a substring of the designation (uppercase).
const DESIGNATION_KEYWORD_RANKS = [
  // Top management
  ['GENERAL MANAGER', 0],
  ['OPERATIONS MANAGER', 1],
  ['PROJECT MANAGER', 2],
  ['CONSTRUCTION MANAGER', 3],
  ['COMMERCIAL MANAGER', 4],
  ['DEPUTY MANAGER', 5],
  ['MANAGER', 6],
  // Engineers
  ['SENIOR ENGINEER', 10],
  ['LEAD ENGINEER', 10],
  ['PRINCIPAL ENGINEER', 10],
  ['ENGINEER', 11],
  // Supervisors / Foremen
  ['GENERAL FOREMAN', 20],
  ['SENIOR FOREMAN', 21],
  ['FOREMAN', 22],
  ['SUPERVISOR', 23],
  // Coordinators / Inspectors / Officers
  ['COORDINATOR', 30],
  ['INSPECTOR', 31],
  ['OFFICER', 32],
  ['PLANNER', 33],
  ['SCHEDULER', 34],
  ['ADMINISTRATOR', 35],
  ['ADMIN', 35],
  // Technicians
  ['SENIOR TECHNICIAN', 40],
  ['LEAD TECHNICIAN', 40],
  ['TECHNICIAN', 41],
  ['MECHANIC', 42],
  ['ELECTRICIAN', 43],
  ['WELDER', 44],
  ['FITTER', 45],
  ['RIGGER', 46],
  ['SCAFFOLDER', 47],
  ['PAINTER', 48],
  ['MASON', 49],
  ['CARPENTER', 50],
  ['PLUMBER', 51],
  ['BLASTER', 52],
  // Operators
  ['CRANE OPERATOR', 60],
  ['EQUIPMENT OPERATOR', 60],
  ['HEAVY EQUIPMENT', 60],
  ['OPERATOR', 61],
  // Drivers
  ['DRIVER', 70],
  // Safety / Fire / Security
  ['SAFETY OFFICER', 32],
  ['HSE OFFICER', 32],
  ['SHES OFFICER', 32],
  ['FIRE WATCHER', 75],
  ['SECURITY', 76],
  // General labor / helpers / unspecified
  ['HELPER', 80],
  ['LABOUR', 90],
  ['LABOR', 90],
  ['UNSPECIFIED', 99],
];

function getDesignationRank(desig) {
  const upper = desig.trim().toUpperCase();
  let bestRank = 95; // default for unknown
  for (const [keyword, rank] of DESIGNATION_KEYWORD_RANKS) {
    if (upper.includes(keyword)) {
      if (rank < bestRank) bestRank = rank;
    }
  }
  return bestRank;
}

function sortDesignations(designations) {
  return [...designations].sort((a, b) => {
    const rankA = getDesignationRank(a);
    const rankB = getDesignationRank(b);
    if (rankA !== rankB) return rankA - rankB;
    return a.localeCompare(b); // alphabetical tiebreak within same rank
  });
}

// ── Table HTML builder ────────────────────────────────────────────────────────
function buildCompanyTableHTML(company, rows, isGrand = false) {
  const designations = sortDesignations(Object.keys(rows));
  const totals = sumRows(rows);
  const hdrClass = isGrand ? 'hdr-company grand' : 'hdr-company';
  const dataRows = designations.map(d => `
    <tr>
      <td class="left">${d}</td>
      <td class="c-medical num">${c(rows[d].pendingMedical)}</td>
      <td class="c-medical num">${c(rows[d].ftw)}</td>
      <td class="c-gatepass num">${c(rows[d].gpUnder)}</td>
      <td class="c-gatepass num">${c(rows[d].validGP)}</td>
      <td class="c-training num">${c(rows[d].trainingScheduled)}</td>
      <td class="c-training num">${c(rows[d].trainingOnGoing)}</td>
      <td class="c-training num">${c(rows[d].trainingDone)}</td>
      <td class="c-pid num">${c(rows[d].pid)}</td>
      <td class="c-camp num">${c(rows[d].camp)}</td>
    </tr>`).join('');
  return `
    <div class="company-block">
      <table>
        <tbody>
          <tr><td colspan="12" class="${hdrClass}">${company}</td></tr>
          <tr>
            <td class="hdr-group"></td>
            <td colspan="2" class="hdr-group g-medical">MEDICAL</td>
            <td colspan="2" class="hdr-group g-gatepass">GATEPASS</td>
            <td colspan="3" class="hdr-group g-training">TRAINING</td>
            <td class="hdr-group g-pid">PID</td>
            <td class="hdr-group g-camp">CAMP</td>
          </tr>
          <tr>
            <td class="hdr-col left" style="width:18%">DESIGNATION</td>
            <td class="hdr-col c-medical" style="width:9%">PENDING MEDICAL</td>
            <td class="hdr-col c-medical" style="width:9%">FTW / APPROVED</td>
            <td class="hdr-col c-gatepass" style="width:9%">GP UNDER PROCESS</td>
            <td class="hdr-col c-gatepass" style="width:9%">VALID GATEPASS</td>
            <td class="hdr-col c-training" style="width:9%">SCHEDULED</td>
            <td class="hdr-col c-training" style="width:9%">ON-GOING</td>
            <td class="hdr-col c-training" style="width:9%">COMPLETED</td>
            <td class="hdr-col c-pid" style="width:9%">PID</td>
            <td class="hdr-col c-camp" style="width:9%">CAMP</td>
          </tr>
          ${dataRows}
          <tr class="grand-total-row">
            <td class="left">TOTAL</td>
            <td class="num">${c(totals.pendingMedical)}</td>
            <td class="num">${c(totals.ftw)}</td>
            <td class="num">${c(totals.gpUnder)}</td>
            <td class="num">${c(totals.validGP)}</td>
            <td class="num">${c(totals.trainingScheduled)}</td>
            <td class="num">${c(totals.trainingOnGoing)}</td>
            <td class="num">${c(totals.trainingDone)}</td>
            <td class="num">${c(totals.pid)}</td>
            <td class="num">${c(totals.camp)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}
function buildGrandTotalHTML(companyData, companyManagers = {}) {
  // Manager per company — sourced from personnel assigned_manager_id.
  const managerMap = companyManagers;

  // CATEGORY MAPPING
  const COMPANY_CATEGORIES = {
    'KM STEEL - MOSTAFA (GSO)': 'STEEL STRUCTURE',
    'QTRS - ALAVON (GSO)': 'CIVIL',
    'VMANES (GSO)': 'MECHANICAL & CIVIL',
    'GSO QATAR': '',
    'INTEGRATED (GSO)': 'STEEL STRUCTURE & CIVIL',
    'TEXON (GSO)': 'LOGISTICS',
    'SWAN GLOBAL (GSO)': 'PIPELINE',
    'GOOD HIRING': 'CIVIL',
    'GSO LOGISTICS': 'DRIVERS AND OPERATORS',
    'KHALED PROJECTS': 'DRIVERS AND OPERATORS',
    'AUTO XPERT': 'DRIVERS AND OPERATORS',
    'SIGEL (GSO)': 'MECHANICAL - PIPELINE',
    'CRYSTAL': 'MECHANICAL - PIPELINE',
    'ZEAL-IT': 'RIGGERS',
    'QSS': 'SECURITY',
    'INFINITY (GSO)': 'STEEL STRUCTURE & CIVIL',
    'WENMA': 'SCAFFOLDING',
    'MIR (GSO)': 'STEEL STRUCTURE',
    'AL JABER (GSO)': 'HEAVY LIFT',
    'AL-RAMSHA (GSO)': 'MECHANICAL - ROTARY',
    'METAL WORLD': 'MECHANICAL & STEEL STRUCTURE',
    'ALTHAF (GSO)': 'STEEL STRUCTURE',
    'ALTAF (GSO)': 'STEEL STRUCTURE',
    'ARKAN GULF (GSO)': 'ELECTRICAL (NEW)',
    'ANION': 'CATHODIC',
    'ENERSERVE (GSO)': 'MECHANICAL & ELECTRICAL',
    'LMV E AND I': 'ELECTRICAL',
    'MEGATRONICS (GSO)': 'STEEL STRUCTURE & ELECTRICAL',
    'NTC (GSO)': 'ELECTRICAL',
    'SEA QUEEN': 'MECHANICAL & INSTRUMENTATION',
    'ITELLIGENT': 'TELECOMMUNICATION',
  };

const companies = Object.keys(companyData).sort((a, b) => {
  const categoryA = COMPANY_CATEGORIES[a] || '';
  const categoryB = COMPANY_CATEGORIES[b] || '';
  const managerA = (managerMap[a] || '').toUpperCase();
  const managerB = (managerMap[b] || '').toUpperCase();

  // First sort by manager name A-Z, then by category
  const managerCompare = managerA.localeCompare(managerB);
  if (managerCompare !== 0) return managerCompare;
  return categoryA.localeCompare(categoryB);
});

  const grandTotal = ZERO_ROW();
  const companyTotals = {};

  for (const co of companies) {
    companyTotals[co] = sumRows(companyData[co]);

    for (const k of Object.keys(grandTotal)) {
      grandTotal[k] += companyTotals[co][k];
    }
  }

  const companyRows = companies.map((co, index) => `
    <tr>
      <td class="left">${co}</td>

      <!-- CATEGORY COLUMN -->
      <td class="left" style="white-space:nowrap; font-size:10px; padding: 3px 5px;">
        ${COMPANY_CATEGORIES[co] || ''}
      </td>

      <!-- MANAGER ASSIGNED COLUMN -->
      <td class="left">${(managerMap[co] || '—').toUpperCase()}</td>

      <td class="c-medical num">${c(companyTotals[co].pendingMedical)}</td>
      <td class="c-medical num">${c(companyTotals[co].ftw)}</td>

      <td class="c-gatepass num">${c(companyTotals[co].gpUnder)}</td>
      <td class="c-gatepass num">${c(companyTotals[co].validGP)}</td>

      <td class="c-training num">${c(companyTotals[co].trainingScheduled)}</td>
      <td class="c-training num">${c(companyTotals[co].trainingOnGoing)}</td>
      <td class="c-training num">${c(companyTotals[co].trainingDone)}</td>

      <td class="c-pid num">${c(companyTotals[co].pid)}</td>
      <td class="c-camp num">${c(companyTotals[co].camp)}</td>
    </tr>
  `).join('');

  return `
    <div class="company-block">
      <table>
        <tbody>

          <!-- TITLE -->
          <tr>
            <td colspan="12" class="hdr-company grand">
               GRAND TOTAL — ALL COMPANIES
              </td>
          </tr>

          <!-- GROUP HEADER -->
          <tr>
            <td class="hdr-group"></td>
            <td class="hdr-group"></td>
            <td class="hdr-group"></td>

            <td colspan="2" class="hdr-group g-medical">MEDICAL</td>

            <td colspan="2" class="hdr-group g-gatepass">GATEPASS</td>

            <td colspan="3" class="hdr-group g-training">TRAINING</td>

            <td class="hdr-group g-pid">PID</td>

            <td class="hdr-group g-camp">CAMP</td>
          </tr>

          <!-- COLUMN HEADER -->
          <tr>
            <td class="hdr-col left" style="width:18%">
              COMPANY
            </td>

            <td class="hdr-col left" style="width:20%">
              CATEGORY
            </td>

            <td class="hdr-col left" style="width:11%">
              MANAGER ASSIGNED
            </td>

            <td class="hdr-col c-medical" style="width:6%">PENDING MEDICAL</td>

            <td class="hdr-col c-medical" style="width:6%">FTW / APPROVED</td>

            <td class="hdr-col c-gatepass" style="width:6%">GP UNDER PROCESS</td>

            <td class="hdr-col c-gatepass" style="width:6%">VALID GATEPASS</td>

            <td class="hdr-col c-training" style="width:6%">SCHEDULED</td>

            <td class="hdr-col c-training" style="width:6%">ON-GOING</td>

            <td class="hdr-col c-training" style="width:6%">COMPLETED</td>

            <td class="hdr-col c-pid" style="width:4%">PID</td>

            <td class="hdr-col c-camp" style="width:4%">CAMP</td>
          </tr>

          ${companyRows}

          <!-- GRAND TOTAL -->
           <tr class="grand-total-row">

             <td class="left">GRAND TOTAL</td>

             <td></td>

             <td></td>

             <td class="num">${grandTotal.pendingMedical || ''}</td>

            <td class="num">${grandTotal.ftw || ''}</td>

            <td class="num">${grandTotal.gpUnder || ''}</td>

            <td class="num">${grandTotal.validGP || ''}</td>

            <td class="num">${grandTotal.trainingScheduled || ''}</td>

            <td class="num">${grandTotal.trainingOnGoing || ''}</td>

            <td class="num">${grandTotal.trainingDone || ''}</td>

            <td class="num">${grandTotal.pid || ''}</td>

            <td class="num">${grandTotal.camp || ''}</td>

          </tr>

        </tbody>
      </table>
    </div>
  `;
}

function buildReportHTML(companyData, displayDate, selectedCompany, companyManagers = {}) {
  const companies = Object.keys(companyData).sort();
  const grandHTML = selectedCompany === 'ALL' ? buildGrandTotalHTML(companyData, companyManagers) : '';
  const companyTablesHTML = companies.map(co => buildCompanyTableHTML(co, companyData[co])).join('');
  return `
    <div class="wrap">
      <div class="report-title">GATEPASS DAILY REPORT UPDATE — ${displayDate}</div>
      ${selectedCompany !== 'ALL' ? `<div class="report-date">Company: ${selectedCompany}</div>` : ''}
      ${grandHTML}
      ${companyTablesHTML}
    </div>`;
}

// ── Preview Modal ─────────────────────────────────────────────────────────────
function ReportPreviewModal({ reportHTML, displayDate, onClose }) {
  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1400,height=900');
    win.document.write(`<!DOCTYPE html><html><head><title>Reports ${displayDate}</title><style>${PRINT_CSS}</style></head><body>${reportHTML}<script>setTimeout(() => window.print(), 300);<\/script></body></html>`);
    win.document.close();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">Reports Preview</h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2"><Printer className="w-4 h-4" /> Print / Save PDF</Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>
        <div className="overflow-auto p-4">
          <style>{PRINT_CSS}</style>
          <div dangerouslySetInnerHTML={{ __html: reportHTML }} />
        </div>
      </div>
    </div>
  );
}

function InlineReport({ reportHTML }) {
  return (
    <div className="bg-white rounded-xl border shadow overflow-auto">
      <style>{PRINT_CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: reportHTML }} />
    </div>
  );
}

// ALL_COMPANIES is now derived dynamically from live employee data

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectionReport() {
  const [showPreview, setShowPreview] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(true);

  // ── Shared filters (Dashboard-equivalent) ────────────────────────────────
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [selectedManagers, setSelectedManagers] = useState([]);
  const [dirFilter, setDirFilter] = useState('');
  const [gpStatusFilter, setGpStatusFilter] = useState([]);
  const [trainingStatusFilter, setTrainingStatusFilter] = useState([]);
  const [pidStatusFilter, setPidStatusFilter] = useState([]);
  const [medicalResultFilter, setMedicalResultFilter] = useState([]);
  const [locationFilter, setLocationFilter] = useState([]);
  const [trainingScheduledFrom, setTrainingScheduledFrom] = useState('');
  const [trainingScheduledTo, setTrainingScheduledTo] = useState('');
  const [medicalTrApprovedFrom, setMedicalTrApprovedFrom] = useState('');
  const [medicalTrApprovedTo, setMedicalTrApprovedTo] = useState('');
  const [gpIssueFrom, setGpIssueFrom] = useState('');
  const [gpIssueTo, setGpIssueTo] = useState('');
  const [gpReceivedFrom, setGpReceivedFrom] = useState('');
  const [gpReceivedTo, setGpReceivedTo] = useState('');
  const [pidIssueFrom, setPidIssueFrom] = useState('');
  const [pidIssueTo, setPidIssueTo] = useState('');

  // Gatepass-tab-only: single company selector for the report (kept separately)
  const [selectedCompany, setSelectedCompany] = useState('ALL');

  const { data: employees = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 100000),
    refetchInterval: 15000,
    refetchOnWindowFocus: true,
    staleTime: 5000,
    gcTime: 1000 * 60 * 5,
    retry: 2,
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ['managerAssignments'],
    queryFn: () => base44.entities.ManagerAssignment.list(),
  });

  // Lookup queries (same as Dashboard)
  const { data: lookupCompanies = [] } = useQuery({ queryKey: ['lookups', 'company'], queryFn: () => base44.entities.Lookup.filter({ type: 'company' }) });
  const { data: lookupDepartments = [] } = useQuery({ queryKey: ['lookups', 'department'], queryFn: () => base44.entities.Lookup.filter({ type: 'department' }) });
  const { data: customRlicStatuses = [] } = useQuery({ queryKey: ['lookups', 'rlic_status'], queryFn: () => base44.entities.Lookup.filter({ type: 'rlic_status' }) });
  const { data: customPidStatuses = [] } = useQuery({ queryKey: ['lookups', 'pid_status'], queryFn: () => base44.entities.Lookup.filter({ type: 'pid_status' }) });
  const { data: customFtwResults = [] } = useQuery({ queryKey: ['lookups', 'ftw_result'], queryFn: () => base44.entities.Lookup.filter({ type: 'ftw_result' }) });
  const { data: customTrainingStatuses = [] } = useQuery({ queryKey: ['lookups', 'training_status'], queryFn: () => base44.entities.Lookup.filter({ type: 'training_status' }) });
  const { data: lookupLocations = [] } = useQuery({ queryKey: ['lookups', 'location'], queryFn: () => base44.entities.Lookup.filter({ type: 'location' }) });

  const today = format(new Date(), 'dd-MM-yyyy');

  // ── Manager source of truth: employee.assigned_manager_id ──
  const empById = useMemo(() => {
    const m = new Map();
    for (const e of employees) m.set(e.id, e);
    return m;
  }, [employees]);

  // Personnel filtered by everything EXCEPT the manager filter — used to build
  // the cascaded manager dropdown options (so they respect other active filters).
  const managerSourceEmployees = useMemo(() => {
    return employees.filter(e => {
      if (e.is_active === false) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = (e.name || '').toLowerCase().includes(q);
        const matchQid = (e.qid_no || '').toLowerCase().includes(q);
        const matchPp = (e.pp_no || '').toLowerCase().includes(q);
        const matchPid = (e.pid || '').toLowerCase().includes(q);
        if (!matchName && !matchQid && !matchPp && !matchPid) return false;
      }
      const empCo = (e.company || '').trim().toUpperCase();
      if (companyFilter.length > 0 && !companyFilter.some(cf => cf.trim().toUpperCase() === empCo)) return false;
      if (positionFilter.length > 0 && !positionFilter.includes(e.designation_org_chart)) return false;
      if (departmentFilter.length > 0 && !departmentFilter.includes(e.department)) return false;
      if (locationFilter.length > 0 && !locationFilter.includes(e.current_location)) return false;
      if (dirFilter && (e.dir_indir || '').trim().toUpperCase() !== dirFilter.toUpperCase()) return false;
      const effectiveRlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
      if (gpStatusFilter.length > 0 && !gpStatusFilter.includes(effectiveRlic)) return false;
      const effectivePid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
      if (pidStatusFilter.length > 0 && !pidStatusFilter.includes(effectivePid)) return false;
      if (trainingStatusFilter.length > 0 && !trainingStatusFilter.includes(e.training_status)) return false;
      if (medicalResultFilter.length > 0 && !medicalResultFilter.includes(e.ftw_result)) return false;
      const trainSched = normalizeDate(e.training_date_scheduled) || '';
      if (trainingScheduledFrom && trainSched < trainingScheduledFrom) return false;
      if (trainingScheduledTo && trainSched > trainingScheduledTo) return false;
      const medApproved = normalizeDate(e.ftw_approved_date) || '';
      if (medicalTrApprovedFrom && medApproved < medicalTrApprovedFrom) return false;
      if (medicalTrApprovedTo && medApproved > medicalTrApprovedTo) return false;
      const gpIssueVal = normalizeDate(e.gate_pass_issue_date) || '';
      if (gpIssueFrom && gpIssueVal < gpIssueFrom) return false;
      if (gpIssueTo && gpIssueVal > gpIssueTo) return false;
      const gpRecVal = normalizeDate(e.gate_pass_received_date) || '';
      if (gpReceivedFrom && gpRecVal < gpReceivedFrom) return false;
      if (gpReceivedTo && gpRecVal > gpReceivedTo) return false;
      const pidIssueVal = normalizeDate(e.pid_issue_date) || '';
      if (pidIssueFrom && pidIssueVal < pidIssueFrom) return false;
      if (pidIssueTo && pidIssueVal > pidIssueTo) return false;
      return true;
    });
  }, [employees, searchQuery, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, gpStatusFilter, pidStatusFilter, trainingStatusFilter, medicalResultFilter, trainingScheduledFrom, trainingScheduledTo, medicalTrApprovedFrom, medicalTrApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);

  const managerOptions = useMemo(() => buildManagerOptions(managerSourceEmployees, empById), [managerSourceEmployees, empById]);

  // Prune manager selections that are no longer valid after other filters change.
  useEffect(() => {
    if (selectedManagers.length === 0) return;
    const valid = new Set(managerOptions.map(o => o.value));
    const still = selectedManagers.filter(m => valid.has(m));
    if (still.length !== selectedManagers.length) setSelectedManagers(still);
  }, [managerOptions]);

  // Build deduplicated company options (same logic as Dashboard)
  const allCompanyOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const c of [...COMPANIES.map(c => ({ value: c.value, label: c.label })), ...lookupCompanies.map(c => ({ value: c.value, label: c.label }))]) {
      const key = c.value.trim().toUpperCase();
      if (!seen.has(key)) { seen.add(key); result.push(c); }
    }
    return result;
  }, [lookupCompanies]);

  const cascadedCompanyOptions = useMemo(() => {
    if (departmentFilter.length === 0) return allCompanyOptions;
    const deptSet = new Set(departmentFilter.map(d => d.trim().toLowerCase()));
    const valid = new Set(employees.filter(e => deptSet.has((e.department || '').trim().toLowerCase())).map(e => (e.company || '').trim().toUpperCase()));
    return allCompanyOptions.filter(c => valid.has(c.value.trim().toUpperCase()));
  }, [allCompanyOptions, departmentFilter, employees]);

  useEffect(() => {
    if (companyFilter.length === 0) return;
    const validSet = new Set(cascadedCompanyOptions.map(c => c.value.trim().toUpperCase()));
    const still = companyFilter.filter(cf => validSet.has(cf.trim().toUpperCase()));
    if (still.length !== companyFilter.length) setCompanyFilter(still);
  }, [cascadedCompanyOptions]);

  const allDepartmentOptions = useMemo(() => {
    const seen = new Set();
    const result = [];
    [...DEPARTMENTS.map(d => ({ value: d, label: d.toUpperCase() })), ...lookupDepartments.map(d => ({ value: d.value, label: d.label.toUpperCase() }))].forEach(d => {
      const key = d.value.toUpperCase();
      if (!seen.has(key)) { seen.add(key); result.push(d); }
    });
    return result;
  }, [lookupDepartments]);

  const allPositions = useMemo(() => {
    const seen = new Map();
    for (const e of employees) {
      const raw = (e.designation_org_chart || '').trim();
      if (!raw) continue;
      const key = raw.toUpperCase();
      if (!seen.has(key)) seen.set(key, raw);
    }
    return [...seen.values()].sort().map(p => ({ value: p, label: p }));
  }, [employees]);

  const filteredPositions = useMemo(() => {
    const hasFilter = companyFilter.length > 0 || departmentFilter.length > 0 || gpStatusFilter.length > 0;
    if (!hasFilter) return allPositions;
    const coSet = companyFilter.length > 0 ? new Set(companyFilter.map(c => c.trim().toUpperCase())) : null;
    const deptSet = departmentFilter.length > 0 ? new Set(departmentFilter.map(d => d.trim().toLowerCase())) : null;
    const seen = new Set();
    return employees
      .filter(e => {
        if (!e.designation_org_chart) return false;
        if (coSet && !coSet.has((e.company || '').trim().toUpperCase())) return false;
        if (deptSet && !deptSet.has((e.department || '').trim().toLowerCase())) return false;
        if (gpStatusFilter.length > 0 && !gpStatusFilter.includes(computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status))) return false;
        return true;
      })
      .map(e => e.designation_org_chart.trim())
      .filter(p => { if (seen.has(p)) return false; seen.add(p); return true; })
      .sort()
      .map(p => ({ value: p, label: p }));
  }, [employees, companyFilter, departmentFilter, gpStatusFilter]);

  useEffect(() => {
    if (positionFilter.length === 0) return;
    const valid = new Set(filteredPositions.map(p => p.value));
    const still = positionFilter.filter(p => valid.has(p));
    if (still.length !== positionFilter.length) setPositionFilter(still);
  }, [filteredPositions]);

  const allRlicOptions = useMemo(() => {
    const seen = new Set(); const result = [];
    [...RLIC_STATUSES, ...customRlicStatuses].forEach(s => { const k = s.value.toUpperCase(); if (!seen.has(k)) { seen.add(k); result.push({ value: s.value, label: s.label.toUpperCase() }); } });
    return result;
  }, [customRlicStatuses]);

  const allPidOptions = useMemo(() => {
    const seen = new Set(); const result = [];
    [...PID_STATUSES, ...customPidStatuses].forEach(s => { const k = s.value.toUpperCase(); if (!seen.has(k)) { seen.add(k); result.push({ value: s.value, label: s.label.toUpperCase() }); } });
    return result;
  }, [customPidStatuses]);

  const allMedicalResultOptions = useMemo(() => {
    const seen = new Set(); const result = [];
    [...MEDICAL_RESULTS, ...customFtwResults].forEach(s => { const k = s.value.toUpperCase(); if (!seen.has(k)) { seen.add(k); result.push({ value: s.value, label: s.label.toUpperCase() }); } });
    return result;
  }, [customFtwResults]);

  const allTrainingOptions = useMemo(() => {
    const seen = new Set(); const result = [];
    [...TRAINING_STATUSES, ...customTrainingStatuses].forEach(s => { const k = s.value.toUpperCase(); if (!seen.has(k)) { seen.add(k); result.push({ value: s.value, label: s.label.toUpperCase() }); } });
    return result;
  }, [customTrainingStatuses]);

  const allLocationOptions = useMemo(() => {
    const seen = new Set(); const result = [];
    [...['QATAR', 'COMO CAMP', 'OTHER'].map(l => ({ value: l, label: l })), ...lookupLocations.map(l => ({ value: l.value, label: l.label }))].forEach(l => {
      const k = l.value.toUpperCase(); if (!seen.has(k)) { seen.add(k); result.push(l); }
    });
    return result;
  }, [lookupLocations]);

  // ── Master filtered employee list (shared across both tabs) ───────────────
  // Apply the manager filter on top of the cascaded non-manager dataset.
  const filteredEmployees = useMemo(() => {
    if (selectedManagers.length === 0) return managerSourceEmployees;
    const wantUnassigned = selectedManagers.includes(UNASSIGNED_MANAGER);
    const ids = selectedManagers.filter(x => x !== UNASSIGNED_MANAGER);
    return managerSourceEmployees.filter(e => {
      if (ids.length && ids.includes(e.assigned_manager_id)) return true;
      if (wantUnassigned && !e.assigned_manager_id) return true;
      return false;
    });
  }, [managerSourceEmployees, selectedManagers]);

  const hasFilter = companyFilter.length > 0 || positionFilter.length > 0 || departmentFilter.length > 0 || selectedManagers.length > 0 || !!dirFilter || gpStatusFilter.length > 0 || pidStatusFilter.length > 0 || trainingStatusFilter.length > 0 || medicalResultFilter.length > 0 || locationFilter.length > 0 || !!trainingScheduledFrom || !!trainingScheduledTo || !!medicalTrApprovedFrom || !!medicalTrApprovedTo || !!gpIssueFrom || !!gpIssueTo || !!gpReceivedFrom || !!gpReceivedTo || !!pidIssueFrom || !!pidIssueTo;

  const clearFilters = () => {
    setCompanyFilter([]); setPositionFilter([]); setDepartmentFilter([]); setSelectedManagers([]);
    setDirFilter(''); setGpStatusFilter([]); setPidStatusFilter([]); setTrainingStatusFilter([]);
    setMedicalResultFilter([]); setLocationFilter([]);
    setTrainingScheduledFrom(''); setTrainingScheduledTo('');
    setMedicalTrApprovedFrom(''); setMedicalTrApprovedTo('');
    setGpIssueFrom(''); setGpIssueTo('');
    setGpReceivedFrom(''); setGpReceivedTo('');
    setPidIssueFrom(''); setPidIssueTo('');
    setSearchQuery('');
  };

  // Gatepass tab: compute company data using existing extraFilters structure
  const extraFilters = useMemo(() => ({
    positionFilter, departmentFilter, dirFilter: dirFilter || 'all',
    gpStatusFilter, medicalResultFilter, locationFilter, trainingStatusFilter,
    trainingScheduledFrom, trainingScheduledTo,
    medicalTrApprovedFrom, medicalTrApprovedTo,
    gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo,
    pidIssueFrom, pidIssueTo,
  }), [positionFilter, departmentFilter, dirFilter, gpStatusFilter, medicalResultFilter, locationFilter, trainingStatusFilter, trainingScheduledFrom, trainingScheduledTo, medicalTrApprovedFrom, medicalTrApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);

  const gatepassCompanyFilter = useMemo(() => {
    if (companyFilter.length === 1) return companyFilter[0].trim().toUpperCase();
    return 'ALL';
  }, [companyFilter]);

  const companyData = useMemo(
    () => buildCompanyData(filteredEmployees, gatepassCompanyFilter, extraFilters),
    [filteredEmployees, gatepassCompanyFilter, extraFilters]
  );

  // Manager Assigned per company — sourced from personnel assigned_manager_id.
  const companyManagers = useMemo(() => buildCompanyManagers(filteredEmployees, empById), [filteredEmployees, empById]);

  const reportHTML = useMemo(
    () => buildReportHTML(companyData, today, gatepassCompanyFilter, companyManagers),
    [companyData, today, gatepassCompanyFilter, companyManagers]
  );

  const summaryTotals = useMemo(() => {
    return Object.values(companyData).reduce((acc, rows) => {
      const t = sumRows(rows);
      for (const k of Object.keys(acc)) acc[k] += t[k];
      return acc;
    }, ZERO_ROW());
  }, [companyData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live data from masterlist ·{' '}
            {hasFilter
              ? <span className="text-primary font-semibold">Filtered: {filteredEmployees.length} personnel</span>
              : <span>{employees.filter(e => e.is_active !== false).length} active personnel</span>}
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* ── Shared Filter Panel (Dashboard-style) ── */}
      <Card className="border shadow-sm">
        <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setFiltersOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Filters
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${filtersOpen ? '' : '-rotate-90'}`} />
            </button>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Name, QID, PP, PID..."
                className="w-56 pl-9 pr-4 h-8 rounded-full border border-input bg-white text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring placeholder:text-muted-foreground"
              />
            </div>
          </div>
          {hasFilter && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground h-7 px-2 rounded hover:bg-accent">
              <X className="w-3 h-3" /> Clear All
            </button>
          )}
        </div>
        <div className={`p-4 space-y-3 ${filtersOpen ? '' : 'hidden'}`}>
          {/* Row 1 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Company</p>
              <MultiSelect options={cascadedCompanyOptions} value={companyFilter} onChange={setCompanyFilter} placeholder="All companies..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Position / Designation</p>
              <MultiSelect options={filteredPositions} value={positionFilter} onChange={setPositionFilter} placeholder="All positions..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Department</p>
              <MultiSelect options={allDepartmentOptions} value={departmentFilter} onChange={setDepartmentFilter} placeholder="All departments..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Manager Name</p>
              <MultiSelect options={managerOptions} value={selectedManagers} onChange={setSelectedManagers} placeholder="All Managers" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">DIR / INDIR</p>
              <select value={dirFilter} onChange={e => setDirFilter(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                <option value="">All</option>
                <option value="DIR">DIR</option>
                <option value="INDIR">INDIR</option>
              </select>
            </div>
          </div>
          {/* Row 2 */}
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Status</p>
              <MultiSelect options={allRlicOptions} value={gpStatusFilter} onChange={setGpStatusFilter} placeholder="All statuses..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Training Status</p>
              <MultiSelect options={allTrainingOptions} value={trainingStatusFilter} onChange={setTrainingStatusFilter} placeholder="All statuses..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Project ID Status</p>
              <MultiSelect options={allPidOptions} value={pidStatusFilter} onChange={setPidStatusFilter} placeholder="All statuses..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Medical Result</p>
              <MultiSelect options={allMedicalResultOptions} value={medicalResultFilter} onChange={setMedicalResultFilter} placeholder="All results..." />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Location</p>
              <MultiSelect options={allLocationOptions} value={locationFilter} onChange={setLocationFilter} placeholder="All locations..." />
            </div>
          </div>
          {/* Row 3: date ranges */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1 border-t">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Training Scheduled</p>
              <div className="flex gap-1.5">
                <Input type="date" value={trainingScheduledFrom} onChange={e => setTrainingScheduledFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={trainingScheduledTo} onChange={e => setTrainingScheduledTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Medical TR Approved</p>
              <div className="flex gap-1.5">
                <Input type="date" value={medicalTrApprovedFrom} onChange={e => setMedicalTrApprovedFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={medicalTrApprovedTo} onChange={e => setMedicalTrApprovedTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Submitted</p>
              <div className="flex gap-1.5">
                <Input type="date" value={gpIssueFrom} onChange={e => setGpIssueFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={gpIssueTo} onChange={e => setGpIssueTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Gate Pass Received</p>
              <div className="flex gap-1.5">
                <Input type="date" value={gpReceivedFrom} onChange={e => setGpReceivedFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={gpReceivedTo} onChange={e => setGpReceivedTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Project ID Issue</p>
              <div className="flex gap-1.5">
                <Input type="date" value={pidIssueFrom} onChange={e => setPidIssueFrom(e.target.value)} className="text-xs h-8" />
                <Input type="date" value={pidIssueTo} onChange={e => setPidIssueTo(e.target.value)} className="text-xs h-8" />
              </div>
            </div>
          </div>
          {hasFilter && (
            <p className="text-xs text-muted-foreground pt-1">
              Showing <strong className="text-foreground">{filteredEmployees.length}</strong> of <strong className="text-foreground">{employees.filter(e => e.is_active !== false).length}</strong> active personnel
            </p>
          )}
        </div>
      </Card>

      <Tabs defaultValue="gatepass" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="gatepass">Gatepass Daily Report Update</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding Monitoring</TabsTrigger>
          <TabsTrigger value="approved">Approved List</TabsTrigger>
        </TabsList>

        <TabsContent value="approved">
          <ApprovedList />
        </TabsContent>

        <TabsContent value="onboarding">
          <OnboardingMonitoring employees={filteredEmployees} assignments={assignments} />
        </TabsContent>

        <TabsContent value="gatepass">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Gatepass Daily Report Update</h2>
              <p className="text-sm text-muted-foreground mt-1">Report date: <strong>{today}</strong></p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  setIsExporting(true);
                  try {
                    await exportGatepassExcel({
                      companyData,
                      companyManagers,
                      displayDate: today,
                      isoDate: format(new Date(), 'yyyy-MM-dd'),
                    });
                  } finally {
                    setIsExporting(false);
                  }
                }}
                disabled={filteredEmployees.length === 0 || isExporting}
                className="gap-2"
              >
                <Download className="w-4 h-4" />
                {isExporting ? 'Exporting...' : 'Export Excel'}
              </Button>
              <Button onClick={() => setShowPreview(true)} disabled={filteredEmployees.length === 0} className="gap-2">
                <FileText className="w-4 h-4" /> Preview &amp; Print
              </Button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-4">
            {[
              { label: 'Pending Medical', value: summaryTotals.pendingMedical, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'FTW / Approved', value: summaryTotals.ftw, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'GP Under Process', value: summaryTotals.gpUnder, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: 'Valid Gate Pass', value: summaryTotals.validGP, color: 'text-green-600', bg: 'bg-green-50' },
              { label: 'Training Completed', value: summaryTotals.trainingDone, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'PID Valid', value: summaryTotals.pid, color: 'text-purple-600', bg: 'bg-purple-50' },
            ].map(card => (
              <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
                <div className="text-xs text-slate-500 font-medium">{card.label}</div>
                <div className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Inline report tables */}
          {filteredEmployees.length > 0 ? (
            <InlineReport reportHTML={reportHTML} />
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <FileText className="w-10 h-10 opacity-30" />
              <p className="font-medium">No employee data found for the selected filters.</p>
            </div>
          )}

          {/* Print Modal */}
          {showPreview && (
            <ReportPreviewModal
              reportHTML={reportHTML}
              displayDate={today}
              onClose={() => setShowPreview(false)}
            />
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}