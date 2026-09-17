import React, { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ClipboardList, Loader2, ChevronDown, Eye, Printer, FileText } from 'lucide-react';
import { buildPersonalWorkingRecord, exportPersonalWorkingRecordPdf } from '@/lib/personalWorkingRecordPdf';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTHS_UP = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];

const INDIGO = '#4338ca';

// Build the printable HTML for one employee page (used for Preview + Print A4).
const buildPageHtml = (emp, rows, year, month) => {
  const dayRows = rows.map((r) => `
    <tr>
      <td class="c-date">${r.dayNum}</td>
      <td>${r.firstIn === '—' ? '' : r.firstIn}</td>
      <td>${r.firstOut === '—' ? '' : r.firstOut}</td>
      <td>${r.secondIn === '—' ? '' : r.secondIn}</td>
      <td>${r.finalOut === '—' ? '' : r.finalOut}</td>
      <td class="c-sig"></td>
    </tr>`).join('');

  return `
  <div class="pwr-page">
    <table class="pwr-table">
      <colgroup>
        <col style="width:11%"><col style="width:13%"><col style="width:13%">
        <col style="width:13%"><col style="width:13%"><col style="width:37%">
      </colgroup>
      <tbody>
        <tr>
          <td colspan="6" class="pwr-title">RLTO EXPANSION AND OFFPLOT FACILITIES OF THE NORTH FIELD EXPANSION PROJECT (PEC-3)</td>
        </tr>
        <tr>
          <td colspan="5" class="pwr-subtitle">PERSONAL WORKING RECORD</td>
          <td rowspan="2" class="pwr-supplier">SUPPLIER'S</td>
        </tr>
        <tr>
          <td class="lbl">NAME</td>
          <td class="val">${emp.name || ''}</td>
          <td class="lbl">PID NO.</td>
          <td class="val" colspan="2">${emp.pid || ''}</td>
        </tr>
        <tr>
          <td class="lbl">COMPANY:</td>
          <td class="val">${emp.company || ''}</td>
          <td class="lbl">QID NO.</td>
          <td class="val" colspan="2">${emp.qid_no || ''}</td>
        </tr>
        <tr>
          <td class="lbl">DESIGNATION:</td>
          <td class="val">${emp.position_application || emp.designation_org_chart || ''}</td>
          <td class="lbl" colspan="3"></td>
        </tr>
        <tr>
          <td class="lbl">YEAR</td>
          <td class="val center">${year}</td>
          <td class="lbl">MONTH</td>
          <td class="val" colspan="3">MONTH OF (${MONTHS_UP[month]}) ${year}</td>
        </tr>
        <tr class="pwr-header">
          <th>DATE</th>
          <th>Time In</th>
          <th>Time Out</th>
          <th>Time In</th>
          <th>Time Out</th>
          <th>Employee Signature</th>
        </tr>
        ${dayRows}
      </tbody>
    </table>
    <div class="pwr-signatures">
      <div class="sig-left">
        <div class="sig-label">SUPERVISOR NAME &amp; SIGNATURE</div>
        <div class="sig-line"></div>
      </div>
      <div class="sig-right">
        <div class="sig-label">MANAGER NAME &amp; SIGNATURE</div>
        <div class="sig-line"></div>
      </div>
    </div>
    <div class="pwr-hr">
      <div class="sig-label">HR DEPARTMENT SIGNATURE</div>
      <div class="sig-note">The completed timesheets must be submitted to Site HR no later than the 23rd of each month.</div>
    </div>
  </div>`;
};

const PRINT_STYLES = `
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; margin: 0; padding: 0; }
  .pwr-page { width: 190mm; margin: 0 auto; page-break-after: always; }
  .pwr-page:last-child { page-break-after: auto; }
  .pwr-table { width: 100%; border-collapse: collapse; border: 1px solid #000; }
  .pwr-table td, .pwr-table th { border: 1px solid #000; padding: 3px 5px; font-size: 9pt; vertical-align: middle; }
  .pwr-title { background: #d9ead3; text-align: center; font-weight: bold; font-size: 9.5pt; padding: 5px; }
  .pwr-subtitle { background: #cfe2f3; text-align: center; font-weight: bold; font-size: 13pt; padding: 8px; }
  .pwr-supplier { background: #f4cccc; text-align: center; font-weight: bold; font-size: 10pt; vertical-align: top; padding-top: 6px; }
  .pwr-table .lbl { background: #cfe2f3; font-weight: bold; font-size: 8.5pt; white-space: nowrap; }
  .pwr-table .val { font-size: 9pt; }
  .pwr-table .val.center { text-align: center; font-weight: bold; }
  .pwr-header th { background: #cfe2f3; text-align: center; font-weight: bold; font-size: 9pt; padding: 5px; }
  .pwr-table .c-date { text-align: center; }
  .pwr-table .c-sig { min-height: 18px; }
  .pwr-signatures { display: flex; justify-content: space-between; margin-top: 18mm; padding: 0 5mm; }
  .sig-left, .sig-right { width: 42%; }
  .sig-label { font-weight: bold; font-size: 9pt; }
  .sig-line { border-bottom: 1px solid #000; margin-top: 14mm; height: 1px; }
  .pwr-hr { margin-top: 12mm; padding: 0 5mm; }
  .pwr-hr .sig-label { font-weight: bold; font-size: 9pt; }
  .pwr-hr .sig-note { font-size: 8.5pt; margin-top: 4mm; }
`;

export default function PersonalWorkingRecordDialog({ open, onOpenChange, employees, records }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [employeeId, setEmployeeId] = useState('');
  const [search, setSearch] = useState('');
  const [company, setCompany] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const previewRef = useRef(null);

  const companies = useMemo(
    () => [...new Set(employees.map((e) => e.company).filter(Boolean))].sort(),
    [employees]
  );

  const filteredEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (company && e.company !== company) return false;
      if (search) {
        const hay = `${e.name || ''} ${e.qid_no || ''} ${e.pid || ''} ${e.staff_no || ''}`.toLowerCase();
        if (!hay.includes(search.toLowerCase())) return false;
      }
      return true;
    });
  }, [employees, company, search]);

  const selectedEmp = filteredEmployees.find((e) => e.id === employeeId) || null;

  const targets = selectedEmp ? [selectedEmp] : filteredEmployees;

  const builtPages = useMemo(() => {
    if (!showPreview) return [];
    return targets.map((emp) => ({
      emp,
      rows: buildPersonalWorkingRecord(emp, records, year, month),
    }));
  }, [showPreview, targets, records, year, month]);

  const handleExportPdf = async () => {
    if (targets.length === 0) return;
    setBusy(true);
    try {
      exportPersonalWorkingRecordPdf(targets, records, year, month);
    } finally {
      setBusy(false);
    }
  };

  const handlePrint = () => {
    if (targets.length === 0) return;
    const pages = targets.map((emp) => buildPageHtml(emp, buildPersonalWorkingRecord(emp, records, year, month), year, month)).join('');
    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><title>Personal Working Record</title><style>${PRINT_STYLES}</style></head><body>${pages}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader className="flex-row items-center gap-2 space-y-0">
          <ClipboardList className="w-5 h-5" style={{ color: INDIGO }} />
          <DialogTitle>Personal Working Record</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee select */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700">Employee</label>
            <input
              list="pwr-emp-list"
              value={selectedEmp ? selectedEmp.name : search}
              onChange={(e) => {
                setSearch(e.target.value);
                const match = filteredEmployees.find((emp) => emp.name === e.target.value);
                setEmployeeId(match ? match.id : '');
              }}
              placeholder="— Search or select an employee —"
              className="w-full h-9 rounded-md border border-slate-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <datalist id="pwr-emp-list">
              {filteredEmployees.slice(0, 500).map((e) => <option key={e.id} value={e.name} />)}
            </datalist>
            <p className="text-[11px] text-slate-500">Leave empty to generate one A4 page per filtered employee.</p>
          </div>

          {/* Company + Month + Year */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Company</label>
              <div className="relative">
                <select value={company} onChange={(e) => setCompany(e.target.value)}
                  className="w-full h-9 rounded-md border border-slate-300 bg-slate-50 pl-2.5 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">All Companies</option>
                  {companies.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Month <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={MONTHS[month]} onChange={(e) => setMonth(MONTHS.indexOf(e.target.value))}
                  className="w-full h-9 rounded-md border border-slate-300 bg-slate-50 pl-2.5 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700">Year <span className="text-red-500">*</span></label>
              <div className="relative">
                <select value={String(year)} onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full h-9 rounded-md border border-slate-300 bg-slate-50 pl-2.5 pr-8 text-sm appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  {Array.from({ length: 8 }, (_, i) => String(now.getFullYear() - 3 + i)).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
                <ChevronDown className="w-4 h-4 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
              </div>
            </div>
          </div>

          {/* Status bar */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-600">
            {targets.length === 0
              ? 'No employees match the selected filters.'
              : selectedEmp
                ? <>Generating <span className="font-bold text-slate-900">{selectedEmp.name}</span>'s record for <span className="font-bold text-slate-900">{MONTHS[month]} {year}</span>.</>
                : <>Generating records for <span className="font-bold text-slate-900">{targets.length}</span> employees for <span className="font-bold text-slate-900">{MONTHS[month]} {year}</span> (one A4 page each).</>}
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowPreview(s => !s)} disabled={targets.length === 0} className="gap-2">
                <Eye className="w-4 h-4" /> {showPreview ? 'Hide Preview' : 'Preview'}
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} disabled={targets.length === 0} className="gap-2">
                <Printer className="w-4 h-4" /> Print A4
              </Button>
            </div>
            <Button size="sm" onClick={handleExportPdf} disabled={busy || targets.length === 0} className="gap-2 text-white" style={{ background: INDIGO }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              Export PDF
            </Button>
          </div>

          {/* Inline preview */}
          {showPreview && (
            <div ref={previewRef} className="border border-slate-200 rounded-lg bg-slate-100 p-4 max-h-[420px] overflow-auto">
              {builtPages.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">No employees to preview.</p>
              ) : (
                builtPages.map((p, i) => (
                  <div key={i} dangerouslySetInnerHTML={{ __html: `<style>${PRINT_STYLES} .pwr-page{transform:scale(0.62);transform-origin:top center;margin-bottom:-160px;}</style>${buildPageHtml(p.emp, p.rows, year, month)}` }} />
                ))
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); setShowPreview(false); }} disabled={busy}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}