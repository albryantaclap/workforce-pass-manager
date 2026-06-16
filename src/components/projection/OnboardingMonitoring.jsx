import React, { useMemo, useState, useEffect } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { FileText, PencilLine, X as XIcon, Sheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { computePassStatus } from '@/utils/constants';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import InlineEditCell from '@/components/common/InlineEditCell';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { usePermissions } from '@/lib/usePermissions';
import ExcelJS from 'exceljs';

// ── Status helpers ─────────────────────────────────────────────────────────────
// Badge color palette — professional, print-friendly
// green: #D6EFD8 / #1A5C2A   amber: #FEF3C7 / #7C4D00   orange: #FDEBD0 / #7B3500
// blue:  #DBEAFE / #1E3A6E   purple: #EDE9FE / #4B2A8A  red: #FCE4E4 / #8B1A1A
// gray:  #F1F5F9 / #475569

function getMedicalLabel(emp) {
  const ftw = (emp.ftw_result || '').trim().toUpperCase();
  if (!emp.ftw_result) return { label: 'New', color: 'badge-lightblue', printClass: 'badge-blue' };
  if (ftw === 'ACCEPTED') return { label: 'Accepted', color: 'badge-softgreen', printClass: 'badge-green' };
  if (ftw === 'WAITING TR APPROVAL') return { label: 'Waiting TR', color: 'badge-softamber', printClass: 'badge-amber' };
  if (ftw === 'RE-ASSESS') return { label: 'Re-Assess', color: 'badge-softorange', printClass: 'badge-orange' };
  if (ftw === 'REJECTED') return { label: 'Recalled', color: 'badge-softgray', printClass: 'badge-slate' };
  return { label: emp.ftw_result, color: 'badge-softgray', printClass: 'badge-slate' };
}

function getGPLabel(emp) {
  const raw = (emp.rlic_status || '').trim().toUpperCase();
  const effective = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
  const eff = (effective || '').toUpperCase();
  if (eff === 'VALID RLIC PASS') return { label: 'Valid', color: 'badge-softgreen', printClass: 'badge-green' };
  if (eff === 'SOON TO EXPIRE') return { label: 'Soon', color: 'badge-softamber', printClass: 'badge-amber' };
  if (eff === 'EXPIRED RLIC PASS') return { label: 'Expired', color: 'badge-softred', printClass: 'badge-red' };
  if (eff === 'NO RLIC PASS') return { label: 'No Pass', color: 'badge-softgray', printClass: 'badge-slate' };
  if (raw === 'UNDER PROCESS' || raw === 'DVC SENT') return { label: 'Under Process', color: 'badge-lightblue', printClass: 'badge-blue' };
  if (raw === 'WAITING MOI APPROVAL') return { label: 'Waiting MOI', color: 'badge-softpurple', printClass: 'badge-purple' };
  if (raw === 'HOLDING ACTIVE GP') return { label: 'Holding Active GP', color: 'badge-softgray', printClass: 'badge-slate' };
  return { label: emp.rlic_status || '—', color: 'badge-softgray', printClass: 'badge-slate' };
}

function getTrainingLabel(emp) {
  const t = (emp.training_status || '').trim().toUpperCase();
  if (!emp.training_status) return { label: '—', color: 'badge-softgray', printClass: 'badge-slate' };
  if (t === 'DONE') return { label: 'Done', color: 'badge-softgreen', printClass: 'badge-green' };
  if (t === 'PENDING') return { label: 'Pending', color: 'badge-softamber', printClass: 'badge-amber' };
  if (t === 'ON-GOING' || t === 'ONGOING' || t === 'ON GOING') return { label: 'On-Going', color: 'badge-softpurple', printClass: 'badge-purple' };
  if (t === 'SCHEDULED') return { label: 'Scheduled', color: 'badge-lightblue', printClass: 'badge-blue' };
  if (t === 'NOT REQUIRED') return { label: 'Not Required', color: 'badge-softgray', printClass: 'badge-slate' };
  return { label: emp.training_status, color: 'badge-softgray', printClass: 'badge-slate' };
}

function getPIDLabel(emp) {
  const raw = (emp.pid_status || '').trim().toUpperCase();
  const effective = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
  const eff = (effective || '').toUpperCase();
  if (eff === 'VALID PID PASS') return { label: 'Valid', color: 'badge-softgreen', printClass: 'badge-green' };
  if (eff === 'SOON TO EXPIRE') return { label: 'Soon', color: 'badge-softamber', printClass: 'badge-amber' };
  if (eff === 'EXPIRED PID PASS') return { label: 'Expired', color: 'badge-softred', printClass: 'badge-red' };
  if (eff === 'NO PID PASS' || raw === 'NO PID PASS') return { label: 'No PID', color: 'badge-softgray', printClass: 'badge-slate' };
  if (raw === 'RENEWAL UNDER PROCESS') return { label: 'Renewal Under Process', color: 'badge-lightblue', printClass: 'badge-blue' };
  if (raw === 'RECALLED') return { label: 'Recalled', color: 'badge-softgray', printClass: 'badge-slate' };
  return { label: emp.pid_status || '—', color: 'badge-softgray', printClass: 'badge-slate' };
}

// Screen badge CSS classes (inline style map)
const BADGE_STYLES = {
  'badge-softgreen':  { background: '#D6EFD8', color: '#1A5C2A', border: '1px solid #A8D5AC' },
  'badge-softamber':  { background: '#FEF3C7', color: '#7C4D00', border: '1px solid #F6D860' },
  'badge-softorange': { background: '#FDEBD0', color: '#7B3500', border: '1px solid #F5C59A' },
  'badge-softred':    { background: '#FCE4E4', color: '#8B1A1A', border: '1px solid #F5A9A9' },
  'badge-lightblue':  { background: '#DBEAFE', color: '#1E3A6E', border: '1px solid #93C5FD' },
  'badge-softpurple': { background: '#EDE9FE', color: '#4B2A8A', border: '1px solid #C4B5FD' },
  'badge-softgray':   { background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' },
};

function BadgeSpan({ colorKey, label }) {
  const s = BADGE_STYLES[colorKey] || BADGE_STYLES['badge-softgray'];
  return (
    <span style={{ ...s, display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function DaysCell({ days, pidValid }) {
  if (pidValid) {
    return (
      <span style={{ background: '#E8F5E9', color: '#1B5E20', border: '1px solid #A5D6A7', display: 'inline-block', padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>
        ✓ Completed
      </span>
    );
  }
  if (days === null) return <span className="text-slate-400">—</span>;
  const color = days > 60 ? '#8B1A1A' : days > 30 ? '#7B3500' : '#1E3A5F';
  return <span style={{ color, fontWeight: 700, fontSize: 11 }}>{days} days</span>;
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

// ── Editable field option lists ────────────────────────────────────────────────
const MEDICAL_OPTIONS = [
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'WAITING TR APPROVAL', label: 'Waiting TR Approval' },
  { value: 'RE-ASSESS', label: 'Re-Assess' },
  { value: 'REJECTED', label: 'Rejected' },
];
const GP_OPTIONS = [
  { value: 'VALID RLIC PASS', label: 'Valid RLIC Pass' },
  { value: 'EXPIRED RLIC PASS', label: 'Expired RLIC Pass' },
  { value: 'SOON TO EXPIRE', label: 'Soon to Expire' },
  { value: 'NO RLIC PASS', label: 'No RLIC Pass' },
  { value: 'UNDER PROCESS', label: 'Under Process' },
  { value: 'WAITING MOI APPROVAL', label: 'Waiting MOI Approval' },
  { value: 'HOLDING ACTIVE GP', label: 'Holding Active GP' },
];
const TRAINING_OPTIONS = [
  { value: 'DONE', label: 'Done' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SCHEDULED', label: 'Scheduled' },
  { value: 'ON-GOING', label: 'On-Going' },
  { value: 'NOT REQUIRED', label: 'Not Required' },
];
const PID_OPTIONS = [
  { value: 'VALID PID PASS', label: 'Valid PID Pass' },
  { value: 'EXPIRED PID PASS', label: 'Expired PID Pass' },
  { value: 'SOON TO EXPIRE', label: 'Soon to Expire' },
  { value: 'NO PID PASS', label: 'No PID Pass' },
  { value: 'RENEWAL UNDER PROCESS', label: 'Renewal Under Process' },
  { value: 'RECALLED', label: 'Recalled' },
];

// ── Department Table ───────────────────────────────────────────────────────────
function DeptTable({ dept, employees, resetKey, editMode, onSave }) {
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [resetKey]);
  const totalPages = Math.ceil(employees.length / PAGE_SIZE);
  const paginated = employees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const DEPT_HDR = { background: '#1E3A5F', color: '#fff' };
  const COL_HDR  = { background: '#DCE6F2', color: '#2D3748' };
  const PID_HDR  = { background: '#DDEFE0', color: '#1A5C2A' };
  const PID_CELL = { background: '#F5FBF6' };

  return (
    <div className="mb-6">
      {/* Department Header */}
      <div className="text-center font-bold text-sm py-2 rounded-t" style={DEPT_HDR}>
        {dept} <span className="font-normal opacity-75 text-xs">({employees.length} Records)</span>
      </div>
      <div className="overflow-x-auto rounded-b border border-t-0">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              {[
                ['#', 'text-center w-6'],
                ['Full Name', 'text-left'],
                ['QID Number', 'text-center'],
                ['Mobile Number', 'text-center'],
                ['Company', 'text-center'],
                ['Designation / Position', 'text-center'],
                ['Medical', 'text-center'],
                ['TR Date Approved', 'text-center'],
                ['Gate Pass Status', 'text-center'],
                ['Gatepass Received Date', 'text-center'],
                ['Training Status', 'text-center'],
              ].map(([label, align]) => (
                <th key={label} className={`border border-slate-300 px-2 py-1.5 font-semibold ${align}`} style={COL_HDR}>{label}</th>
              ))}
              <th className="border border-slate-300 px-2 py-1.5 font-semibold text-center" style={PID_HDR}>Project ID Status</th>
              <th className="border border-slate-300 px-2 py-1.5 font-semibold text-center" style={COL_HDR}>Remarks</th>
              <th className="border border-slate-300 px-2 py-1.5 font-semibold text-center" style={COL_HDR}>No. Days Since Med Approved</th>
              <th className="border border-slate-300 px-2 py-1.5 font-semibold text-center" style={COL_HDR}>No. Days Since Gatepass Received</th>
              <th className="border border-slate-300 px-2 py-1.5 font-semibold text-center" style={COL_HDR}>No. Days Waiting for PID</th>
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
                const pidEffective = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase();
                const pidValid = pidEffective === 'VALID PID PASS' || pidEffective === 'SOON TO EXPIRE';
                const rowBg = idx % 2 === 0 ? '#ffffff' : '#F7F9FC';
                return (
                  <tr key={emp.id} style={{ background: rowBg }}>
                    <td className="border border-slate-200 px-1 py-1 text-center text-slate-400">{globalIdx + 1}</td>
                    <td className="border border-slate-200 px-2 py-1 font-medium text-slate-800">{emp.name}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{emp.qid_no || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{emp.contact_details || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-700">{emp.company || '—'}</td>
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-700">{emp.designation_org_chart || emp.position_application || '—'}</td>
                    {/* Medical Status — editable */}
                    <td className="border border-slate-200 px-1 py-1 text-center">
                      {editMode
                        ? <InlineEditCell value={emp.ftw_result} field="ftw_result" empId={emp.id} type="select" options={MEDICAL_OPTIONS} onSave={onSave} editMode={editMode} />
                        : <BadgeSpan colorKey={med.color} label={med.label} />}
                    </td>
                    {/* TR Date Approved — editable */}
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">
                      <InlineEditCell value={emp.ftw_approved_date} field="ftw_approved_date" empId={emp.id} type="date" onSave={onSave} editMode={editMode} />
                    </td>
                    {/* Gate Pass Status — editable */}
                    <td className="border border-slate-200 px-1 py-1 text-center">
                      {editMode
                        ? <InlineEditCell value={emp.rlic_status} field="rlic_status" empId={emp.id} type="select" options={GP_OPTIONS} onSave={onSave} editMode={editMode} />
                        : <BadgeSpan colorKey={gp.color} label={gp.label} />}
                    </td>
                    {/* Gatepass Received Date — editable */}
                    <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">
                      <InlineEditCell value={emp.gate_pass_received_date} field="gate_pass_received_date" empId={emp.id} type="date" onSave={onSave} editMode={editMode} />
                    </td>
                    {/* Training Status — editable */}
                    <td className="border border-slate-200 px-1 py-1 text-center">
                      {editMode
                        ? <InlineEditCell value={emp.training_status} field="training_status" empId={emp.id} type="select" options={TRAINING_OPTIONS} onSave={onSave} editMode={editMode} />
                        : <BadgeSpan colorKey={tr.color} label={tr.label} />}
                    </td>
                    {/* PID Status — editable */}
                    <td className="border border-slate-200 px-1 py-1 text-center" style={PID_CELL}>
                      {editMode
                        ? <InlineEditCell value={emp.pid_status} field="pid_status" empId={emp.id} type="select" options={PID_OPTIONS} onSave={onSave} editMode={editMode} />
                        : <BadgeSpan colorKey={pid.color} label={pid.label} />}
                    </td>
                    {/* Remarks — editable */}
                    <td className="border border-slate-200 px-2 py-1 text-slate-600 text-[11px]" style={{ background: '#FAFAFA' }}>
                      <InlineEditCell value={emp.remarks} field="remarks" empId={emp.id} type="text" onSave={onSave} editMode={editMode} />
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      <DaysCell days={daysMed} pidValid={pidValid} />
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      <DaysCell days={daysGP} pidValid={pidValid} />
                    </td>
                    <td className="border border-slate-200 px-2 py-1 text-center">
                      <DaysCell days={daysPID} pidValid={pidValid} />
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
            <button onClick={() => setPage(1)} disabled={page === 1} className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100">«</button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100">‹</button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
              .reduce((acc, p, i, arr) => { if (i > 0 && p - arr[i - 1] > 1) acc.push('...'); acc.push(p); return acc; }, [])
              .map((p, i) =>
                p === '...' ? <span key={`e-${i}`} className="px-1">…</span> : (
                  <button key={p} onClick={() => setPage(p)}
                    style={page === p ? { background: '#1E3A5F', color: '#fff', border: '1px solid #1E3A5F' } : {}}
                    className={`px-2 py-1 rounded border ${page === p ? '' : 'bg-white hover:bg-slate-100'}`}
                  >{p}</button>
                )
              )}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100">›</button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages} className="px-2 py-1 rounded border bg-white disabled:opacity-40 hover:bg-slate-100">»</button>
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
  .dept-block { margin-bottom: 20px; page-break-inside: avoid; }
  .dept-header { text-align: center; font-weight: 700; font-size: 11px; color: white; background: #1E3A5F; padding: 5px 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 8.5px; }
  th { background: #DCE6F2; color: #2D3748; border: 1px solid #B0C4DE; padding: 3px 2px; text-align: center; font-weight: 700; }
  th.pid-col { background: #DDEFE0; color: #1A5C2A; }
  td { border: 1px solid #CBD5E1; padding: 2px 3px; vertical-align: middle; }
  td.center { text-align: center; }
  td.pid-cell { background: #F5FBF6; }
  td.remarks-cell { background: #FAFAFA; color: #374151; }
  .badge { display: inline-block; padding: 1px 5px; border-radius: 3px; font-size: 8px; font-weight: 600; border: 1px solid transparent; }
  .badge-green  { background: #D6EFD8; color: #1A5C2A; border-color: #A8D5AC; }
  .badge-amber  { background: #FEF3C7; color: #7C4D00; border-color: #F6D860; }
  .badge-orange { background: #FDEBD0; color: #7B3500; border-color: #F5C59A; }
  .badge-red    { background: #FCE4E4; color: #8B1A1A; border-color: #F5A9A9; }
  .badge-blue   { background: #DBEAFE; color: #1E3A6E; border-color: #93C5FD; }
  .badge-purple { background: #EDE9FE; color: #4B2A8A; border-color: #C4B5FD; }
  .badge-slate  { background: #F1F5F9; color: #475569; border-color: #CBD5E1; }
  .badge-completed { background: #E8F5E9; color: #1B5E20; border: 1px solid #A5D6A7; }
  .days-normal   { color: #1E3A5F; font-weight: 700; }
  .days-warning  { color: #7B3500; font-weight: 700; }
  .days-critical { color: #8B1A1A; font-weight: 700; }
  tr:nth-child(odd)  td { background: #ffffff; }
  tr:nth-child(even) td { background: #F7F9FC; }
  td.pid-cell { background: #F5FBF6 !important; }
  td.remarks-cell { background: #FAFAFA !important; }
  @media print { @page { size: A3 landscape; margin: 8mm; } }
`;

// ── Main Component ─────────────────────────────────────────────────────────────
export default function OnboardingMonitoring({ employees = [], assignments = [] }) {
  const [showPreview, setShowPreview] = useState(false);
  const [filterKey, setFilterKey] = useState(0);
  const [editMode, setEditMode] = useState(false);

  const { canEdit } = usePermissions();
  const currentUser = useCurrentUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = format(new Date(), 'dd-MMM-yyyy');

  // Fetch position ranks for sorting
  const { data: positionRanks = [] } = useQuery({
    queryKey: ['positionRanks'],
    queryFn: () => base44.entities.PositionRank.list(),
    staleTime: 30000,
  });

  // Build rank lookup map: position (uppercase) → rank number
  const rankMap = useMemo(() => {
    const m = new Map();
    for (const r of positionRanks) {
      if (r.position) m.set(r.position.trim().toUpperCase(), r.rank ?? 9999);
    }
    return m;
  }, [positionRanks]);

  // Helper: get rank for an employee — inline so it always uses current rankMap
  const getPositionRank = useMemo(() => (emp) => {
    const pos = (emp.designation_org_chart || emp.position_application || '').trim().toUpperCase();
    // Try exact match first
    if (rankMap.has(pos)) return rankMap.get(pos);
    // Try partial/contains match for discipline-prefixed titles e.g. "LIFTING SUPERVISOR" → Supervisor rank
    for (const [key, rank] of rankMap.entries()) {
      if (pos.includes(key) || key.includes(pos)) return rank;
    }
    return 9999;
  }, [rankMap]);

  // Build manager lookup
  const managerMap = useMemo(() => {
    const m = {};
    for (const a of assignments) for (const co of (a.companies || [])) m[co.trim().toUpperCase()] = a.manager_name;
    return m;
  }, [assignments]);

  // Use pre-filtered employees directly
  const filteredEmployees = employees;

  // Group by department, sort employees within each dept by position rank then name
  const grouped = useMemo(() => {
    const map = {};
    for (const emp of filteredEmployees) {
      const dept = (emp.department || 'UNASSIGNED').trim().toUpperCase();
      if (!map[dept]) map[dept] = [];
      map[dept].push(emp);
    }
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dept, emps]) => [
        dept,
        [...emps].sort((a, b) => {
          const rankDiff = getPositionRank(a) - getPositionRank(b);
          if (rankDiff !== 0) return rankDiff;
          return (a.name || '').localeCompare(b.name || '');
        }),
      ]);
  }, [filteredEmployees, rankMap, getPositionRank]);

  // Reset DeptTable pages only when the grouping structure changes (dept names or counts)
  // — NOT on inline cell edits that just refresh data within the same grouping
  const groupStructureKey = useMemo(() => {
    return grouped.map(([dept, emps]) => `${dept}:${emps.length}`).join('|');
  }, [grouped]);
  useEffect(() => { setFilterKey(groupStructureKey); }, [groupStructureKey]);

  // ── Grid Edit mutation ────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees-active'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const handleCellSave = (empId, field, newValue) => {
    // Find old value for audit log
    const emp = employees.find(e => e.id === empId);
    const oldValue = emp ? emp[field] : undefined;

    updateMutation.mutate({ id: empId, data: { [field]: newValue } });

    // Activity log
    base44.entities.ActivityLog.create({
      action: 'update',
      entity_name: 'Employee',
      entity_id: empId,
      performed_by: currentUser?.email || '',
      record_name: emp?.name || empId,
      changed_fields: [field],
      record_snapshot: { [field]: newValue, _old: { [field]: oldValue } },
    }).catch(() => {});
  };

  // Build print HTML
  function buildPrintHTML() {
    const deptBlocks = grouped.map(([dept, emps]) => {
      const rows = emps.map((emp, idx) => {
        const med = getMedicalLabel(emp);
        const gp = getGPLabel(emp);
        const tr = getTrainingLabel(emp);
        const pid = getPIDLabel(emp);
        const PRINT_CLASS_MAP = {
          'badge-softgreen': 'badge-green', 'badge-softamber': 'badge-amber',
          'badge-softorange': 'badge-orange', 'badge-softred': 'badge-red',
          'badge-lightblue': 'badge-blue', 'badge-softpurple': 'badge-purple',
          'badge-softgray': 'badge-slate',
        };
        const medClass = PRINT_CLASS_MAP[med.color] || 'badge-slate';
        const gpClass  = PRINT_CLASS_MAP[gp.color]  || 'badge-slate';
        const trClass  = PRINT_CLASS_MAP[tr.color]  || 'badge-slate';
        const pidClass = PRINT_CLASS_MAP[pid.color] || 'badge-slate';
        const dm = daysSince(emp.ftw_approved_date);
        const dg = daysSince(emp.gate_pass_received_date);
        const dp = daysSince(emp.pid_issue_date) ?? daysSince(emp.ftw_approved_date);
        const trDatePrint = emp.ftw_approved_date ? format(parseISO(emp.ftw_approved_date.substring(0, 10)), 'dd-MMM-yyyy') : '—';
        const gpRecPrint = emp.gate_pass_received_date ? format(parseISO(emp.gate_pass_received_date.substring(0, 10)), 'dd-MMM-yyyy') : '—';
        const pidEffectivePrint = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase();
        const pidValidPrint = pidEffectivePrint === 'VALID PID PASS' || pidEffectivePrint === 'SOON TO EXPIRE';
        const completedBadge = '<span class="badge badge-completed">✓ Completed</span>';
        const daysSpan = (d) => {
          if (d === null) return '—';
          const cls = d > 60 ? 'days-critical' : d > 30 ? 'days-warning' : 'days-normal';
          return `<span class="${cls}">${d} days</span>`;
        };
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
          <td class="remarks-cell">${emp.remarks || ''}</td>
          <td class="center">${pidValidPrint ? completedBadge : daysSpan(dm)}</td>
          <td class="center">${pidValidPrint ? completedBadge : daysSpan(dg)}</td>
          <td class="center">${pidValidPrint ? completedBadge : daysSpan(dp)}</td>
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

  // ── Excel Export ──────────────────────────────────────────────────────────────
  async function handleExcelExport() {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    wb.creator = 'Onboarding System';
    wb.created = new Date();

    const ws = wb.addWorksheet('Onboarding Monitoring', {
      pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    // Column definitions (widths)
    ws.columns = [
      { key: 'no',       width: 4  },
      { key: 'name',     width: 28 },
      { key: 'qid',      width: 14 },
      { key: 'mobile',   width: 14 },
      { key: 'company',  width: 18 },
      { key: 'position', width: 26 },
      { key: 'medical',  width: 14 },
      { key: 'tr_date',  width: 14 },
      { key: 'gp',       width: 14 },
      { key: 'gp_date',  width: 16 },
      { key: 'training', width: 14 },
      { key: 'pid',      width: 14 },
      { key: 'remarks',  width: 30 },
      { key: 'days_med', width: 18 },
      { key: 'days_gp',  width: 20 },
      { key: 'days_pid', width: 18 },
    ];

    const TOTAL_COLS = 16;

    // Color palette
    const C = {
      deptBg:    '1E3A5F', deptFg:  'FFFFFF',
      colHdrBg:  'DCE6F2', colHdrFg:'2D3748',
      pidHdrBg:  'DDEFE0', pidHdrFg:'1A5C2A',
      pidCellBg: 'F5FBF6',
      remarksBg: 'FAFAFA',
      rowOdd:    'FFFFFF', rowEven: 'F7F9FC',
      green:  { bg: 'D6EFD8', fg: '1A5C2A' },
      amber:  { bg: 'FEF3C7', fg: '7C4D00' },
      orange: { bg: 'FDEBD0', fg: '7B3500' },
      red:    { bg: 'FCE4E4', fg: '8B1A1A' },
      blue:   { bg: 'DBEAFE', fg: '1E3A6E' },
      purple: { bg: 'EDE9FE', fg: '4B2A8A' },
      slate:  { bg: 'F1F5F9', fg: '475569' },
      completed: { bg: 'E8F5E9', fg: '1B5E20' },
      daysNormal:   '1E3A5F',
      daysWarning:  '7B3500',
      daysCritical: '8B1A1A',
    };

    const BADGE_COLOR_MAP = {
      'badge-softgreen':  C.green,
      'badge-softamber':  C.amber,
      'badge-softorange': C.orange,
      'badge-softred':    C.red,
      'badge-lightblue':  C.blue,
      'badge-softpurple': C.purple,
      'badge-softgray':   C.slate,
    };

    function applyBadgeCell(cell, colorKey, label, isBold = true) {
      const col = BADGE_COLOR_MAP[colorKey] || C.slate;
      cell.value = label;
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + col.bg } };
      cell.font = { color: { argb: 'FF' + col.fg }, bold: isBold, size: 8 };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: false };
    }

    function applyDaysCell(cell, days, pidValid) {
      if (pidValid) {
        cell.value = '✓ Completed';
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.completed.bg } };
        cell.font = { color: { argb: 'FF' + C.completed.fg }, bold: true, size: 8 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else if (days === null) {
        cell.value = '—';
        cell.font = { color: { argb: 'FF94A3B8' }, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      } else {
        const fgColor = days > 60 ? C.daysCritical : days > 30 ? C.daysWarning : C.daysNormal;
        cell.value = `${days} days`;
        cell.font = { color: { argb: 'FF' + fgColor }, bold: true, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }

    function applyBorder(cell) {
      const thin = { style: 'thin', color: { argb: 'FFCBD5E1' } };
      cell.border = { top: thin, left: thin, bottom: thin, right: thin };
    }

    const COL_HEADERS = [
      '#', 'Full Name', 'QID Number', 'Mobile Number', 'Company', 'Designation / Position',
      'Medical', 'TR Date Approved', 'Gate Pass Status', 'Gatepass Received Date', 'Training Status',
      'Project ID Status', 'Remarks', 'No. Days Since Med Approved', 'No. Days Since Gatepass Received', 'No. Days Waiting for PID',
    ];

    let currentRow = 1;

    for (const [dept, emps] of grouped) {
      // ── Department header row (merged) ──
      const deptRow = ws.getRow(currentRow);
      const deptCell = deptRow.getCell(1);
      deptCell.value = `${dept}  (${emps.length} Records)`;
      deptCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.deptBg } };
      deptCell.font = { color: { argb: 'FF' + C.deptFg }, bold: true, size: 11 };
      deptCell.alignment = { horizontal: 'center', vertical: 'middle' };
      ws.mergeCells(currentRow, 1, currentRow, TOTAL_COLS);
      deptRow.height = 22;
      // Apply border to merged cells
      for (let c = 1; c <= TOTAL_COLS; c++) applyBorder(ws.getRow(currentRow).getCell(c));
      currentRow++;

      // ── Column header row ──
      const hdrRow = ws.getRow(currentRow);
      hdrRow.height = 28;
      COL_HEADERS.forEach((h, i) => {
        const cell = hdrRow.getCell(i + 1);
        cell.value = h;
        const isPid = i === 11;
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + (isPid ? C.pidHdrBg : C.colHdrBg) } };
        cell.font = { color: { argb: 'FF' + (isPid ? C.pidHdrFg : C.colHdrFg) }, bold: true, size: 9 };
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        applyBorder(cell);
      });
      currentRow++;

      // ── Employee rows ──
      emps.forEach((emp, idx) => {
        const med = getMedicalLabel(emp);
        const gp  = getGPLabel(emp);
        const tr  = getTrainingLabel(emp);
        const pid = getPIDLabel(emp);
        const daysMed = daysSince(emp.ftw_approved_date);
        const daysGP  = daysSince(emp.gate_pass_received_date);
        const daysPID = daysSince(emp.pid_issue_date) ?? daysSince(emp.ftw_approved_date);
        const trDateFmt = emp.ftw_approved_date ? format(parseISO(emp.ftw_approved_date.substring(0, 10)), 'dd-MMM-yyyy') : '—';
        const gpDateFmt = emp.gate_pass_received_date ? format(parseISO(emp.gate_pass_received_date.substring(0, 10)), 'dd-MMM-yyyy') : '—';
        const pidEffective = (computePassStatus(emp.pid_expiry, 'pid', emp.pid_status) || '').toUpperCase();
        const pidValid = pidEffective === 'VALID PID PASS' || pidEffective === 'SOON TO EXPIRE';
        const rowBg = idx % 2 === 0 ? C.rowOdd : C.rowEven;

        const row = ws.getRow(currentRow);
        row.height = 18;

        // Helper to get/style plain cells
        const plain = (colIdx, value, align = 'center', wrap = false) => {
          const cell = row.getCell(colIdx);
          cell.value = value ?? '—';
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rowBg } };
          cell.font = { size: 9 };
          cell.alignment = { horizontal: align, vertical: 'middle', wrapText: wrap };
          applyBorder(cell);
          return cell;
        };

        plain(1, idx + 1);
        plain(2, emp.name || '', 'left');
        plain(3, emp.qid_no || '—');
        plain(4, emp.contact_details || '—');
        plain(5, emp.company || '—');
        plain(6, emp.designation_org_chart || emp.position_application || '—', 'left', true);

        // Medical badge
        const medCell = row.getCell(7);
        medCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rowBg } };
        applyBadgeCell(medCell, med.color, med.label);
        applyBorder(medCell);

        // TR Date
        plain(8, trDateFmt);

        // Gate Pass badge
        const gpCell = row.getCell(9);
        gpCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rowBg } };
        applyBadgeCell(gpCell, gp.color, gp.label);
        applyBorder(gpCell);

        // GP Received Date
        plain(10, gpDateFmt);

        // Training badge
        const trCell = row.getCell(11);
        trCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rowBg } };
        applyBadgeCell(trCell, tr.color, tr.label);
        applyBorder(trCell);

        // PID badge (green-tinted cell)
        const pidCell = row.getCell(12);
        pidCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.pidCellBg } };
        applyBadgeCell(pidCell, pid.color, pid.label);
        applyBorder(pidCell);

        // Remarks
        const remCell = row.getCell(13);
        remCell.value = emp.remarks || '';
        remCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + C.remarksBg } };
        remCell.font = { size: 9 };
        remCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        applyBorder(remCell);

        // Days cells
        const daysCell14 = row.getCell(14);
        daysCell14.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rowBg } };
        applyDaysCell(daysCell14, daysMed, pidValid);
        applyBorder(daysCell14);

        const daysCell15 = row.getCell(15);
        daysCell15.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rowBg } };
        applyDaysCell(daysCell15, daysGP, pidValid);
        applyBorder(daysCell15);

        const daysCell16 = row.getCell(16);
        daysCell16.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + rowBg } };
        applyDaysCell(daysCell16, daysPID, pidValid);
        applyBorder(daysCell16);

        currentRow++;
      });

      // Spacer row between departments
      currentRow++;
    }

    // Download
    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Onboarding_Monitoring_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
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
          {canEdit && (
            <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(v => !v)} className="gap-2">
              {editMode ? <><XIcon className="w-4 h-4" /> Exit Edit Mode</> : <><PencilLine className="w-4 h-4" /> Edit in Grid</>}
            </Button>
          )}
          <Button variant="outline" onClick={handleExcelExport} className="gap-2">
            <Sheet className="w-4 h-4" /> Export Excel
          </Button>
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
            <DeptTable key={dept} dept={dept} employees={emps} resetKey={filterKey} editMode={editMode} onSave={handleCellSave} />
          ))}
        </div>
      )}
    </div>
  );
}