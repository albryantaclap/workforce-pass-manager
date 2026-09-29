import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCheck, Eye, Pencil, X, Trash2, ArrowLeftRight } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import ExportButton from '@/components/common/ExportButton';
import PrintReportButton from '@/components/common/PrintReportButton';
import MultiSelect from '@/components/common/MultiSelect';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';
import SharepointDocIcon from '@/components/common/SharepointDocIcon';
import CheckOutDialog from '@/components/comocamp/CheckOutDialog';
import ReactivateDialog from '@/components/inactive/ReactivateDialog';
import { useLatestCampStays } from '@/hooks/useLatestCampStays';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { INACTIVE, resolvePersonnelStatus, isActiveRosterStatus } from '@/lib/personnelStatus';
import { CAMP_STATUS, CAMP_STATUS_CONFIG, campStatusLabel, isDemobilized, isStayOpen, resolveCampStatus } from '@/lib/campStatus';
import { demobilizeFromCamp } from '@/lib/campDemobilization';
import { COMPANIES, LOCATIONS, MEDICAL_RESULTS, PID_STATUSES, computePassStatus, formatDate } from '@/utils/constants';
import { calcDuration, formatDateTimeCompact } from '@/lib/attendanceUtils';

const RETURN_CONTEXT_KEY = 'inactiveReturnContext';
const PAGE_SIZE = 50;

/** Saved list context, used to return to the same list state after Edit. */
export function readReturnContext() {
  try {
    const raw = sessionStorage.getItem(RETURN_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Inactive / Demobilized roster — shared cache, also powers the host tab counts. */
export function useInactiveRoster() {
  const { data = [], isLoading } = useQuery({
    queryKey: ['employees-inactive'],
    queryFn: () => base44.entities.Employee.filter({ is_active: false }, '-created_date', 100000),
  });
  return { employees: data, isLoading };
}

/**
 * Rows for one tab.
 *   Inactive    → EVERY project-inactive person, whatever their camp status
 *                 (never excludes the demobilized ones).
 *   Demobilized → the SUBSET of Inactive that was demobilized from COMO Camp.
 */
export function statusList(employees, status) {
  const inactive = employees.filter(e => resolvePersonnelStatus(e) === INACTIVE);
  if (status !== 'Demobilized') return inactive;
  return inactive.filter(e => isDemobilized(e));
}

// ── Badges ────────────────────────────────────────────────────────────────────
const medicalResultStyles = {
  'ACCEPTED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'REJECTED': 'bg-red-50 text-red-700 border-red-200',
  'WAITING TR APPROVAL': 'bg-amber-50 text-amber-700 border-amber-200',
  'RE-ASSESS': 'bg-purple-50 text-purple-700 border-purple-200',
};
const medicalShortLabels = { 'ACCEPTED': 'Accepted', 'REJECTED': 'Rejected', 'WAITING TR APPROVAL': 'Waiting TR', 'RE-ASSESS': 'Re-Assess' };

function MedicalBadge({ result }) {
  if (!result) return <span className="text-xs text-muted-foreground">—</span>;
  const style = medicalResultStyles[result] || 'bg-blue-50 text-blue-700 border-blue-200';
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style}`}>{medicalShortLabels[result] || result}</span>;
}

function GatePassBadge({ emp }) {
  const status = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
  const styles = { 'VALID RLIC PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200', 'EXPIRED RLIC PASS': 'bg-red-50 text-red-700 border-red-200', 'SOON TO EXPIRE': 'bg-amber-50 text-amber-700 border-amber-200', 'NO RLIC PASS': 'bg-slate-100 text-slate-600 border-slate-200' };
  const labels = { 'VALID RLIC PASS': 'Valid', 'EXPIRED RLIC PASS': 'Expired', 'SOON TO EXPIRE': 'Soon', 'NO RLIC PASS': 'No Pass' };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${styles[status] || 'bg-blue-50 text-blue-700 border-blue-200'}`}>{labels[status] || status}</span>;
}

function PidStatusBadge({ emp }) {
  const status = computePassStatus(emp.pid_expiry, 'pid', emp.pid_status);
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const styles = {
    'VALID PID PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'EXPIRED PID PASS': 'bg-red-50 text-red-700 border-red-200',
    'SOON TO EXPIRE': 'bg-amber-50 text-amber-700 border-amber-200',
    'NO PID PASS': 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const labels = {
    'VALID PID PASS': 'Valid',
    'EXPIRED PID PASS': 'Expired',
    'SOON TO EXPIRE': 'Soon',
    'NO PID PASS': 'No Pass',
  };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${styles[status] || 'bg-blue-50 text-blue-700 border-blue-200'}`}>{labels[status] || status}</span>;
}

// Camp Check-in / Check-out date + time (two lines, matching the COMO Camp format).
function CampDateTime({ iso }) {
  const dt = formatDateTimeCompact(iso);
  if (!dt) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="leading-tight">
      <div className="text-xs font-mono whitespace-nowrap">{dt.date}</div>
      <div className="text-[10px] text-muted-foreground whitespace-nowrap">{dt.time}</div>
    </div>
  );
}

// ── Filter Panel ──────────────────────────────────────────────────────────────
function FilterPanel({ filters, setters, uniqueCompanies, positions, rlicStatusOptions, trainingStatusOptions, onClear }) {
  const { search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter, trainingFilter, gatePassFilter, pidStatusFilter } = filters;
  const { setSearch, setCompanyFilter, setPositionFilter, setDepartmentFilter, setLocationFilter, setDirFilter, setMedicalResultFilter, setTrainingFilter, setGatePassFilter, setPidStatusFilter, setPage } = setters;

  const hasActiveFilters = search || companyFilter.length > 0 || positionFilter.length > 0 ||
    departmentFilter !== 'all' || locationFilter !== 'all' || dirFilter !== 'all' ||
    medicalResultFilter !== 'all' || trainingFilter !== 'all' || gatePassFilter.length > 0 || pidStatusFilter !== 'all';

  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div className="relative xl:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search Name, QID, PID, Passport, Company, Nationality, Designation..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <MultiSelect options={uniqueCompanies} value={companyFilter} onChange={v => { setCompanyFilter(v); setPage(0); }} placeholder="All Companies" />
        <MultiSelect options={positions} value={positionFilter} onChange={v => { setPositionFilter(v); setPage(0); }} placeholder="Filter by position" />
        <Select value={departmentFilter} onValueChange={v => { setDepartmentFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {['Electrical', 'Mechanical', 'Civil', 'Services', 'Steel Structure'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={locationFilter} onValueChange={v => { setLocationFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Locations</SelectItem>
            {LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={dirFilter} onValueChange={v => { setDirFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="DIR / INDIR" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="DIR">DIR</SelectItem>
            <SelectItem value="INDIR">INDIR</SelectItem>
          </SelectContent>
        </Select>
        <Select value={medicalResultFilter} onValueChange={v => { setMedicalResultFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Medical Result" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Medical Results</SelectItem>
            {MEDICAL_RESULTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">Training Status</p>
          <Select value={trainingFilter} onValueChange={v => { setTrainingFilter(v); setPage(0); }}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {trainingStatusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">Gate Pass Status</p>
          <MultiSelect options={rlicStatusOptions} value={gatePassFilter} onChange={v => { setGatePassFilter(v); setPage(0); }} placeholder="All Gate Pass" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">PID Status</p>
          <Select value={pidStatusFilter} onValueChange={v => { setPidStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="text-xs"><SelectValue placeholder="All PID" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All PID Status</SelectItem>
              {PID_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onClear}><X className="w-3.5 h-3.5 mr-1" /> Clear Filters</Button>
        </div>
      )}
    </Card>
  );
}

// ── Personnel Table ───────────────────────────────────────────────────────────
function CampStatusBadge({ status }) {
  if (!status || status === CAMP_STATUS.NOT_CHECKED_IN) return <span className="text-xs text-muted-foreground">—</span>;
  const cfg = CAMP_STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border whitespace-nowrap ${cfg.badge}`}>
      {cfg.label}
    </span>
  );
}

function PersonnelTable({ rows, isLoading, page, setPage, totalCount, tabType, onReactivate, onDelete, onEdit, onDemobilize, latestByPersonnel }) {
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pagedRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const isInactiveTab = tabType === 'inactive';
  const dateColLabel = isInactiveTab ? 'Inactive Date' : 'Demobilization Date';
  const columnCount = isInactiveTab ? 14 : 16;

  return (
    <>
      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <div className="table-scroll-y h-[560px]">
            <Table className="table-list-view">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50">
                  <TableHead className="text-[11px] bg-muted/50 w-10">Photo</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-8">Docs</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-44">Name</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-28">QID No</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-32">Company</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-44">Designation / Position</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-28">{dateColLabel}</TableHead>
                  {isInactiveTab && <TableHead className="text-[11px] bg-muted/50 w-24">Camp Status</TableHead>}
                  <TableHead className="text-[11px] bg-muted/50 w-20">Medical</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-20">Gate Pass</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-20">Training</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 w-20">PID Status</TableHead>
                  {tabType === 'demobilized' && (
                    <>
                      <TableHead className="text-[11px] bg-muted/50 w-28">Location</TableHead>
                      <TableHead className="text-[11px] bg-muted/50 w-28">Camp Check-in</TableHead>
                      <TableHead className="text-[11px] bg-muted/50 w-28">Camp Check-out</TableHead>
                    </>
                  )}
                  <TableHead className="text-[11px] bg-muted/50 w-44">Reason / Remarks</TableHead>
                  <TableHead className="text-[11px] bg-muted/50 text-right w-[280px] min-w-[280px] whitespace-nowrap">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>{Array(columnCount).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columnCount} className="text-center py-14">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UserCheck className="w-8 h-8 text-green-500" />
                        <p className="font-medium">{tabType === 'inactive' ? 'No inactive personnel' : 'No demobilized personnel'}</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  pagedRows.map(emp => {
                    const stay = latestByPersonnel?.get(emp.id);
                    const statusDate = isInactiveTab ? (emp.inactive_date || emp.status_effective_date) : emp.demobilization_date;
                    const campStatus = resolveCampStatus(emp, stay);
                    const demobilized = isDemobilized(emp);
                    // "Demobilize from COMO" is offered only to an Inactive person who is
                    // still recorded inside COMO Camp and is not demobilized yet.
                    const canDemobilizeFromCamp = isInactiveTab && !demobilized && isStayOpen(stay);
                    const reasonText = isInactiveTab
                      ? (emp.inactive_reason || emp.status_reason || emp.status_remarks)
                      : (emp.demobilization_reason || emp.status_reason || emp.status_remarks);
                    return (
                      <TableRow key={emp.id} className="hover:bg-muted/30">
                        <TableCell className="p-2"><PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size={8} /></TableCell>
                        <TableCell className="p-1"><SharepointDocIcon emp={emp} canEdit={false} onSave={() => {}} /></TableCell>
                        <TableCell className="text-xs font-medium whitespace-nowrap">{emp.name}</TableCell>
                        <TableCell className="text-xs font-mono whitespace-nowrap">{emp.qid_no || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{emp.company}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{emp.designation_org_chart || emp.position_application || '—'}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(statusDate) || '—'}</TableCell>
                        {isInactiveTab && <TableCell className="whitespace-nowrap"><CampStatusBadge status={campStatus} /></TableCell>}
                        <TableCell><MedicalBadge result={emp.ftw_result} /></TableCell>
                        <TableCell><GatePassBadge emp={emp} /></TableCell>
                        <TableCell>
                          {emp.training_status
                            ? <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded border ${{ DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200', PENDING: 'bg-amber-50 text-amber-700 border-amber-200', 'NOT REQUIRED': 'bg-slate-100 text-slate-600 border-slate-200' }[emp.training_status] || 'bg-blue-50 text-blue-700 border-blue-200'}`}>{emp.training_status}</span>
                            : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell><PidStatusBadge emp={emp} /></TableCell>
                        {tabType === 'demobilized' && (
                          <>
                            <TableCell className="text-xs uppercase whitespace-nowrap">{stay?.camp_location || stay?.work_location || emp.current_location || '—'}</TableCell>
                            <TableCell className="whitespace-nowrap"><CampDateTime iso={stay?.check_in_at} /></TableCell>
                            <TableCell className="whitespace-nowrap"><CampDateTime iso={stay?.check_out_at} /></TableCell>
                          </>
                        )}
                        <TableCell className="text-[11px] max-w-[160px] truncate" title={reasonText || ''}>
                          {reasonText || <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap p-1">
                          <div className="flex items-center justify-end gap-1 flex-nowrap whitespace-nowrap">
                            <Link to={`/employees/${emp.id}`}>
                              <Button variant="ghost" size="icon" className="h-6 w-6"><Eye className="w-3.5 h-3.5" /></Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(emp)}><Pencil className="w-3.5 h-3.5" /></Button>
                            {/* Demobilization — COMO Camp action of an Inactive person.
                                Never available without a camp stay; demobilized personnel
                                show a status badge instead. */}
                            {isInactiveTab && (
                              demobilized ? (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border bg-orange-50 text-orange-700 border-orange-200 whitespace-nowrap">
                                  Demobilized
                                </span>
                              ) : canDemobilizeFromCamp ? (
                                <Button
                                  variant="outline" size="sm"
                                  className="text-[11px] h-6 px-1.5 gap-0.5 text-orange-700 border-orange-200 hover:bg-orange-50"
                                  onClick={() => onDemobilize(emp, stay)}
                                  title="Still inside COMO Camp — check out and demobilize"
                                >
                                  <ArrowLeftRight className="w-3 h-3" /> Demobilize from COMO
                                </Button>
                              ) : null
                            )}
                            {/* Reactivate — personnel / project status only */}
                            <Button
                              size="sm"
                              className="text-[11px] h-6 px-1.5 gap-0.5 bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => onReactivate(emp)}
                            >
                              <UserCheck className="w-3.5 h-3.5" /> Reactivate
                            </Button>
                            {/* Delete */}
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" className="text-[11px] h-6 px-1.5 text-red-600 border-red-200 hover:bg-red-50">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Permanently Delete Personnel</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will <strong>permanently delete</strong> <strong>{emp.name}</strong>. Record will be archived in Deleted Personnel.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => onDelete(emp)} className="bg-red-600 hover:bg-red-700">Delete Permanently</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
          <span className="text-xs text-muted-foreground">
            Showing <strong>{rows.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, rows.length)}</strong> of <strong>{rows.length}</strong> filtered · <strong>{totalCount}</strong> total
          </span>
          {totalPages > 1 && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(0)} disabled={page === 0}>«</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}>‹ Prev</Button>
              <span className="text-xs px-2">Page {page + 1} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}>Next ›</Button>
              <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1}>»</Button>
            </div>
          )}
        </div>
      </Card>
    </>
  );
}

// ── Inactive / Demobilized list ───────────────────────────────────────────────
// Self-contained list for one status. Rendered as a tab inside Master List
// (status="Inactive") and COMO Camp (status="Demobilized").
export default function InactivePersonnelView({ status = 'Inactive' }) {
  const tabType = status === 'Demobilized' ? 'demobilized' : 'inactive';
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { rlicStatusOptions, trainingStatusOptions } = useLookupOptions();
  const currentUser = useCurrentUser();
  const navigate = useNavigate();

  const { employees, isLoading } = useInactiveRoster();
  const { latestByPersonnel } = useLatestCampStays();

  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [medicalResultFilter, setMedicalResultFilter] = useState('all');
  const [trainingFilter, setTrainingFilter] = useState('all');
  const [gatePassFilter, setGatePassFilter] = useState([]);
  const [pidStatusFilter, setPidStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [reactivateDialog, setReactivateDialog] = useState({ open: false, emp: null });
  const [demobilizeDialog, setDemobilizeDialog] = useState({ open: false, emp: null, record: null });

  // Restore the list state saved before opening Edit (filters, page, scroll).
  useEffect(() => {
    const ctx = readReturnContext();
    if (!ctx || ctx.tab !== tabType) return;
    sessionStorage.removeItem(RETURN_CONTEXT_KEY);
    if (typeof ctx.search === 'string') setSearch(ctx.search);
    if (Array.isArray(ctx.companyFilter)) setCompanyFilter(ctx.companyFilter);
    if (Array.isArray(ctx.positionFilter)) setPositionFilter(ctx.positionFilter);
    if (ctx.departmentFilter) setDepartmentFilter(ctx.departmentFilter);
    if (ctx.locationFilter) setLocationFilter(ctx.locationFilter);
    if (ctx.dirFilter) setDirFilter(ctx.dirFilter);
    if (ctx.medicalResultFilter) setMedicalResultFilter(ctx.medicalResultFilter);
    if (ctx.trainingFilter) setTrainingFilter(ctx.trainingFilter);
    if (Array.isArray(ctx.gatePassFilter)) setGatePassFilter(ctx.gatePassFilter);
    if (ctx.pidStatusFilter) setPidStatusFilter(ctx.pidStatusFilter);
    if (typeof ctx.page === 'number') setPage(ctx.page);
    setTimeout(() => window.scrollTo(0, typeof ctx.scrollY === 'number' ? ctx.scrollY : 0), 80);
  }, [tabType]);

  const allRows = useMemo(() => statusList(employees, status), [employees, status]);

  const uniqueCompanies = useMemo(() => {
    const vals = [...new Set(allRows.map(e => e.company).filter(Boolean))].sort();
    return vals.map(v => { const c = COMPANIES.find(x => x.value === v); return { value: v, label: c ? c.label : v }; });
  }, [allRows]);

  const positions = useMemo(() => {
    const pos = [...new Set(allRows.map(e => e.designation_org_chart || e.position_application).filter(Boolean))].sort();
    return pos.map(p => ({ value: p, label: p }));
  }, [allRows]);

  const filtered = useMemo(() => allRows.filter(e => {
    if (search) {
      const q = search.toLowerCase();
      const matched =
        e.name?.toLowerCase().includes(q) ||
        e.qid_no?.toLowerCase().includes(q) ||
        e.pid?.toLowerCase().includes(q) ||
        e.pp_no?.toLowerCase().includes(q) ||
        e.company?.toLowerCase().includes(q) ||
        e.nationality?.toLowerCase().includes(q) ||
        e.designation_org_chart?.toLowerCase().includes(q) ||
        e.position_application?.toLowerCase().includes(q);
      if (!matched) return false;
    }
    if (companyFilter.length > 0 && !companyFilter.includes(e.company)) return false;
    if (positionFilter.length > 0 && !positionFilter.includes(e.designation_org_chart) && !positionFilter.includes(e.position_application)) return false;
    if (departmentFilter !== 'all' && e.department !== departmentFilter) return false;
    if (locationFilter !== 'all' && e.current_location !== locationFilter) return false;
    if (dirFilter !== 'all' && e.dir_indir !== dirFilter) return false;
    if (medicalResultFilter !== 'all' && e.ftw_result !== medicalResultFilter) return false;
    if (trainingFilter !== 'all' && e.training_status !== trainingFilter) return false;
    const effectiveRlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    if (gatePassFilter.length > 0 && !gatePassFilter.includes(effectiveRlic)) return false;
    const effectivePid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    if (pidStatusFilter !== 'all' && effectivePid !== pidStatusFilter) return false;
    return true;
  }), [allRows, search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter, trainingFilter, gatePassFilter, pidStatusFilter]);

  const clearFilters = () => {
    setSearch(''); setCompanyFilter([]); setPositionFilter([]);
    setDepartmentFilter('all'); setLocationFilter('all'); setDirFilter('all');
    setMedicalResultFilter('all'); setTrainingFilter('all'); setGatePassFilter([]); setPidStatusFilter('all');
    setPage(0);
  };

  // Save the current list state before opening Edit, so the form returns to it.
  const goToEdit = (emp) => {
    sessionStorage.setItem(RETURN_CONTEXT_KEY, JSON.stringify({
      tab: tabType, page, search, companyFilter, positionFilter, departmentFilter,
      locationFilter, dirFilter, medicalResultFilter, trainingFilter, gatePassFilter,
      pidStatusFilter, scrollY: window.scrollY,
    }));
    const section = tabType === 'demobilized' ? 'demobilization-details' : 'inactive-details';
    navigate(`/employees/${emp.id}/edit?section=${section}`);
  };

  // ── Reactivate — personnel / project status ONLY ──
  // Returns the person to the working roster (Active on Site / Onboarding).
  // Camp accommodation is never touched: a previous demobilization stays in
  // history and a new camp stay is a separate COMO Camp check-in.
  const reactivateMutation = useMutation({
    mutationFn: ({ emp, newStatus, effectiveDate, reason }) => base44.entities.Employee.update(emp.id, {
      personnel_status: newStatus,
      is_active: isActiveRosterStatus(newStatus),
      status_effective_date: effectiveDate || '',
      status_reason: reason || '',
      status_changed_by: currentUser?.email || 'unknown',
      status_changed_at: new Date().toISOString(),
    }),
    onSuccess: async (_, { emp, newStatus, effectiveDate, reason }) => {
      await base44.entities.ActivityLog.create({
        action: 'update', entity_name: 'Employee', entity_id: emp.id,
        performed_by: currentUser?.email || 'unknown',
        record_name: emp.name,
        changed_fields: ['personnel_status'],
        record_snapshot: {
          previous_status: emp.personnel_status || 'Inactive',
          new_status: newStatus,
          effective_date: effectiveDate,
          reason: reason || '',
          camp_status_kept: resolveCampStatus(emp),
          updated_by: currentUser?.full_name || currentUser?.email || 'unknown',
          updated_at: new Date().toISOString(),
        },
      });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({
        title: 'Personnel reactivated',
        description: `${emp.name} is back on the roster as ${newStatus}. Camp accommodation was not changed.`,
      });
    },
    onError: () => toast({ title: 'Reactivation failed', variant: 'destructive' }),
  });

  // ── Demobilize from COMO Camp (Inactive person still inside camp) ──
  // Closes the camp stay, keeps the personnel status Inactive and sets the camp
  // status Demobilized — the person stays in the Inactive list AND appears under
  // Demobilized. Camp history and every other field are preserved.
  const demobilizeMutation = useMutation({
    mutationFn: async ({ emp, record, at, reason }) => {
      const outIso = at.toISOString();
      const duration = record?.check_in_at ? calcDuration(record.check_in_at, outIso) : 0;
      if (record) {
        await base44.entities.ComoCampStay.update(record.id, {
          check_out_at: outIso, duration_minutes: duration, status: 'completed',
          checked_out_by: currentUser?.email || '', checked_out_by_name: currentUser?.full_name || '',
        });
      }
      await demobilizeFromCamp({ emp, checkOutAt: outIso, reason, user: currentUser });
      await base44.entities.ActivityLog.create({
        action: 'update', entity_name: 'Employee', entity_id: emp.id,
        performed_by: currentUser?.email || 'unknown',
        record_name: emp.name,
        changed_fields: ['camp_status', 'personnel_status'],
        record_snapshot: {
          action_type: 'Demobilize from COMO Camp',
          camp_check_out_at: outIso,
          personnel_status: 'Inactive',
          camp_status: CAMP_STATUS.DEMOBILIZED,
          reason: reason || '',
          updated_by: currentUser?.full_name || currentUser?.email || 'unknown',
          updated_at: new Date().toISOString(),
        },
      });
    },
    onSuccess: (_, { emp }) => {
      queryClient.invalidateQueries({ queryKey: ['camp-stays'] });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['activity-logs'] });
      toast({
        title: 'Demobilized from COMO Camp',
        description: `${emp.name} stays Inactive and now also appears under Demobilized.`,
      });
    },
    onError: () => toast({ title: 'Demobilization failed', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (emp) => {
      await base44.entities.DeletedEmployee.create({
        original_id: emp.id, deleted_by: currentUser?.email || 'unknown',
        deleted_at: new Date().toISOString(), employee_data: emp,
        employee_name: emp.name, company: emp.company, department: emp.department, recovered: false,
      });
      await base44.entities.ActivityLog.create({
        action: 'delete', entity_name: 'Employee', entity_id: emp.id,
        performed_by: currentUser?.email || 'unknown', record_snapshot: emp, record_name: emp.name,
      });
      await base44.entities.Employee.delete(emp.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-employees'] });
      toast({ title: 'Personnel permanently deleted', description: 'Record moved to Deleted Personnel.' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  // Both exports follow the corrected model: the Inactive export carries EVERY
  // project-inactive person, the Demobilized export only those demobilized from
  // COMO Camp. Personnel status and camp status are reported separately.
  const exportData = (list) => list.map(e => {
    const stay = latestByPersonnel.get(e.id);
    return {
      Name: e.name, QID: e.qid_no, PID_No: e.pid || '—', Nationality: e.nationality,
      Company: e.company, Department: e.department,
      Position: e.designation_org_chart || e.position_application,
      Location: e.current_location,
      Personnel_Status: resolvePersonnelStatus(e) || 'Inactive',
      Camp_Status: campStatusLabel(resolveCampStatus(e, stay)),
      Inactive_Date: e.inactive_date, Inactive_Reason: e.inactive_reason || e.status_reason || '',
      Camp_Check_In: stay?.check_in_at || '', Camp_Check_Out: stay?.check_out_at || e.camp_check_out_at || '',
      Demobilization_Date: e.demobilization_date, Demobilization_Reason: e.demobilization_reason || '',
      Status_Effective_Date: e.status_effective_date, Last_Working_Date: e.last_working_date,
      Status_Reason: e.status_reason, Status_Changed_By: e.status_changed_by,
      Medical: e.ftw_result, Gate_Pass_Expiry: e.gate_pass_expiry, RLIC_Status: e.rlic_status,
      Training_Status: e.training_status,
      PID_Status: computePassStatus(e.pid_expiry, 'pid', e.pid_status) || '—',
      Reason_Remarks: e.inactive_reason || e.demobilization_reason || e.status_reason || e.status_remarks || '—',
    };
  });

  const filters = { search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter, trainingFilter, gatePassFilter, pidStatusFilter };
  const setters = { setSearch, setCompanyFilter, setPositionFilter, setDepartmentFilter, setLocationFilter, setDirFilter, setMedicalResultFilter, setTrainingFilter, setGatePassFilter, setPidStatusFilter, setPage };

  // ── Print / PDF report data ──
  const printColumns = tabType === 'inactive'
    ? [
        { key: 'name', label: 'Name' },
        { key: 'qid_no', label: 'QID No.' },
        { key: 'pid', label: 'PID No.' },
        { key: 'company', label: 'Company' },
        { key: 'designation', label: 'Designation / Position' },
        { key: 'status_date', label: 'Inactive Date', align: 'center' },
        { key: 'camp_status', label: 'Camp Status', align: 'center' },
        { key: 'medical', label: 'Medical Status', align: 'center' },
        { key: 'gate_pass', label: 'Gate Pass Status', align: 'center' },
        { key: 'training', label: 'Training Status', align: 'center' },
        { key: 'pid_status', label: 'PID Status', align: 'center' },
        { key: 'reason', label: 'Inactive Reason / Remarks' },
      ]
    : [
        { key: 'name', label: 'Name' },
        { key: 'qid_no', label: 'QID No.' },
        { key: 'pid', label: 'PID No.' },
        { key: 'company', label: 'Company' },
        { key: 'designation', label: 'Designation / Position' },
        { key: 'status_date', label: 'Demobilization Date', align: 'center' },
        { key: 'location', label: 'Location', align: 'center' },
        { key: 'camp_in', label: 'Camp Check-in', align: 'center' },
        { key: 'camp_out', label: 'Camp Check-out', align: 'center' },
        { key: 'medical', label: 'Medical Status', align: 'center' },
        { key: 'gate_pass', label: 'Gate Pass Status', align: 'center' },
        { key: 'training', label: 'Training Status', align: 'center' },
        { key: 'pid_status', label: 'PID Status', align: 'center' },
        { key: 'reason', label: 'Demobilization Reason' },
      ];

  const medPrintLabels = { 'ACCEPTED': 'Accepted', 'REJECTED': 'Rejected', 'WAITING TR APPROVAL': 'Waiting TR', 'RE-ASSESS': 'Re-Assess' };
  const passPrintLabels = { 'VALID RLIC PASS': 'Valid', 'EXPIRED RLIC PASS': 'Expired', 'SOON TO EXPIRE': 'Soon to Expire', 'NO RLIC PASS': 'No Pass', 'VALID PID PASS': 'Valid', 'EXPIRED PID PASS': 'Expired', 'NO PID PASS': 'No Pass' };

  const printRows = useMemo(() => {
    const fmtStamp = (iso) => {
      const dt = formatDateTimeCompact(iso);
      return dt ? `${dt.date} ${dt.time}` : '—';
    };
    return filtered.map(e => {
      const stay = latestByPersonnel.get(e.id);
      const isInactiveTab = tabType === 'inactive';
      const statusDate = isInactiveTab ? (e.inactive_date || e.status_effective_date) : e.demobilization_date;
      return {
        name: e.name || '—',
        qid_no: e.qid_no || '—',
        pid: e.pid || '—',
        company: e.company || '—',
        designation: e.designation_org_chart || e.position_application || '—',
        status_date: formatDate(statusDate) || '—',
        camp_status: campStatusLabel(resolveCampStatus(e, stay)),
        location: (stay?.camp_location || stay?.work_location || e.current_location || '—').toUpperCase(),
        camp_in: fmtStamp(stay?.check_in_at),
        camp_out: fmtStamp(stay?.check_out_at || e.camp_check_out_at),
        medical: e.ftw_result ? (medPrintLabels[e.ftw_result] || e.ftw_result) : '—',
        gate_pass: passPrintLabels[computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status)] || '—',
        training: e.training_status || '—',
        pid_status: passPrintLabels[computePassStatus(e.pid_expiry, 'pid', e.pid_status)] || '—',
        reason: (isInactiveTab
          ? (e.inactive_reason || e.status_reason)
          : (e.demobilization_reason || e.status_reason)) || e.status_remarks || '—',
      };
    });
  }, [filtered, tabType, latestByPersonnel]);

  const activeAppliedFilters = useMemo(() => {
    const items = [];
    if (search) items.push(`Search: "${search}"`);
    if (companyFilter.length > 0) items.push(`Company: ${companyFilter.join(', ')}`);
    if (positionFilter.length > 0) items.push(`Position: ${positionFilter.join(', ')}`);
    if (departmentFilter !== 'all') items.push(`Department: ${departmentFilter}`);
    if (locationFilter !== 'all') items.push(`Location: ${locationFilter}`);
    if (dirFilter !== 'all') items.push(`DIR/INDIR: ${dirFilter}`);
    if (medicalResultFilter !== 'all') items.push(`Medical: ${MEDICAL_RESULTS.find(r => r.value === medicalResultFilter)?.label || medicalResultFilter}`);
    if (trainingFilter !== 'all') items.push(`Training: ${trainingFilter}`);
    if (gatePassFilter.length > 0) items.push(`Gate Pass: ${gatePassFilter.join(', ')}`);
    if (pidStatusFilter !== 'all') items.push(`PID Status: ${PID_STATUSES.find(s => s.value === pidStatusFilter)?.label || pidStatusFilter}`);
    return items;
  }, [search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter, trainingFilter, gatePassFilter, pidStatusFilter]);

  const reportTitle = tabType === 'inactive' ? 'GSO Qatar — Inactive Personnel Report' : 'GSO Qatar — Demobilized Personnel Report';

  return (
    <div className="space-y-3">
      <FilterPanel
        filters={filters}
        setters={setters}
        uniqueCompanies={uniqueCompanies}
        positions={positions}
        rlicStatusOptions={rlicStatusOptions}
        trainingStatusOptions={trainingStatusOptions}
        onClear={clearFilters}
      />

      <div className="flex justify-end items-center gap-2">
        <PrintReportButton
          records={printRows}
          columns={printColumns}
          title={reportTitle}
          appliedFilters={activeAppliedFilters}
          totalFiltered={filtered.length}
          sortBy={['company', 'designation', 'name']}
        />
        <ExportButton filename={`${tabType}_personnel`} label="Export" getData={() => exportData(filtered)} />
      </div>

      <PersonnelTable
        rows={filtered}
        isLoading={isLoading}
        page={page}
        setPage={setPage}
        totalCount={allRows.length}
        tabType={tabType}
        latestByPersonnel={latestByPersonnel}
        onReactivate={(emp) => setReactivateDialog({ open: true, emp })}
        onDemobilize={(emp, record) => setDemobilizeDialog({ open: true, emp, record })}
        onDelete={(emp) => deleteMutation.mutate(emp)}
        onEdit={goToEdit}
      />

      <ReactivateDialog
        open={reactivateDialog.open}
        emp={reactivateDialog.emp}
        onClose={() => setReactivateDialog({ open: false, emp: null })}
        onConfirm={(args) => reactivateMutation.mutate(args)}
      />

      <CheckOutDialog
        open={demobilizeDialog.open}
        emp={demobilizeDialog.emp}
        record={demobilizeDialog.record}
        mode="demobilize"
        onClose={() => setDemobilizeDialog({ open: false, emp: null, record: null })}
        onConfirm={(record, at, { reason }) => {
          const emp = demobilizeDialog.emp;
          setDemobilizeDialog({ open: false, emp: null, record: null });
          demobilizeMutation.mutate({ emp, record, at, reason });
        }}
      />
    </div>
  );
}