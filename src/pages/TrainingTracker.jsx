import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, GraduationCap, Eye, Pencil } from 'lucide-react';
import TrainingRequestForm from './TrainingRequestForm';
import TrainingRequestLogs from './TrainingRequestLogs';
import OngoingTraining from './OngoingTraining';
import PersonnelAvatar from '../components/common/PersonnelAvatar';
import SharepointDocIcon from '../components/common/SharepointDocIcon';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { COMPANIES, TRAINING_STATUSES, formatDate, computePassStatus, normalizeDate } from '@/utils/constants';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import MultiSelect from '../components/common/MultiSelect';
import ExportButton from '../components/common/ExportButton';
import TrackerFilters from '../components/common/TrackerFilters';
import { useToast } from '@/components/ui/use-toast';
import { useManagerFilter } from '@/hooks/useManagerFilter';
import WorkforceSubmenuNav from '@/components/common/WorkforceSubmenuNav';

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#eab308', '#ef4444', '#6b7280', '#94a3b8'];

export default function TrainingTracker() {
  const { selectedManagerIds, setSelectedManagerIds, managers } = useManagerFilter();
  const { trainingStatusOptions, departmentOptions, rlicStatusOptions, pidStatusOptions, medicalResultOptions, companyOptions } = useLookupOptions();
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState([]);
  const [rlicStatusFilter, setRlicStatusFilter] = useState([]);
  const [trainingStatusFilter, setTrainingStatusFilter] = useState([]);
  const [pidStatusFilter, setPidStatusFilter] = useState([]);
  const [medicalResultFilter, setMedicalResultFilter] = useState([]);
  const [trainingScheduledFrom, setTrainingScheduledFrom] = useState('');
  const [trainingScheduledTo, setTrainingScheduledTo] = useState('');
  const [trApprovedFrom, setTrApprovedFrom] = useState('');
  const [trApprovedTo, setTrApprovedTo] = useState('');
  const [gpIssueFrom, setGpIssueFrom] = useState('');
  const [gpIssueTo, setGpIssueTo] = useState('');
  const [gpReceivedFrom, setGpReceivedFrom] = useState('');
  const [gpReceivedTo, setGpReceivedTo] = useState('');
  const [pidIssueFrom, setPidIssueFrom] = useState('');
  const [pidIssueTo, setPidIssueTo] = useState('');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;
  // list-tab local filters
  const [statusFilter, setStatusFilter] = useState('all');
  const [scheduledDateFrom, setScheduledDateFrom] = useState('');
  const [scheduledDateTo, setScheduledDateTo] = useState('');
  const [startDateFrom, setStartDateFrom] = useState('');
  const [startDateTo, setStartDateTo] = useState('');


  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 100000),
  });

  const positions = useMemo(() => [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort().map(p => ({ value: p, label: p })), [employees]);

  // Cascade positions by company, department, gate pass status, and PID status
  const filteredPositions = useMemo(() => {
    const hasFilter = companyFilter.length > 0 || departmentFilter.length > 0 || rlicStatusFilter.length > 0 || pidStatusFilter.length > 0;
    if (!hasFilter) return positions;
    const coSet = companyFilter.length > 0 ? new Set(companyFilter.map(c => c.trim().toUpperCase())) : null;
    const deptSet = departmentFilter.length > 0 ? new Set(departmentFilter.map(d => d.trim().toLowerCase())) : null;
    const seen = new Set();
    return employees
      .filter(e => {
        if (!e.designation_org_chart) return false;
        if (coSet && !coSet.has((e.company || '').trim().toUpperCase())) return false;
        if (deptSet && !deptSet.has((e.department || '').trim().toLowerCase())) return false;
        if (rlicStatusFilter.length > 0 && !rlicStatusFilter.includes(computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status))) return false;
        if (pidStatusFilter.length > 0 && !pidStatusFilter.includes(computePassStatus(e.pid_expiry, 'pid', e.pid_status))) return false;
        return true;
      })
      .map(e => e.designation_org_chart.trim())
      .filter(p => { if (seen.has(p)) return false; seen.add(p); return true; })
      .sort()
      .map(p => ({ value: p, label: p }));
  }, [employees, companyFilter, departmentFilter, rlicStatusFilter, pidStatusFilter]);

  // Reset position when any parent filter changes; keep only valid selections
  useEffect(() => {
    if (positionFilter.length === 0) return;
    const valid = new Set(filteredPositions.map(p => p.value));
    const still = positionFilter.filter(p => valid.has(p));
    if (still.length !== positionFilter.length) setPositionFilter(still);
  }, [filteredPositions]);

  const filtered = useMemo(() => employees.filter(e => {
    const matchesSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.qid_no?.includes(search);
    const empCompany = (e.company || '').trim().toUpperCase();
    const matchesCompany = companyFilter.length === 0 || companyFilter.some(cf => cf.trim().toUpperCase() === empCompany);
    const matchesPosition = positionFilter.length === 0 || positionFilter.includes(e.designation_org_chart);
    // panel training filter merged with list-tab single select
    const matchesStatus = (trainingStatusFilter.length > 0 ? trainingStatusFilter.includes(e.training_status) : (statusFilter === 'all' || e.training_status === statusFilter));
    const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(e.department);
    const empScheduled = e.training_date_scheduled ? e.training_date_scheduled.substring(0, 10) : '';
    // panel scheduled range merged with list-tab scheduled range
    const schedFrom = trainingScheduledFrom || scheduledDateFrom;
    const schedTo = trainingScheduledTo || scheduledDateTo;
    const matchesScheduledFrom = !schedFrom || (empScheduled && empScheduled >= schedFrom);
    const matchesScheduledTo = !schedTo || (empScheduled && empScheduled <= schedTo);
    const empStart = e.training_date_start ? e.training_date_start.substring(0, 10) : '';
    const matchesStartFrom = !startDateFrom || (empStart && empStart >= startDateFrom);
    const matchesStartTo = !startDateTo || (empStart && empStart <= startDateTo);
    const effectiveRlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    const matchesRlic = rlicStatusFilter.length === 0 || rlicStatusFilter.includes(effectiveRlic);
    const effectivePid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    const matchesPid = pidStatusFilter.length === 0 || pidStatusFilter.includes(effectivePid);
    const matchesMedical = medicalResultFilter.length === 0 || medicalResultFilter.includes(e.ftw_result);
    const trDate = normalizeDate(e.ftw_approved_date) || '';
    const matchesTrFrom = !trApprovedFrom || trDate >= trApprovedFrom;
    const matchesTrTo = !trApprovedTo || trDate <= trApprovedTo;
    const gpIssueDateVal = normalizeDate(e.gate_pass_issue_date) || '';
    const matchesGpIssueFrom = !gpIssueFrom || gpIssueDateVal >= gpIssueFrom;
    const matchesGpIssueTo = !gpIssueTo || gpIssueDateVal <= gpIssueTo;
    const gpReceivedVal = normalizeDate(e.gate_pass_received_date) || '';
    const matchesGpReceivedFrom = !gpReceivedFrom || gpReceivedVal >= gpReceivedFrom;
    const matchesGpReceivedTo = !gpReceivedTo || gpReceivedVal <= gpReceivedTo;
    const pidDate = normalizeDate(e.pid_issue_date) || '';
    const matchesPidFrom = !pidIssueFrom || pidDate >= pidIssueFrom;
    const matchesPidTo = !pidIssueTo || pidDate <= pidIssueTo;
    const matchesManager = selectedManagerIds.length === 0 || selectedManagerIds.some(mid =>
      e.assigned_manager_id ? e.assigned_manager_id === mid : e.assigned_manager_name === managers.find(m => m.id === mid)?.label
    );
    return matchesSearch && matchesCompany && matchesPosition && matchesStatus && matchesDepartment && matchesScheduledFrom && matchesScheduledTo && matchesStartFrom && matchesStartTo && matchesRlic && matchesPid && matchesMedical && matchesTrFrom && matchesTrTo && matchesGpIssueFrom && matchesGpIssueTo && matchesGpReceivedFrom && matchesGpReceivedTo && matchesPidFrom && matchesPidTo && matchesManager;
  }),     [employees, search, companyFilter, positionFilter, statusFilter, trainingStatusFilter, departmentFilter, scheduledDateFrom, scheduledDateTo, startDateFrom, startDateTo, rlicStatusFilter, pidStatusFilter, medicalResultFilter, trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo, selectedManagerIds, managers]);

  const isInitialMount = useRef(true);
  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    setPage(0);
  }, [companyFilter, positionFilter, departmentFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter, statusFilter, search, scheduledDateFrom, scheduledDateTo, startDateFrom, startDateTo, trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRows = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  const stats = useMemo(() => trainingStatusOptions.map((s) => ({
    name: s.label,
    count: filtered.filter(e => e.training_status === s.value).length,
  })), [filtered, trainingStatusOptions]);

  const companyHeadcount = useMemo(() => {
    const allCompanies = new Set(filtered.map(e => e.company).filter(Boolean));
    const staticValues = new Set(COMPANIES.map(c => c.value));
    const extra = [...allCompanies].filter(v => !staticValues.has(v)).map(v => ({ value: v, label: v }));
    return [...COMPANIES, ...extra]
      .map(c => ({ name: c.label, count: filtered.filter(e => e.company === c.value).length }))
      .filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const companyStats = useMemo(() => {
    return COMPANIES.filter(c => filtered.some(e => e.company === c.value)).map(c => ({
      name: c.label.substring(0, 12),
      done: filtered.filter(e => e.company === c.value && e.training_status === 'DONE').length,
      pending: filtered.filter(e => e.company === c.value && e.training_status === 'PENDING').length,
    })).filter(c => c.done + c.pending > 0);
  }, [filtered]);

  const getExportData = () => filtered.map(e => ({
    Name: e.name, Company: e.company, Nationality: e.nationality, QID_No: e.qid_no,
    Training_Date_Scheduled: formatDate(e.training_date_scheduled), Training_Date_Started: formatDate(e.training_date_start), Training_Date_End: formatDate(e.training_date_end), Training_Status: e.training_status,
  }));

  const statusColors = {
    'DONE':             'bg-emerald-100 text-emerald-800',
    'ON-GOING':         'bg-emerald-50 text-emerald-700',
    'SCHEDULED':        'bg-blue-50 text-blue-700',
    'TO BE SCHEDULED':  'bg-amber-50 text-amber-700',
    'PENDING':          'bg-yellow-50 text-yellow-700',
    'ABSENT':           'bg-red-50 text-red-700',
    'NOT REQUIRED':     'bg-gray-100 text-gray-500',
  };

  return (
    <div className="space-y-5">
      <WorkforceSubmenuNav />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Training</h2>
            <p className="text-sm text-muted-foreground">Training status & tracking</p>
          </div>
        </div>
        <ExportButton getData={getExportData} filename="training_data.csv" />
      </div>

      <TrackerFilters
        filters={{ companyFilter, positionFilter, departmentFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter, trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo }}
        setters={{ setCompanyFilter, setPositionFilter, setDepartmentFilter, setRlicStatusFilter, setTrainingStatusFilter, setPidStatusFilter, setMedicalResultFilter, setTrainingScheduledFrom, setTrainingScheduledTo, setTrApprovedFrom, setTrApprovedTo, setGpIssueFrom, setGpIssueTo, setGpReceivedFrom, setGpReceivedTo, setPidIssueFrom, setPidIssueTo }}
        options={{ companies: companyOptions, positions: filteredPositions, departments: departmentOptions, rlicStatuses: rlicStatusOptions, trainingStatuses: trainingStatusOptions, pidStatuses: pidStatusOptions, medicalResults: medicalResultOptions }}
        totalFiltered={filtered.length}
        totalAll={employees.length}
        employees={employees}
        managers={managers}
        selectedManagerIds={selectedManagerIds}
        onManagerIdsChange={setSelectedManagerIds}
      />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="request">Training Request</TabsTrigger>
          <TabsTrigger value="logs">Request Logs</TabsTrigger>
          <TabsTrigger value="ongoing">Ongoing Training</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {stats.map((s, i) => (
              <Card key={s.name}>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold" style={{ color: COLORS[i] }}>{s.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.name}</div>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Training Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stats.filter(s => s.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, count }) => `${name}: ${count}`} labelLine={false}>
                      {stats.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">By Company</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={companyStats} margin={{ left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="done" fill="#10b981" name="Done" />
                    <Bar dataKey="pending" fill="#f59e0b" name="Pending" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardHeader><CardTitle className="text-sm">Personnel by Company</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={Math.max(220, companyHeadcount.length * 26)}>
                <BarChart data={companyHeadcount} layout="vertical" margin={{ top: 4, right: 30, left: 4, bottom: 4 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f97316" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search name or QID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44 dropdown-training"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {trainingStatusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="table-scroll-x">
              <div className="table-scroll-y h-[560px]">
              <Table className="table-list-view">
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs bg-muted/50 w-10">Photo</TableHead>
                    <TableHead className="text-xs bg-muted/50 w-8">Docs</TableHead>
                    <TableHead className="text-xs bg-muted/50">Name</TableHead>
                    <TableHead className="text-xs bg-muted/50">Company</TableHead>
                    <TableHead className="text-xs bg-muted/50">Nationality</TableHead>
                    <TableHead className="text-xs bg-muted/50">QID No</TableHead>
                    <TableHead className="text-xs bg-muted/50">Position</TableHead>
                    <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Date Scheduled</TableHead>
                    <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Date Started</TableHead>
                    <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Training Date End</TableHead>
                    <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Status</TableHead>
                    <TableHead className="text-xs bg-muted/50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(6).fill(0).map((_, i) => <TableRow key={i}>{Array(11).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center py-10 text-muted-foreground">No records found</TableCell></TableRow>
                  ) : pagedRows.map(emp => (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="p-2"><PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size={8} /></TableCell>
                      <TableCell className="p-1"><SharepointDocIcon emp={emp} canEdit={true} onSave={(id, url) => base44.entities.Employee.update(id, { sharepoint_url: url })} /></TableCell>
                      <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                      <TableCell className="text-xs">{emp.company}</TableCell>
                      <TableCell className="text-xs">{emp.nationality}</TableCell>
                      <TableCell className="text-xs font-mono">{emp.qid_no}</TableCell>
                      <TableCell className="text-xs">{emp.designation_org_chart}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.training_date_scheduled)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.training_date_start)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.training_date_end)}</TableCell>
                      <TableCell>
                        {emp.training_status ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[emp.training_status] || 'bg-muted text-muted-foreground'}`}>{emp.training_status}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Link to={`/employees/${emp.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button></Link>
                          <Link to={`/employees/${emp.id}/edit`}><Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button></Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            </div>
            <div className="px-4 py-2 border-t bg-muted/30 flex items-center justify-between gap-3 flex-wrap">
              <span className="text-xs text-muted-foreground">
                Showing <strong>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> filtered · <strong>{employees.length}</strong> total active
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
        </TabsContent>

        <TabsContent value="request" className="mt-4">
          <TrainingRequestForm />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <TrainingRequestLogs />
        </TabsContent>

        <TabsContent value="ongoing" className="mt-4">
          <OngoingTraining />
        </TabsContent>
      </Tabs>
    </div>
  );
}