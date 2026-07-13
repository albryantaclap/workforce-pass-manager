import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCheck, UserX, Eye, Pencil, X, Trash2, ArrowLeftRight } from 'lucide-react';
import ExportButton from '../components/common/ExportButton';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, computePassStatus, daysUntil, normalizeDate, COMPANIES, RLIC_STATUSES, PID_STATUSES, LOCATIONS, MEDICAL_RESULTS } from '@/utils/constants';
import MultiSelect from '../components/common/MultiSelect';
import PersonnelAvatar from '../components/common/PersonnelAvatar';
import SharepointDocIcon from '../components/common/SharepointDocIcon';
import StatusBadge from '../components/common/StatusBadge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import { useCurrentUser } from '@/lib/useCurrentUser';

const medicalResultStyles = {
  'ACCEPTED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'REJECTED': 'bg-red-50 text-red-700 border-red-200',
  'WAITING TR APPROVAL': 'bg-amber-50 text-amber-700 border-amber-200',
  'RE-ASSESS': 'bg-purple-50 text-purple-700 border-purple-200',
};
const medicalShortLabels = {
  'ACCEPTED': 'Accepted', 'REJECTED': 'Rejected',
  'WAITING TR APPROVAL': 'Waiting TR', 'RE-ASSESS': 'Re-Assess',
};
function MedicalBadge({ result }) {
  if (!result) return <span className="text-xs text-muted-foreground">—</span>;
  const style = medicalResultStyles[result] || 'bg-blue-50 text-blue-700 border-blue-200';
  const label = medicalShortLabels[result] || result;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style}`}>{label}</span>;
}

function GatePassBadge({ emp }) {
  const status = computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status);
  const styles = {
    'VALID RLIC PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'EXPIRED RLIC PASS': 'bg-red-50 text-red-700 border-red-200',
    'SOON TO EXPIRE': 'bg-amber-50 text-amber-700 border-amber-200',
    'NO RLIC PASS': 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const labels = {
    'VALID RLIC PASS': 'Valid', 'EXPIRED RLIC PASS': 'Expired',
    'SOON TO EXPIRE': 'Soon', 'NO RLIC PASS': 'No Pass',
  };
  const style = styles[status] || 'bg-blue-50 text-blue-700 border-blue-200';
  const label = labels[status] || status;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${style}`}>{label}</span>;
}

const PAGE_SIZE = 50;

// ── Filters component (shared between tabs) ────────────────────────────────
function FilterPanel({ filters, setters, uniqueCompanies, positions, rlicStatusOptions, trainingStatusOptions, onClear }) {
  const { search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter,
    medicalResultFilter, pidIssueFrom, pidIssueTo, trainingFilter, gatePassFilter, pidStatusFilter } = filters;
  const { setSearch, setCompanyFilter, setPositionFilter, setDepartmentFilter, setLocationFilter, setDirFilter,
    setMedicalResultFilter, setPidIssueFrom, setPidIssueTo, setTrainingFilter, setGatePassFilter, setPidStatusFilter, setPage } = setters;

  const hasActiveFilters = search || companyFilter.length > 0 || positionFilter.length > 0 ||
    departmentFilter !== 'all' || locationFilter !== 'all' || dirFilter !== 'all' ||
    medicalResultFilter !== 'all' || pidIssueFrom || pidIssueTo ||
    trainingFilter !== 'all' || gatePassFilter.length > 0 || pidStatusFilter !== 'all';

  return (
    <Card className="p-4 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
        <div className="relative xl:col-span-2">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Name, QID, Company, Nationality..." value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} className="pl-9" />
        </div>
        <MultiSelect options={uniqueCompanies} value={companyFilter} onChange={v => { setCompanyFilter(v); setPage(0); }} placeholder="All Companies" />
        <MultiSelect options={positions} value={positionFilter} onChange={v => { setPositionFilter(v); setPage(0); }} placeholder="Filter by position" />
        <Select value={departmentFilter} onValueChange={v => { setDepartmentFilter(v); setPage(0); }}>
          <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Departments</SelectItem>
            {['Electrical','Mechanical','Civil','Services','Steel Structure'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
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
          <p className="text-xs font-medium text-muted-foreground mb-1">PID Issue Date — From</p>
          <Input type="date" value={pidIssueFrom} onChange={e => { setPidIssueFrom(e.target.value); setPage(0); }} className="text-xs" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-medium text-muted-foreground mb-1">PID Issue Date — To</p>
          <Input type="date" value={pidIssueTo} onChange={e => { setPidIssueTo(e.target.value); setPage(0); }} className="text-xs" />
        </div>
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
          <Button variant="outline" size="sm" onClick={onClear}>
            <X className="w-3.5 h-3.5 mr-1" /> Clear Filters
          </Button>
        </div>
      )}
    </Card>
  );
}

// ── Personnel Table (shared between tabs) ─────────────────────────────────
function PersonnelTable({ rows, isLoading, page, setPage, totalCount, onReactivate, onChangeStatus, onDelete, tabType }) {
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pagedRows = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const emptyLabel = tabType === 'inactive' ? 'No inactive personnel' : 'No demobilized personnel';
  const emptyDesc = tabType === 'inactive' ? 'All personnel are currently active or demobilized.' : 'No personnel have been demobilized.';

  return (
    <Card className="overflow-hidden">
      <div className="table-scroll-x">
        <div className="table-scroll-y h-[560px]">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs bg-muted/50 w-10">Photo</TableHead>
                <TableHead className="text-xs bg-muted/50 w-8">Docs</TableHead>
                <TableHead className="text-xs bg-muted/50">Name</TableHead>
                <TableHead className="text-xs bg-muted/50">Company</TableHead>
                <TableHead className="text-xs bg-muted/50">QID No</TableHead>
                <TableHead className="text-xs bg-muted/50">PID No</TableHead>
                <TableHead className="text-xs bg-muted/50">Issue Date</TableHead>
                <TableHead className="text-xs bg-muted/50">Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50">Days Left</TableHead>
                <TableHead className="text-xs bg-muted/50">Medical</TableHead>
                <TableHead className="text-xs bg-muted/50">Gate Pass</TableHead>
                <TableHead className="text-xs bg-muted/50">Training</TableHead>
                {tabType === 'demobilized' && <TableHead className="text-xs bg-muted/50">Demob Date</TableHead>}
                {tabType === 'demobilized' && <TableHead className="text-xs bg-muted/50">Demob Reason</TableHead>}
                <TableHead className="text-xs bg-muted/50 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5).fill(0).map((_, i) => (
                  <TableRow key={i}>{Array(14).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-14">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <UserCheck className="w-8 h-8 text-green-500" />
                      <p className="font-medium">{emptyLabel}</p>
                      <p className="text-xs">{emptyDesc}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedRows.map(emp => {
                  const days = daysUntil(emp.pid_expiry);
                  return (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="p-2"><PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size={8} /></TableCell>
                      <TableCell className="p-1"><SharepointDocIcon emp={emp} canEdit={false} onSave={() => {}} /></TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{emp.name}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{emp.company}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{emp.qid_no || '—'}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{emp.pid || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.pid_issue_date) || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.pid_expiry) || '—'}</TableCell>
                      <TableCell>
                        {days !== null ? (
                          <span className={`text-xs font-bold ${days <= 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-green-600'}`}>
                            {days <= 0 ? 'Expired' : `${days}d`}
                          </span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell><MedicalBadge result={emp.ftw_result} /></TableCell>
                      <TableCell><GatePassBadge emp={emp} /></TableCell>
                      <TableCell>
                        {emp.training_status ? (
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${{ DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200', PENDING: 'bg-amber-50 text-amber-700 border-amber-200', 'NOT REQUIRED': 'bg-slate-100 text-slate-600 border-slate-200' }[emp.training_status] || 'bg-blue-50 text-blue-700 border-blue-200'}`}>{emp.training_status}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      {tabType === 'demobilized' && (
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.demobilization_date) || '—'}</TableCell>
                      )}
                      {tabType === 'demobilized' && (
                        <TableCell className="text-xs max-w-[120px] truncate" title={emp.demobilization_reason}>{emp.demobilization_reason || '—'}</TableCell>
                      )}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`/employees/${emp.id}`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                          </Link>
                          <Link to={`/employees/${emp.id}/edit`}>
                            <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                          </Link>
                          {/* Move to other non-active status */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-slate-600">
                                <ArrowLeftRight className="w-3 h-3" />
                                {tabType === 'inactive' ? 'Demobilize' : 'Mark Inactive'}
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  {tabType === 'inactive' ? 'Move to Demobilized' : 'Move to Inactive'}
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Change <strong>{emp.name}</strong> from{' '}
                                  <strong>{tabType === 'inactive' ? 'Inactive' : 'Demobilized'}</strong> to{' '}
                                  <strong>{tabType === 'inactive' ? 'Demobilized' : 'Inactive'}</strong>?
                                  All records and history will be preserved.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => onChangeStatus(emp, tabType === 'inactive' ? 'Demobilized' : 'Inactive')}
                                  className="bg-slate-700 hover:bg-slate-800"
                                >
                                  Confirm
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {/* Reactivate */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" className="text-xs h-7 bg-green-600 hover:bg-green-700 text-white gap-1">
                                <UserCheck className="w-3.5 h-3.5" /> Reactivate
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Reactivate Personnel</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Reactivate <strong>{emp.name}</strong>? They will return to the active Master List and all counts.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onReactivate(emp)} className="bg-green-600 hover:bg-green-700">
                                  Reactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                          {/* Delete */}
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="outline" className="text-xs h-7 text-red-600 border-red-200 hover:bg-red-50 gap-1">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Permanently Delete Personnel</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This will <strong>permanently delete</strong> <strong>{emp.name}</strong> from the system. The record will be moved to the Deleted Personnel archive.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onDelete(emp)} className="bg-red-600 hover:bg-red-700">
                                  Delete Permanently
                                </AlertDialogAction>
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
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function InactivePersonnel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { rlicStatusOptions, trainingStatusOptions } = useLookupOptions();
  const currentUser = useCurrentUser();

  // Shared filters
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [medicalResultFilter, setMedicalResultFilter] = useState('all');
  const [pidIssueFrom, setPidIssueFrom] = useState('');
  const [pidIssueTo, setPidIssueTo] = useState('');
  const [trainingFilter, setTrainingFilter] = useState('all');
  const [gatePassFilter, setGatePassFilter] = useState([]);
  const [pidStatusFilter, setPidStatusFilter] = useState('all');
  const [inactivePage, setInactivePage] = useState(0);
  const [demobPage, setDemobPage] = useState(0);

  // Fetch all non-active employees (is_active: false covers both Inactive and Demobilized)
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-inactive'],
    queryFn: () => base44.entities.Employee.filter({ is_active: false }, '-created_date', 5000),
  });

  const uniqueCompanies = useMemo(() => {
    const vals = [...new Set(employees.map(e => e.company).filter(Boolean))].sort();
    return vals.map(v => { const c = COMPANIES.find(x => x.value === v); return { value: v, label: c ? c.label : v }; });
  }, [employees]);

  const positions = useMemo(() => {
    const pos = [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort();
    return pos.map(p => ({ value: p, label: p }));
  }, [employees]);

  // Apply common filters to a list
  const applyFilters = (list) => list.filter(e => {
    if (search && !e.name?.toLowerCase().includes(search.toLowerCase()) &&
      !e.qid_no?.includes(search) && !e.company?.toLowerCase().includes(search.toLowerCase()) &&
      !e.nationality?.toLowerCase().includes(search.toLowerCase())) return false;
    if (companyFilter.length > 0 && !companyFilter.includes(e.company)) return false;
    if (positionFilter.length > 0 && !positionFilter.includes(e.designation_org_chart)) return false;
    if (departmentFilter !== 'all' && e.department !== departmentFilter) return false;
    if (locationFilter !== 'all' && e.current_location !== locationFilter) return false;
    if (dirFilter !== 'all' && e.dir_indir !== dirFilter) return false;
    if (medicalResultFilter !== 'all' && e.ftw_result !== medicalResultFilter) return false;
    const issueDate = normalizeDate(e.pid_issue_date);
    if (pidIssueFrom && (!issueDate || issueDate < pidIssueFrom)) return false;
    if (pidIssueTo && (!issueDate || issueDate > pidIssueTo)) return false;
    if (trainingFilter !== 'all' && e.training_status !== trainingFilter) return false;
    const effectiveRlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    if (gatePassFilter.length > 0 && !gatePassFilter.includes(effectiveRlic)) return false;
    const effectivePid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    if (pidStatusFilter !== 'all' && effectivePid !== pidStatusFilter) return false;
    return true;
  });

  // Split by personnel_status (fall back: if no personnel_status, use is_active=false → Inactive)
  const allInactive = useMemo(() =>
    employees.filter(e => !e.personnel_status || e.personnel_status === 'Inactive'),
    [employees]
  );
  const allDemobilized = useMemo(() =>
    employees.filter(e => e.personnel_status === 'Demobilized'),
    [employees]
  );

  const filteredInactive = useMemo(() => applyFilters(allInactive),
    [allInactive, search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter, pidIssueFrom, pidIssueTo, trainingFilter, gatePassFilter, pidStatusFilter]
  );
  const filteredDemobilized = useMemo(() => applyFilters(allDemobilized),
    [allDemobilized, search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter, pidIssueFrom, pidIssueTo, trainingFilter, gatePassFilter, pidStatusFilter]
  );

  const clearFilters = () => {
    setSearch(''); setCompanyFilter([]); setPositionFilter([]);
    setDepartmentFilter('all'); setLocationFilter('all'); setDirFilter('all');
    setMedicalResultFilter('all'); setPidIssueFrom(''); setPidIssueTo('');
    setTrainingFilter('all'); setGatePassFilter([]); setPidStatusFilter('all');
    setInactivePage(0); setDemobPage(0);
  };

  const filters = { search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter, pidIssueFrom, pidIssueTo, trainingFilter, gatePassFilter, pidStatusFilter };
  const setters = { setSearch, setCompanyFilter, setPositionFilter, setDepartmentFilter, setLocationFilter, setDirFilter, setMedicalResultFilter, setPidIssueFrom, setPidIssueTo, setTrainingFilter, setGatePassFilter, setPidStatusFilter, setPage: setInactivePage };

  // ── Mutations ──
  const reactivateMutation = useMutation({
    mutationFn: (emp) => base44.entities.Employee.update(emp.id, {
      is_active: true,
      personnel_status: 'Active',
      status_effective_date: new Date().toISOString().split('T')[0],
    }),
    onSuccess: async (_, emp) => {
      await base44.entities.ActivityLog.create({
        action: 'update', entity_name: 'Employee', entity_id: emp.id,
        performed_by: currentUser?.email || 'unknown',
        record_name: emp.name,
        changed_fields: ['is_active', 'personnel_status'],
        record_snapshot: { previous_status: emp.personnel_status || 'Inactive', new_status: 'Active' },
      });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Personnel reactivated', description: `${emp.name} returned to active roster.` });
    },
    onError: () => toast({ title: 'Failed to reactivate', variant: 'destructive' }),
  });

  const changeStatusMutation = useMutation({
    mutationFn: ({ emp, newStatus }) => base44.entities.Employee.update(emp.id, {
      personnel_status: newStatus,
      status_effective_date: new Date().toISOString().split('T')[0],
      ...(newStatus === 'Demobilized' ? { demobilization_date: new Date().toISOString().split('T')[0] } : {}),
    }),
    onSuccess: async (_, { emp, newStatus }) => {
      await base44.entities.ActivityLog.create({
        action: 'update', entity_name: 'Employee', entity_id: emp.id,
        performed_by: currentUser?.email || 'unknown',
        record_name: emp.name,
        changed_fields: ['personnel_status'],
        record_snapshot: { previous_status: emp.personnel_status || 'Inactive', new_status: newStatus },
      });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      toast({ title: `Moved to ${newStatus}`, description: `${emp.name} status updated.` });
    },
    onError: () => toast({ title: 'Status change failed', variant: 'destructive' }),
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
    onSuccess: (_, emp) => {
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-employees'] });
      toast({ title: 'Personnel permanently deleted', description: 'Record moved to Deleted Personnel.' });
    },
    onError: () => toast({ title: 'Delete failed', variant: 'destructive' }),
  });

  const exportData = (list) => list.map(e => ({
    Name: e.name, Company: e.company, QID: e.qid_no, Department: e.department,
    Nationality: e.nationality, Position: e.designation_org_chart || e.position_application,
    Personnel_Status: e.personnel_status || 'Inactive',
    Status_Effective_Date: e.status_effective_date, Last_Working_Date: e.last_working_date,
    Status_Reason: e.status_reason, Demobilization_Date: e.demobilization_date, Demobilization_Reason: e.demobilization_reason,
    PID: e.pid, PID_Issue_Date: e.pid_issue_date, PID_Expiry: e.pid_expiry,
    Medical: e.ftw_result, Gate_Pass_Expiry: e.gate_pass_expiry, RLIC_Status: e.rlic_status,
    Training_Status: e.training_status, Location: e.current_location,
  }));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <UserX className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Inactive Personnel</h2>
            <p className="text-sm text-muted-foreground">
              <span className="text-red-600 font-semibold">{allInactive.length} inactive</span>
              {' · '}
              <span className="text-orange-600 font-semibold">{allDemobilized.length} demobilized</span>
              {' · '}
              {employees.length} total non-active records
            </p>
          </div>
        </div>
      </div>

      {/* Shared Filters */}
      <FilterPanel
        filters={filters}
        setters={{ ...setters, setPage: (p) => { setInactivePage(p); setDemobPage(p); } }}
        uniqueCompanies={uniqueCompanies}
        positions={positions}
        rlicStatusOptions={rlicStatusOptions}
        trainingStatusOptions={trainingStatusOptions}
        onClear={clearFilters}
      />

      {/* Tabs */}
      <Tabs defaultValue="inactive" className="w-full">
        <div className="flex items-center justify-between mb-3">
          <TabsList>
            <TabsTrigger value="inactive" className="gap-2">
              <UserX className="w-3.5 h-3.5" />
              Inactive
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">{filteredInactive.length}</span>
            </TabsTrigger>
            <TabsTrigger value="demobilized" className="gap-2">
              <ArrowLeftRight className="w-3.5 h-3.5" />
              Demobilized
              <span className="ml-1 px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold">{filteredDemobilized.length}</span>
            </TabsTrigger>
          </TabsList>
          <div id="export-slot" />
        </div>

        <TabsContent value="inactive">
          <div className="flex justify-end mb-2">
            <ExportButton filename="inactive_personnel" label="Export" getData={() => exportData(filteredInactive)} />
          </div>
          <PersonnelTable
            rows={filteredInactive}
            isLoading={isLoading}
            page={inactivePage}
            setPage={setInactivePage}
            totalCount={allInactive.length}
            tabType="inactive"
            onReactivate={(emp) => reactivateMutation.mutate(emp)}
            onChangeStatus={(emp, newStatus) => changeStatusMutation.mutate({ emp, newStatus })}
            onDelete={(emp) => deleteMutation.mutate(emp)}
          />
        </TabsContent>

        <TabsContent value="demobilized">
          <div className="flex justify-end mb-2">
            <ExportButton filename="demobilized_personnel" label="Export" getData={() => exportData(filteredDemobilized)} />
          </div>
          <PersonnelTable
            rows={filteredDemobilized}
            isLoading={isLoading}
            page={demobPage}
            setPage={setDemobPage}
            totalCount={allDemobilized.length}
            tabType="demobilized"
            onReactivate={(emp) => reactivateMutation.mutate(emp)}
            onChangeStatus={(emp, newStatus) => changeStatusMutation.mutate({ emp, newStatus })}
            onDelete={(emp) => deleteMutation.mutate(emp)}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}