import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Search, Eye } from 'lucide-react';
import { formatDate, computePassStatus } from '@/utils/constants';
import { Link } from 'react-router-dom';

const ONGOING_STATUSES = ['SCHEDULED', 'ON-GOING', 'TO BE SCHEDULED'];

const STATUS_COLORS = {
  'SCHEDULED': 'bg-blue-50 text-blue-700',
  'ON-GOING': 'bg-emerald-50 text-emerald-700',
  'TO BE SCHEDULED': 'bg-amber-50 text-amber-700',
};

export default function OngoingTraining() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
  });

  const ongoingEmployees = useMemo(() =>
    employees.filter(e => {
      const medical = (e.ftw_result || '').toUpperCase();
      const rlic = computePassStatus(e.gate_pass_expiry, 'rlic', e.rlic_status);
      return (
        medical === 'ACCEPTED' &&
        (rlic === 'VALID RLIC PASS' || rlic === 'SOON TO EXPIRE') &&
        ONGOING_STATUSES.includes((e.training_status || '').toUpperCase())
      );
    }),
    [employees]
  );

  const companies = useMemo(() => [...new Set(ongoingEmployees.map(e => e.company).filter(Boolean))].sort(), [ongoingEmployees]);
  const departments = useMemo(() => [...new Set(ongoingEmployees.map(e => e.department).filter(Boolean))].sort(), [ongoingEmployees]);
  const positions = useMemo(() => [...new Set(ongoingEmployees.map(e => e.designation_org_chart).filter(Boolean))].sort(), [ongoingEmployees]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return ongoingEmployees.filter(e => {
      const matchSearch = !q || e.name?.toLowerCase().includes(q) || e.qid_no?.includes(q) || e.company?.toLowerCase().includes(q);
      const matchCompany = companyFilter === 'all' || e.company === companyFilter;
      const matchDept = departmentFilter === 'all' || e.department === departmentFilter;
      const matchPos = positionFilter === 'all' || e.designation_org_chart === positionFilter;
      const matchStatus = statusFilter === 'all' || (e.training_status || '').toUpperCase() === statusFilter;
      const sched = e.training_date_scheduled || '';
      const matchFrom = !dateFrom || sched >= dateFrom;
      const matchTo = !dateTo || sched <= dateTo;
      return matchSearch && matchCompany && matchDept && matchPos && matchStatus && matchFrom && matchTo;
    });
  }, [ongoingEmployees, search, companyFilter, departmentFilter, positionFilter, statusFilter, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input placeholder="Search name, QID, company..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-xs" />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Companies" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Depts" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={positionFilter} onValueChange={setPositionFilter}>
            <SelectTrigger className="w-40 h-8 text-xs"><SelectValue placeholder="All Positions" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Positions</SelectItem>
              {positions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-8 text-xs"><SelectValue placeholder="All Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {ONGOING_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted-foreground whitespace-nowrap">Scheduled Date:</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-8 text-xs border border-input rounded-md px-2" />
            <span className="text-xs text-muted-foreground">—</span>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-8 text-xs border border-input rounded-md px-2" />
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <div className="table-scroll-y" style={{ maxHeight: 520 }}>
            <Table className="table-list-view">
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50">
                  <TableHead className="bg-muted/50">Employee Name</TableHead>
                  <TableHead className="bg-muted/50">QID</TableHead>
                  <TableHead className="bg-muted/50">Company</TableHead>
                  <TableHead className="bg-muted/50">Department</TableHead>
                  <TableHead className="bg-muted/50">Designation</TableHead>
                  <TableHead className="bg-muted/50 whitespace-nowrap">Medical Status</TableHead>
                  <TableHead className="bg-muted/50 whitespace-nowrap">Gate Pass Status</TableHead>
                  <TableHead className="bg-muted/50 whitespace-nowrap">Training Date Scheduled</TableHead>
                  <TableHead className="bg-muted/50 whitespace-nowrap">Training Date Started</TableHead>
                  <TableHead className="bg-muted/50 whitespace-nowrap">Training Date End</TableHead>
                  <TableHead className="bg-muted/50">Training Status</TableHead>
                  <TableHead className="bg-muted/50">Remarks</TableHead>
                  <TableHead className="bg-muted/50">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-10 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={13} className="text-center py-10 text-muted-foreground">No ongoing training records found</TableCell></TableRow>
                ) : filtered.map(emp => (
                  <TableRow key={emp.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                    <TableCell className="text-xs font-mono">{emp.qid_no}</TableCell>
                    <TableCell className="text-xs">{emp.company}</TableCell>
                    <TableCell className="text-xs">{emp.department}</TableCell>
                    <TableCell className="text-xs">{emp.designation_org_chart}</TableCell>
                    <TableCell><span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">{emp.ftw_result}</span></TableCell>
                    <TableCell><span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{computePassStatus(emp.gate_pass_expiry, 'rlic', emp.rlic_status)}</span></TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.training_date_scheduled)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.training_date_start)}</TableCell>
                    <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.training_date_end)}</TableCell>
                    <TableCell>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[(emp.training_status || '').toUpperCase()] || 'bg-muted text-muted-foreground'}`}>
                        {emp.training_status}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs">{emp.remarks || '—'}</TableCell>
                    <TableCell>
                      <Link to={`/employees/${emp.id}`}><Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button></Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
        <div className="px-4 py-2 border-t bg-muted/30">
          <span className="text-xs text-muted-foreground">
            Showing <strong>{filtered.length}</strong> of <strong>{ongoingEmployees.length}</strong> ongoing/scheduled
          </span>
        </div>
      </Card>
    </div>
  );
}