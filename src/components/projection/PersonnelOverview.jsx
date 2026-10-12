import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, History as HistoryIcon, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { computePassStatus, formatDate } from '@/utils/constants';
import PersonnelRenewalHistoryModal from './PersonnelRenewalHistoryModal';

const PERSONNEL_STATUSES = ['All', 'Active on Site', 'Onboarding', 'Inactive', 'Demobilized'];
const DOC_TYPES = ['All', 'Gate Pass', 'Project ID'];
const EXPIRY_STATUSES = ['All', 'Valid', 'Soon to Expire', 'Expired', 'No Pass'];
const ROWS_OPTIONS = [25, 50, 100];

function isoDay(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function expiryCond(status) {
  const today = isoDay(new Date());
  const soon = isoDay(new Date(Date.now() + 30 * 86400000));
  switch (status) {
    case 'Valid': return { $gt: soon };
    case 'Soon to Expire': return { $gte: today, $lte: soon };
    case 'Expired': return { $lt: today };
    case 'No Pass': return { $in: ['', null] };
    default: return null;
  }
}

const STATUS_COLOR = {
  'VALID RLIC PASS': 'text-emerald-600', 'VALID PID PASS': 'text-emerald-600',
  'SOON TO EXPIRE': 'text-amber-600',
  'EXPIRED RLIC PASS': 'text-red-600', 'EXPIRED PID PASS': 'text-red-600',
  'NO RLIC PASS': 'text-slate-400', 'NO PID PASS': 'text-slate-400',
};

/**
 * Personnel Overview — lists every Master List person (Active, Onboarding,
 * Inactive, Demobilized) with Gate Pass / Project ID expiry and genuine renewal
 * counts. Server-side paginated via cursor; renewal counts are fetched for the
 * current page only. "View History" opens the combined per-person history modal.
 */
export default function PersonnelOverview() {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [personnelStatus, setPersonnelStatus] = useState('All');
  const [company, setCompany] = useState('All');
  const [documentType, setDocumentType] = useState('All');
  const [expiryStatus, setExpiryStatus] = useState('All');
  const [dueFrom, setDueFrom] = useState('');
  const [dueTo, setDueTo] = useState('');
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [cursorStack, setCursorStack] = useState([undefined]);
  const [pageIndex, setPageIndex] = useState(0);
  const [historyEmployee, setHistoryEmployee] = useState(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setCursorStack([undefined]);
    setPageIndex(0);
  }, [debounced, personnelStatus, company, documentType, expiryStatus, dueFrom, dueTo, rowsPerPage]);

  const { data: companyLookups = [] } = useQuery({
    queryKey: ['lookups', 'company'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'company' }),
  });
  const companyOptions = useMemo(() => {
    const seen = new Set();
    const opts = [];
    for (const c of companyLookups) {
      const v = (c.value || '').trim();
      const key = v.toUpperCase();
      if (v && !seen.has(key)) { seen.add(key); opts.push(v); }
    }
    return opts.sort();
  }, [companyLookups]);

  const query = useMemo(() => {
    const q = {};
    if (personnelStatus !== 'All') {
      if (personnelStatus === 'Demobilized') q.camp_status = 'DEMOBILIZED';
      else q.personnel_status = personnelStatus;
    }
    if (company !== 'All') q.company = company;

    let cond = null;
    if (dueFrom || dueTo) {
      cond = {};
      if (dueFrom) cond.$gte = dueFrom;
      if (dueTo) cond.$lte = dueTo;
    } else if (expiryStatus !== 'All') {
      cond = expiryCond(expiryStatus);
    }

    const searchOr = debounced ? [
      { name: { $regex: debounced, $options: 'i' } },
      { qid_no: { $regex: debounced, $options: 'i' } },
      { pid: { $regex: debounced, $options: 'i' } },
      { company: { $regex: debounced, $options: 'i' } },
    ] : null;

    if (cond) {
      let expiryOr;
      if (documentType === 'Gate Pass') expiryOr = [{ gate_pass_expiry: cond }];
      else if (documentType === 'Project ID') expiryOr = [{ pid_expiry: cond }];
      else expiryOr = [{ gate_pass_expiry: cond }, { pid_expiry: cond }];

      if (searchOr) q.$and = [{ $or: searchOr }, { $or: expiryOr }];
      else q.$or = expiryOr;
    } else if (searchOr) {
      q.$or = searchOr;
    }
    return q;
  }, [debounced, personnelStatus, company, documentType, expiryStatus, dueFrom, dueTo]);

  const cursor = cursorStack[pageIndex];
  const { data: page, isLoading, isFetching } = useQuery({
    queryKey: ['personnelOverview', query, rowsPerPage, cursor],
    queryFn: () => base44.entities.Employee.filter(query, { sort: 'name', limit: rowsPerPage, cursor }),
    placeholderData: (prev) => prev,
  });
  const { data: totalCount = 0 } = useQuery({
    queryKey: ['personnelOverviewCount', query],
    queryFn: () => base44.entities.Employee.count(query),
  });

  const employees = page?.items || [];
  const hasNext = !!page?.has_more;
  const nextPageCursor = page?.next_cursor;

  const pageIds = useMemo(() => employees.map((e) => e.id), [employees]);
  const { data: countPage } = useQuery({
    queryKey: ['renewalCounts', pageIds],
    queryFn: () => base44.entities.DocumentRenewalHistory.filter(
      { personnel_id: { $in: pageIds }, is_deleted: { $ne: true }, entry_type: 'Renewal' },
      { fields: ['personnel_id', 'document_type'], limit: 1000 },
    ),
    enabled: pageIds.length > 0,
  });
  const renewalCounts = useMemo(() => {
    const map = {};
    for (const e of employees) map[e.id] = { gp: 0, pid: 0 };
    for (const r of countPage?.items || []) {
      if (!map[r.personnel_id]) map[r.personnel_id] = { gp: 0, pid: 0 };
      if (r.document_type === 'Gate Pass') map[r.personnel_id].gp++;
      else if (r.document_type === 'Project ID') map[r.personnel_id].pid++;
    }
    return map;
  }, [countPage, employees]);

  const totalPages = Math.max(1, Math.ceil(totalCount / rowsPerPage));
  const start = totalCount === 0 ? 0 : pageIndex * rowsPerPage + 1;
  const end = Math.min((pageIndex + 1) * rowsPerPage, totalCount);

  const goNext = () => {
    if (!hasNext || !nextPageCursor) return;
    setCursorStack((prev) => {
      if (prev[pageIndex + 1]) return prev;
      const next = [...prev];
      next[pageIndex + 1] = nextPageCursor;
      return next;
    });
    setPageIndex((i) => i + 1);
  };
  const goPrev = () => setPageIndex((i) => Math.max(0, i - 1));

  const gpStatus = (e) => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
  const pidStatus = (e) => computePassStatus(e.pid_expiry, 'pid', e.pid_status);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="bg-white rounded-xl border shadow-sm p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, QID, PID, company..."
            className="w-full pl-9 pr-4 h-9 rounded-md border border-input bg-white text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Personnel Status</p>
            <select value={personnelStatus} onChange={(e) => setPersonnelStatus(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {PERSONNEL_STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Company</p>
            <select value={company} onChange={(e) => setCompany(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              <option value="All">All companies</option>
              {companyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Document Type</p>
            <select value={documentType} onChange={(e) => setDocumentType(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t === 'All' ? 'All Documents' : t}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Expiry Status</p>
            <select value={expiryStatus} onChange={(e) => setExpiryStatus(e.target.value)} className="w-full h-9 rounded-md border border-input bg-transparent px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring">
              {EXPIRY_STATUSES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All statuses' : s}</option>)}
            </select>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Renewal Due From</p>
            <Input type="date" value={dueFrom} onChange={(e) => setDueFrom(e.target.value)} className="text-xs h-9" />
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-1.5">Renewal Due To</p>
            <Input type="date" value={dueTo} onChange={(e) => setDueTo(e.target.value)} className="text-xs h-9" />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border shadow overflow-hidden">
        <div className="overflow-auto max-h-[62vh]">
          {isLoading && employees.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            </div>
          ) : employees.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Users className="w-10 h-10 opacity-30" />
              <p className="font-medium">No personnel match the current filters.</p>
            </div>
          ) : (
            <table className="table-list-view w-full">
              <thead className="bg-muted/40 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold w-10">#</th>
                  <th className="px-2 py-2 text-left font-semibold">Personnel</th>
                  <th className="px-2 py-2 text-left font-semibold">Company</th>
                  <th className="px-2 py-2 text-left font-semibold">Status</th>
                  <th className="px-2 py-2 text-left font-semibold">Gate Pass Expiry</th>
                  <th className="px-2 py-2 text-left font-semibold">PID Expiry</th>
                  <th className="px-2 py-2 text-center font-semibold">GP Renewals</th>
                  <th className="px-2 py-2 text-center font-semibold">PID Renewals</th>
                  <th className="px-2 py-2 text-center font-semibold w-24">History</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e, i) => {
                  const gp = gpStatus(e);
                  const pid = pidStatus(e);
                  const counts = renewalCounts[e.id] || { gp: 0, pid: 0 };
                  return (
                    <tr key={e.id} className="border-b hover:bg-muted/30">
                      <td className="px-2 py-1.5">{pageIndex * rowsPerPage + i + 1}</td>
                      <td className="px-2 py-1.5">
                        <div className="font-medium">{e.name || '—'}</div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {e.qid_no ? `QID ${e.qid_no}` : ''}{e.pid ? ` · PID ${e.pid}` : ''}
                        </div>
                      </td>
                      <td className="px-2 py-1.5">{e.company || '—'}</td>
                      <td className="px-2 py-1.5">
                        <span className="text-[10px] text-muted-foreground">{e.personnel_status || 'Unassigned'}</span>
                      </td>
                      <td className={`px-2 py-1.5 ${STATUS_COLOR[gp] || ''}`}>{formatDate(e.gate_pass_expiry)}</td>
                      <td className={`px-2 py-1.5 ${STATUS_COLOR[pid] || ''}`}>{formatDate(e.pid_expiry)}</td>
                      <td className="px-2 py-1.5 text-center font-semibold">{counts.gp || 0}</td>
                      <td className="px-2 py-1.5 text-center font-semibold">{counts.pid || 0}</td>
                      <td className="px-2 py-1.5 text-center">
                        <Button variant="outline" size="sm" className="h-7 gap-1 text-[11px]" onClick={() => setHistoryEmployee(e)}>
                          <HistoryIcon className="w-3 h-3" /> View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        {/* Pager */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 border-t border-slate-200 bg-slate-50/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {totalCount > 0 ? (
              <span>Showing <strong className="text-foreground">{start}–{end}</strong> of <strong className="text-foreground">{totalCount.toLocaleString()}</strong> personnel</span>
            ) : <span>No personnel</span>}
            <span className="text-slate-300">|</span>
            <span>Page <strong className="text-foreground">{pageIndex + 1}</strong> of <strong className="text-foreground">{totalPages}</strong></span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Rows per page:</span>
              <Select value={String(rowsPerPage)} onValueChange={(v) => setRowsPerPage(Number(v))}>
                <SelectTrigger className="w-[72px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{ROWS_OPTIONS.map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={pageIndex === 0 || isFetching} onClick={goPrev} title="Previous page"><ChevronLeft className="w-4 h-4" /></Button>
              <Button size="icon" variant="outline" className="h-8 w-8" disabled={!hasNext || isFetching} onClick={goNext} title="Next page"><ChevronRight className="w-4 h-4" /></Button>
            </div>
          </div>
        </div>
      </div>

      {historyEmployee && (
        <PersonnelRenewalHistoryModal
          open
          onClose={() => setHistoryEmployee(null)}
          employee={historyEmployee}
        />
      )}
    </div>
  );
}