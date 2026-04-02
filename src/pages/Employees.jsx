import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, Eye, Pencil, Trash2, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import StatusBadge from '../components/common/StatusBadge';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';

export default function Employees() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [rlicFilter, setRlicFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 200),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Employee deleted successfully' });
    },
  });

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const matchesSearch = !search || 
        emp.name?.toLowerCase().includes(search.toLowerCase()) ||
        emp.pid?.includes(search) ||
        emp.pp_no?.includes(search) ||
        emp.staff_no?.toLowerCase().includes(search.toLowerCase());
      const matchesCompany = companyFilter === 'all' || emp.company === companyFilter;
      const matchesRlic = rlicFilter === 'all' || emp.rlic_status === rlicFilter;
      const matchesLocation = locationFilter === 'all' || emp.current_location === locationFilter;
      return matchesSearch && matchesCompany && matchesRlic && matchesLocation;
    });
  }, [employees, search, companyFilter, rlicFilter, locationFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Employees</h2>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} of {employees.length} employees</p>
        </div>
        <Link to="/employees/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" /> Add Employee
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, PID, passport..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Company" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              <SelectItem value="GSOQ">GSOQ</SelectItem>
              <SelectItem value="LMV">LMV</SelectItem>
              <SelectItem value="WENMA">WENMA</SelectItem>
              <SelectItem value="ENERTEC">ENERTEC</SelectItem>
            </SelectContent>
          </Select>
          <Select value={rlicFilter} onValueChange={setRlicFilter}>
            <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="RLIC Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All RLIC Status</SelectItem>
              <SelectItem value="VALID RLIC PASS">Valid</SelectItem>
              <SelectItem value="EXPIRED RLIC PASS">Expired</SelectItem>
              <SelectItem value="SOON TO EXPIRE">Soon to Expire</SelectItem>
              <SelectItem value="NO RLIC PASS">No Pass</SelectItem>
            </SelectContent>
          </Select>
          <Select value={locationFilter} onValueChange={setLocationFilter}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue placeholder="Location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Locations</SelectItem>
              <SelectItem value="QATAR">Qatar</SelectItem>
              <SelectItem value="COMO CAMP">COMO Camp</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold">SL</TableHead>
                <TableHead className="text-xs font-semibold">Name</TableHead>
                <TableHead className="text-xs font-semibold">Designation</TableHead>
                <TableHead className="text-xs font-semibold">Company</TableHead>
                <TableHead className="text-xs font-semibold">Nationality</TableHead>
                <TableHead className="text-xs font-semibold">Location</TableHead>
                <TableHead className="text-xs font-semibold">Type</TableHead>
                <TableHead className="text-xs font-semibold">RLIC</TableHead>
                <TableHead className="text-xs font-semibold">PID</TableHead>
                <TableHead className="text-xs font-semibold text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(8).fill(0).map((_, i) => (
                  <TableRow key={i}>
                    {Array(10).fill(0).map((_, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                    No employees found
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs text-muted-foreground">{emp.sl_no}</TableCell>
                    <TableCell className="text-sm font-medium max-w-[200px] truncate">{emp.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate">{emp.designation_org_chart}</TableCell>
                    <TableCell className="text-xs">{emp.company}</TableCell>
                    <TableCell className="text-xs">{emp.nationality}</TableCell>
                    <TableCell className="text-xs">{emp.current_location}</TableCell>
                    <TableCell className="text-xs">{emp.dir_indir}</TableCell>
                    <TableCell><StatusBadge status={emp.rlic_status} short /></TableCell>
                    <TableCell><StatusBadge status={emp.pid_status} short /></TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Link to={`/employees/${emp.id}`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <Link to={`/employees/${emp.id}/edit`}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </Link>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Employee</AlertDialogTitle>
                              <AlertDialogDescription>Are you sure you want to delete {emp.name}? This cannot be undone.</AlertDialogDescription>
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