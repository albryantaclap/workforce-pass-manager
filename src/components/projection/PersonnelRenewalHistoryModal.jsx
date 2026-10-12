import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { History as HistoryIcon, ChevronRight } from 'lucide-react';
import { fetchRenewalHistory } from '@/lib/renewalHistory';
import { computePassStatus, formatDate } from '@/utils/constants';

const ENTRY_BADGE = {
  'Initial Issuance': 'bg-blue-50 text-blue-700 border-blue-200',
  Renewal: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Existing Record': 'bg-slate-100 text-slate-600 border-slate-200',
  Correction: 'bg-amber-50 text-amber-700 border-amber-200',
};

const STATUS_STYLE = {
  'VALID RLIC PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'VALID PID PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'EXPIRED RLIC PASS': 'bg-red-50 text-red-700 border-red-200',
  'EXPIRED PID PASS': 'bg-red-50 text-red-700 border-red-200',
  'SOON TO EXPIRE': 'bg-amber-50 text-amber-700 border-amber-200',
  'NO RLIC PASS': 'bg-slate-100 text-slate-600 border-slate-200',
  'NO PID PASS': 'bg-slate-100 text-slate-600 border-slate-200',
};

function StatusPill({ entry }) {
  const type = entry.document_type === 'Gate Pass' ? 'rlic' : 'pid';
  const status = computePassStatus(entry.expiry_date, type, entry.recorded_status);
  const style = STATUS_STYLE[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  const label = (status || '').replace(/ RLIC PASS| PID PASS/, '') || status;
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style}`}>{label}</span>;
}

function Section({ title, documentType, employee }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchRenewalHistory({ employeeId: employee.id, documentType, limit: 100 })
      .then((page) => { if (alive) setItems(page.items || []); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [employee.id, documentType]);

  const isGatePass = documentType === 'Gate Pass';

  return (
    <div className="rounded-lg border">
      <div className="px-3 py-2 bg-slate-50 border-b font-semibold text-sm flex items-center gap-2">
        <HistoryIcon className="w-3.5 h-3.5 text-primary" /> {title}
        <span className="text-xs font-normal text-muted-foreground ml-auto">
          {loading ? '…' : `${items.length} entr${items.length === 1 ? 'y' : 'ies'}`}
        </span>
      </div>
      <div className="max-h-[34vh] overflow-auto doc-lines-scroll">
        <table className="w-full table-list-view">
          <thead className="bg-muted/40 sticky top-0">
            <tr>
              <th className="px-2 py-1.5 text-left font-semibold w-14">Ren. No.</th>
              <th className="px-2 py-1.5 text-left font-semibold w-24">Entry Type</th>
              {isGatePass ? (
                <>
                  <th className="px-2 py-1.5 text-left font-semibold">Submitted</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Received</th>
                </>
              ) : (
                <>
                  <th className="px-2 py-1.5 text-left font-semibold">Doc No.</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Issue Date</th>
                </>
              )}
              <th className="px-2 py-1.5 text-left font-semibold">Expiry</th>
              <th className="px-2 py-1.5 text-left font-semibold w-20">Status</th>
              <th className="px-2 py-1.5 text-left font-semibold w-28">Recorded By</th>
              <th className="px-2 py-1.5 text-left font-semibold">Remarks</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(3).fill(0).map((_, i) => (
                <tr key={i}><td colSpan={8} className="px-2 py-1.5"><Skeleton className="h-4 w-full" /></td></tr>
              ))
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-6 text-muted-foreground text-xs">No {title} recorded yet</td></tr>
            ) : items.map((entry) => (
              <React.Fragment key={entry.id}>
                <tr className="border-t hover:bg-muted/30">
                  <td className="px-2 py-1.5 font-semibold">#{entry.renewal_no}</td>
                  <td className="px-2 py-1.5">
                    <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ENTRY_BADGE[entry.entry_type] || ENTRY_BADGE.Renewal}`}>{entry.entry_type}</span>
                  </td>
                  {isGatePass ? (
                    <>
                      <td className="px-2 py-1.5">{formatDate(entry.issue_date)}</td>
                      <td className="px-2 py-1.5">{formatDate(entry.received_date)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-2 py-1.5 font-mono">{entry.document_number || '—'}</td>
                      <td className="px-2 py-1.5">{formatDate(entry.issue_date)}</td>
                    </>
                  )}
                  <td className="px-2 py-1.5 font-medium">{formatDate(entry.expiry_date)}</td>
                  <td className="px-2 py-1.5"><StatusPill entry={entry} /></td>
                  <td className="px-2 py-1.5">{entry.updated_by_name || entry.updated_by || '—'}</td>
                  <td className="px-2 py-1.5 max-w-xs truncate" title={entry.remarks || ''}>{entry.remarks || '—'}</td>
                </tr>
                {((entry.corrections || []).length > 0 || entry.renewal_date) && (
                  <tr className="bg-slate-50/40">
                    <td colSpan={8} className="px-2 py-1.5">
                      <button className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                        <ChevronRight className={`w-3 h-3 transition-transform ${expanded === entry.id ? 'rotate-90' : ''}`} />
                        Recorded {formatDate(entry.renewal_date)}
                        {(entry.corrections?.length || 0) > 0 && ` · ${entry.corrections.length} correction${entry.corrections.length === 1 ? '' : 's'}`}
                      </button>
                      {expanded === entry.id && (entry.corrections?.length > 0) && (
                        <div className="mt-1 ml-4 space-y-1 text-[11px]">
                          {entry.corrections.map((c, i) => (
                            <div key={i} className="border-l-2 border-amber-300 pl-2">
                              <span className="font-medium">{c.corrected_by_name || c.corrected_by || '—'}</span> on {c.corrected_at ? new Date(c.corrected_at).toLocaleString() : '—'} — {c.reason}
                              <ul className="ml-4 list-disc">
                                {(c.changes || []).map((ch, j) => <li key={j}>{ch.field}: <span className="line-through text-muted-foreground">{ch.from || '—'}</span> → <span className="font-medium">{ch.to || '—'}</span></li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Combined renewal history for a single personnel: Gate Pass (RLIC) and Project ID
 * sections shown newest-first, with corrections expandable. History is linked by
 * the personnel record ID and remains available even if the person is Inactive.
 */
export default function PersonnelRenewalHistoryModal({ open, onClose, employee }) {
  if (!employee) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-primary" /> Renewal History — {employee.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-md border bg-slate-50/60 p-3 text-xs shrink-0">
          <div><span className="text-muted-foreground">QID No.</span><p className="font-mono">{employee.qid_no || '—'}</p></div>
          <div><span className="text-muted-foreground">PID No.</span><p className="font-mono">{employee.pid || '—'}</p></div>
          <div><span className="text-muted-foreground">Company</span><p>{employee.company || '—'}</p></div>
          <div><span className="text-muted-foreground">Designation</span><p>{employee.designation_org_chart || employee.position_application || '—'}</p></div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto space-y-3 pr-1">
          <Section title="Gate Pass (RLIC)" documentType="Gate Pass" employee={employee} />
          <Section title="Project ID" documentType="Project ID" employee={employee} />
        </div>

        <div className="flex justify-end shrink-0 pt-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}