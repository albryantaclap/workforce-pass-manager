import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Eye, Pencil, Trash2, Download, Upload } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '../components/common/StatusBadge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import { COMPANIES, RLIC_STATUSES, LOCATIONS, exportToCSV, formatDate } from '@/utils/constants';
import MultiSelect from '../components/common/MultiSelect';

export default function MasterList() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [rlicFilter, setRlicFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState([]);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Record deleted' });
    },
  });

  const uniqueCompanies = useMemo(() => {
    const vals = [...new Set(employees.map(e => e.company).filter(Boolean))].sort();
    return vals.map(v => { const c = COMPANIES.find(x => x.value === v); return { value: v, label: c ? c.label : v }; });
  }, [employees]);

  const positions = useMemo(() => {
    const pos = [...new Set(employees.map(e => e.designation_org_chart).filter(Boolean))].sort();
    return pos.map(p => ({ value: p, label: p }));
  }, [employees]);

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch = !search ||
        emp.name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.qid_no?.includes(search) ||
        emp.pp_no?.includes(search) ||
        emp.pid?.includes(search) ||
        emp.staff_no?.toLowerCase().includes(search.toLowerCase()) ||
        emp.nationality?.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter.length === 0 || companyFilter.includes(emp.company);
      const matchesRlic = rlicFilter === 'all' || emp.rlic_status === rlicFilter;
      const matchesLocation = locationFilter === 'all' || emp.current_location === locationFilter;
      const matchesDir = dirFilter === 'all' || emp.dir_indir === dirFilter;
      const matchesPosition = positionFilter.length === 0 || positionFilter.includes(emp.designation_org_chart);
      return matchesSearch && matchesCompany && matchesRlic && matchesLocation && matchesDir && matchesPosition;
    });
  }, [employees, search, companyFilter, rlicFilter, locationFilter, dirFilter, positionFilter]);

  const handleExport = () => {
    const data = filtered.map(e => ({
      SL: e.sl_no, Name: e.name, Position: e.position_application, Designation: e.designation_org_chart,
      Company: e.company, Nationality: e.nationality, Location: e.current_location, Type: e.dir_indir,
      QID_No: e.qid_no, QID_Expiry: e.qid_expiry, Passport_No: e.pp_no, PP_Expiry: e.pp_expiry,
      FTW_Result: e.ftw_result, Gate_Pass_Expiry: e.gate_pass_expiry, RLIC_Status: e.rlic_status,
      Staff_No: e.staff_no, PID: e.pid, PID_Expiry: e.pid_expiry, PID_Status: e.pid_status,
      Training_Status: e.training_status,
    }));
    exportToCSV(data, 'master_list.csv');
    toast({ title: `Exported ${data.length} records` });
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Master List</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {employees.length} personnel</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Link to="/employees/new">
            <Button><Plus className="w-4 h-4 mr-2" /> Add Personnel</Button>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
          <div className="relative xl:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Name, QID, PP, PID..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <MultiSelect options={uniqueCompanies} value={companyFilter} onChange={setCompanyFilter} placeholder="All Companies" />
          <MultiSelect options={positions} value={positionFilter} onChange={setPositionFilter} placeholder="Filter by position" />
          <Select value={rlicFilter} onValueChange={setRlicFilter}>
            <SelectTrigger><SelectValue placeholder="RLIC Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All RLIC</SelectItem>
              {RLIC_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger><SelectValue placeholder="Location" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {LOCATIONS.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={dirFilter} onValueChange={setDirFilter}>
              <SelectTrigger className="w-28"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="DIR">DIR</SelectItem>
                <SelectItem value="INDIR">INDIR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs bg-muted/50">SL</TableHead>
                <TableHead className="text-xs bg-muted/50">Name</TableHead>
                <TableHead className="text-xs bg-muted/50">Designation</TableHead>
                <TableHead className="text-xs bg-muted/50">Department</TableHead>
                <TableHead className="text-xs bg-muted/50">Company</TableHead>
                <TableHead className="text-xs bg-muted/50">Nationality</TableHead>
                <TableHead className="text-xs bg-muted/50">Location</TableHead>
                <TableHead className="text-xs bg-muted/50">Type</TableHead>
                <TableHead className="text-xs bg-muted/50">QID No</TableHead>
                <TableHead className="text-xs bg-muted/50">QID Expiry</TableHead>
                <TableHead className="text-xs bg-muted/50">RLIC</TableHead>
                <TableHead className="text-xs bg-muted/50">PID</TableHead>
                <TableHead className="text-xs bg-muted/50">Medical</TableHead>
                <TableHead className="text-xs bg-muted/50">Training</TableHead>
                <TableHead className="text-xs text-right bg-muted/50">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <TableRow key={i}>{Array(14).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={15} className="text-center py-12 text-muted-foreground">No records found</TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground">{emp.sl_no}</TableCell>
                    <TableCell className="text-xs font-medium max-w-[160px] truncate">{emp.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[140px] truncate">{emp.designation_org_chart}</TableCell>
                    <TableCell className="text-xs">{emp.department || '—'}</TableCell>
                    <TableCell className="text-xs max-w-[120px] truncate">{emp.company}</TableCell>
                    <TableCell className="text-xs">{emp.nationality}</TableCell>
                    <TableCell className="text-xs">{emp.current_location}</TableCell>
                    <TableCell className="text-xs">{emp.dir_indir}</TableCell>
                    <TableCell className="text-xs font-mono">{emp.qid_no}</TableCell>
                    <TableCell className="text-xs">{formatDate(emp.qid_expiry)}</TableCell>
                    <TableCell><StatusBadge status={emp.rlic_status} short /></TableCell>
                    <TableCell><StatusBadge status={emp.pid_status} short /></TableCell>
                    <TableCell>
                      {emp.ftw_result ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          emp.ftw_result === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700' :
                          emp.ftw_result === 'REJECTED' ? 'bg-red-50 text-red-700' :
                          'bg-amber-50 text-amber-700'
                        }`}>{emp.ftw_result}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      {emp.training_status ? (
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          emp.training_status === 'DONE' ? 'bg-emerald-50 text-emerald-700' :
                          emp.training_status === 'PENDING' ? 'bg-amber-50 text-amber-700' :
                          'bg-slate-100 text-slate-600'
                        }`}>{emp.training_status}</span>
                      ) : <span className="text-xs text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link to={`/employees/${emp.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Eye className="w-3.5 h-3.5" /></Button>
                        </Link>
                        <Link to={`/employees/${emp.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7"><Pencil className="w-3.5 h-3.5" /></Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Record</AlertDialogTitle>
                              <AlertDialogDescription>Delete {emp.name}? This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteMutation.mutate(emp.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}