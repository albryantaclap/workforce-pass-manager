import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Stethoscope, Upload, Eye, Pencil } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { COMPANIES, FTW_RESULTS, formatDate } from '@/utils/constants';
import MultiSelect from '../components/common/MultiSelect';
import ExportButton from '../components/common/ExportButton';
import { useToast } from '@/components/ui/use-toast';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function MedicalTracker() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');


  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const positions = useMemo(() => [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort().map(p => ({ value: p, label: p })), [employees]);

  const filtered = useMemo(() => employees.filter(e => {
    const matchesSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.qid_no?.includes(search);
    const empCompany = (e.company || '').trim().toUpperCase();
    const matchesCompany = companyFilter.length === 0 || companyFilter.some(cf => cf.trim().toUpperCase() === empCompany);
    const matchesPosition = positionFilter.length === 0 || positionFilter.includes(e.designation_org_chart);
    const matchesResult = resultFilter === 'all' || e.ftw_result === resultFilter;
    const matchesDepartment = departmentFilter === 'all' || e.department === departmentFilter;
    return matchesSearch && matchesCompany && matchesPosition && matchesResult && matchesDepartment;
  }), [employees, search, companyFilter, positionFilter, resultFilter, departmentFilter]);

  const stats = useMemo(() => FTW_RESULTS.map(r => ({
    name: r,
    count: filtered.filter(e => e.ftw_result === r).length,
  })), [filtered]);

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
      pending: filtered.filter(e => e.company === c.value && e.ftw_result === 'PENDING').length,
      rejected: filtered.filter(e => e.company === c.value && e.ftw_result === 'REJECTED').length,
    })).filter(c => c.accepted + c.pending + c.rejected > 0);
  }, [filtered]);

  const getExportData = () => filtered.map(e => ({
    Name: e.name, Company: e.company, Nationality: e.nationality,
    QID_No: e.qid_no, PP_No: e.pp_no, Medical_Date: e.ftw_medical_date,
    Received_Date: e.ftw_received_date, Approval_Request: e.ftw_approval_request_date,
    Count_Days: e.ftw_count_days, Approved_Date: e.ftw_approved_date,
    Result: e.ftw_result, Doctor: e.ftw_doctor, Mobile: e.ftw_mobile,
    ReAssess_Date: e.ftw_reassess_date, Remarks: e.ftw_remarks,
  }));

  const resultColors = { ACCEPTED: 'bg-emerald-50 text-emerald-700', REJECTED: 'bg-red-50 text-red-700', PENDING: 'bg-amber-50 text-amber-700', 'RE-ASSESS': 'bg-purple-50 text-purple-700' };

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
        <div className="flex gap-2">
          <Link to="/medical/import"><Button variant="outline"><Upload className="w-4 h-4 mr-2" /> Import Medical Data</Button></Link>
          <ExportButton getData={getExportData} filename="medical_data.csv" />
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
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {stats.map((s, i) => (
              <Card key={s.name}>
                <CardContent className="pt-4">
                  <div className="text-3xl font-bold" style={{ color: COLORS[i] }}>{s.count}</div>
                  <div className="text-xs text-muted-foreground mt-1">{s.name}</div>
                </CardContent>
              </Card>
            ))}
            <Card>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold text-slate-400">{filtered.filter(e => e.ftw_result === 'NO PASS').length}</div>
                <div className="text-xs text-muted-foreground mt-1">No Pass</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold text-slate-500">{filtered.filter(e => !e.ftw_result).length}</div>
                <div className="text-xs text-muted-foreground mt-1">No Data</div>
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader><CardTitle className="text-sm">Result Distribution</CardTitle></CardHeader>
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
                  {FTW_RESULTS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="table-scroll-x">
              <div className="table-scroll-y h-[560px]">
              <Table>
                <TableHeader className="sticky top-0 z-10">
                  <TableRow className="bg-muted/50">
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
                    Array(6).fill(0).map((_, i) => <TableRow key={i}>{Array(12).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={12} className="text-center py-10 text-muted-foreground">No records found</TableCell></TableRow>
                  ) : filtered.map(emp => (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                      <TableCell className="text-xs">{emp.company}</TableCell>
                      <TableCell className="text-xs font-mono">{emp.qid_no}</TableCell>
                      <TableCell className="text-xs font-mono">{emp.pp_no}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.ftw_medical_date)}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.ftw_received_date)}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.ftw_approval_request_date)}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.ftw_approved_date)}</TableCell>
                      <TableCell>
                        {emp.ftw_result ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${resultColors[emp.ftw_result] || 'bg-muted text-muted-foreground'}`}>{emp.ftw_result}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{emp.ftw_doctor}</TableCell>
                      <TableCell className="text-xs">{emp.ftw_mobile}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.ftw_reassess_date)}</TableCell>
                      <TableCell className="text-xs">{emp.ftw_remarks}</TableCell>
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
            <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
              Showing <strong>{filtered.length}</strong> of <strong>{employees.length}</strong> records
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}