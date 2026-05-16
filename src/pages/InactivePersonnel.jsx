import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCheck, UserX, Eye, Pencil, X, Trash2 } from 'lucide-react';
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

export default function InactivePersonnel() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [medicalResultFilter, setMedicalResultFilter] = useState('all');
  // New filters matching ProjectIDTracker list view
  const [pidIssueFrom, setPidIssueFrom] = useState('');
  const [pidIssueTo, setPidIssueTo] = useState('');
  const [trainingFilter, setTrainingFilter] = useState('all');
  const [gatePassFilter, setGatePassFilter] = useState([]);
  const [page, setPage] = useState(0);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { rlicStatusOptions, trainingStatusOptions } = useLookupOptions();
  const currentUser = useCurrentUser();

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

  const hasActiveFilters = search || companyFilter.length > 0 || positionFilter.length > 0 ||
    departmentFilter !== 'all' || locationFilter !== 'all' || dirFilter !== 'all' ||
    medicalResultFilter !== 'all' || pidIssueFrom || pidIssueTo ||
    trainingFilter !== 'all' || gatePassFilter.length > 0;

  const inactive = useMemo(() =>
    employees.filter(e => {
      const matchesSearch = !search ||
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.qid_no?.includes(search) ||
        e.company?.toLowerCase().includes(search.toLowerCase()) ||
        e.nationality?.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter.length === 0 || companyFilter.includes(e.company);
      const matchesPosition = positionFilter.length === 0 || positionFilter.includes(e.designation_org_chart);
      const matchesDepartment = departmentFilter === 'all' || e.department === departmentFilter;
      const matchesLocation = locationFilter === 'all' || e.current_location === locationFilter;
      const matchesDir = dirFilter === 'all' || e.dir_indir === dirFilter;
      const matchesMedical = medicalResultFilter === 'all' || e.ftw_result === medicalResultFilter;
      const issueDate = normalizeDate(e.pid_issue_date);
      const matchesIssueFrom = !pidIssueFrom || (issueDate && issueDate >= pidIssueFrom);
      const matchesIssueTo = !pidIssueTo || (issueDate && issueDate <= pidIssueTo);
      const matchesTraining = trainingFilter === 'all' || e.training_status === trainingFilter;
      const effectiveRlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
      const matchesGatePass = gatePassFilter.length === 0 || gatePassFilter.includes(effectiveRlic);
      return matchesSearch && matchesCompany && matchesPosition && matchesDepartment && matchesLocation && matchesDir && matchesMedical && matchesIssueFrom && matchesIssueTo && matchesTraining && matchesGatePass;
    }),
    [employees, search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter, pidIssueFrom, pidIssueTo, trainingFilter, gatePassFilter]
  );

  const totalPages = Math.ceil(inactive.length / PAGE_SIZE);
  const pagedRows = useMemo(() => inactive.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [inactive, page]);

  const reactivateMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.update(id, { is_active: true }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['employees-inactive'] });
      const prev = queryClient.getQueryData(['employees-inactive']);
      queryClient.setQueryData(['employees-inactive'], old => (old || []).filter(e => e.id !== id));
      return { prev };
    },
    onError: (_err, _id, ctx) => {
      queryClient.setQueryData(['employees-inactive'], ctx.prev);
      toast({ title: 'Failed to reactivate', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Personnel reactivated' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (emp) => {
      // Save to DeletedEmployee archive first
      await base44.entities.DeletedEmployee.create({
        original_id: emp.id,
        deleted_by: currentUser?.email || 'unknown',
        deleted_at: new Date().toISOString(),
        employee_data: emp,
        employee_name: emp.name,
        company: emp.company,
        department: emp.department,
        recovered: false,
      });
      // Log the deletion
      await base44.entities.ActivityLog.create({
        action: 'delete',
        entity_name: 'Employee',
        entity_id: emp.id,
        performed_by: currentUser?.email || 'unknown',
        record_snapshot: emp,
        record_name: emp.name,
      });
      // Permanently delete the employee record
      await base44.entities.Employee.delete(emp.id);
    },
    onMutate: async (emp) => {
      await queryClient.cancelQueries({ queryKey: ['employees-inactive'] });
      const prev = queryClient.getQueryData(['employees-inactive']);
      queryClient.setQueryData(['employees-inactive'], old => (old || []).filter(e => e.id !== emp.id));
      return { prev };
    },
    onError: (_err, _emp, ctx) => {
      queryClient.setQueryData(['employees-inactive'], ctx.prev);
      toast({ title: 'Delete failed', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['deleted-employees'] });
      toast({ title: 'Personnel permanently deleted', description: 'Record moved to Deleted Personnel.' });
    },
  });

  const clearFilters = () => {
    setSearch(''); setCompanyFilter([]); setPositionFilter([]);
    setDepartmentFilter('all'); setLocationFilter('all'); setDirFilter('all');
    setMedicalResultFilter('all'); setPidIssueFrom(''); setPidIssueTo('');
    setTrainingFilter('all'); setGatePassFilter([]);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <UserX className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Inactive Personnel</h2>
            <p className="text-sm text-muted-foreground">{inactive.length} of {employees.length} inactive records</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4 space-y-3">
        {/* Row 1: search + company + position + dept + location + dir */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Name, QID, Company, Nationality..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <MultiSelect options={uniqueCompanies} value={companyFilter} onChange={setCompanyFilter} placeholder="All Companies" />
          <MultiSelect options={positions} value={positionFilter} onChange={setPositionFilter} placeholder="Filter by position" />
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {['Electrical','Mechanical','Civil','Services','Steel Structure'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              {LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={dirFilter} onValueChange={setDirFilter}>
            <SelectTrigger><SelectValue placeholder="DIR / INDIR" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="DIR">DIR</SelectItem>
              <SelectItem value="INDIR">INDIR</SelectItem>
            </SelectContent>
          </Select>
          <Select value={medicalResultFilter} onValueChange={setMedicalResultFilter}>
            <SelectTrigger><SelectValue placeholder="Medical Result" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Medical Results</SelectItem>
              {MEDICAL_RESULTS.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Row 2: PID Issue Date range + Training Status + Gate Pass Status */}
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
        </div>

        {hasActiveFilters && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={clearFilters}>
              <X className="w-3.5 h-3.5 mr-1" /> Clear Filters
            </Button>
          </div>
        )}
      </Card>

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
                  <TableHead className="text-xs bg-muted/50">Projected Date</TableHead>
                  <TableHead className="text-xs bg-muted/50">Days Left</TableHead>
                  <TableHead className="text-xs bg-muted/50">Medical</TableHead>
                  <TableHead className="text-xs bg-muted/50">Gate Pass</TableHead>
                  <TableHead className="text-xs bg-muted/50">Training</TableHead>
                  <TableHead className="text-xs bg-muted/50">Status</TableHead>
                  <TableHead className="text-xs bg-muted/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>{Array(15).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : inactive.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={15} className="text-center py-14">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UserCheck className="w-8 h-8 text-green-500" />
                        <p className="font-medium">No inactive personnel</p>
                        <p className="text-xs">All personnel are currently active.</p>
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
                        <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.pid_projected_date) || '—'}</TableCell>
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
                        <TableCell>
                          <StatusBadge dateStr={emp.pid_expiry} type="pid" storedStatus={emp.pid_status} short />
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Link to={`/employees/${emp.id}`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                            </Link>
                            <Link to={`/employees/${emp.id}/edit`}>
                              <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                            </Link>
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
                                    Reactivate <strong>{emp.name}</strong>? They will appear in all active lists and their Gate Pass and Project ID data will be restored.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => reactivateMutation.mutate(emp.id)} className="bg-green-600 hover:bg-green-700">
                                    Reactivate
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
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
                                    This will <strong>permanently delete</strong> <strong>{emp.name}</strong> from the system. The record will be moved to the Deleted Personnel archive. This action cannot be undone without manual recovery.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(emp)} className="bg-red-600 hover:bg-red-700">
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
            Showing <strong>{inactive.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, inactive.length)}</strong> of <strong>{inactive.length}</strong> filtered · <strong>{employees.length}</strong> total inactive
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
    </div>
  );
}