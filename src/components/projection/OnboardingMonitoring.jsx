import React, { useMemo, useState, useEffect } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computePassStatus } from '@/utils/constants';

// ── Status helpers ─────────────────────────────────────────────────────────────
function getMedicalLabel(emp) {
  const ftw = (emp.ftw_result || '').trim().toUpperCase();
  if (!emp.ftw_result) return { label: 'New', color: 'bg-slate-100 text-slate-700' };
  if (ftw === 'ACCEPTED') return { label: 'Accepted', color: 'bg-green-100 text-green-700' };
  if (ftw === 'WAITING TR APPROVAL') return { label: 'Waiting TR', color: 'bg-blue-100 text-blue-700' };
  if (ftw === 'RE-ASSESS') return { label: 'Re-Assess', color: 'bg-amber-100 text-amber-700' };
  if (ftw === 'REJECTED') return { label: 'Recalled', color: 'bg-red-100 text-red-700' };
  return { label: emp.ftw_result, color: 'bg-slate-100 text-slate-600' };
}

function getGPLabel(emp) {
  const raw = (emp.rlic_status || '').trim().toUpperCase();
  const effective = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
  const eff = (effective || '').toUpperCase();
  if (eff === 'VALID RLIC PASS') return { label: 'Valid', color: 'bg-green-100 text-green-700' };
  if (eff === 'SOON TO EXPIRE') return { label: 'Soon', color: 'bg-amber-100 text-amber-700' };
  if (eff === 'EXPIRED RLIC PASS') return { label: 'Expired', color: 'bg-red-100 text-red-700' };
  if (eff === 'NO RLIC PASS') return { label: 'No Pass', color: 'bg-slate-100 text-slate-500' };
  if (raw === 'UNDER PROCESS' || raw === 'DVC SENT') return { label: 'Under Process', color: 'bg-blue-100 text-blue-700' };
  if (raw === 'WAITING MOI APPROVAL') return { label: 'Waiting MOI', color: 'bg-indigo-100 text-indigo-700' };
  if (raw === 'HOLDING ACTIVE GP') return { label: 'Holding Active GP', color: 'bg-teal-100 text-teal-700' };
  return { label: emp.rlic_status || '—', color: 'bg-slate-100 text-slate-600' };
}

function getTrainingLabel(emp) {
  const t = (emp.training_status || '').trim().toUpperCase();
  if (!emp.training_status) return { label: '—', color: 'bg-slate-100 text-slate-400' };
  if (t === 'DONE') return { label: 'Done', color: 'bg-green-100 text-green-700' };
  if (t === 'PENDING') return { label: 'Pending', color: 'bg-amber-100 text-amber-700' };
  if (t === 'ON-GOING' || t === 'ONGOING' || t === 'ON GOING') return { label: 'On-Going', color: 'bg-blue-100 text-blue-700' };
  if (t === 'SCHEDULED') return { label: 'Scheduled', color: 'bg-purple-100 text-purple-700' };
  if (t === 'NOT REQUIRED') return { label: 'Not Required', color: 'bg-slate-100 text-slate-500' };
  return { label: emp.training_status, color: 'bg-slate-100 text-slate-600' };
}

function getPIDLabel(emp) {
  const raw = (emp.pid_status || '').trim().toUpperCase();
  const effective = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
  const eff = (effective || '').toUpperCase();
  if (eff === 'VALID PID PASS') return { label: 'Valid', color: 'bg-green-100 text-green-700' };
  if (eff === 'SOON TO EXPIRE') return { label: 'Soon', color: 'bg-amber-100 text-amber-700' };
  if (eff === 'EXPIRED PID PASS') return { label: 'Expired', color: 'bg-red-100 text-red-700' };
  if (eff === 'NO PID PASS' || raw === 'NO PID PASS') return { label: 'No PID', color: 'bg-slate-100 text-slate-500' };
  if (raw === 'RENEWAL UNDER PROCESS') return { label: 'Renewal Under Process', color: 'bg-blue-100 text-blue-700' };
  if (raw === 'RECALLED') return { label: 'Recalled', color: 'bg-red-100 text-red-700' };
  return { label: emp.pid_status || '—', color: 'bg-slate-100 text-slate-600' };
}

function daysSince(dateStr) {
  if (!dateStr) return null;
  try {
    const d = parseISO(dateStr.substring(0, 10));
    const diff = differenceInDays(new Date(), d);
    return diff >= 0 ? diff : null;
  } catch { return null; }
}

// ── Summary cards ──────────────────────────────────────────────────────────────
function SummaryCards({ employees }) {
  const stats = useMemo(() => {
    let pendingMed = 0, ftwApproved = 0, gpUnder = 0, validGP = 0, trainingDone = 0, pidValid = 0;
    for (const emp of employees) {
      const ftw = (emp.ftw_result || '').trim().toUpperCase();
      if (!emp.ftw_result || ftw === 'WAITING TR APPROVAL' || ftw === 'RE-ASSESS') pendingMed++;
      if (ftw === 'ACCEPTED') ftwApproved++;
      const raw = (emp.rlic_status || '').trim().toUpperCase();
      if (raw === 'UNDER PROCESS' || raw === 'DVC SENT') gpUnder++;
      const eff = (computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status) || '').toUpperCase();
      if (eff === 'VALID RLIC PASS' || eff === 'SOON TO EXPIRE') validGP++;
      const tr = (emp.training_status || '').trim().toUpperCase();
      if (tr === 'DONE') trainingDone++;
      const pid = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase();
      if (pid === 'VALID PID PASS' || pid === 'SOON TO EXPIRE') pidValid++;
    }
    return [
      { label: 'Pending Medical', value: pendingMed, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'FTW Approved', value: ftwApproved, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'GP Under Process', value: gpUnder, color: 'text-amber-600', bg: 'bg-amber-50' },
      { label: 'Valid Gate Pass', value: validGP, color: 'text-green-600', bg: 'bg-green-50' },
      { label: 'Training Completed', value: trainingDone, color: 'text-orange-600', bg: 'bg-orange-50' },
      { label: 'PID Valid', value: pidValid, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];
  }, [employees]);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {stats.map(card => (
        <div key={card.label} className={`rounded-xl border p-4 ${card.bg}`}>
          <div className="text-xs text-slate-500 font-medium">{card.label}</div>
          <div className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</div>
        </div>
      ))}
    </div>
  );
}

const PAGE_SIZE = 20;

// ── Department Table ───────────────────────────────────────────────────────────
function DeptTable({ dept, employees, resetKey }) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const totalPages = Math.ceil(employees.length / PAGE_SIZE);
  const paginated = employees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="mb-6">
      {/* Department Header */}
      <div className="text-center font-bold text-white text-sm py-1.5 rounded-t" style={{ background: '#1e7b8a' }}>
        {dept} <span className="font-normal opacity-80 text-xs">({employees.length} records)</span>
      </div>
      <div className="overflow-x-auto rounded-b border border-t-0">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr style={{ background: '#1e7b8a' }} className="text-white">
              <th className="border border-teal-600 px-2 py-1.5 text-center w-6">#</th>
              <th className="border border-teal-600 px-2 py-1.5 text-left">Full Name</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">QID Number</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">Mobile Number</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">Company</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">Designation / Position</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">Medical</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">TR Date Approved</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">Gate Pass Status</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">Gatepass Received Date</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">Training Status</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center" style={{ background: '#4caf7d' }}>Project ID Status</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">Remarks</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">No. Days Since Med Approved</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">No. Days Since Gatepass Received</th>
              <th className="border border-teal-600 px-2 py-1.5 text-center">No. Days Waiting for PID</th>
            </tr>
          </thead>
          <tbody>
            {employees.length === 0 ? (
              <tr>
                <td colSpan={16} className="text-center py-4 text-slate-400 bg-white border">No employees in this department</td>
              </tr>
            ) : (
              paginated.map((emp, idx) => {
                const globalIdx = (page - 1) * PAGE_SIZE + idx;
                const med = getMedicalLabel(emp);
                const gp = getGPLabel(emp);
                const tr = getTrainingLabel(emp);
                const pid = getPIDLabel(emp);
                const daysMed = daysSince(emp.ftw_approved_date);
                const daysGP = daysSince(emp.gate_pass_received_date);
                const daysPID = daysSince(emp.pid_issue_date) ?? daysSince(emp.ftw_approved_date);
                const trDateApproved = emp.ftw_approved_date ? format(parseISO(emp.ftw_approved_date.substring(0, 10)), 'dd-MMM-yyyy') : null;
                const gpReceivedDate = emp.gate_pass_received_date ? format(parseISO(emp.gate_pass_received_date.substring(0, 10)), 'dd-MMM-yyyy') : null;
                const pidValid = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase() === 'VALID PID PASS';
                const rowBg = idx % 2 === 0 ? 'bg-white' : 'bg-slate-50';
                return (
                  <tr key={emp.id} className={rowBg}>
                    <td className="border border-slate-200 px-1 py-1 text-center text-slate-500">{globalIdx + 1}</td>
                    <td className="border border-slate-200 px-2 py-1 font-medium">{emp.name}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{emp.qid_no || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{emp.contact_details || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{emp.company || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">{emp.designation_org_chart || emp.position_application || '—'}</td>
                    <td className="border border-slate-200 px-1 py-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${med.color}`}>{med.label}</span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{trDateApproved || '—'}</td>
                    <td className="border border-slate-200 px-1 py-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${gp.color}`}>{gp.label}</span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{gpReceivedDate || '—'}</td>
                    <td className="border border-slate-200 px-1 py-1 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${tr.color}`}>{tr.label}</span>
                    </td>
                    <td className="border border-slate-200 px-1 py-1 text-center" style={{ background: '#f0fdf4' }}>
                      <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${pid.color}`}>{pid.label}</span>
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-500">{emp.remarks || ''}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {pidValid ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">Completed</span> : daysMed !== null ? <span className="font-semibold text-blue-700">{daysMed} days</span> : '—'}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {pidValid ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">Completed</span> : daysGP !== null ? <span className="font-semibold text-green-700">{daysGP} days</span> : '—'}
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      {pidValid ? <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">Completed</span> : daysPID !== null ? <span className="font-semibold text-purple-700">{daysPID} days</span> : '—'}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border border-t-0 rounded-b text-xs text-slate-600">
          <span>Page {page} of {totalPages} · {employees.length} total</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100"
            >«</button>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100"
            >‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, i, arr) => {
                if (i > 0 && p - arr[i - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2 py-1 rounded border ${page === p ? 'bg-teal-600 text-white border-teal-600' : 'bg-white hover:bg-slate-100'}`}
                  >{p}</button>
                )
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100"
            >›</button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={page === totalPages}
              className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100"
            >»</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Print CSS for Onboarding ───────────────────────────────────────────────────
const ONBOARDING_PRINT_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  body { font-family: Arial, sans-serif; font-size: 9px; background: white; color: #1e293b; }
  .wrap { padding: 12px; }
  .report-title { font-size: 16px; font-weight: 700; text-transform: uppercase; margin-bottom: 2px; }
  .report-date { font-size: 11px; color: #475569; margin-bottom: 16px; }
  .dept-block { margin-bottom: 20px; page-break-inside: avoid; }
  .dept-header { text-align: center; font-weight: 700; font-size: 11px; color: white; background: #1e7b8a; padding: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  th { background: #1e7b8a; color: white; border: 1px solid #0e5f6a; padding: 3px 2px; text-align: center; font-weight: 700; }
  th.pid-col { background: #4caf7d; }
  td { border: 1px solid #cbd5e1; padding: 2px 3px; vertical-align: middle; }
  td.center { text-align: center; }
  td.pid-cell { background: #f0fdf4; }
  .badge { display: inline-block; padding: 1px 4px; border-radius: 3px; font-size: 8px; font-weight: 600; }
  .badge-green { background: #dcfce7; color: #166534; }
  .badge-amber { background: #fef3c7; color: #92400e; }
  .badge-red { background: #fee2e2; color: #991b1b; }
  .badge-blue { background: #dbeafe; color: #1e40af; }
  .badge-slate { background: #f1f5f9; color: #475569; }
  tr:nth-child(odd) { background: #ffffff; }
  tr:nth-child(even) { background: #f8fafc; }
  @media print { @page { size: A3 landscape; margin: 8mm; } }
`;

// ── Main Component ─────────────────────────────────────────────────────────────
// Accepts pre-filtered employees from parent (ProjectionReport shared filters)
// filteredEmployees is passed in; assignments for manager lookup in print
export default function OnboardingMonitoring({ employees = [], assignments = [] }) {
  const [showPreview, setShowPreview] = useState(false);
  const [filterKey, setFilterKey] = useState(0);

  const today = format(new Date(), 'dd-MMM-yyyy');

  // Build manager lookup
  const managerMap = useMemo(() => {
    const m = {};
    for (const a of assignments) for (const co of (a.companies || [])) m[co.trim().toUpperCase()] = a.manager_name;
    return m;
  }, [assignments]);

  // Use pre-filtered employees directly
  const filteredEmployees = employees;

  // Reset pages when employees change (filters applied upstream)
  useEffect(() => { setFilterKey(k => k + 1); }, [employees]);

  // Group by department
  const grouped = useMemo(() => {
    const map = {};
    for (const emp of filteredEmployees) {
      const dept = (emp.department || 'UNASSIGNED').trim().toUpperCase();
      if (!map[dept]) map[dept] = [];
      map[dept].push(emp);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredEmployees]);

  // Build print HTML
  function buildPrintHTML() {
    const deptBlocks = grouped.map(([dept, emps]) => {
      const rows = emps.map((emp, idx) => {
        const med = getMedicalLabel(emp);
        const gp = getGPLabel(emp);
        const tr = getTrainingLabel(emp);
        const pid = getPIDLabel(emp);
        const medClass = med.color.includes('green') ? 'badge-green' : med.color.includes('blue') ? 'badge-blue' : med.color.includes('amber') ? 'badge-amber' : med.color.includes('red') ? 'badge-red' : 'badge-slate';
        const gpClass = gp.color.includes('green') ? 'badge-green' : gp.color.includes('amber') ? 'badge-amber' : gp.color.includes('red') ? 'badge-red' : gp.color.includes('blue') ? 'badge-blue' : 'badge-slate';
        const trClass = tr.color.includes('green') ? 'badge-green' : tr.color.includes('amber') ? 'badge-amber' : tr.color.includes('blue') ? 'badge-blue' : 'badge-slate';
        const pidClass = pid.color.includes('green') ? 'badge-green' : pid.color.includes('amber') ? 'badge-amber' : pid.color.includes('red') ? 'badge-red' : pid.color.includes('blue') ? 'badge-blue' : 'badge-slate';
        const dm = daysSince(emp.ftw_approved_date);
        const dg = daysSince(emp.gate_pass_received_date);
        const dp = daysSince(emp.pid_issue_date) ?? daysSince(emp.ftw_approved_date);
        const trDatePrint = emp.ftw_approved_date ? format(parseISO(emp.ftw_approved_date.substring(0, 10)), 'dd-MMM-yyyy') : '—';
        const gpRecPrint = emp.gate_pass_received_date ? format(parseISO(emp.gate_pass_received_date.substring(0, 10)), 'dd-MMM-yyyy') : '—';
        const pidValidPrint = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase() === 'VALID PID PASS';
        const completedBadge = '<span class="badge badge-green">Completed</span>';
        return `<tr>
          <td class="center">${idx + 1}</td>
          <td>${emp.name || ''}</td>
          <td class="center">${emp.qid_no || ''}</td>
          <td class="center">${emp.contact_details || ''}</td>
          <td class="center">${emp.company || ''}</td>
          <td class="center">${emp.designation_org_chart || emp.position_application || ''}</td>
          <td class="center"><span class="badge ${medClass}">${med.label}</span></td>
          <td class="center">${trDatePrint}</td>
          <td class="center"><span class="badge ${gpClass}">${gp.label}</span></td>
          <td class="center">${gpRecPrint}</td>
          <td class="center"><span class="badge ${trClass}">${tr.label}</span></td>
          <td class="center pid-cell"><span class="badge ${pidClass}">${pid.label}</span></td>
          <td>${emp.remarks || ''}</td>
          <td class="center">${pidValidPrint ? completedBadge : dm !== null ? dm + ' days' : '—'}</td>
          <td class="center">${pidValidPrint ? completedBadge : dg !== null ? dg + ' days' : '—'}</td>
          <td class="center">${pidValidPrint ? completedBadge : dp !== null ? dp + ' days' : '—'}</td>
        </tr>`;
      }).join('');
      return `<div class="dept-block">
        <div class="dept-header">${dept}</div>
        <table>
          <thead><tr>
            <th>#</th><th style="text-align:left">Full Name</th><th>QID Number</th>
            <th>Mobile Number</th><th>Company</th><th>Designation / Position</th>
            <th>Medical</th><th>TR Date Approved</th><th>Gate Pass Status</th><th>Gatepass Received Date</th><th>Training Status</th>
            <th class="pid-col">Project ID Status</th><th>Remarks</th>
            <th>Days Since Med Approved</th><th>Days Since GP Received</th><th>Days Waiting for PID</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }).join('');

    return `<div class="wrap">
      <table style="width:100%; margin-bottom:12px; font-size:10px; border:none; border-collapse: collapse;">
        <tr><td style="border:none; font-size:16px; font-weight:700; text-transform:uppercase;">ONBOARDING CANDIDATES MASTERLIST</td>
            <td style="border:none; text-align:right; font-size:12px; color:#475569;">${today}</td></tr>
      </table>
      ${deptBlocks}
    </div>`;
  }

  function handlePrint() {
    const html = buildPrintHTML();
    const win = window.open('', '_blank', 'width=1400,height=900');
    win.document.write(`<!DOCTYPE html><html><head><title>Onboarding Monitoring ${today}</title><style>${ONBOARDING_PRINT_CSS}</style></head><body>${html}<script>setTimeout(() => window.print(), 300);<\/script></body></html>`);
    win.document.close();
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Onboarding Candidates Masterlist</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{today} · {filteredEmployees.length} personnel shown</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} className="gap-2">
            <FileText className="w-4 h-4" /> Print / Export
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <SummaryCards employees={filteredEmployees} />

      {/* Department Tables */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <FileText className="w-10 h-10 opacity-30" />
          <p className="font-medium">No employee data found for the selected filters.</p>
        </div>
      ) : (
        <div>
          {grouped.map(([dept, emps]) => (
            <DeptTable key={dept} dept={dept} employees={emps} resetKey={filterKey} />
          ))}
        </div>
      )}
    </div>
  );
}