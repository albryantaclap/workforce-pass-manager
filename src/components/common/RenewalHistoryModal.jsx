import React, { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { History as HistoryIcon, Pencil, ChevronRight, ShieldCheck } from 'lucide-react';
import { fetchRenewalHistory } from '@/lib/renewalHistory';
import { computePassStatus, formatDate } from '@/utils/constants';
import { usePermissions } from '@/lib/usePermissions';
import RenewalCorrectionDialog from '@/components/common/RenewalCorrectionDialog';

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

const STATUS_LABEL = {
  'VALID RLIC PASS': 'Valid', 'VALID PID PASS': 'Valid',
  'EXPIRED RLIC PASS': 'Expired', 'EXPIRED PID PASS': 'Expired',
  'SOON TO EXPIRE': 'Soon', 'NO RLIC PASS': 'No Pass', 'NO PID PASS': 'No Pass',
};

function StatusPill({ entry }) {
  const type = entry.document_type === 'Gate Pass' ? 'rlic' : 'pid';
  const status = computePassStatus(entry.expiry_date, type, entry.recorded_status);
  const style = STATUS_STYLE[status] || 'bg-slate-100 text-slate-600 border-slate-200';
  return <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style}`}>{STATUS_LABEL[status] || status}</span>;
}

/**
 * Renewal History modal shared by the Gate Pass (RLIC) and Project ID pages.
 * Read-only for ordinary users; authorized admins may correct an entry through
 * an audited action. History is linked by the personnel record ID and sorted
 * with the latest renewal first.
 */
export default function RenewalHistoryModal({ open, onClose, employee, documentType }) {
  const { canEdit } = usePermissions();
  const isGatePass = documentType === 'Gate Pass';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [correcting, setCorrecting] = useState(null);

  const load = useCallback(async (reset) => {
    if (!employee?.id) return;
    setLoading(true);
    try {
      const page = await fetchRenewalHistory({
        employeeId: employee.id,
        documentType,
        cursor: reset ? undefined : cursor,
      });
      setItems(prev => reset ? page.items : [...prev, ...(page.items || [])]);
      setHasMore(!!page.has_more);
      setCursor(page.next_cursor || null);
    } catch {
      setItems([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  }, [employee?.id, documentType, cursor]);

  useEffect(() => {
    if (open && employee?.id) {
      setItems([]);
      setCursor(null);
      setExpanded(null);
      load(true);
    }
  }, [open, employee?.id, documentType]); // eslint-disable-line react-hooks/exhaustive-deps

  const title = isGatePass ? 'Gate Pass (RLIC) — Renewal History' : 'Project ID — Renewal History';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <HistoryIcon className="w-4 h-4 text-primary" /> {title}
          </DialogTitle>
        </DialogHeader>

        {/* Personnel information */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-md border bg-slate-50/60 p-3 text-xs shrink-0">
          <div><span className="text-muted-foreground">Full Name</span><p className="font-semibold">{employee?.name || '—'}</p></div>
          <div><span className="text-muted-foreground">QID No.</span><p className="font-mono">{employee?.qid_no || '—'}</p></div>
          <div><span className="text-muted-foreground">PID No.</span><p className="font-mono">{employee?.pid || '—'}</p></div>
          <div><span className="text-muted-foreground">Company</span><p>{employee?.company || '—'}</p></div>
          <div className="col-span-2 sm:col-span-1"><span className="text-muted-foreground">Designation</span><p>{employee?.designation_org_chart || employee?.position_application || '—'}</p></div>
        </div>

        <div className="flex items-center justify-between text-xs shrink-0">
          <span className="text-muted-foreground">{items.length} renewal{items.length === 1 ? '' : 's'} recorded</span>
          <span className="text-muted-foreground flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Latest first</span>
        </div>

        <div className="doc-lines-scroll flex-1 min-h-0 rounded-md border">
          <table className="w-full caption-bottom text-sm table-list-view">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left px-2 py-1.5 w-16">Renewal No.</th>
                {isGatePass ? (
                  <>
                    <th className="text-left px-2 py-1.5">GP Submitted</th>
                    <th className="text-left px-2 py-1.5">GP Received</th>
                    <th className="text-left px-2 py-1.5">GP Expiry</th>
                  </>
                ) : (
                  <>
                    <th className="text-left px-2 py-1.5">PID No.</th>
                    <th className="text-left px-2 py-1.5">PID Issue Date</th>
                    <th className="text-left px-2 py-1.5">PID Expiry Date</th>
                  </>
                )}
                <th className="text-left px-2 py-1.5 w-20">Status</th>
                <th className="text-left px-2 py-1.5 w-28">Type</th>
                {canEdit && <th className="w-10"></th>}
              </tr>
            </thead>
            <tbody>
              {loading && items.length === 0 ? (
                Array(4).fill(0).map((_, i) => (
                  <tr key={i}><td colSpan={isGatePass ? 7 : 7} className="px-2 py-1.5"><Skeleton className="h-4 w-full" /></td></tr>
                ))
              ) : items.length === 0 ? (
                <tr><td colSpan={canEdit ? 7 : 6} className="text-center py-8 text-muted-foreground">No renewal history recorded yet</td></tr>
              ) : items.map((entry) => (
                <React.Fragment key={entry.id}>
                  <tr className="border-t hover:bg-muted/30">
                    <td className="px-2 py-1.5 font-semibold">#{entry.renewal_no}</td>
                    {isGatePass ? (
                      <>
                        <td className="px-2 py-1.5">{formatDate(entry.issue_date)}</td>
                        <td className="px-2 py-1.5">{formatDate(entry.received_date)}</td>
                        <td className="px-2 py-1.5">{formatDate(entry.expiry_date)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-2 py-1.5 font-mono">{entry.document_number || '—'}</td>
                        <td className="px-2 py-1.5">{formatDate(entry.issue_date)}</td>
                        <td className="px-2 py-1.5">{formatDate(entry.expiry_date)}</td>
                      </>
                    )}
                    <td className="px-2 py-1.5"><StatusPill entry={entry} /></td>
                    <td className="px-2 py-1.5">
                      <span className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold border ${ENTRY_BADGE[entry.entry_type] || ENTRY_BADGE.Renewal}`}>{entry.entry_type}</span>
                    </td>
                    {canEdit && (
                      <td className="px-1 py-1.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" title="Correct this entry" onClick={() => setCorrecting(entry)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                  <tr className="bg-slate-50/40">
                    <td colSpan={canEdit ? 7 : 6} className="px-2 py-1.5">
                      <button className="text-[11px] text-muted-foreground flex items-center gap-1 hover:text-foreground" onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}>
                        <ChevronRight className={`w-3 h-3 transition-transform ${expanded === entry.id ? 'rotate-90' : ''}`} />
                        Recorded {formatDate(entry.renewal_date)} by {entry.updated_by_name || entry.updated_by || '—'}
                        {(entry.corrections?.length || 0) > 0 && ` · ${entry.corrections.length} correction${entry.corrections.length === 1 ? '' : 's'}`}
                        {entry.remarks ? ` · ${entry.remarks}` : ''}
                      </button>
                      {expanded === entry.id && (entry.corrections?.length > 0) && (
                        <div className="mt-1 ml-4 space-y-1 text-[11px]">
                          {entry.corrections.map((c, i) => (
                            <div key={i} className="border-l-2 border-amber-300 pl-2">
                              <span className="font-medium">{c.corrected_by_name || c.corrected_by || '—'}</span> on {new Date(c.corrected_at).toLocaleString()} — {c.reason}
                              <ul className="ml-4 list-disc">
                                {c.changes.map((ch, j) => <li key={j}>{ch.field}: <span className="line-through text-muted-foreground">{ch.from || '—'}</span> → <span className="font-medium">{ch.to || '—'}</span></li>)}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {hasMore && (
          <div className="text-center shrink-0">
            <Button variant="outline" size="sm" onClick={() => load(false)} disabled={loading}>Load more</Button>
          </div>
        )}

        <div className="flex justify-end shrink-0">
          <Button variant="outline" onClick={onClose}>Close</Button>
        </div>
      </DialogContent>

      {correcting && (
        <RenewalCorrectionDialog
          entry={correcting}
          onClose={() => setCorrecting(null)}
          onSaved={() => { setCorrecting(null); load(true); }}
        />
      )}
    </Dialog>
  );
}