import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, ShieldCheck, Eye, Pencil, Upload, PencilLine, X as XIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import StatusBadge from '../components/common/StatusBadge';
import { COMPANIES, RLIC_STATUSES, formatDate, daysUntil, computePassStatus } from '@/utils/constants';
import MultiSelect from '../components/common/MultiSelect';
import ExportButton from '../components/common/ExportButton';
import InlineEditCell from '../components/common/InlineEditCell';
import BulkEditBar from '../components/common/BulkEditBar';
import { useToast } from '@/components/ui/use-toast';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#94a3b8'];

export default function GatepassTracker() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [editMode, setEditMode] = useState(false);

  const queryClient = useQueryClient();
  const { toast } = useToast();


  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const { data: customRlicStatuses = [] } = useQuery({
    queryKey: ['lookups', 'rlic_status'],
    queryFn: () => base44.entities.Lookup.filter({ type: 'rlic_status' }),
  });

  const allStatusOptions = useMemo(() => {
    const custom = customRlicStatuses.map(s => ({ value: s.value, label: s.label }));
    return [...RLIC_STATUSES, ...custom];
  }, [customRlicStatuses]);

  const getEffectiveRlic = (e) => computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);

  const positions = useMemo(() => [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort().map(p => ({ value: p, label: p })), [employees]);

  const filtered = useMemo(() => employees.filter(e => {
    const matchesSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.qid_no?.includes(search) || e.staff_no?.toLowerCase().includes(search.toLowerCase());
    const empCompany = (e.company || '').trim().toUpperCase();
    const matchesCompany = companyFilter.length === 0 || companyFilter.some(cf => cf.trim().toUpperCase() === empCompany);
    const matchesPosition = positionFilter.length === 0 || positionFilter.includes(e.designation_org_chart);
    const effectiveRlic = getEffectiveRlic(e);
    const matchesStatus = statusFilter.length === 0 || statusFilter.includes(effectiveRlic);
    const matchesDepartment = departmentFilter === 'all' || e.department === departmentFilter;
    return matchesSearch && matchesCompany && matchesPosition && matchesStatus && matchesDepartment;
  }), [employees, search, companyFilter, positionFilter, statusFilter, departmentFilter, customRlicStatuses]);

  const stats = useMemo(() => {
    // Built-in 4 + any custom statuses
    const customCounts = customRlicStatuses.map(s => ({
      name: s.label,
      count: filtered.filter(e => getEffectiveRlic(e) === s.value).length,
    }));
    return [
      { name: 'Valid', count: filtered.filter(e => getEffectiveRlic(e) === 'VALID RLIC PASS').length },
      { name: 'Expired', count: filtered.filter(e => getEffectiveRlic(e) === 'EXPIRED RLIC PASS').length },
      { name: 'Soon', count: filtered.filter(e => getEffectiveRlic(e) === 'SOON TO EXPIRE').length },
      { name: 'No Pass', count: filtered.filter(e => getEffectiveRlic(e) === 'NO RLIC PASS').length },
      ...customCounts,
    ];
  }, [filtered, customRlicStatuses]);

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
      valid: filtered.filter(e => e.company === c.value && getEffectiveRlic(e) === 'VALID RLIC PASS').length,
      expired: filtered.filter(e => e.company === c.value && getEffectiveRlic(e) === 'EXPIRED RLIC PASS').length,
      soon: filtered.filter(e => e.company === c.value && getEffectiveRlic(e) === 'SOON TO EXPIRE').length,
    })).filter(c => c.valid + c.expired + c.soon > 0);
  }, [filtered]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['employees'] }),
    onError: () => toast({ title: 'Update failed', variant: 'destructive' }),
  });

  const handleCellSave = (id, field, value) => updateMutation.mutate({ id, data: { [field]: value } });

  const hasActiveFilters = search || companyFilter.length > 0 || positionFilter.length > 0 || statusFilter.length > 0 || departmentFilter !== 'all';

  const gateBulkFields = [
    { key: 'rlic_status', label: 'RLIC Status', type: 'select', options: allStatusOptions },
    { key: 'gate_pass_expiry', label: 'Gate Pass Expiry', type: 'date' },
    { key: 'gate_pass_issue_date', label: 'Issue Date', type: 'date' },
    { key: 'gate_pass_received_date', label: 'Received Date', type: 'date' },
  ];

  const handleBulkApply = async (field, value) => {
    await Promise.all(filtered.map(e => base44.entities.Employee.update(e.id, { [field]: value })));
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    toast({ title: `Updated ${filtered.length} records` });
  };

  const getExportData = () => filtered.map(e => ({
    Name: e.name, Company: e.company, Nationality: e.nationality, QID_No: e.qid_no,
    Staff_No: e.staff_no, Gate_Pass_Issue: e.gate_pass_issue_date,
    Gate_Pass_Received: e.gate_pass_received_date, Gate_Pass_Expiry: e.gate_pass_expiry,
    RLIC_Status: e.rlic_status,
  }));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Gate Pass (RLIC)</h2>
            <p className="text-sm text-muted-foreground">RLIC pass tracking & status</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={editMode ? 'default' : 'outline'} onClick={() => setEditMode(v => !v)}>
            {editMode ? <><XIcon className="w-4 h-4 mr-2" /> Exit Edit Mode</> : <><PencilLine className="w-4 h-4 mr-2" /> Edit in Grid</>}
          </Button>
          <Link to="/gatepass/import"><Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import Gate Pass Data</Button></Link>
          <ExportButton getData={getExportData} filename="gatepass_data.csv" />
        </div>
      </div>

      {/* Shared Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Filter by Company</p>
            <MultiSelect options={COMPANIES.map(c => ({ value: c.value, label: c.label }))} value={companyFilter} onChange={setCompanyFilter} placeholder="All Companies" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Filter by Position</p>
            <MultiSelect options={positions} value={positionFilter} onChange={setPositionFilter} placeholder="All Positions" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-medium text-muted-foreground mb-1">Filter by Department</p>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {['Electrical','Mechanical','Civil','Services','Steel Structure'].map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        {(companyFilter.length > 0 || positionFilter.length > 0 || departmentFilter !== 'all') && (
          <p className="text-xs text-muted-foreground mt-2">Showing <strong>{filtered.length}</strong> of <strong>{employees.length}</strong> personnel</p>
        )}
      </Card>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-4 mt-4">
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
              <CardHeader><CardTitle className="text-sm">RLIC Status Distribution</CardTitle></CardHeader>
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
                  <Bar dataKey="count" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Expiry Timeline */}
          <Card>
            <CardHeader><CardTitle className="text-sm">Expiring Within 90 Days</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {employees
                  .filter(e => { const d = daysUntil(e.gate_pass_expiry); return d !== null && d <= 90; })
                  .sort((a, b) => daysUntil(a.gate_pass_expiry) - daysUntil(b.gate_pass_expiry))
                  .slice(0, 10)
                  .map(emp => {
                    const days = daysUntil(emp.gate_pass_expiry);
                    return (
                      <div key={emp.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div>
                          <p className="text-sm font-medium">{emp.name}</p>
                          <p className="text-xs text-muted-foreground">{emp.company} — {formatDate(emp.gate_pass_expiry)}</p>
                        </div>
                        <span className={`text-xs font-bold px-2 py-1 rounded ${days <= 0 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                          {days <= 0 ? 'EXPIRED' : `${days}d`}
                        </span>
                      </div>
                    );
                  })}
                {employees.filter(e => { const d = daysUntil(e.gate_pass_expiry); return d !== null && d <= 90; }).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No passes expiring within 90 days</p>
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
                <Input placeholder="Name, QID, Staff No..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <MultiSelect
                options={allStatusOptions}
                value={statusFilter}
                onChange={setStatusFilter}
                placeholder="All Statuses"
              />
            </div>
          </Card>

          {editMode && hasActiveFilters && filtered.length > 0 && (
            <BulkEditBar fields={gateBulkFields} filteredCount={filtered.length} onApply={handleBulkApply} isLoading={updateMutation.isPending} />
          )}
          <Card className="overflow-hidden">
            <div className="table-scroll-x">
              <div className="table-scroll-y h-[560px]">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs bg-muted/50">Name</TableHead>
                    <TableHead className="text-xs bg-muted/50">Company</TableHead>
                    <TableHead className="text-xs bg-muted/50">QID No</TableHead>
                    <TableHead className="text-xs bg-muted/50">Staff No / RLIC</TableHead>
                    <TableHead className="text-xs bg-muted/50">Issue Date</TableHead>
                    <TableHead className="text-xs bg-muted/50">Received</TableHead>
                    <TableHead className="text-xs bg-muted/50">Expiry</TableHead>
                    <TableHead className="text-xs bg-muted/50">Days Left</TableHead>
                    <TableHead className="text-xs bg-muted/50">Status</TableHead>
                    <TableHead className="text-xs bg-muted/50">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(6).fill(0).map((_, i) => <TableRow key={i}>{Array(10).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">No records found</TableCell></TableRow>
                  ) : filtered.map(emp => {
                    const days = daysUntil(emp.gate_pass_expiry);
                    return (
                      <TableRow key={emp.id} className="hover:bg-muted/30">
                       <TableCell className="text-xs font-medium"><InlineEditCell value={emp.name} field="name" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                       <TableCell className="text-xs">{emp.company}</TableCell>
                       <TableCell className="text-xs font-mono"><InlineEditCell value={emp.qid_no} field="qid_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                       <TableCell className="text-xs"><InlineEditCell value={emp.staff_no} field="staff_no" empId={emp.id} onSave={handleCellSave} editMode={editMode} /></TableCell>
                       <TableCell className="text-xs"><InlineEditCell value={emp.gate_pass_issue_date} field="gate_pass_issue_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                       <TableCell className="text-xs"><InlineEditCell value={emp.gate_pass_received_date} field="gate_pass_received_date" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                       <TableCell className="text-xs"><InlineEditCell value={emp.gate_pass_expiry} field="gate_pass_expiry" empId={emp.id} type="date" onSave={handleCellSave} editMode={editMode} /></TableCell>
                        <TableCell>
                          {days !== null ? (
                            <span className={`text-xs font-bold ${days <= 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-green-600'}`}>
                              {days <= 0 ? 'Expired' : `${days}d`}
                            </span>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell>
                          {editMode ? (
                            <InlineEditCell value={emp.rlic_status} field="rlic_status" empId={emp.id} type="select" options={allStatusOptions} onSave={handleCellSave} editMode={editMode} />
                          ) : (
                            <StatusBadge dateStr={emp.gate_pass_expiry} type="rlic" storedStatus={emp.rlic_status} short />
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
            <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
              Showing <strong>{filtered.length}</strong> of <strong>{employees.length}</strong> records
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}