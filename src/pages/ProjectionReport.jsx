import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
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
const getTrainingOnGoing   = (e) => {
  // On-going: training has started but not yet done (has start date, no end date or status not DONE)
  return (e.training_date_start && e.training_status !== 'DONE') ? 1 : 0;
};
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

// ── Table Components ─────────────────────────────────────────────────────────
const HEADER_COLS = [
  { label: 'DESIGNATION', width: '14%', group: null },
  { label: 'DVC SUBMITTED FROM CONTRACTOR', width: '8%', group: 'DVC' },
  { label: 'DVC SUBMITTED TO TR', width: '8%', group: 'DVC' },
  { label: 'PENDING MEDICAL', width: '7%', group: 'MEDICAL' },
  { label: 'FTW / APPROVED', width: '6%', group: 'MEDICAL' },
  { label: 'GP UNDER PROCESS', width: '8%', group: 'GATEPASS' },
  { label: 'VALID GATEPASS', width: '8%', group: 'GATEPASS' },
  { label: 'SCHEDULED', width: '7%', group: 'TRAINING' },
  { label: 'ON-GOING', width: '7%', group: 'TRAINING' },
  { label: 'COMPLETED', width: '7%', group: 'TRAINING' },
  { label: 'PID', width: '6%', group: null },
  { label: 'CAMP', width: '7%', group: null },
  { label: '', width: '7%', group: null },
];

const groupBg = {
  'DVC':      'bg-purple-100',
  'MEDICAL':  'bg-blue-100',
  'GATEPASS': 'bg-green-100',
  'TRAINING': 'bg-orange-100',
};
const groupCellBg = {
  'DVC':      'bg-purple-50/60',
  'MEDICAL':  'bg-blue-50/60',
  'GATEPASS': 'bg-green-50/60',
  'TRAINING': 'bg-orange-50/60',
};

function TableHeaders({ companyName, headerBg = 'bg-yellow-300' }) {
  // Group row spans
  const groups = [
    { label: '', span: 1 },
    { label: 'DVC', span: 2, bg: groupBg.DVC },
    { label: 'MEDICAL', span: 2, bg: groupBg.MEDICAL },
    { label: 'GATEPASS', span: 2, bg: groupBg.GATEPASS },
    { label: 'TRAINING', span: 3, bg: groupBg.TRAINING },
    { label: '', span: 1 },
    { label: '', span: 1 },
    { label: '', span: 1 },
  ];

  return (
    <>
      <tr>
        <td colSpan={13} className={`${headerBg} font-bold text-sm px-2 py-1 border border-black text-center tracking-widest`}>
          {companyName}
        </td>
      </tr>
      <tr className="text-center font-bold text-[9px]">
        {groups.map((g, i) => (
          <td key={i} colSpan={g.span} className={`border border-black py-0.5 ${g.bg || ''}`}>
            {g.label}
          </td>
        ))}
      </tr>
      <tr className="bg-gray-100 font-bold text-[9px] text-center">
        {HEADER_COLS.map((col, i) => (
          <td key={i} className={`border border-black px-1 py-1 ${col.group ? groupCellBg[col.group] : ''}`} style={{ width: col.width }}>
            {col.label}
          </td>
        ))}
      </tr>
    </>
  );
}

function DataRow({ label, data, isTotal = false }) {
  const c = (v) => (v === 0 ? '' : v);
  const baseClass = `border border-black px-1 py-0.5 text-center ${isTotal ? 'font-bold bg-yellow-50' : ''}`;
  return (
    <tr className={isTotal ? 'bg-yellow-50' : 'hover:bg-slate-50'}>
      <td className={`border border-black px-1 py-0.5 ${isTotal ? 'font-bold bg-yellow-50' : 'font-medium'} text-left`}>{label}</td>
      <td className={`${baseClass} ${groupCellBg.DVC}`}>{c(data.dvcFrom)}</td>
      <td className={`${baseClass} ${groupCellBg.DVC}`}>{c(data.dvcTo)}</td>
      <td className={`${baseClass} ${groupCellBg.MEDICAL}`}>{c(data.pendingMedical)}</td>
      <td className={`${baseClass} ${groupCellBg.MEDICAL}`}>{c(data.ftw)}</td>
      <td className={`${baseClass} ${groupCellBg.GATEPASS}`}>{c(data.gpUnder)}</td>
      <td className={`${baseClass} ${groupCellBg.GATEPASS}`}>{c(data.validGP)}</td>
      <td className={`${baseClass} ${groupCellBg.TRAINING}`}>{c(data.trainingScheduled)}</td>
      <td className={`${baseClass} ${groupCellBg.TRAINING}`}>{c(data.trainingOnGoing)}</td>
      <td className={`${baseClass} ${groupCellBg.TRAINING}`}>{c(data.trainingDone)}</td>
      <td className={baseClass}>{c(data.pid)}</td>
      <td className={baseClass}>{c(data.camp)}</td>
      <td className={baseClass}></td>
    </tr>
  );
}

function ReportTable({ company, rows }) {
  const designations = Object.keys(rows).sort();
  const totals = sumRows(rows);
  return (
    <div className="mb-6 break-inside-avoid">
      <table className="w-full border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
        <tbody>
          <TableHeaders companyName={company} />
          {designations.map(d => <DataRow key={d} label={d} data={rows[d]} />)}
          <DataRow label="TOTAL" data={totals} isTotal />
        </tbody>
      </table>
    </div>
  );
}

function GrandTotalTable({ companyData }) {
  const companies = Object.keys(companyData).sort();
  const grandTotal = ZERO_ROW();
  const companyTotals = {};
  for (const co of companies) {
    companyTotals[co] = sumRows(companyData[co]);
    for (const k of Object.keys(grandTotal)) grandTotal[k] += companyTotals[co][k];
  }

  const c = (v) => (v === 0 ? '' : v);

  const groups = [
    { label: '', span: 1 },
    { label: 'DVC', span: 2, bg: groupBg.DVC },
    { label: 'MEDICAL', span: 2, bg: groupBg.MEDICAL },
    { label: 'GATEPASS', span: 2, bg: groupBg.GATEPASS },
    { label: 'TRAINING', span: 3, bg: groupBg.TRAINING },
    { label: '', span: 1 },
    { label: '', span: 1 },
    { label: '', span: 1 },
  ];

  return (
    <div className="mb-8 break-inside-avoid">
      <table className="w-full border-collapse text-[10px]" style={{ tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td colSpan={13} className="bg-slate-800 text-white font-bold text-sm px-2 py-1 border border-black text-center tracking-widest">
              GRAND TOTAL — ALL COMPANIES
            </td>
          </tr>
          <tr className="text-center font-bold text-[9px]">
            {groups.map((g, i) => (
              <td key={i} colSpan={g.span} className={`border border-black py-0.5 ${g.bg || ''}`}>{g.label}</td>
            ))}
          </tr>
          <tr className="bg-gray-100 font-bold text-[9px] text-center">
            <td className="border border-black px-1 py-1 text-left" style={{ width: '14%' }}>COMPANY</td>
            {HEADER_COLS.slice(1).map((col, i) => (
              <td key={i} className={`border border-black px-1 py-1 ${col.group ? groupCellBg[col.group] : ''}`} style={{ width: col.width }}>{col.label}</td>
            ))}
          </tr>
          {companies.map(co => (
            <tr key={co} className="hover:bg-slate-50 text-center">
              <td className="border border-black px-1 py-0.5 text-left font-medium">{co}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.DVC}`}>{c(companyTotals[co].dvcFrom)}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.DVC}`}>{c(companyTotals[co].dvcTo)}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.MEDICAL}`}>{c(companyTotals[co].pendingMedical)}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.MEDICAL}`}>{c(companyTotals[co].ftw)}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.GATEPASS}`}>{c(companyTotals[co].gpUnder)}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.GATEPASS}`}>{c(companyTotals[co].validGP)}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.TRAINING}`}>{c(companyTotals[co].trainingScheduled)}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.TRAINING}`}>{c(companyTotals[co].trainingOnGoing)}</td>
              <td className={`border border-black px-1 py-0.5 ${groupCellBg.TRAINING}`}>{c(companyTotals[co].trainingDone)}</td>
              <td className="border border-black px-1 py-0.5">{c(companyTotals[co].pid)}</td>
              <td className="border border-black px-1 py-0.5">{c(companyTotals[co].camp)}</td>
              <td className="border border-black px-1 py-0.5"></td>
            </tr>
          ))}
          <tr className="text-center bg-slate-800 text-white font-bold">
            <td className="border border-white px-1 py-1 text-left">GRAND TOTAL</td>
            <td className="border border-white px-1 py-1">{grandTotal.dvcFrom || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.dvcTo || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.pendingMedical || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.ftw || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.gpUnder || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.validGP || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.trainingScheduled || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.trainingOnGoing || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.trainingDone || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.pid || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.camp || ''}</td>
            <td className="border border-white px-1 py-1"></td>
          </tr>
        </tbody>
      </table>
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
  const today = format(new Date(), 'dd-MM-yyyy');

  const [selectedCompany, setSelectedCompany] = useState('ALL');
  const [reportDate, setReportDate] = useState(format(new Date(), 'yyyy-MM-dd'));

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

  const companies = useMemo(() => Object.keys(filteredCompanyData).sort(), [filteredCompanyData]);

  const displayDate = reportDate
    ? format(new Date(reportDate + 'T00:00:00'), 'dd-MM-yyyy')
    : today;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls — hidden on print */}
      <div className="no-print flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Projection Report</h2>
          <p className="text-sm text-muted-foreground mt-1">Active personnel only</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Date filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Report Date:</label>
            <Input
              type="date"
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-40"
            />
          </div>
          {/* Company filter */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-slate-600 whitespace-nowrap">Company:</label>
            <Select value={selectedCompany} onValueChange={setSelectedCompany}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="All Companies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Companies</SelectItem>
                {ALL_COMPANIES.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Print / PDF
          </Button>
        </div>
      </div>

      {/* Report content */}
      <div id="projection-report">
        {/* Report Title */}
        <div className="text-center mb-4">
          <div className="text-base font-bold uppercase tracking-widest text-slate-800">
            GATEPASS DAILY REPORT UPDATE — {displayDate}
          </div>
          {selectedCompany !== 'ALL' && (
            <div className="text-sm text-slate-600 mt-0.5">Company: {selectedCompany}</div>
          )}
        </div>

        {/* Grand Total Summary — only when showing all companies */}
        {selectedCompany === 'ALL' && <GrandTotalTable companyData={filteredCompanyData} />}

        {/* Per-company tables */}
        {companies.map(co => (
          <ReportTable
            key={co}
            company={co}
            rows={filteredCompanyData[co]}
          />
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: landscape; margin: 10mm; }
          .no-print { display: none !important; }
          body { background: white !important; }
          #projection-report { padding: 0; }
        }
      `}</style>
    </div>
  );
}