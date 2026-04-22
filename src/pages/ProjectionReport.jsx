import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer, X, FileText, Calendar } from 'lucide-react';
import { computePassStatus } from '@/utils/constants';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// ── Column logic ─────────────────────────────────────────────────────────────
const ZERO_ROW = () => ({
  dvcFrom: 0, dvcTo: 0, pendingMedical: 0, ftw: 0,
  gpUnder: 0, validGP: 0, trainingScheduled: 0,
  trainingOnGoing: 0, trainingDone: 0, pid: 0, camp: 0
});

function sumRows(rows) {
  const totals = ZERO_ROW();
  for (const r of Object.values(rows)) for (const k of Object.keys(totals)) totals[k] += r[k];
  return totals;
}

function c(v) { return v === 0 ? '' : v; }

// ── CSS for preview / print ───────────────────────────────────────────────────
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

// ── Table HTML builder ────────────────────────────────────────────────────────
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
            <td class="hdr-group"></td><td class="hdr-group"></td><td class="hdr-group"></td>
          </tr>
          <tr>
            <td class="hdr-col left" style="width:14%">DESIGNATION</td>
            <td class="hdr-col c-dvc" style="width:8%">DVC FROM CONTRACTOR</td>
            <td class="hdr-col c-dvc" style="width:8%">DVC TO TR</td>
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
            <td class="hdr-group"></td><td class="hdr-group"></td><td class="hdr-group"></td>
          </tr>
          <tr>
            <td class="hdr-col left" style="width:14%">COMPANY</td>
            <td class="hdr-col c-dvc" style="width:8%">DVC FROM CONTRACTOR</td>
            <td class="hdr-col c-dvc" style="width:8%">DVC TO TR</td>
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
            <td>${grandTotal.dvcFrom || ''}</td><td>${grandTotal.dvcTo || ''}</td>
            <td>${grandTotal.pendingMedical || ''}</td><td>${grandTotal.ftw || ''}</td>
            <td>${grandTotal.gpUnder || ''}</td><td>${grandTotal.validGP || ''}</td>
            <td>${grandTotal.trainingScheduled || ''}</td><td>${grandTotal.trainingOnGoing || ''}</td>
            <td>${grandTotal.trainingDone || ''}</td>
            <td>${grandTotal.pid || ''}</td><td>${grandTotal.camp || ''}</td><td></td>
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

// ── Inline Report Display ─────────────────────────────────────────────────────
function InlineReport({ reportHTML }) {
  return (
    <div className="bg-white rounded-xl border shadow overflow-auto">
      <style>{PRINT_CSS}</style>
      <div dangerouslySetInnerHTML={{ __html: reportHTML }} />
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const ALL_COMPANIES = [
  'GSO QATAR','ITELLIGENT','ANION','SEA QUEEN','LMV E AND I','METAL WORLD','ASMA','FIT',
  'SPRAY CON','EMKAN','ENERTEC','CRYSTAL','MEGATRONICS (GSO)','ENERSERVE (GSO)','ENERTEC (GSO)',
  'NTC (GSO)','MIR (GSO)','ALTAF (GSO)','SWAN GLOBAL (GSO)','SIGEL (GSO)','AL-RAMSHA (GSO)',
  'ALTHAF (GSO)','ZEAL-IT',
];

export default function ProjectionReport() {
  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // Load all saved snapshots
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ['projection-snapshots'],
    queryFn: () => base44.entities.ProjectionSnapshot.list('-snapshot_date', 365),
  });

  // Available dates for dropdown
  const availableDates = useMemo(() =>
    snapshots.map(s => s.snapshot_date).sort((a, b) => b.localeCompare(a)),
    [snapshots]
  );

  // Auto-select latest date
  const displayDate = selectedDate || availableDates[0] || '';

  // Find the snapshot for the selected date
  const snapshot = useMemo(() =>
    snapshots.find(s => s.snapshot_date === displayDate),
    [snapshots, displayDate]
  );

  // Apply company filter to snapshot data
  const filteredCompanyData = useMemo(() => {
    if (!snapshot?.report_data) return {};
    if (selectedCompany === 'ALL') return snapshot.report_data;
    const key = selectedCompany.toUpperCase();
    return snapshot.report_data[key] ? { [key]: snapshot.report_data[key] } : {};
  }, [snapshot, selectedCompany]);

  const formattedDisplayDate = displayDate
    ? format(new Date(displayDate + 'T00:00:00'), 'dd-MM-yyyy')
    : '—';

  const reportHTML = useMemo(
    () => buildReportHTML(filteredCompanyData, formattedDisplayDate, selectedCompany),
    [filteredCompanyData, formattedDisplayDate, selectedCompany]
  );

  // Quick summary from filtered data
  const summaryTotals = useMemo(() => {
    return Object.values(filteredCompanyData).reduce((acc, rows) => {
      const t = sumRows(rows);
      for (const k of Object.keys(acc)) acc[k] += t[k];
      return acc;
    }, ZERO_ROW());
  }, [filteredCompanyData]);

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
            Snapshots saved automatically every midnight · {snapshots.length} snapshot{snapshots.length !== 1 ? 's' : ''} available
          </p>
        </div>
        <Button onClick={() => setShowPreview(true)} disabled={!snapshot} className="gap-2">
          <FileText className="w-4 h-4" /> Preview &amp; Print
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 p-4 bg-card rounded-xl border">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-500" />
          <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Report Date:</label>
          <Select value={displayDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Select date…" />
            </SelectTrigger>
            <SelectContent>
              {availableDates.map(d => (
                <SelectItem key={d} value={d}>
                  {format(new Date(d + 'T00:00:00'), 'dd MMM yyyy')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
        {snapshot && (
          <div className="ml-auto text-sm text-muted-foreground">
            Personnel: <strong>{snapshot.total_personnel}</strong>
          </div>
        )}
      </div>

      {/* Summary cards */}
      {snapshot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'DVC Submitted (Contractor)', value: summaryTotals.dvcFrom, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'FTW / Approved', value: summaryTotals.ftw, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Valid Gate Pass', value: summaryTotals.validGP, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Training Completed', value: summaryTotals.trainingDone, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
              <div className="text-xs text-slate-500 font-medium">{card.label}</div>
              <div className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Inline report tables */}
      {snapshot ? (
        <InlineReport reportHTML={reportHTML} />
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Calendar className="w-10 h-10 opacity-30" />
          <p className="font-medium">No snapshots saved yet.</p>
          <p className="text-sm">The first snapshot will be saved automatically tonight at midnight.</p>
        </div>
      )}

      {/* Print Modal */}
      {showPreview && snapshot && (
        <ReportPreviewModal
          reportHTML={reportHTML}
          displayDate={formattedDisplayDate}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}