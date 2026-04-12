import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, Stethoscope, Upload } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { COMPANIES, FTW_RESULTS, exportToCSV, formatDate } from '@/utils/constants';
import { useToast } from '@/components/ui/use-toast';

const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function MedicalTracker() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [resultFilter, setResultFilter] = useState('all');
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const filtered = useMemo(() => employees.filter(e => {
    const matchesSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.qid_no?.includes(search);
    const matchesCompany = companyFilter === 'all' || e.company === companyFilter;
    const matchesResult = resultFilter === 'all' || e.ftw_result === resultFilter;
    return matchesSearch && matchesCompany && matchesResult;
  }), [employees, search, companyFilter, resultFilter]);

  const stats = useMemo(() => FTW_RESULTS.map(r => ({
    name: r,
    count: employees.filter(e => e.ftw_result === r).length,
  })), [employees]);

  const companyStats = useMemo(() => {
    const active = COMPANIES.filter(c => employees.some(e => e.company === c.value));
    return active.map(c => ({
      name: c.label.substring(0, 12),
      accepted: employees.filter(e => e.company === c.value && e.ftw_result === 'ACCEPTED').length,
      pending: employees.filter(e => e.company === c.value && e.ftw_result === 'PENDING').length,
      rejected: employees.filter(e => e.company === c.value && e.ftw_result === 'REJECTED').length,
    })).filter(c => c.accepted + c.pending + c.rejected > 0);
  }, [employees]);

  const handleExport = () => {
    const data = filtered.map(e => ({
      Name: e.name, Company: e.company, Nationality: e.nationality,
      QID_No: e.qid_no, PP_No: e.pp_no, Medical_Date: e.ftw_medical_date,
      Received_Date: e.ftw_received_date, Approval_Request: e.ftw_approval_request_date,
      Count_Days: e.ftw_count_days, Approved_Date: e.ftw_approved_date,
      Result: e.ftw_result, Doctor: e.ftw_doctor, Mobile: e.ftw_mobile,
    }));
    exportToCSV(data, 'medical_data.csv');
    toast({ title: `Exported ${data.length} records` });
  };

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
          <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Export</Button>
        </div>
      </div>

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
            <Card>
              <CardContent className="pt-4">
                <div className="text-3xl font-bold text-slate-500">{employees.filter(e => !e.ftw_result).length}</div>
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
              <CardHeader><CardTitle className="text-sm">By Company</CardTitle></CardHeader>
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
        </TabsContent>

        <TabsContent value="list" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input placeholder="Search name or QID..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={companyFilter} onValueChange={setCompanyFilter}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Companies</SelectItem>
                  {COMPANIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">QID No</TableHead>
                    <TableHead className="text-xs">PP No</TableHead>
                    <TableHead className="text-xs">Medical Date</TableHead>
                    <TableHead className="text-xs">Date Received from ALSAFA</TableHead>
                    <TableHead className="text-xs">Approved Date</TableHead>
                    <TableHead className="text-xs">Result</TableHead>
                    <TableHead className="text-xs">Doctor</TableHead>
                    <TableHead className="text-xs">Mobile</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(6).fill(0).map((_, i) => <TableRow key={i}>{Array(10).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={10} className="text-center py-10 text-muted-foreground">No records found</TableCell></TableRow>
                  ) : filtered.map(emp => (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                      <TableCell className="text-xs">{emp.company}</TableCell>
                      <TableCell className="text-xs font-mono">{emp.qid_no}</TableCell>
                      <TableCell className="text-xs font-mono">{emp.pp_no}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.ftw_medical_date)}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.ftw_received_date)}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.ftw_approved_date)}</TableCell>
                      <TableCell>
                        {emp.ftw_result ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${resultColors[emp.ftw_result] || 'bg-muted text-muted-foreground'}`}>{emp.ftw_result}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-xs">{emp.ftw_doctor}</TableCell>
                      <TableCell className="text-xs">{emp.ftw_mobile}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}