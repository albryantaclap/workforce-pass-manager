import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Stethoscope, Upload, Eye, Pencil, PencilLine, X as XIcon } from 'lucide-react';
import PersonnelAvatar from '../components/common/PersonnelAvatar';
import SharepointDocIcon from '../components/common/SharepointDocIcon';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { COMPANIES, MEDICAL_RESULTS, formatDate, normalizeDate, computePassStatus } from '@/utils/constants';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import MultiSelect from '../components/common/MultiSelect';
import ExportButton from '../components/common/ExportButton';
import InlineEditCell from '../components/common/InlineEditCell';
import BulkEditBar from '../components/common/BulkEditBar';
import TrackerFilters from '../components/common/TrackerFilters';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function MedicalTracker() {
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
  const [gpReceivedFrom, setGpReceivedFrom] = useState('');
  const [gpReceivedTo, setGpReceivedTo] = useState('');
  const [pidIssueFrom, setPidIssueFrom] = useState('');
  const [pidIssueTo, setPidIssueTo] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [editMode, setEditMode] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, '-created_date', 10000),
    staleTime: 30000,
    placeholderData: (prev) => prev,
  });

  const { medicalResultOptions: allMedicalResults, departmentOptions, rlicStatusOptions, pidStatusOptions, trainingStatusOptions, companyOptions } = useLookupOptions();

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

  const hasActiveFilters = companyFilter.length > 0 || positionFilter.length > 0 || departmentFilter.length > 0 || rlicStatusFilter.length > 0 || trainingStatusFilter.length > 0 || pidStatusFilter.length > 0 || medicalResultFilter.length > 0 || resultFilter !== 'all' || !!search || !!trApprovedFrom || !!trApprovedTo || !!trainingScheduledFrom || !!trainingScheduledTo || !!gpReceivedFrom || !!gpReceivedTo || !!pidIssueFrom || !!pidIssueTo;

  const medicalBulkFields = [
    { key: 'ftw_result', label: 'Medical Result', type: 'select', options: allMedicalResults },
    { key: 'ftw_medical_date', label: 'Medical Date', type: 'date' },
    { key: 'ftw_approved_date', label: 'TR Date Approved', type: 'date' },
  ];

  const handleBulkApply = async (field, value) => {
    await Promise.all(filtered.map(e => base44.entities.Employee.update(e.id, { [field]: value })));
    queryClient.invalidateQueries({ queryKey: ['employees-active'] });
    toast({ title: `Updated ${filtered.length} records` });
  };

  const positions = useMemo(() => [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort().map(p => ({ value: p, label: p })), [employees]);

  const filtered = useMemo(() => employees.filter(e => {
    const matchesSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.qid_no?.includes(search);
    const empCompany = (e.company || '').trim().toUpperCase();
    const matchesCompany = companyFilter.length === 0 || companyFilter.some(cf => cf.trim().toUpperCase() === empCompany);
    const matchesPosition = positionFilter.length === 0 || positionFilter.includes(e.designation_org_chart);
    const matchesResult = (resultFilter === 'all' && medicalResultFilter.length === 0) || (medicalResultFilter.length > 0 ? medicalResultFilter.includes(e.ftw_result) : e.ftw_result === resultFilter);
    const matchesDepartment = departmentFilter.length === 0 || departmentFilter.includes(e.department);
    const approvedDate = normalizeDate(e.ftw_approved_date);
    const matchesTrFrom = !trApprovedFrom || (approvedDate && approvedDate >= trApprovedFrom);
    const matchesTrTo = !trApprovedTo || (approvedDate && approvedDate <= trApprovedTo);
    const effectiveRlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
    const matchesRlic = rlicStatusFilter.length === 0 || rlicStatusFilter.includes(effectiveRlic);
    const matchesTraining = trainingStatusFilter.length === 0 || trainingStatusFilter.includes(e.training_status);
    const effectivePid = computePassStatus(e.pid_expiry, 'pid', e.pid_status);
    const matchesPid = pidStatusFilter.length === 0 || pidStatusFilter.includes(effectivePid);
    const trainSchedDate = normalizeDate(e.training_date_scheduled) || '';
    const matchesTrainSchedFrom = !trainingScheduledFrom || trainSchedDate >= trainingScheduledFrom;
    const matchesTrainSchedTo = !trainingScheduledTo || trainSchedDate <= trainingScheduledTo;
    const gpDate = normalizeDate(e.gate_pass_received_date) || '';
    const matchesGpFrom = !gpReceivedFrom || gpDate >= gpReceivedFrom;
    const matchesGpTo = !gpReceivedTo || gpDate <= gpReceivedTo;
    const pidDate = normalizeDate(e.pid_issue_date) || '';
    const matchesPidFrom = !pidIssueFrom || pidDate >= pidIssueFrom;
    const matchesPidTo = !pidIssueTo || pidDate <= pidIssueTo;
    return matchesSearch && matchesCompany && matchesPosition && matchesResult && matchesDepartment && matchesTrFrom && matchesTrTo && matchesRlic && matchesTraining && matchesPid && matchesTrainSchedFrom && matchesTrainSchedTo && matchesGpFrom && matchesGpTo && matchesPidFrom && matchesPidTo;
  }), [employees, search, companyFilter, positionFilter, resultFilter, medicalResultFilter, departmentFilter, trApprovedFrom, trApprovedTo, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, trainingScheduledFrom, trainingScheduledTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);

  useEffect(() => { setPage(0); }, [companyFilter, positionFilter, departmentFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter, resultFilter, search, trApprovedFrom, trApprovedTo, trainingScheduledFrom, trainingScheduledTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRows = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  const stats = useMemo(() => allMedicalResults.map(r => ({
    name: r.label,
    value: r.value,
    count: filtered.filter(e => e.ftw_result === r.value).length,
  })), [filtered, allMedicalResults]);  // allMedicalResults from useLookupOptions

  const companyHeadcount = useMemo(() => {
    const allCompanies = new Set(filtered.map(e => e.company).filter(Boolean));
    const staticValues = new Set(COMPANIES.map(c => c.value));
    const extra = [...allCompanies].filter(v => !staticValues.has(v)).map(v => ({ value: v, label: v }));
    return [...COMPANIES, ...extra]
      .map(c => ({ name: c.label, count: filtered.filter(e => e.company === c.value).length }))
      .filter(c => c.count > 0).sort((a, b) => b.count - a.count);
  }, [filtered]);

  const companyStats = useMemo(() => {
    const active = COMPANIES.filter(c => filtered.some(e => e.company === c.value));
    return active.map(c => ({
      name: c.label.substring(0, 12),
      accepted: filtered.filter(e => e.company === c.value && e.ftw_result === 'ACCEPTED').length,
      pending: filtered.filter(e => e.company === c.value && e.ftw_result === 'WAITING TR APPROVAL').length,
      rejected: filtered.filter(e => e.company === c.value && e.ftw_result === 'REJECTED').length,
    })).filter(c => c.accepted + c.pending + c.rejected > 0);
  }, [filtered]);

  const getExportData = () => filtered.map(e => ({
    Name: e.name, Company: e.company, Nationality: e.nationality,
    QID_No: e.qid_no, PP_No: e.pp_no, Medical_Date: formatDate(e.ftw_medical_date),
    Received_Date: formatDate(e.ftw_received_date), Approval_Request: formatDate(e.ftw_approval_request_date),
    Count_Days: e.ftw_count_days, Approved_Date: formatDate(e.ftw_approved_date),
    Result: e.ftw_result, Doctor: e.ftw_doctor, Mobile: e.ftw_mobile,
    ReAssess_Date: formatDate(e.ftw_reassess_date), Remarks: e.ftw_remarks,
  }));

  const resultColors = { ACCEPTED: 'bg-emerald-50 text-emerald-700', REJECTED: 'bg-red-50 text-red-700', 'WAITING TR APPROVAL': 'bg-amber-50 text-amber-700', 'RE-ASSESS': 'bg-purple-50 text-purple-700' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Stethoscope className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Medical Data</h2>
            <p className="text-sm text-muted-foreground">FTW / Medical tracking</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(v => !v)}>
            {editMode ? <><XIcon className="w-4 h-4 mr-2" /> Exit Edit Mode</> : <><PencilLine className="w-4 h-4 mr-2" /> Edit in Grid</>}
          </Button>
          <Link to="/medical/import"><Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import Medical Data</Button></Link>
          <ExportButton getData={getExportData} filename="medical_data.csv" />
        </div>
      </div>

      <TrackerFilters
        filters={{ companyFilter, positionFilter, departmentFilter, rlicStatusFilter, trainingStatusFilter, pidStatusFilter, medicalResultFilter, trainingScheduledFrom, trainingScheduledTo, trApprovedFrom, trApprovedTo, gpReceivedFrom, gpReceivedTo, pidIssueFrom, pidIssueTo }}
        setters={{ setCompanyFilter, setPositionFilter, setDepartmentFilter, setRlicStatusFilter, setTrainingStatusFilter, setPidStatusFilter, setMedicalResultFilter, setTrainingScheduledFrom, setTrainingScheduledTo, setTrApprovedFrom, setTrApprovedTo, setGpReceivedFrom, setGpReceivedTo, setPidIssueFrom, setPidIssueTo }}
        options={{ companies: companyOptions, positions, departments: departmentOptions, rlicStatuses: rlicStatusOptions, trainingStatuses: trainingStatusOptions, pidStatuses: pidStatusOptions, medicalResults: allMedicalResults }}
        totalFiltered={filtered.length}
        totalAll={employees.length}
      />

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
          {/* Overall Total Banner */}
          {(() => {
            const accepted = filtered.filter(e => e.ftw_result === 'ACCEPTED').length;
            const newCount = filtered.filter(e => !e.ftw_result || e.ftw_result === 'NEW').length;
            const knownResultCounts = allMedicalResults.reduce((sum, r) => sum + filtered.filter(e => e.ftw_result === r.value).length, 0);
            const overallTotal = newCount + knownResultCounts;
            const waitingTr = filtered.filter(e => e.ftw_result === 'WAITING TR APPROVAL').length;
            const rejected = filtered.filter(e => e.ftw_result === 'REJECTED').length;
            const reAssess = filtered.filter(e => e.ftw_result === 'RE-ASSESS').length;
            return (
              <Card className="border-blue-200 bg-blue-50/60">
                <CardContent className="pt-4 pb-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-blue-700">Medical Data Overview</p>
                    <p className="text-xs text-blue-600 mt-0.5">{accepted} Accepted &nbsp;+&nbsp; {waitingTr} Waiting TR &nbsp;+&nbsp; {rejected} Rejected &nbsp;+&nbsp; {reAssess} Re-Assess &nbsp;+&nbsp; {newCount} New</p>
                  </div>
                  <div className="flex items-end gap-3">
                    <div className="text-center">
                      <span className="text-5xl font-extrabold text-blue-600">{accepted}</span>
                      <p className="text-[10px] text-blue-600 mt-0.5">Accepted</p>
                    </div>
                    <div className="text-center border-l border-blue-300 pl-3">
                      <span className="text-3xl font-bold text-blue-400">{overallTotal}</span>
                      <p className="text-[10px] text-blue-500 mt-0.5">Overall Total</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((s, i) => (
              <Card key={s.name}>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold" style={{ color: COLORS[i % COLORS.length] }}>{s.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.name}</div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold text-blue-500">{filtered.filter(e => !e.ftw_result).length}</div>
                <div className="text-xs text-muted-foreground mt-1">New</div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Result Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={stats.filter(s => s.count > 0)} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, count }) => `${name}: ${count}`} labelLine={false} >

                      {stats.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-sm">Medical Result by Company</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={companyStats} margin={{ left: -20 }}>
                    <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Bar dataKey="accepted" fill="#10b981" stackId="a" />
                    <Bar dataKey="pending" fill="#f59e0b" stackId="a" />
                    <Bar dataKey="rejected" fill="#ef4444" stackId="a" />
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
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
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
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Result" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  {allMedicalResults.map(r => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 mt-3 items-end">
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">TR Date Approved — From</p>
                <Input type="date" value={trApprovedFrom} onChange={e => setTrApprovedFrom(e.target.value)} className="text-xs" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium text-muted-foreground mb-1">TR Date Approved — To</p>
                <Input type="date" value={trApprovedTo} onChange={e => setTrApprovedTo(e.target.value)} className="text-xs" />
              </div>
              {(trApprovedFrom || trApprovedTo) && (
                <Button variant="ghost" size="sm" onClick={() => { setTrApprovedFrom(''); setTrApprovedTo(''); }} className="text-xs">Clear Dates</Button>
              )}
            </div>
          </Card>
          {editMode && hasActiveFilters && filtered.length > 0 && (
            <BulkEditBar fields={medicalBulkFields} filteredCount={filtered.length} onApply={handleBulkApply} isLoading={updateMutation.isPending} />
          )}

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
                    <TableHead className="text-xs bg-muted/50">PP No</TableHead>
                    <TableHead className="text-xs bg-muted/50">Medical Date</TableHead>
                    <TableHead className="text-xs bg-muted/50">Date Received from ALSAFA</TableHead>
                    <TableHead className="text-xs bg-muted/50">TR FTW Approval Date Request</TableHead>
                    <TableHead className="text-xs bg-muted/50">TR Date Approved</TableHead>
                    <TableHead className="text-xs bg-muted/50">Result</TableHead>
                    <TableHead className="text-xs bg-muted/50">Doctor</TableHead>
                    <TableHead className="text-xs bg-muted/50">Mobile</TableHead>
                    <TableHead className="text-xs bg-muted/50">Re-Assess Date</TableHead>
                    <TableHead className="text-xs bg-muted/50">Remarks</TableHead>
                    <TableHead className="text-xs bg-muted/50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(6).fill(0).map((_, i) => <TableRow key={i}>{Array(16).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={16} className="text-center py-10 text-muted-foreground">No records found</TableCell></TableRow>
                  ) : pagedRows.map(emp => (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="p-2"><PersonnelAvatar name={emp.name} photoUrl={emp.photo_url} size={8} /></TableCell>
                      <TableCell className="p-1"><SharepointDocIcon emp={emp} canEdit={true} onSave={(id, url) => handleCellSave(id, 'sharepoint_url', url)} /></TableCell>
                      <TableCell className="text-xs font-medium"><InlineEditCell value={emp.name} field="name" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs">{emp.company}</TableCell>
                      <TableCell className="text-xs font-mono"><InlineEditCell value={emp.qid_no} field="qid_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs font-mono"><InlineEditCell value={emp.pp_no} field="pp_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs"><InlineEditCell value={emp.ftw_medical_date} field="ftw_medical_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs"><InlineEditCell value={emp.ftw_received_date} field="ftw_received_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs"><InlineEditCell value={emp.ftw_approval_request_date} field="ftw_approval_request_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs"><InlineEditCell value={emp.ftw_approved_date} field="ftw_approved_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell>
                        <InlineEditCell value={emp.ftw_result} field="ftw_result" empId={emp.id} type="select" options={allMedicalResults} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} />
                      </TableCell>
                      <TableCell className="text-xs"><InlineEditCell value={emp.ftw_doctor} field="ftw_doctor" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs"><InlineEditCell value={emp.ftw_mobile} field="ftw_mobile" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs"><InlineEditCell value={emp.ftw_reassess_date} field="ftw_reassess_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
                      <TableCell className="text-xs"><InlineEditCell value={emp.ftw_remarks} field="ftw_remarks" empId={emp.id} onSave={handleCellSave} editMode={editMode} onFillDown={editMode ? handleFillDown : undefined} /></TableCell>
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
      </Tabs>
    </div>
  );
}