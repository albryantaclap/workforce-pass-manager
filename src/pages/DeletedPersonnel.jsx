import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { RotateCcw, Search, Trash2 } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';
import { computePassStatus } from '@/utils/constants';
import PersonnelAvatar from '@/components/common/PersonnelAvatar';

const PAGE_SIZE = 50;

const medicalShortLabels = {
  'ACCEPTED': 'Accepted', 'REJECTED': 'Rejected',
  'WAITING TR APPROVAL': 'Waiting TR', 'RE-ASSESS': 'Re-Assess',
};
const medicalStyles = {
  'ACCEPTED': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'REJECTED': 'bg-red-50 text-red-700 border-red-200',
  'WAITING TR APPROVAL': 'bg-amber-50 text-amber-700 border-amber-200',
  'RE-ASSESS': 'bg-purple-50 text-purple-700 border-purple-200',
};

function MedicalBadge({ result }) {
  if (!result) return <span className="text-xs text-muted-foreground">—</span>;
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${medicalStyles[result] || 'bg-blue-50 text-blue-700 border-blue-200'}`}>{medicalShortLabels[result] || result}</span>;
}

function GatePassBadge({ data }) {
  const status = computePassStatus(data?.gate_pass_expiry, 'rlic', data?.rlic_status);
  const styles = {
    'VALID RLIC PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'EXPIRED RLIC PASS': 'bg-red-50 text-red-700 border-red-200',
    'SOON TO EXPIRE': 'bg-amber-50 text-amber-700 border-amber-200',
    'NO RLIC PASS': 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const labels = { 'VALID RLIC PASS': 'Valid', 'EXPIRED RLIC PASS': 'Expired', 'SOON TO EXPIRE': 'Soon', 'NO RLIC PASS': 'No Pass' };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{labels[status] || status || '—'}</span>;
}

function PidBadge({ data }) {
  const status = computePassStatus(data?.pid_expiry, 'pid', data?.pid_status);
  const styles = {
    'VALID PID PASS': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    'EXPIRED PID PASS': 'bg-red-50 text-red-700 border-red-200',
    'SOON TO EXPIRE': 'bg-amber-50 text-amber-700 border-amber-200',
    'NO PID PASS': 'bg-slate-100 text-slate-600 border-slate-200',
  };
  const labels = { 'VALID PID PASS': 'Valid', 'EXPIRED PID PASS': 'Expired', 'SOON TO EXPIRE': 'Soon', 'NO PID PASS': 'No Pass' };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${styles[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{labels[status] || status || '—'}</span>;
}

function TrainingBadge({ status }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const styles = { DONE: 'bg-emerald-50 text-emerald-700 border-emerald-200', PENDING: 'bg-amber-50 text-amber-700 border-amber-200', 'NOT REQUIRED': 'bg-slate-100 text-slate-600 border-slate-200' };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${styles[status] || 'bg-blue-50 text-blue-700 border-blue-200'}`}>{status}</span>;
}

export default function DeletedPersonnel() {
  const [search, setSearch] = useState('');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: deleted = [], isLoading } = useQuery({
    queryKey: ['deleted-employees'],
    queryFn: () => base44.entities.DeletedEmployee.filter({ recovered: false }, '-deleted_at', 2000),
  });

  const uniqueCompanies = useMemo(() => [...new Set(deleted.map(r => r.company).filter(Boolean))].sort(), [deleted]);
  const uniqueDepts = useMemo(() => [...new Set(deleted.map(r => r.department).filter(Boolean))].sort(), [deleted]);

  const filtered = useMemo(() => deleted.filter(r => {
    const matchesSearch = !search ||
      r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
      r.company?.toLowerCase().includes(search.toLowerCase()) ||
      r.department?.toLowerCase().includes(search.toLowerCase()) ||
      r.deleted_by?.toLowerCase().includes(search.toLowerCase());
    const matchesCompany = companyFilter === 'all' || r.company === companyFilter;
    const matchesDept = departmentFilter === 'all' || r.department === departmentFilter;
    return matchesSearch && matchesCompany && matchesDept;
  }), [deleted, search, companyFilter, departmentFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pagedRows = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page]);

  const recoverMutation = useMutation({
    mutationFn: async (record) => {
      const { employee_data, original_id } = record;
      const existing = await base44.entities.Employee.filter({ is_active: false }, '-created_date', 5000);
      const match = existing.find(e => e.id === original_id);
      if (match) {
        await base44.entities.Employee.update(original_id, { is_active: true });
      } else {
        const { id, created_date, updated_date, _last_updated_by, ...cleanData } = employee_data;
        await base44.entities.Employee.create({ ...cleanData, is_active: true });
      }
      await Promise.all([
        base44.entities.DeletedEmployee.update(record.id, { recovered: true }),
        base44.entities.ActivityLog.create({
          action: 'create', entity_name: 'Employee', entity_id: original_id,
          performed_by: 'system-recovery', record_snapshot: employee_data,
          changed_fields: ['is_active'], record_name: record.employee_name,
        }),
      ]);
    },
    onMutate: async (record) => {
      await queryClient.cancelQueries({ queryKey: ['deleted-employees'] });
      const prev = queryClient.getQueryData(['deleted-employees']);
      queryClient.setQueryData(['deleted-employees'], old => (old || []).filter(r => r.id !== record.id));
      return { prev };
    },
    onError: (_err, _record, ctx) => {
      queryClient.setQueryData(['deleted-employees'], ctx.prev);
      toast({ title: 'Recovery failed', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-employees'] });
      queryClient.invalidateQueries({ queryKey: ['employees-inactive'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Employee recovered successfully' });
    },
  });

  const permanentDeleteMutation = useMutation({
    mutationFn: async (record) => {
      await base44.entities.DeletedEmployee.delete(record.id);
    },
    onMutate: async (record) => {
      await queryClient.cancelQueries({ queryKey: ['deleted-employees'] });
      const prev = queryClient.getQueryData(['deleted-employees']);
      queryClient.setQueryData(['deleted-employees'], old => (old || []).filter(r => r.id !== record.id));
      return { prev };
    },
    onError: (_err, _record, ctx) => {
      queryClient.setQueryData(['deleted-employees'], ctx.prev);
      toast({ title: 'Deletion failed', variant: 'destructive' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-employees'] });
      toast({ title: 'Record permanently deleted', description: 'This record cannot be recovered.' });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Deleted Personnel</h2>
            <p className="text-sm text-muted-foreground">View and recover deleted employee records</p>
          </div>
        </div>
        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
          {deleted.length} deleted record{deleted.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search by name, company, department, or deleted by..." className="pl-9" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
          </div>
          <Select value={companyFilter} onValueChange={v => { setCompanyFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="All Companies" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Companies</SelectItem>
              {uniqueCompanies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={departmentFilter} onValueChange={v => { setDepartmentFilter(v); setPage(0); }}>
            <SelectTrigger><SelectValue placeholder="All Departments" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {uniqueDepts.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="p-4 space-y-2">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
        ) : filtered.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Trash2 className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium">No deleted records found</p>
            <p className="text-sm text-muted-foreground mt-1">Deleted employees will appear here for recovery</p>
          </CardContent>
        ) : (
          <>
            <div className="table-scroll-x">
              <div className="table-scroll-y h-[560px]">
                <Table>
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs bg-muted/50 w-10">Photo</TableHead>
                      <TableHead className="text-xs bg-muted/50">Name</TableHead>
                      <TableHead className="text-xs bg-muted/50">Company</TableHead>
                      <TableHead className="text-xs bg-muted/50">Department</TableHead>
                      <TableHead className="text-xs bg-muted/50">Medical</TableHead>
                      <TableHead className="text-xs bg-muted/50">Gate Pass</TableHead>
                      <TableHead className="text-xs bg-muted/50">Training</TableHead>
                      <TableHead className="text-xs bg-muted/50">PID Status</TableHead>
                      <TableHead className="text-xs bg-muted/50">Deleted Date</TableHead>
                      <TableHead className="text-xs bg-muted/50">Deleted By</TableHead>
                      <TableHead className="text-xs bg-muted/50 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagedRows.map(record => {
                      const d = record.employee_data || {};
                      return (
                        <TableRow key={record.id} className="hover:bg-muted/30">
                          <TableCell className="p-2">
                            <PersonnelAvatar name={record.employee_name} photoUrl={d.photo_url} size={8} />
                          </TableCell>
                          <TableCell className="text-xs font-medium whitespace-nowrap">
                            <div>{record.employee_name}</div>
                            <div className="text-[10px] text-muted-foreground">{d.designation_org_chart || ''}</div>
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{record.company || '—'}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap">{record.department || '—'}</TableCell>
                          <TableCell><MedicalBadge result={d.ftw_result} /></TableCell>
                          <TableCell><GatePassBadge data={d} /></TableCell>
                          <TableCell><TrainingBadge status={d.training_status} /></TableCell>
                          <TableCell><PidBadge data={d} /></TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">
                            {record.deleted_at ? format(new Date(record.deleted_at), 'dd MMM yyyy, HH:mm') : '—'}
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap text-muted-foreground">{record.deleted_by || '—'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => recoverMutation.mutate(record)}
                                disabled={recoverMutation.isPending}
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Recover
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="outline" className="text-xs h-8 text-red-600 border-red-200 hover:bg-red-50 gap-1" disabled={permanentDeleteMutation.isPending}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Permanently Delete Record</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to permanently delete <strong>{record.employee_name}</strong>? This action cannot be undone and the record will no longer be recoverable.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => permanentDeleteMutation.mutate(record)} className="bg-red-600 hover:bg-red-700">
                                      Delete Permanently
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
                Showing <strong>{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)}</strong> of <strong>{filtered.length}</strong> filtered · <strong>{deleted.length}</strong> total deleted
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
          </>
        )}
      </Card>
    </div>
  );
}