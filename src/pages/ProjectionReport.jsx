import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer, X, FileText, RefreshCw } from 'lucide-react';
import { computePassStatus } from '@/utils/constants';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  // Medical
  const ftw = (emp.ftw_result || '').trim().toUpperCase();
  if (ftw === 'ACCEPTED') {
    counts.ftw = 1;
  } else {
    // Everything not accepted = pending (waiting, re-assess, rejected, blank)
    counts.pendingMedical = 1;
  }

  // Gatepass
  // Custom statuses (not built-in) like "UNDER PROCESS" → GP Under Process
  const rlicStatus = (emp.rlic_status || '').trim().toUpperCase();
  if (rlicStatus && !BUILT_IN_RLIC.has(rlicStatus)) {
    counts.gpUnder = 1;
  } else {
    // Derive from expiry date
    const effectiveRlic = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
    if (effectiveRlic === 'VALID RLIC PASS' || effectiveRlic === 'SOON TO EXPIRE') {
      counts.validGP = 1;
    }
  }

  // Training — based purely on training_status value
  const training = (emp.training_status || '').trim().toUpperCase();
  if (training === 'DONE') {
    counts.trainingDone = 1;
  } else if (training === 'ON-GOING' || training === 'ONGOING' || training === 'ON GOING') {
    counts.trainingOnGoing = 1;
  } else if (training === 'SCHEDULED') {
    counts.trainingScheduled = 1;
  }

  // PID — count if they have a PID number or a valid/soon status
  const pidStatus = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
  if (emp.pid || (pidStatus !== 'NO PID PASS' && pidStatus !== 'EXPIRED PID PASS')) {
    counts.pid = 1;
  }

  // Camp location
  if ((emp.current_location || '').trim().toUpperCase() === 'COMO CAMP') {
    counts.camp = 1;
  }

  return counts;
}

// ── Build company data structure from live employees ─────────────────────────
function buildCompanyData(employees, companyFilter) {
  const companyData = {};
  for (const emp of employees) {
    if (emp.is_active === false) continue;
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
  .company-block { margin-bottom: 24px; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 11px; }
  td { border: 1px solid black; padding: 4px 5px; text-align: center; }
  td.left { text-align: left; }
  td.num { font-size: 20px; font-weight: 700; line-height: 1.1; padding: 4px 3px; }
  .hdr-company { background: #fde047; font-weight: 700; font-size: 15px; text-align: center; letter-spacing: 2px; padding: 6px; }
  .hdr-company.grand { background: #1e293b; color: white; }
  .hdr-group { font-weight: 700; font-size: 10px; text-align: center; padding: 3px; }
  .g-medical  { background: #bfdbfe; }
  .g-gatepass { background: #bbf7d0; }
  .g-training { background: #fed7aa; }
  .g-pid      { background: #e9d5ff; }
  .g-camp     { background: #fce7f3; }
  .hdr-col { background: #f1f5f9; font-weight: 700; font-size: 10px; text-align: center; padding: 4px 3px; }
  .c-medical  { background: #eff6ff; }
  .c-gatepass { background: #f0fdf4; }
  .c-training { background: #fff7ed; }
  .c-pid      { background: #faf5ff; }
  .c-camp     { background: #fdf2f8; }
  .row-total { background: #fef9c3; font-weight: 700; }
  .grand-total-row { background: #1e293b; color: white; font-weight: 700; }
  @media print {
    @page { size: A3 landscape; margin: 10mm; }
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
          <tr><td colspan="10" class="${hdrClass}">${company}</td></tr>
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
          <tr class="row-total">
            <td class="left">TOTAL</td>
            <td class="c-medical num">${c(totals.pendingMedical)}</td>
            <td class="c-medical num">${c(totals.ftw)}</td>
            <td class="c-gatepass num">${c(totals.gpUnder)}</td>
            <td class="c-gatepass num">${c(totals.validGP)}</td>
            <td class="c-training num">${c(totals.trainingScheduled)}</td>
            <td class="c-training num">${c(totals.trainingOnGoing)}</td>
            <td class="c-training num">${c(totals.trainingDone)}</td>
            <td class="c-pid num">${c(totals.pid)}</td>
            <td class="c-camp num">${c(totals.camp)}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function buildGrandTotalHTML(companyData) {
  const companies = Object.keys(companyData).sort();
  const grandTotal = ZERO_ROW();
  const companyTotals = {};
  for (const co of companies) {
    companyTotals[co] = sumRows(companyData[co]);
    for (const k of Object.keys(grandTotal)) grandTotal[k] += companyTotals[co][k];
  }
  const companyRows = companies.map(co => `
    <tr>
      <td class="left">${co}</td>
      <td class="c-medical num">${c(companyTotals[co].pendingMedical)}</td>
      <td class="c-medical num">${c(companyTotals[co].ftw)}</td>
      <td class="c-gatepass num">${c(companyTotals[co].gpUnder)}</td>
      <td class="c-gatepass num">${c(companyTotals[co].validGP)}</td>
      <td class="c-training num">${c(companyTotals[co].trainingScheduled)}</td>
      <td class="c-training num">${c(companyTotals[co].trainingOnGoing)}</td>
      <td class="c-training num">${c(companyTotals[co].trainingDone)}</td>
      <td class="c-pid num">${c(companyTotals[co].pid)}</td>
      <td class="c-camp num">${c(companyTotals[co].camp)}</td>
    </tr>`).join('');
  return `
    <div class="company-block">
      <table>
        <tbody>
          <tr><td colspan="10" class="hdr-company grand">GRAND TOTAL — ALL COMPANIES</td></tr>
          <tr>
            <td class="hdr-group"></td>
            <td colspan="2" class="hdr-group g-medical">MEDICAL</td>
            <td colspan="2" class="hdr-group g-gatepass">GATEPASS</td>
            <td colspan="3" class="hdr-group g-training">TRAINING</td>
            <td class="hdr-group g-pid">PID</td>
            <td class="hdr-group g-camp">CAMP</td>
          </tr>
          <tr>
            <td class="hdr-col left" style="width:18%">COMPANY</td>
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
          ${companyRows}
          <tr class="grand-total-row">
            <td class="left">GRAND TOTAL</td>
            <td class="num">${grandTotal.pendingMedical || ''}</td><td class="num">${grandTotal.ftw || ''}</td>
            <td class="num">${grandTotal.gpUnder || ''}</td><td class="num">${grandTotal.validGP || ''}</td>
            <td class="num">${grandTotal.trainingScheduled || ''}</td><td class="num">${grandTotal.trainingOnGoing || ''}</td>
            <td class="num">${grandTotal.trainingDone || ''}</td>
            <td class="num">${grandTotal.pid || ''}</td><td class="num">${grandTotal.camp || ''}</td>
          </tr>
        </tbody>
      </table>
    </div>`;
}

function buildReportHTML(companyData, displayDate, selectedCompany) {
  const companies = Object.keys(companyData).sort();
  const grandHTML = selectedCompany === 'ALL' ? buildGrandTotalHTML(companyData) : '';
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

// ── Companies list ────────────────────────────────────────────────────────────
const ALL_COMPANIES = [
  'GSO QATAR','ITELLIGENT','ANION','SEA QUEEN','LMV E AND I','METAL WORLD','ASMA','FIT',
  'SPRAY CON','EMKAN','ENERTEC','CRYSTAL','MEGATRONICS (GSO)','ENERSERVE (GSO)','ENERTEC (GSO)',
  'NTC (GSO)','MIR (GSO)','ALTAF (GSO)','SWAN GLOBAL (GSO)','SIGEL (GSO)','AL-RAMSHA (GSO)',
  'ALTHAF (GSO)','ZEAL-IT',
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectionReport() {
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [showPreview, setShowPreview] = useState(false);

  // Load all active employees from masterlist
  const { data: employees = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['employees-projection'],
    queryFn: () => base44.entities.Employee.list('-updated_date', 2000),
  });

  const today = format(new Date(), 'dd-MM-yyyy');

  // Compute company data from live employee records
  const companyData = useMemo(
    () => buildCompanyData(employees, selectedCompany),
    [employees, selectedCompany]
  );

  const reportHTML = useMemo(
    () => buildReportHTML(companyData, today, selectedCompany),
    [companyData, today, selectedCompany]
  );

  // Summary totals across all filtered data
  const summaryTotals = useMemo(() => {
    return Object.values(companyData).reduce((acc, rows) => {
      const t = sumRows(rows);
      for (const k of Object.keys(acc)) acc[k] += t[k];
      return acc;
    }, ZERO_ROW());
  }, [companyData]);

  const activeCount = employees.filter(e => e.is_active !== false).length;

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
            Live data from masterlist · {activeCount} active personnel
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
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-xl border">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Company:</label>
          <Select value={selectedCompany} onValueChange={setSelectedCompany}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All Companies" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Companies</SelectItem>
              {ALL_COMPANIES.map(co => (
                <SelectItem key={co} value={co}>{co}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          Report date: <strong>{today}</strong>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Pending Medical', value: summaryTotals.pendingMedical, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'FTW / Approved', value: summaryTotals.ftw, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'GP Under Process', value: summaryTotals.gpUnder, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Valid Gate Pass', value: summaryTotals.validGP, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Training Completed', value: summaryTotals.trainingDone, color: 'text-orange-600', bg: 'bg-orange-50' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
            <div className="text-xs text-slate-500 font-medium">{card.label}</div>
            <div className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Inline report tables */}
      {employees.length > 0 ? (
        <InlineReport reportHTML={reportHTML} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <FileText className="w-10 h-10 opacity-30" />
          <p className="font-medium">No employee data found.</p>
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