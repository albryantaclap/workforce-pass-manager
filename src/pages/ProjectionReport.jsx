import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer, X, FileText } from 'lucide-react';
import { computePassStatus } from '@/utils/constants';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';

// ── Column logic ─────────────────────────────────────────────────────────────
const getDvcFromContractor = (e) => (e.visa_date_applied ? 1 : 0);
const getDvcToTR           = (e) => (e.ftw_approval_request_date ? 1 : 0);
const getPendingMedical    = (e) => (!e.ftw_result || e.ftw_result === 'WAITING TR APPROVAL' || e.ftw_result === 'RE-ASSESS') ? 1 : 0;
const getFTW               = (e) => (e.ftw_result === 'ACCEPTED' ? 1 : 0);
const getGPUnderProcess    = (e) => {
  const status = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  const hasIssueDate = !!e.gate_pass_issue_date;
  const isValid = status === 'VALID RLIC PASS' || status === 'SOON TO EXPIRE';
  return (hasIssueDate && !isValid) ? 1 : 0;
};
const getValidGatepass     = (e) => {
  const status = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  return (status === 'VALID RLIC PASS' || status === 'SOON TO EXPIRE') ? 1 : 0;
};
const getTrainingScheduled = (e) => (e.training_status === 'PENDING' ? 1 : 0);
const getTrainingOnGoing   = (e) => (e.training_date_start && e.training_status !== 'DONE') ? 1 : 0;
const getTrainingCompleted = (e) => (e.training_status === 'DONE' ? 1 : 0);
const getPID               = (e) => {
  const status = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
  return (status === 'VALID PID PASS' || status === 'SOON TO EXPIRE') ? 1 : 0;
};
const getCamp              = (e) => (e.current_location === 'COMO CAMP' ? 1 : 0);

const ZERO_ROW = () => ({ dvcFrom: 0, dvcTo: 0, pendingMedical: 0, ftw: 0, gpUnder: 0, validGP: 0, trainingScheduled: 0, trainingOnGoing: 0, trainingDone: 0, pid: 0, camp: 0 });

function accumulateRow(row, e) {
  row.dvcFrom           += getDvcFromContractor(e);
  row.dvcTo             += getDvcToTR(e);
  row.pendingMedical    += getPendingMedical(e);
  row.ftw               += getFTW(e);
  row.gpUnder           += getGPUnderProcess(e);
  row.validGP           += getValidGatepass(e);
  row.trainingScheduled += getTrainingScheduled(e);
  row.trainingOnGoing   += getTrainingOnGoing(e);
  row.trainingDone      += getTrainingCompleted(e);
  row.pid               += getPID(e);
  row.camp              += getCamp(e);
}

function buildCompanyData(employees) {
  const companyMap = {};
  for (const e of employees) {
    if (e.is_active === false) continue;
    const company     = (e.company || 'UNKNOWN').toUpperCase();
    const designation = (e.designation_org_chart || e.position_application || 'UNSPECIFIED').toUpperCase();
    if (!companyMap[company]) companyMap[company] = {};
    if (!companyMap[company][designation]) companyMap[company][designation] = ZERO_ROW();
    accumulateRow(companyMap[company][designation], e);
  }
  return companyMap;
}

function sumRows(rows) {
  const totals = ZERO_ROW();
  for (const r of Object.values(rows)) for (const k of Object.keys(totals)) totals[k] += r[k];
  return totals;
}

// ── HTML Report Builder ───────────────────────────────────────────────────────
const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: Arial, sans-serif; font-size: 10px; background: white; color: #1e293b; }
  .wrap { padding: 16px; }
  .report-title { text-align: center; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 4px; }
  .report-date { text-align: center; font-size: 11px; color: #475569; margin-bottom: 16px; }
  .company-block { margin-bottom: 20px; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9px; }
  td { border: 1px solid black; padding: 2px 3px; text-align: center; }
  td.left { text-align: left; }
  .hdr-company { background: #fde047; font-weight: 700; font-size: 11px; text-align: center; letter-spacing: 2px; padding: 4px; }
  .hdr-company.grand { background: #1e293b; color: white; }
  .hdr-group { font-weight: 700; font-size: 8px; text-align: center; padding: 2px; }
  .g-dvc      { background: #e9d5ff; }
  .g-medical  { background: #bfdbfe; }
  .g-gatepass { background: #bbf7d0; }
  .g-training { background: #fed7aa; }
  .hdr-col { background: #f1f5f9; font-weight: 700; font-size: 8px; text-align: center; padding: 3px 2px; }
  .c-dvc      { background: #f5f3ff; }
  .c-medical  { background: #eff6ff; }
  .c-gatepass { background: #f0fdf4; }
  .c-training { background: #fff7ed; }
  .row-total { background: #fef9c3; font-weight: 700; }
  .grand-total-row { background: #1e293b; color: white; font-weight: 700; }
  @media print {
    @page { size: A3 landscape; margin: 10mm; }
    body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    .company-block { page-break-inside: avoid; }
  }
`;

function c(v) { return v === 0 ? '' : v; }

function buildCompanyTableHTML(company, rows, isGrand = false) {
  const designations = Object.keys(rows).sort();
  const totals = sumRows(rows);
  const hdrClass = isGrand ? 'hdr-company grand' : 'hdr-company';

  const dataRows = designations.map(d => `
    <tr>
      <td class="left">${d}</td>
      <td class="c-dvc">${c(rows[d].dvcFrom)}</td>
      <td class="c-dvc">${c(rows[d].dvcTo)}</td>
      <td class="c-medical">${c(rows[d].pendingMedical)}</td>
      <td class="c-medical">${c(rows[d].ftw)}</td>
      <td class="c-gatepass">${c(rows[d].gpUnder)}</td>
      <td class="c-gatepass">${c(rows[d].validGP)}</td>
      <td class="c-training">${c(rows[d].trainingScheduled)}</td>
      <td class="c-training">${c(rows[d].trainingOnGoing)}</td>
      <td class="c-training">${c(rows[d].trainingDone)}</td>
      <td>${c(rows[d].pid)}</td>
      <td>${c(rows[d].camp)}</td>
      <td></td>
    </tr>`).join('');

  return `
    <div class="company-block">
      <table>
        <tbody>
          <tr><td colspan="13" class="${hdrClass}">${company}</td></tr>
          <tr>
            <td class="hdr-group"></td>
            <td colspan="2" class="hdr-group g-dvc">DVC</td>
            <td colspan="2" class="hdr-group g-medical">MEDICAL</td>
            <td colspan="2" class="hdr-group g-gatepass">GATEPASS</td>
            <td colspan="3" class="hdr-group g-training">TRAINING</td>
            <td class="hdr-group"></td>
            <td class="hdr-group"></td>
            <td class="hdr-group"></td>
          </tr>
          <tr>
            <td class="hdr-col left" style="width:14%">DESIGNATION</td>
            <td class="hdr-col c-dvc" style="width:8%">DVC SUBMITTED FROM CONTRACTOR</td>
            <td class="hdr-col c-dvc" style="width:8%">DVC SUBMITTED TO TR</td>
            <td class="hdr-col c-medical" style="width:7%">PENDING MEDICAL</td>
            <td class="hdr-col c-medical" style="width:6%">FTW / APPROVED</td>
            <td class="hdr-col c-gatepass" style="width:8%">GP UNDER PROCESS</td>
            <td class="hdr-col c-gatepass" style="width:8%">VALID GATEPASS</td>
            <td class="hdr-col c-training" style="width:7%">SCHEDULED</td>
            <td class="hdr-col c-training" style="width:7%">ON-GOING</td>
            <td class="hdr-col c-training" style="width:7%">COMPLETED</td>
            <td class="hdr-col" style="width:6%">PID</td>
            <td class="hdr-col" style="width:7%">CAMP</td>
            <td class="hdr-col" style="width:7%"></td>
          </tr>
          ${dataRows}
          <tr class="row-total">
            <td class="left">TOTAL</td>
            <td class="c-dvc">${c(totals.dvcFrom)}</td>
            <td class="c-dvc">${c(totals.dvcTo)}</td>
            <td class="c-medical">${c(totals.pendingMedical)}</td>
            <td class="c-medical">${c(totals.ftw)}</td>
            <td class="c-gatepass">${c(totals.gpUnder)}</td>
            <td class="c-gatepass">${c(totals.validGP)}</td>
            <td class="c-training">${c(totals.trainingScheduled)}</td>
            <td class="c-training">${c(totals.trainingOnGoing)}</td>
            <td class="c-training">${c(totals.trainingDone)}</td>
            <td>${c(totals.pid)}</td>
            <td>${c(totals.camp)}</td>
            <td></td>
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
      <td class="c-dvc">${c(companyTotals[co].dvcFrom)}</td>
      <td class="c-dvc">${c(companyTotals[co].dvcTo)}</td>
      <td class="c-medical">${c(companyTotals[co].pendingMedical)}</td>
      <td class="c-medical">${c(companyTotals[co].ftw)}</td>
      <td class="c-gatepass">${c(companyTotals[co].gpUnder)}</td>
      <td class="c-gatepass">${c(companyTotals[co].validGP)}</td>
      <td class="c-training">${c(companyTotals[co].trainingScheduled)}</td>
      <td class="c-training">${c(companyTotals[co].trainingOnGoing)}</td>
      <td class="c-training">${c(companyTotals[co].trainingDone)}</td>
      <td>${c(companyTotals[co].pid)}</td>
      <td>${c(companyTotals[co].camp)}</td>
      <td></td>
    </tr>`).join('');

  return `
    <div class="company-block">
      <table>
        <tbody>
          <tr><td colspan="13" class="hdr-company grand">GRAND TOTAL — ALL COMPANIES</td></tr>
          <tr>
            <td class="hdr-group"></td>
            <td colspan="2" class="hdr-group g-dvc">DVC</td>
            <td colspan="2" class="hdr-group g-medical">MEDICAL</td>
            <td colspan="2" class="hdr-group g-gatepass">GATEPASS</td>
            <td colspan="3" class="hdr-group g-training">TRAINING</td>
            <td class="hdr-group"></td>
            <td class="hdr-group"></td>
            <td class="hdr-group"></td>
          </tr>
          <tr>
            <td class="hdr-col left" style="width:14%">COMPANY</td>
            <td class="hdr-col c-dvc" style="width:8%">DVC SUBMITTED FROM CONTRACTOR</td>
            <td class="hdr-col c-dvc" style="width:8%">DVC SUBMITTED TO TR</td>
            <td class="hdr-col c-medical" style="width:7%">PENDING MEDICAL</td>
            <td class="hdr-col c-medical" style="width:6%">FTW / APPROVED</td>
            <td class="hdr-col c-gatepass" style="width:8%">GP UNDER PROCESS</td>
            <td class="hdr-col c-gatepass" style="width:8%">VALID GATEPASS</td>
            <td class="hdr-col c-training" style="width:7%">SCHEDULED</td>
            <td class="hdr-col c-training" style="width:7%">ON-GOING</td>
            <td class="hdr-col c-training" style="width:7%">COMPLETED</td>
            <td class="hdr-col" style="width:6%">PID</td>
            <td class="hdr-col" style="width:7%">CAMP</td>
            <td class="hdr-col" style="width:7%"></td>
          </tr>
          ${companyRows}
          <tr class="grand-total-row">
            <td class="left">GRAND TOTAL</td>
            <td>${grandTotal.dvcFrom || ''}</td>
            <td>${grandTotal.dvcTo || ''}</td>
            <td>${grandTotal.pendingMedical || ''}</td>
            <td>${grandTotal.ftw || ''}</td>
            <td>${grandTotal.gpUnder || ''}</td>
            <td>${grandTotal.validGP || ''}</td>
            <td>${grandTotal.trainingScheduled || ''}</td>
            <td>${grandTotal.trainingOnGoing || ''}</td>
            <td>${grandTotal.trainingDone || ''}</td>
            <td>${grandTotal.pid || ''}</td>
            <td>${grandTotal.camp || ''}</td>
            <td></td>
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
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b sticky top-0 bg-white rounded-t-2xl z-10">
          <h2 className="text-lg font-bold">Projection Report Preview</h2>
          <div className="flex gap-2">
            <Button onClick={handlePrint} className="gap-2">
              <Printer className="w-4 h-4" /> Print / Save PDF
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-5 h-5" /></Button>
          </div>
        </div>
        {/* Preview */}
        <div className="overflow-auto p-4">
          <style>{PRINT_CSS}</style>
          <div dangerouslySetInnerHTML={{ __html: reportHTML }} />
        </div>
      </div>
    </div>
  );
}

// ── All Companies list ────────────────────────────────────────────────────────
const ALL_COMPANIES = [
  'GSO QATAR','ITELLIGENT','ANION','SEA QUEEN','LMV E AND I','METAL WORLD','ASMA','FIT',
  'SPRAY CON','EMKAN','ENERTEC','CRYSTAL','MEGATRONICS (GSO)','ENERSERVE (GSO)','ENERTEC (GSO)',
  'NTC (GSO)','MIR (GSO)','ALTAF (GSO)','SWAN GLOBAL (GSO)','SIGEL (GSO)','AL-RAMSHA (GSO)',
  'ALTHAF (GSO)','ZEAL-IT',
];

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectionReport() {
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showPreview, setShowPreview] = useState(false);

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const companyData = useMemo(() => buildCompanyData(employees), [employees]);

  const filteredCompanyData = useMemo(() => {
    if (selectedCompany === 'ALL') return companyData;
    const key = selectedCompany.toUpperCase();
    return companyData[key] ? { [key]: companyData[key] } : {};
  }, [companyData, selectedCompany]);

  const displayDate = reportDate
    ? format(new Date(reportDate + 'T00:00:00'), 'dd-MM-yyyy')
    : format(new Date(), 'dd-MM-yyyy');

  const reportHTML = useMemo(
    () => buildReportHTML(filteredCompanyData, displayDate, selectedCompany),
    [filteredCompanyData, displayDate, selectedCompany]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Projection Report</h2>
          <p className="text-sm text-muted-foreground mt-1">Active personnel only — gate pass daily status</p>
        </div>
        <Button onClick={() => setShowPreview(true)} className="gap-2">
          <FileText className="w-4 h-4" /> Preview &amp; Print
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-xl border">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Report Date:</label>
          <Input
            type="date"
            value={reportDate}
            onChange={(e) => setReportDate(e.target.value)}
            className="w-40"
          />
        </div>
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
      </div>

      {/* Quick summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {(() => {
          const gt = Object.values(filteredCompanyData).reduce((acc, rows) => {
            const t = sumRows(rows);
            for (const k of Object.keys(acc)) acc[k] += t[k];
            return acc;
          }, ZERO_ROW());
          return [
            { label: 'DVC Submitted (Contractor)', value: gt.dvcFrom, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'FTW / Approved', value: gt.ftw, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Valid Gate Pass', value: gt.validGP, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Training Completed', value: gt.trainingDone, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
              <div className="text-xs text-slate-500 font-medium">{card.label}</div>
              <div className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
            </div>
          ));
        })()}
      </div>

      {/* Instruction hint */}
      <div className="text-sm text-muted-foreground text-center py-4">
        Click <strong>Preview &amp; Print</strong> to open the full report in a modal, then print or save as PDF (A3 landscape).
      </div>

      {/* Modal Preview */}
      {showPreview && (
        <ReportPreviewModal
          reportHTML={reportHTML}
          displayDate={displayDate}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}