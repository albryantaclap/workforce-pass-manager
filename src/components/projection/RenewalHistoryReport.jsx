import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, FileText, RefreshCw, Printer } from 'lucide-react';
import { format } from 'date-fns';
import { exportRenewalHistoryExcel } from '@/utils/exportRenewalHistoryExcel';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2024 + 2 }, (_, i) => 2024 + i);

const PERIOD_MODES = [
  { id: 'month', label: 'By Month' },
  { id: 'year', label: 'By Year' },
  { id: 'range', label: 'By Range' },
];

const DOC_TYPES = ['All', 'Gate Pass', 'Project ID'];

function getRange(periodMode, year, month, rangeFrom, rangeTo) {
  if (periodMode === 'year') return { from: `${year}-01-01`, to: `${year}-12-31` };
  if (periodMode === 'month') {
    const last = new Date(year, month + 1, 0).getDate();
    const mm = String(month + 1).padStart(2, '0');
    return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, '0')}` };
  }
  return { from: rangeFrom || '', to: rangeTo || '' };
}

function periodLabel(periodMode, year, month, rangeFrom, rangeTo) {
  if (periodMode === 'year') return `Year ${year}`;
  if (periodMode === 'month') return `${MONTHS[month]} ${year}`;
  return `${rangeFrom || '…'} → ${rangeTo || '…'}`;
}

const PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: Arial, sans-serif; font-size: 10px; background: white; color: #1e293b; }
  .wrap { padding: 16px; }
  .title { text-align: center; font-size: 16px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
  .sub { text-align: center; font-size: 11px; color: #475569; margin-bottom: 14px; }
  table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 9px; }
  th { background: #f1f5f9; font-weight: 700; font-size: 8.5px; padding: 4px 3px; border: 1px solid #cbd5e1; text-align: center; }
  td { border: 1px solid #cbd5e1; padding: 3px; text-align: center; font-size: 9px; }
  td.l { text-align: left; }
  tr:nth-child(even) td { background: #f8fafc; }
  @media print { @page { size: A3 landscape; margin: 6mm; } }
`;

function buildReportHTML(rows, plabel) {
  const head = `<tr><th>#</th><th>Personnel</th><th>Company</th><th>Document</th><th>Renewal No.</th><th>Entry Type</th><th>Doc No.</th><th>Issue / Submitted</th><th>Received</th><th>Expiry</th><th>Recorded Status</th><th>Renewal Date</th><th>Recorded By</th><th>Remarks</th></tr>`;
  const body = rows.map((r, i) => `<tr>
    <td>${i + 1}</td><td class="l">${r.employee_name || ''}</td><td>${r.company || ''}</td>
    <td>${r.document_type || ''}</td><td>${r.renewal_no ?? ''}</td><td>${r.entry_type || ''}</td>
    <td>${r.document_number || ''}</td><td>${r.issue_date || ''}</td><td>${r.received_date || ''}</td>
    <td>${r.expiry_date || ''}</td><td>${r.recorded_status || ''}</td><td>${r.renewal_date || ''}</td>
    <td>${r.updated_by_name || ''}</td><td class="l">${r.remarks || ''}</td></tr>`).join('');
  return `<div class="wrap"><div class="title">Document Renewal History Report</div><div class="sub">Period: ${plabel} · Generated ${format(NOW, 'dd-MM-yyyy HH:mm')}</div><table><thead>${head}</thead><tbody>${body || '<tr><td colspan="14" style="text-align:center;padding:16px">No renewal records in this period</td></tr>'}</tbody></table></div>`;
}

export default function RenewalHistoryReport() {
  const [periodMode, setPeriodMode] = useState('month');
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(NOW.getMonth());
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [docType, setDocType] = useState('All');
  const [isExporting, setIsExporting] = useState(false);

  const { from, to } = useMemo(() => getRange(periodMode, year, month, rangeFrom, rangeTo), [periodMode, year, month, rangeFrom, rangeTo]);
  const ready = !!(from && to);

  const query = useMemo(() => {
    const q = { is_deleted: { $ne: true }, renewal_date: { $gte: from, $lte: to } };
    if (docType !== 'All') q.document_type = docType;
    return q;
  }, [from, to, docType]);

  const { data: rows = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['renewalHistoryReport', from, to, docType],
    queryFn: () => base44.entities.DocumentRenewalHistory.filter(query, '-renewal_date', 100000),
    enabled: ready,
    staleTime: 30000,
  });

  const plabel = periodLabel(periodMode, year, month, rangeFrom, rangeTo);

  const summary = useMemo(() => {
    const gp = rows.filter(r => r.document_type === 'Gate Pass').length;
    const pid = rows.filter(r => r.document_type === 'Project ID').length;
    const renewals = rows.filter(r => r.entry_type === 'Renewal').length;
    const initial = rows.filter(r => r.entry_type === 'Initial Issuance').length;
    const corrected = rows.filter(r => (r.corrections || []).length > 0).length;
    return { total: rows.length, gp, pid, renewals, initial, corrected };
  }, [rows]);

  const handlePrint = () => {
    const win = window.open('', '_blank', 'width=1400,height=900');
    win.document.write(`<!DOCTYPE html><html><head><title>Renewal History ${plabel}</title><style>${PRINT_CSS}</style></head><body>${buildReportHTML(rows, plabel)}<script>setTimeout(() => window.print(), 300);<\/script></body></html>`);
    win.document.close();
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await exportRenewalHistoryExcel({ rows, periodLabel: plabel, isoLabel: `${from}_to_${to}` });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Renewal History Report</h2>
          <p className="text-sm text-muted-foreground mt-1">Period: <strong>{plabel}</strong></p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={handleExport} disabled={!ready || rows.length === 0 || isExporting} className="gap-2">
            <Download className="w-4 h-4" /> {isExporting ? 'Exporting...' : 'Export Excel'}
          </Button>
          <Button onClick={handlePrint} disabled={!ready || rows.length === 0} className="gap-2">
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Period + type filters */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">Period</span>
          {PERIOD_MODES.map(m => (
            <button key={m.id} onClick={() => setPeriodMode(m.id)}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg border-2 transition-all ${periodMode === m.id ? 'border-primary bg-primary/5 text-primary' : 'border-border text-foreground hover:border-primary/40'}`}>
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {periodMode === 'year' && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Year</p>
              <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          )}
          {periodMode === 'month' && (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Month</p>
                <select value={month} onChange={e => setMonth(Number(e.target.value))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Year</p>
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </>
          )}
          {periodMode === 'range' && (
            <>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">From</p>
                <Input type="date" value={rangeFrom} onChange={e => setRangeFrom(e.target.value)} className="text-xs h-8" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">To</p>
                <Input type="date" value={rangeTo} onChange={e => setRangeTo(e.target.value)} className="text-xs h-8" />
              </div>
            </>
          )}
          <div className={periodMode === 'year' ? 'col-span-1' : 'lg:col-span-2'}>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Document Type</p>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {DOC_TYPES.map(t => <option key={t} value={t}>{t === 'All' ? 'All Documents' : t}</option>)}
            </select>
          </div>
        </div>
        {!ready && periodMode === 'range' && (
          <p className="text-xs text-amber-600">Select both a From and To date to generate the report.</p>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: 'Total Entries', value: summary.total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Gate Pass', value: summary.gp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Project ID', value: summary.pid, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Renewals', value: summary.renewals, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Initial Issuance', value: summary.initial, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'With Corrections', value: summary.corrected, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(card => (
          <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
            <div className="text-xs text-slate-500 font-medium">{card.label}</div>
            <div className={`text-2xl font-bold mt-1 ${card.color}`}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
            <FileText className="w-10 h-10 opacity-30" />
            <p className="font-medium">No renewal records found for {plabel}.</p>
          </div>
        ) : (
          <table className="table-list-view w-full">
            <thead className="bg-muted/40 sticky top-0">
              <tr>
                <th className="px-2 py-2 text-left font-semibold">#</th>
                <th className="px-2 py-2 text-left font-semibold">Personnel</th>
                <th className="px-2 py-2 text-left font-semibold">Company</th>
                <th className="px-2 py-2 text-left font-semibold">Document</th>
                <th className="px-2 py-2 text-left font-semibold">Ren. No.</th>
                <th className="px-2 py-2 text-left font-semibold">Entry Type</th>
                <th className="px-2 py-2 text-left font-semibold">Doc No.</th>
                <th className="px-2 py-2 text-left font-semibold">Issue / Submitted</th>
                <th className="px-2 py-2 text-left font-semibold">Received</th>
                <th className="px-2 py-2 text-left font-semibold">Expiry</th>
                <th className="px-2 py-2 text-left font-semibold">Recorded Status</th>
                <th className="px-2 py-2 text-left font-semibold">Renewal Date</th>
                <th className="px-2 py-2 text-left font-semibold">Recorded By</th>
                <th className="px-2 py-2 text-left font-semibold">Remarks</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || i} className="border-b hover:bg-muted/30">
                  <td className="px-2 py-1.5">{i + 1}</td>
                  <td className="px-2 py-1.5 font-medium">{r.employee_name || '—'}</td>
                  <td className="px-2 py-1.5">{r.company || '—'}</td>
                  <td className="px-2 py-1.5">{r.document_type || '—'}</td>
                  <td className="px-2 py-1.5">{r.renewal_no ?? '—'}</td>
                  <td className="px-2 py-1.5">{r.entry_type || '—'}</td>
                  <td className="px-2 py-1.5">{r.document_number || '—'}</td>
                  <td className="px-2 py-1.5">{r.issue_date || '—'}</td>
                  <td className="px-2 py-1.5">{r.received_date || '—'}</td>
                  <td className="px-2 py-1.5">{r.expiry_date || '—'}</td>
                  <td className="px-2 py-1.5">{r.recorded_status || '—'}</td>
                  <td className="px-2 py-1.5 font-medium">{r.renewal_date || '—'}</td>
                  <td className="px-2 py-1.5">{r.updated_by_name || '—'}</td>
                  <td className="px-2 py-1.5 max-w-xs truncate" title={r.remarks || ''}>{r.remarks || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}