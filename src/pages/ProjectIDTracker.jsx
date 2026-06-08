import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, BadgeCheck, Eye, Pencil, PencilLine, X as XIcon } from 'lucide-react';
import PersonnelAvatar from '../components/common/PersonnelAvatar';
import SharepointDocIcon from '../components/common/SharepointDocIcon';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import StatusBadge from '../components/common/StatusBadge';
import { COMPANIES, PID_STATUSES, RLIC_STATUSES, formatDate, daysUntil, computePassStatus, normalizeDate } from '@/utils/constants';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import MultiSelect from '../components/common/MultiSelect';
import ExportButton from '../components/common/ExportButton';
import InlineEditCell from '../components/common/InlineEditCell';
import BulkEditBar from '../components/common/BulkEditBar';
import TrackerFilters from '../components/common/TrackerFilters';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#94a3b8'];

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

export default function ProjectIDTracker() {
  const currentUser = useCurrentUser();
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
  const [statusFilter, setStatusFilter] = useState([]);
  const [trainingFilter, setTrainingFilter] = useState('all');
  const [gatePassFilter, setGatePassFilter] = useState([]);
  const [editMode, setEditMode] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();


  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 10000),
  });

  const { pidStatusOptions: allStatusOptions, rlicStatusOptions, trainingStatusOptions, departmentOptions, medicalResultOptions, companyOptions } = useLookupOptions();

  const getEffectivePid = (e) => computePassStatus(e.pid_expiry, 'pid', e.pid_status);

  const positions = useMemo(() => [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort().map(p => ({ value: p, label: p })), [employees]);

  // Filter positions by selected departments and/or companies
  const filteredPositions = useMemo(() => {
    if (departmentFilter.length === 0 && companyFilter.length === 0) return positions;
    const deptSet = departmentFilter.length > 0 ? new Set(departmentFilter.map(d => d.trim().toLowerCase())) : null;
    const coSet = companyFilter.length > 0 ? new Set(companyFilter.map(c => c.trim().toUpperCase())) : null;
    const seen = new Set();
    return employees
      .filter(e => e.designation_org_chart &&
        (!deptSet || deptSet.has((e.department || '').trim().toLowerCase())) &&
        (!coSet || coSet.has((e.company || '').trim().toUpperCase())))
      .map(e => e.designation_org_chart.trim())
      .filter(p => { if (seen.has(p)) return false; seen.add(p); return true; })
      .sort()
      .map(p => ({ value: p, label: p }));
  }, [employees, departmentFilter, companyFilter]);

  // Reset position filter when department or company changes
  useEffect(() => { setPositionFilter([]); }, [departmentFilter, companyFilter]);

  const filtered = useMemo(() => employees.filter(e => {
    const matchesSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.pid?.includes(search) || e.qid_no?.includes(search);
    const empCompany = (e.company || '').trim().toUpperCase();
    const matchesCompany = companyFilter.length === 0 || companyFilter.some(cf => cf.trim().toUpperCase() === empCompany);
    const matchesPosition = positionFilter.length === 0 || positionFilter.includes(e.designation_org_chart);
    const effectivePid = getEffectivePid(e);
    // panel pid filter + list-tab status filter merged
    const mergedPid = [...new Set([...pidStatusFilter, ...statusFilter])];
    const matchesStatus = mergedPid.length === 0 || mergedPid.includes(effectivePid);
    const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(e.department);
    const issueDate = normalizeDate(e.pid_issue_date);
    const matchesIssueFrom = !pidIssueFrom || (issueDate && issueDate >= pidIssueFrom);
    const matchesIssueTo = !pidIssueTo || (issueDate && issueDate <= pidIssueTo);
    // panel training filter + list-tab training filter merged
    const matchesTraining = (trainingStatusFilter.length > 0 ? trainingStatusFilter.includes(e.training_status) : (trainingFilter === 'all' || e.training_status === trainingFilter));
    const effectiveRlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    // panel rlic filter + list-tab gate pass filter merged
    const mergedRlic = [...new Set([...rlicStatusFilter, ...gatePassFilter])];
    const matchesGatePass = mergedRlic.length === 0 || mergedRlic.includes(effectiveRlic);
    const matchesMedical = medicalResultFilter.length === 0 || medicalResultFilter.includes(e.ftw_result);
    const trainSchedDate = (e.training_date_scheduled || '').substring(0, 10);
    const matchesTrainSchedFrom = !trainingScheduledFrom || trainSchedDate >= trainingScheduledFrom;
    const matchesTrainSchedTo = !trainingScheduledTo || trainSchedDate <= trainingScheduledTo;
    const trDate = normalizeDate(e.ftw_approved_date) || '';
    const matchesTrFrom = !trApprovedFrom || trDate >= trApprovedFrom;
    const matchesTrTo = !trApprovedTo || trDate <= trApprovedTo;
    const gpIssueDateVal = normalizeDate(e.gate_pass_issue_date) || '';
    const matchesGpIssueFrom = !gpIssueFrom || gpIssueDateVal >= gpIssueFrom;
    const matchesGpIssueTo = !gpIssueTo || gpIssueDateVal <= gpIssueTo;
    const gpReceivedVal = normalizeDate(e.gate_pass_received_date) || '';
    const matchesGpReceivedFrom = !gpReceivedFrom || gpReceivedVal >= gpReceivedFrom;
    const matchesGpReceivedTo = !gpReceivedTo || gpReceivedVal <= gpReceivedTo;
    return matchesSearch && matchesCompany && matchesPosition && matchesStatus && matchesDepartment && matchesIssueFrom && matchesIssueTo && matchesTraining && matchesGatePass && matchesMedical && matchesTrainSchedFrom && matchesTrainSchedTo && matchesTrFrom && matchesTrTo && matchesGpIssueFrom && matchesGpIssueTo && matchesGpReceivedFrom && matchesGpReceivedTo;
  }), [employees, search, companyFilter, positionFilter, statusFilter, pidStatusFilter, departmentFilter, pidIssueFrom, pidIssueTo, trainingFilter, trainingStatusFilter, gatePassFilter, rlicStatusFilter, medicalResultFilter, trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo]);

  useEffect(() => { setPage(0); }, [companyFilter, positionFilter, departmentFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter, statusFilter, trainingFilter, gatePassFilter, search, pidIssueFrom, pidIssueTo, trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRows = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  const stats = useMemo(() => {
    return allStatusOptions.map(s => ({
      name: s.label,
      count: filtered.filter(e => getEffectivePid(e) === s.value).length,
    }));
  }, [filtered, allStatusOptions]);

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
      valid: filtered.filter(e => e.company === c.value && getEffectivePid(e) === 'VALID PID PASS').length,
      expired: filtered.filter(e => e.company === c.value && getEffectivePid(e) === 'EXPIRED PID PASS').length,
      soon: filtered.filter(e => e.company === c.value && getEffectivePid(e) === 'SOON TO EXPIRE').length,
    })).filter(c => c.valid + c.expired + c.soon > 0);
  }, [filtered]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, { ...data, _last_updated_by: currentUser?.email || '' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees-active'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const handleCellSave = (id, field, value) => updateMutation.mutate({ id, data: { [field]: value } });

  const handleFillDown = async (field, value) => {
    await Promise.all(filtered.map(e => base44.entities.Employee.update(e.id, { [field]: value })));
    queryClient.invalidateQueries({ queryKey: ['employees-active'] });
    toast({ title: `Filled "${field}" for ${filtered.length} rows` });
  };

  const hasActiveFilters = search || companyFilter.length > 0 || positionFilter.length > 0 || statusFilter.length > 0 || pidStatusFilter.length > 0 || departmentFilter.length > 0 || rlicStatusFilter.length > 0 || trainingStatusFilter.length > 0 || medicalResultFilter.length > 0 || !!pidIssueFrom || !!pidIssueTo || trainingFilter !== 'all' || gatePassFilter.length > 0 || !!trainingScheduledFrom || !!trainingScheduledTo || !!trApprovedFrom || !!trApprovedTo || !!gpIssueFrom || !!gpIssueTo || !!gpReceivedFrom || !!gpReceivedTo;

  const pidBulkFields = [
    { key: 'pid_status', label: 'PID Status', type: 'select', options: allStatusOptions },
    { key: 'pid_expiry', label: 'PID Expiry', type: 'date' },
    { key: 'pid_issue_date', label: 'PID Issue Date', type: 'date' },
    { key: 'pid_projected_date', label: 'Projected Date', type: 'date' },
  ];

  const handleBulkApply = async (field, value) => {
    await Promise.all(filtered.map(e => base44.entities.Employee.update(e.id, { [field]: value })));
    queryClient.invalidateQueries({ queryKey: ['employees-active'] });
    toast({ title: `Updated ${filtered.length} records` });
  };

  const getExportData = () => filtered.map(e => ({
    Name: e.name, Company: e.company, QID_No: e.qid_no, PID: e.pid,
    PID_Issue_Date: formatDate(e.pid_issue_date), PID_Expiry: formatDate(e.pid_expiry), PID_Status: e.pid_status,
    Projected_Date: formatDate(e.pid_projected_date),
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center">
            <BadgeCheck className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Project ID</h2>
            <p className="text-sm text-muted-foreground">PID tracking & status</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(v => !v)}>
            {editMode ? <><XIcon className="w-4 h-4 mr-2" /> Exit Edit Mode</> : <><PencilLine className="w-4 h-4 mr-2" /> Edit in Grid</>}
          </Button>
          <ExportButton getData={getExportData} filename="project_id_data.csv" />
        </div>
      </div>

      <TrackerFilters
        filters={{ companyFilter, positionFilter, departmentFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter, trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpIssueFrom, gpIssueTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo }}
        setters={{ setCompanyFilter, setPositionFilter, setDepartmentFilter, setRlicStatusFilter, setTrainingStatusFilter, setPidStatusFilter, setMedicalResultFilter, setTrainingScheduledFrom, setTrainingScheduledTo, setTrApprovedFrom, setTrApprovedTo, setGpIssueFrom, setGpIssueTo, setGpReceivedFrom, setGpReceivedTo, setPidIssueFrom, setPidIssueTo }}
        options={{ companies: companyOptions, positions: filteredPositions, departments: departmentOptions, rlicStatuses: rlicStatusOptions, trainingStatuses: trainingStatusOptions, pidStatuses: allStatusOptions, medicalResults: medicalResultOptions }}
        totalFiltered={filtered.length}
        totalAll={employees.length}
      />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {/* Combined Valid + Soon banner */}
          {(() => {
            const validCount = stats.find(s => s.name === 'Valid')?.count ?? 0;
            const soonCount = stats.find(s => s.name === 'Soon')?.count ?? 0;
            return (
              <Card className="border-purple-200 bg-purple-50/60">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-purple-700">Total Valid Project IDs</p>
                    <p className="text-xs text-purple-600 mt-0.5">{validCount} Valid &nbsp;+&nbsp; {soonCount} Soon to Expire</p>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="text-center">
                      <span className="text-5xl font-extrabold text-purple-600">{validCount + soonCount}</span>
                      <p className="text-[10px] text-purple-600 mt-0.5">Total Valid</p>
                    </div>
                    <div className="text-center border-l border-purple-300 pl-3">
                      <span className="text-3xl font-bold text-purple-400">{filtered.length}</span>
                      <p className="text-[10px] text-purple-500 mt-0.5">Overall Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
              <CardHeader><CardTitle className="text-sm">PID Status Distribution</CardTitle></CardHeader>
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
                    <Bar dataKey="valid" fill="#10b981" stackId="a" name="Valid" />
                    <Bar dataKey="soon" fill="#f59e0b" stackId="a" name="Soon" />
                    <Bar dataKey="expired" fill="#ef4444" stackId="a" name="Expired" />
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
                  <Bar dataKey="count" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-sm">Expiring Within 90 Days</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {filtered
                  .filter(e => { const d = daysUntil(e.pid_expiry); return d !== null && d <= 90; })
                  .sort((a, b) => daysUntil(a.pid_expiry) - daysUntil(b.pid_expiry))
                  .slice(0, 10)
                  .map(emp => {
                    const days = daysUntil(emp.pid_expiry);
                    return (
                      <div key={emp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.company} — {emp.pid} — {formatDate(emp.pid_expiry)}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${days <= 0 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {days <= 0 ? 'EXPIRED' : `${days}d`}
                        </span>
                      </div>
                    );
                  })}
                {filtered.filter(e => { const d = daysUntil(e.pid_expiry); return d !== null && d <= 90; }).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No PIDs expiring within 90 days</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Name, PID, QID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <MultiSelect
                options={allStatusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All Statuses"
                className="dropdown-status"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-3 items-end">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">PID Issue Date — From</p>
                <Input type="date" value={pidIssueFrom} onChange={e => setPidIssueFrom(e.target.value)} className="text-xs" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">PID Issue Date — To</p>
                <Input type="date" value={pidIssueTo} onChange={e => setPidIssueTo(e.target.value)} className="text-xs" />
              </div>
              {(pidIssueFrom || pidIssueTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setPidIssueFrom(''); setPidIssueTo(''); }} className="text-xs">Clear Dates</Button>
              )}
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Training Status</p>
                <Select value={trainingFilter} onValueChange={setTrainingFilter}>
                  <SelectTrigger className="text-xs dropdown-training"><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {trainingStatusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">Gate Pass Status</p>
                <MultiSelect options={rlicStatusOptions} value={gatePassFilter} onChange={setGatePassFilter} placeholder="All Gate Pass" className="dropdown-status" />
              </div>
            </div>
          </Card>
          {editMode && hasActiveFilters && filtered.length > 0 && (
            <BulkEditBar fields={pidBulkFields} filteredCount={filtered.length} onApply={handleBulkApply} isLoading={updateMutation.isPending} />
          )}
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
                    <TableHead className="text-xs bg-muted/50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(6).fill(0).map((_, i) => <TableRow key={i}>{Array(15).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={15} className="text-center py-10 text-muted-foreground">No records found</TableCell></TableRow>
                  ) : pagedRows.map(emp => {
                    const days = daysUntil(emp.pid_expiry);
                    return (
                      <TableRow key={emp.id} className="hover:bg-muted/30">
                       <TableCell className="p-2"><PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size={8} /></TableCell>
                       <TableCell className="p-1"><SharepointDocIcon emp={emp} canEdit={true} onSave={(id, url) => handleCellSave(id, 'sharepoint_url', url)} /></TableCell>
                       <TableCell className="text-xs font-medium"><InlineEditCell value={emp.name} field="name" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                       <TableCell className="text-xs">{emp.company}</TableCell>
                       <TableCell className="text-xs font-mono"><InlineEditCell value={emp.qid_no} field="qid_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                       <TableCell className="text-xs font-mono"><InlineEditCell value={emp.pid} field="pid" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                       <TableCell className="text-xs"><InlineEditCell value={emp.pid_issue_date} field="pid_issue_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                       <TableCell className="text-xs"><InlineEditCell value={emp.pid_expiry} field="pid_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                       <TableCell className="text-xs"><InlineEditCell value={emp.pid_projected_date} field="pid_projected_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
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
                          {editMode ? (
                            <InlineEditCell value={emp.pid_status} field="pid_status" empId={emp.id} type="select" options={allStatusOptions} onSave={handleCellSave} editMode={editMode} />
                          ) : (
                            <StatusBadge dateStr={emp.pid_expiry} type="pid" storedStatus={emp.pid_status} short />
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Link to={`/employees/${emp.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button></Link>
                            <Link to={`/employees/${emp.id}/edit`}><Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button></Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
      </Tabs>
    </div>
  );
}