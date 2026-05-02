import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, UserCheck, UserX, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { formatDate, computePassStatus, COMPANIES, RLIC_STATUSES, PID_STATUSES, LOCATIONS, MEDICAL_RESULTS } from '@/utils/constants';
import MultiSelect from '../components/common/MultiSelect';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

export default function InactivePersonnel() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState([]);
  const [positionFilter, setPositionFilter] = useState([]);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [dirFilter, setDirFilter] = useState('all');
  const [medicalResultFilter, setMedicalResultFilter] = useState('all');

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Dedicated query — only fetch inactive records, no shared limit with active employees
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
    departmentFilter !== 'all' || locationFilter !== 'all' || dirFilter !== 'all' || medicalResultFilter !== 'all';

  // All records from this query are already inactive — just apply UI filters
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
      return matchesSearch && matchesCompany && matchesPosition && matchesDepartment && matchesLocation && matchesDir && matchesMedical;
    }),
    [employees, search, companyFilter, positionFilter, departmentFilter, locationFilter, dirFilter, medicalResultFilter]
  );

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

  const clearFilters = () => {
    setSearch(''); setCompanyFilter([]); setPositionFilter([]);
    setDepartmentFilter('all'); setLocationFilter('all'); setDirFilter('all'); setMedicalResultFilter('all');
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
      <Card className="p-4">
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
        {hasActiveFilters && (
          <div className="mt-3 flex justify-end">
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
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">SL</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Name</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Company</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Designation</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Department</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Nationality</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Location</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">DIR/INDIR</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">QID No</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">QID Expiry</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Medical Result</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Gate Pass</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap">Project ID</TableHead>
                  <TableHead className="text-xs bg-muted/50 whitespace-nowrap text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>{Array(14).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : inactive.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={14} className="text-center py-14">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <UserCheck className="w-8 h-8 text-green-500" />
                        <p className="font-medium">No inactive personnel</p>
                        <p className="text-xs">All personnel are currently active.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  inactive.map(emp => (
                    <TableRow key={emp.id} className="hover:bg-muted/30">
                      <TableCell className="text-xs text-muted-foreground">{emp.sl_no}</TableCell>
                      <TableCell className="text-xs font-medium whitespace-nowrap">{emp.name}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{emp.company}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{emp.designation_org_chart || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{emp.department || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{emp.nationality || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{emp.current_location || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{emp.dir_indir || '—'}</TableCell>
                      <TableCell className="text-xs font-mono whitespace-nowrap">{emp.qid_no || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.qid_expiry)}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{emp.ftw_result || '—'}</TableCell>
                      {/* Gate Pass & PID suppressed while inactive — shown as blank */}
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground italic">—</TableCell>
                      <TableCell className="text-xs whitespace-nowrap text-muted-foreground italic">—</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Link to={`/employees/${emp.id}`}>
                            <Button variant="ghost" size="sm" className="text-xs h-7">View</Button>
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
                                <AlertDialogAction
                                  onClick={() => reactivateMutation.mutate(emp.id)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  Reactivate
                                </AlertDialogAction>
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
        </div>
        <div className="px-4 py-2 border-t bg-muted/30 text-xs text-muted-foreground">
          Showing <strong>{inactive.length}</strong> of <strong>{employees.length}</strong> inactive records
        </div>
      </Card>
    </div>
  );
}