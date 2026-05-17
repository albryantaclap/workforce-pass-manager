import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer, X, FileText, RefreshCw } from 'lucide-react';
import { computePassStatus } from '@/utils/constants';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import MultiSelect from '@/components/common/MultiSelect';

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
function buildCompanyData(employees, companyFilter, managerFilter = []) {
  const companyData = {};
  for (const emp of employees) {
    if (emp.is_active === false || emp.is_active === null) continue;
    const co = (emp.company || 'UNKNOWN').trim().toUpperCase();
    if (companyFilter !== 'ALL' && co !== companyFilter.toUpperCase()) continue;
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

// ── Table HTML builder ────────────────────────────────────────────────────────
function buildCompanyTableHTML(company, rows, isGrand = false) {
  const designations = Object.keys(rows).sort();
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
function buildGrandTotalHTML(companyData, assignments = []) {
  // Build manager lookup map
  const managerMap = {};
  for (const a of assignments) {
    for (const co of a.companies) {
      managerMap[co.trim().toUpperCase()] = a.manager_name;
    }
  }

  // CATEGORY MAPPING
  const COMPANY_CATEGORIES = {
    'KM STEEL - MOSTAFA (GSO)': 'STEEL STRUCTURE',
    'QTRS - ALAVON (GSO)': 'CIVIL',
    'VMANES (GSO)': 'MECHANICAL AND CIVIL',
    'GSO QATAR': '',
    'INTEGRATED (GSO)': 'CIVIL',
    'TEXON (GSO)': 'LOGISTICS',
    'SWAN GLOBAL (GSO)': 'PIPELINE',
    'GOOD HIRING': 'CIVIL',
    'GSO LOGISTICS': 'DRIVERS AND OPERATORS',
    'KHALED PROJECTS': 'DRIVERS AND OPERATORS',
    'AUTO XPERT': 'DRIVERS AND OPERATORS',
    'SIGEL (GSO)': 'PIPELINE',
    'CRYSTAL': 'PIPELINE',
    'ZEAL-IT': 'RIGGERS',
    'QSS': 'SECURITY',
    'INFINITY (GSO)': 'CIVIL',
    'WENMA': 'SCAFFOLDING',
    'MIR (GSO)': 'STEEL STRUCTURE',
    'AL JABER (GSO)': 'HEAVY LIFT',
    'AL-RAMSHA (GSO)': 'ROTARY',
    'METAL WORLD': 'STEEL STRUCTURE',
    'ALTHAF (GSO)': 'STEEL STRUCTURE',
    'ALTAF (GSO)': 'STEEL STRUCTURE',
    'ARKAN GULF (GSO)': 'ELECTRICAL (NEW)',
    'ANION': 'CATHODIC',
    'ENERSERVE (GSO)': 'ELECTRICAL',
    'LMV E AND I': 'ELECTRICAL',
    'MEGATRONICS (GSO)': 'ELECTRICAL',
    'NTC (GSO)': 'ELECTRICAL',
    'SEA QUEEN': 'INSTRUMENTATION',
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
      <td class="left">
        <input
          type="text"
          value="${COMPANY_CATEGORIES[co] || ''}"
          style="
            width:100%;
            border:none;
            background:transparent;
            outline:none;
            font-size:11px;
            font-family:Arial;
          "
        />
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

            <td class="hdr-col left" style="width:14%">
              CATEGORY
            </td>

            <td class="hdr-col left" style="width:11%">
              MANAGER ASSIGNED
            </td>

            <td class="hdr-col c-medical" style="width:7%">PENDING MEDICAL</td>

            <td class="hdr-col c-medical" style="width:7%">FTW / APPROVED</td>

            <td class="hdr-col c-gatepass" style="width:7%">GP UNDER PROCESS</td>

            <td class="hdr-col c-gatepass" style="width:7%">VALID GATEPASS</td>

            <td class="hdr-col c-training" style="width:7%">SCHEDULED</td>

            <td class="hdr-col c-training" style="width:7%">ON-GOING</td>

            <td class="hdr-col c-training" style="width:7%">COMPLETED</td>

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

function buildReportHTML(companyData, displayDate, selectedCompany, assignments = []) {
  const companies = Object.keys(companyData).sort();
  const grandHTML = selectedCompany === 'ALL' ? buildGrandTotalHTML(companyData, assignments) : '';
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
    win.document.write(`<!DOCTYPE html><html><head><title>Projection Report ${displayDate}</title><style>${PRINT_CSS}</style></head><body>${reportHTML}<script>setTimeout(() => window.print(), 300);<\/script></body></html>`);
    win.document.close();
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-auto py-6 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-7xl">
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">Projection Report Preview</h2>
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
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedManagers, setSelectedManagers] = useState([]);
  const [showPreview, setShowPreview] = useState(false);

  // Load all employees — same query key as Dashboard so cache is shared
  const {
   data: employees = [],
   isLoading,
   refetch,
   isFetching
  } = useQuery({
   queryKey: ['employees-active'],

   queryFn: () =>
     base44.entities.Employee.filter(
       { is_active: true },
       '-created_date',
       10000
     ),

   refetchInterval: 15000,
   refetchOnWindowFocus: true,
   staleTime: 5000,
   gcTime: 1000 * 60 * 5,
   retry: 2,
  });

  // Load manager assignments
  const { data: assignments = [] } = useQuery({
   queryKey: ['managerAssignments'],
   queryFn: () => base44.entities.ManagerAssignment.list(),
  });

  // Build manager options and filtered companies
  const managerOptions = useMemo(() => {
   return assignments.map(a => ({ value: a.id, label: a.manager_name }));
  }, [assignments]);

  const filteredCompaniesFromManagers = useMemo(() => {
   if (selectedManagers.length === 0) return [];
   const companies = new Set();
   for (const managerId of selectedManagers) {
     const mgr = assignments.find(a => a.id === managerId);
     if (mgr) {
       mgr.companies.forEach(co => companies.add(co.trim().toUpperCase()));
     }
   }
   return Array.from(companies);
  }, [selectedManagers, assignments]);

  const today = format(new Date(), 'dd-MM-yyyy');

  // Derive unique sorted company list from live employee data
  const allCompanies = useMemo(() => {
    const set = new Set();
    for (const emp of employees) {
      if (emp.company) set.add(emp.company.trim().toUpperCase());
    }
    return Array.from(set).sort();
  }, [employees]);

  // Filter employees based on selected managers
  const filteredEmployees = useMemo(() => {
    if (selectedManagers.length === 0) return employees;
    return employees.filter(emp => {
      const empCo = (emp.company || '').trim().toUpperCase();
      return filteredCompaniesFromManagers.includes(empCo);
    });
  }, [employees, selectedManagers, filteredCompaniesFromManagers]);

  // Compute company data from live employee records
  const companyData = useMemo(
    () => buildCompanyData(filteredEmployees, selectedCompany),
    [filteredEmployees, selectedCompany]
  );

  const reportHTML = useMemo(
    () => buildReportHTML(companyData, today, selectedCompany, assignments),
    [companyData, today, selectedCompany, assignments]
  );

  // Summary totals across all filtered data
  const summaryTotals = useMemo(() => {
    return Object.values(companyData).reduce((acc, rows) => {
      const t = sumRows(rows);
      for (const k of Object.keys(acc)) acc[k] += t[k];
      return acc;
    }, ZERO_ROW());
  }, [companyData]);

  const activeCount = filteredEmployees.filter(e => e.is_active !== false && e.is_active !== null).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Projection Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Live data from masterlist · {employees.filter(e => e.is_active !== false).length} active personnel
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button onClick={() => setShowPreview(true)} disabled={employees.length === 0} className="gap-2">
            <FileText className="w-4 h-4" /> Preview &amp; Print
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3 p-4 bg-card rounded-xl border">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Company:</label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-56">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Companies</SelectItem>
                {allCompanies.map(co => (
                  <SelectItem key={co} value={co}>{co}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto text-sm text-muted-foreground">
            Report date: <strong>{today}</strong>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Manager:</label>
          <div className="flex-1 max-w-xs">
            <MultiSelect options={managerOptions} value={selectedManagers} onChange={setSelectedManagers} placeholder="All managers..." />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
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
          <p className="font-medium">{selectedManagers.length > 0 ? 'No employee data found for selected managers.' : 'No employee data found.'}</p>
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
    </div>
  );
}