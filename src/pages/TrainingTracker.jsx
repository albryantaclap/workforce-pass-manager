import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Download, GraduationCap } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import { COMPANIES, TRAINING_STATUSES, exportToCSV, formatDate } from '@/utils/constants';
import { useToast } from '@/components/ui/use-toast';

const COLORS = ['#10b981', '#f59e0b', '#94a3b8'];

export default function TrainingTracker() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const filtered = useMemo(() => employees.filter(e => {
    const matchesSearch = !search || e.name?.toLowerCase().includes(search.toLowerCase()) || e.qid_no?.includes(search);
    const matchesCompany = companyFilter === 'all' || e.company === companyFilter;
    const matchesStatus = statusFilter === 'all' || e.training_status === statusFilter;
    return matchesSearch && matchesCompany && matchesStatus;
  }), [employees, search, companyFilter, statusFilter]);

  const stats = useMemo(() => TRAINING_STATUSES.map((s, i) => ({
    name: s,
    count: employees.filter(e => e.training_status === s).length,
  })), [employees]);

  const companyStats = useMemo(() => {
    return COMPANIES.filter(c => employees.some(e => e.company === c.value)).map(c => ({
      name: c.label.substring(0, 12),
      done: employees.filter(e => e.company === c.value && e.training_status === 'DONE').length,
      pending: employees.filter(e => e.company === c.value && e.training_status === 'PENDING').length,
    })).filter(c => c.done + c.pending > 0);
  }, [employees]);

  const handleExport = () => {
    const data = filtered.map(e => ({
      Name: e.name, Company: e.company, Nationality: e.nationality, QID_No: e.qid_no,
      Training_Date: e.training_date, Training_Status: e.training_status,
    }));
    exportToCSV(data, 'training_data.csv');
    toast({ title: `Exported ${data.length} records` });
  };

  const statusColors = { DONE: 'bg-emerald-50 text-emerald-700', PENDING: 'bg-amber-50 text-amber-700', 'NOT REQUIRED': 'bg-slate-100 text-slate-600' };

  return (
    <div className="space-y-5">
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
        <Button variant="outline" onClick={handleExport}><Download className="w-4 h-4 mr-2" /> Export</Button>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
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
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  {TRAINING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
                    <TableHead className="text-xs">Nationality</TableHead>
                    <TableHead className="text-xs">QID No</TableHead>
                    <TableHead className="text-xs">Position</TableHead>
                    <TableHead className="text-xs">Training Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    Array(6).fill(0).map((_, i) => <TableRow key={i}>{Array(7).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>)
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No records found</TableCell></TableRow>
                  ) : filtered.map(emp => (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                      <TableCell className="text-xs">{emp.company}</TableCell>
                      <TableCell className="text-xs">{emp.nationality}</TableCell>
                      <TableCell className="text-xs font-mono">{emp.qid_no}</TableCell>
                      <TableCell className="text-xs">{emp.designation_org_chart}</TableCell>
                      <TableCell className="text-xs">{formatDate(emp.training_date)}</TableCell>
                      <TableCell>
                        {emp.training_status ? (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusColors[emp.training_status] || 'bg-muted text-muted-foreground'}`}>{emp.training_status}</span>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
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