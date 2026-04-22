import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Printer, X } from 'lucide-react';
import { computePassStatus } from '@/utils/constants';
import { format } from 'date-fns';

// ── Column logic ────────────────────────────────────────────────────────────
function getDvcFromContractor(e) {
  return e.visa_date_applied ? 1 : 0;
}

function getDvcToTR(e) {
  return e.ftw_approval_request_date ? 1 : 0;
}

function getPendingMedical(e) {
  // Has no FTW result yet (or result is blank), meaning still pending
  return (!e.ftw_result || e.ftw_result === 'WAITING TR APPROVAL' || e.ftw_result === 'RE-ASSESS') ? 1 : 0;
}

function getFTW(e) {
  return e.ftw_result === 'ACCEPTED' ? 1 : 0;
}

function getGPUnderProcess(e) {
  // Has gate pass issue date but NO valid/soon-to-expire pass yet
  const status = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  const hasIssueDate = !!e.gate_pass_issue_date;
  const isValid = status === 'VALID RLIC PASS' || status === 'SOON TO EXPIRE';
  return (hasIssueDate && !isValid) ? 1 : 0;
}

function getValidGatepass(e) {
  const status = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  return (status === 'VALID RLIC PASS' || status === 'SOON TO EXPIRE') ? 1 : 0;
}

function getTrainingScheduled(e) {
  return e.training_status === 'PENDING' ? 1 : 0;
}

function getTrainingCompleted(e) {
  return e.training_status === 'DONE' ? 1 : 0;
}

function getPID(e) {
  const status = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
  return (status === 'VALID PID PASS' || status === 'SOON TO EXPIRE') ? 1 : 0;
}

function getCamp(e) {
  return e.current_location === 'COMO CAMP' ? 1 : 0;
}

// ── Build per-company, per-designation table ──────────────────────────────
function buildCompanyData(employees) {
  const companyMap = {};

  for (const e of employees) {
    if (e.is_active === false) continue;
    const company = (e.company || 'UNKNOWN').toUpperCase();
    const designation = (e.designation_org_chart || e.position_application || 'UNSPECIFIED').toUpperCase();

    if (!companyMap[company]) companyMap[company] = {};
    if (!companyMap[company][designation]) {
      companyMap[company][designation] = {
        dvcFrom: 0, dvcTo: 0, pendingMedical: 0, ftw: 0,
        gpUnder: 0, validGP: 0, trainingScheduled: 0, trainingDone: 0,
        pid: 0, camp: 0,
      };
    }

    const row = companyMap[company][designation];
    row.dvcFrom        += getDvcFromContractor(e);
    row.dvcTo          += getDvcToTR(e);
    row.pendingMedical += getPendingMedical(e);
    row.ftw            += getFTW(e);
    row.gpUnder        += getGPUnderProcess(e);
    row.validGP        += getValidGatepass(e);
    row.trainingScheduled += getTrainingScheduled(e);
    row.trainingDone   += getTrainingCompleted(e);
    row.pid            += getPID(e);
    row.camp           += getCamp(e);
  }

  return companyMap;
}

function sumRows(rows) {
  const totals = { dvcFrom: 0, dvcTo: 0, pendingMedical: 0, ftw: 0, gpUnder: 0, validGP: 0, trainingScheduled: 0, trainingDone: 0, pid: 0, camp: 0 };
  for (const r of Object.values(rows)) {
    for (const k of Object.keys(totals)) totals[k] += r[k];
  }
  return totals;
}

// ── Printable Report ──────────────────────────────────────────────────────
function ReportTable({ company, rows, totals }) {
  const designations = Object.keys(rows).sort();
  const cell = (v) => (v === 0 ? '' : v);

  return (
    <div className="mb-8 break-inside-avoid">
      {/* Company Header */}
      <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td colSpan={11} className="bg-yellow-300 font-bold text-sm px-2 py-1 border border-black text-center tracking-widest">
              {company}
            </td>
          </tr>
          <tr>
            <td className="border border-black" />
            <td className="border border-black" />
            <td colSpan={2} className="border border-black bg-blue-100 font-bold text-center py-0.5">MEDICAL</td>
            <td colSpan={2} className="border border-black bg-green-100 font-bold text-center py-0.5">GATEPASS</td>
            <td colSpan={2} className="border border-black bg-orange-100 font-bold text-center py-0.5">TRAINING</td>
            <td className="border border-black" />
            <td className="border border-black" />
          </tr>
          <tr className="bg-gray-100 font-bold text-[10px] text-center">
            <td className="border border-black px-1 py-1 text-left" style={{ width: '18%' }}>DESIGNATION</td>
            <td className="border border-black px-1 py-1" style={{ width: '9%' }}>DVC SUBMITTED FROM CONTRACTOR</td>
            <td className="border border-black px-1 py-1" style={{ width: '8%' }}>DVC SUBMITTED TO TR</td>
            <td className="border border-black px-1 py-1 bg-blue-50" style={{ width: '8%' }}>PENDING MEDICAL</td>
            <td className="border border-black px-1 py-1 bg-blue-50" style={{ width: '6%' }}>FTW</td>
            <td className="border border-black px-1 py-1 bg-green-50" style={{ width: '9%' }}>GP UNDER PROCESS</td>
            <td className="border border-black px-1 py-1 bg-green-50" style={{ width: '9%' }}>VALID GATEPASS</td>
            <td className="border border-black px-1 py-1 bg-orange-50" style={{ width: '10%' }}>SCHEDULED / ON-GOING</td>
            <td className="border border-black px-1 py-1 bg-orange-50" style={{ width: '8%' }}>COMPLETED</td>
            <td className="border border-black px-1 py-1" style={{ width: '7%' }}>PID</td>
            <td className="border border-black px-1 py-1" style={{ width: '8%' }}>CAMP</td>
          </tr>
          {designations.map(d => (
            <tr key={d} className="text-center hover:bg-slate-50">
              <td className="border border-black px-1 py-0.5 text-left font-medium">{d}</td>
              <td className="border border-black px-1 py-0.5">{cell(rows[d].dvcFrom)}</td>
              <td className="border border-black px-1 py-0.5">{cell(rows[d].dvcTo)}</td>
              <td className="border border-black px-1 py-0.5 bg-blue-50/50">{cell(rows[d].pendingMedical)}</td>
              <td className="border border-black px-1 py-0.5 bg-blue-50/50">{cell(rows[d].ftw)}</td>
              <td className="border border-black px-1 py-0.5 bg-green-50/50">{cell(rows[d].gpUnder)}</td>
              <td className="border border-black px-1 py-0.5 bg-green-50/50">{cell(rows[d].validGP)}</td>
              <td className="border border-black px-1 py-0.5 bg-orange-50/50">{cell(rows[d].trainingScheduled)}</td>
              <td className="border border-black px-1 py-0.5 bg-orange-50/50">{cell(rows[d].trainingDone)}</td>
              <td className="border border-black px-1 py-0.5">{cell(rows[d].pid)}</td>
              <td className="border border-black px-1 py-0.5">{cell(rows[d].camp)}</td>
            </tr>
          ))}
          {/* Totals row */}
          <tr className="text-center bg-yellow-50 font-bold">
            <td className="border border-black px-1 py-1 text-left">TOTAL</td>
            <td className="border border-black px-1 py-1">{totals.dvcFrom || ''}</td>
            <td className="border border-black px-1 py-1">{totals.dvcTo || ''}</td>
            <td className="border border-black px-1 py-1 bg-blue-100">{totals.pendingMedical || ''}</td>
            <td className="border border-black px-1 py-1 bg-blue-100">{totals.ftw || ''}</td>
            <td className="border border-black px-1 py-1 bg-green-100">{totals.gpUnder || ''}</td>
            <td className="border border-black px-1 py-1 bg-green-100">{totals.validGP || ''}</td>
            <td className="border border-black px-1 py-1 bg-orange-100">{totals.trainingScheduled || ''}</td>
            <td className="border border-black px-1 py-1 bg-orange-100">{totals.trainingDone || ''}</td>
            <td className="border border-black px-1 py-1">{totals.pid || ''}</td>
            <td className="border border-black px-1 py-1">{totals.camp || ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Grand Total Summary Table ──────────────────────────────────────────────
function GrandTotalTable({ companyData }) {
  const companies = Object.keys(companyData).sort();
  const grandTotal = { dvcFrom: 0, dvcTo: 0, pendingMedical: 0, ftw: 0, gpUnder: 0, validGP: 0, trainingScheduled: 0, trainingDone: 0, pid: 0, camp: 0 };
  const companyTotals = {};
  for (const co of companies) {
    companyTotals[co] = sumRows(companyData[co]);
    for (const k of Object.keys(grandTotal)) grandTotal[k] += companyTotals[co][k];
  }

  const cell = (v) => (v === 0 ? '' : v);

  return (
    <div className="mb-8 break-inside-avoid">
      <table className="w-full border-collapse text-xs" style={{ tableLayout: 'fixed' }}>
        <tbody>
          <tr>
            <td colSpan={11} className="bg-slate-800 text-white font-bold text-sm px-2 py-1 border border-black text-center tracking-widest">
              GRAND TOTAL — ALL COMPANIES
            </td>
          </tr>
          <tr>
            <td className="border border-black" />
            <td className="border border-black" />
            <td colSpan={2} className="border border-black bg-blue-100 font-bold text-center py-0.5">MEDICAL</td>
            <td colSpan={2} className="border border-black bg-green-100 font-bold text-center py-0.5">GATEPASS</td>
            <td colSpan={2} className="border border-black bg-orange-100 font-bold text-center py-0.5">TRAINING</td>
            <td className="border border-black" />
            <td className="border border-black" />
          </tr>
          <tr className="bg-gray-100 font-bold text-[10px] text-center">
            <td className="border border-black px-1 py-1 text-left" style={{ width: '18%' }}>COMPANY</td>
            <td className="border border-black px-1 py-1" style={{ width: '9%' }}>DVC FROM CONTRACTOR</td>
            <td className="border border-black px-1 py-1" style={{ width: '8%' }}>DVC TO TR</td>
            <td className="border border-black px-1 py-1 bg-blue-50" style={{ width: '8%' }}>PENDING MEDICAL</td>
            <td className="border border-black px-1 py-1 bg-blue-50" style={{ width: '6%' }}>FTW</td>
            <td className="border border-black px-1 py-1 bg-green-50" style={{ width: '9%' }}>GP UNDER PROCESS</td>
            <td className="border border-black px-1 py-1 bg-green-50" style={{ width: '9%' }}>VALID GATEPASS</td>
            <td className="border border-black px-1 py-1 bg-orange-50" style={{ width: '10%' }}>SCHEDULED / ON-GOING</td>
            <td className="border border-black px-1 py-1 bg-orange-50" style={{ width: '8%' }}>COMPLETED</td>
            <td className="border border-black px-1 py-1" style={{ width: '7%' }}>PID</td>
            <td className="border border-black px-1 py-1" style={{ width: '8%' }}>CAMP</td>
          </tr>
          {companies.map(co => (
            <tr key={co} className="text-center">
              <td className="border border-black px-1 py-0.5 text-left font-medium">{co}</td>
              <td className="border border-black px-1 py-0.5">{cell(companyTotals[co].dvcFrom)}</td>
              <td className="border border-black px-1 py-0.5">{cell(companyTotals[co].dvcTo)}</td>
              <td className="border border-black px-1 py-0.5 bg-blue-50/50">{cell(companyTotals[co].pendingMedical)}</td>
              <td className="border border-black px-1 py-0.5 bg-blue-50/50">{cell(companyTotals[co].ftw)}</td>
              <td className="border border-black px-1 py-0.5 bg-green-50/50">{cell(companyTotals[co].gpUnder)}</td>
              <td className="border border-black px-1 py-0.5 bg-green-50/50">{cell(companyTotals[co].validGP)}</td>
              <td className="border border-black px-1 py-0.5 bg-orange-50/50">{cell(companyTotals[co].trainingScheduled)}</td>
              <td className="border border-black px-1 py-0.5 bg-orange-50/50">{cell(companyTotals[co].trainingDone)}</td>
              <td className="border border-black px-1 py-0.5">{cell(companyTotals[co].pid)}</td>
              <td className="border border-black px-1 py-0.5">{cell(companyTotals[co].camp)}</td>
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
            <td className="border border-white px-1 py-1">{grandTotal.trainingDone || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.pid || ''}</td>
            <td className="border border-white px-1 py-1">{grandTotal.camp || ''}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function ProjectionReport() {
  const today = format(new Date(), 'dd-MM-yyyy');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const companyData = useMemo(() => buildCompanyData(employees), [employees]);
  const companies = useMemo(() => Object.keys(companyData).sort(), [companyData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between no-print">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Daily Projection Report</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Generated: {today} — Active personnel only
          </p>
        </div>
        <Button onClick={() => window.print()} className="gap-2">
          <Printer className="w-4 h-4" /> Print / PDF
        </Button>
      </div>

      {/* Report content */}
      <div id="projection-report">
        {/* Report Title */}
        <div className="text-center mb-6">
          <div className="text-xl font-bold uppercase tracking-widest text-slate-800">
            PROJECTION REPORT — DAILY UPDATE
          </div>
          <div className="text-sm text-slate-600 mt-1">{today}</div>
        </div>

        {/* Grand Total Summary first */}
        <GrandTotalTable companyData={companyData} />

        {/* Per-company tables */}
        {companies.map(co => (
          <ReportTable
            key={co}
            company={co}
            rows={companyData[co]}
            totals={sumRows(companyData[co])}
          />
        ))}
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          #projection-report { padding: 10px; }
        }
      `}</style>
    </div>
  );
}