import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, UserCheck, UserX } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { formatDate } from '@/utils/constants';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';

export default function InactivePersonnel() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => base44.entities.Employee.list('-created_date', 2000),
  });

  const inactive = useMemo(() =>
    employees.filter(e => e.is_active === false)
      .filter(e => !search ||
        e.name?.toLowerCase().includes(search.toLowerCase()) ||
        e.qid_no?.includes(search) ||
        e.company?.toLowerCase().includes(search.toLowerCase())
      ),
    [employees, search]
  );

  const reactivateMutation = useMutation({
    mutationFn: (id) => base44.entities.Employee.update(id, { is_active: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      toast({ title: 'Personnel reactivated' });
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <UserX className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Inactive Personnel</h2>
            <p className="text-sm text-muted-foreground">{inactive.length} inactive records</p>
          </div>
        </div>
      </div>

      <Card className="p-4">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Name, QID, Company..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <div className="table-scroll-y h-[560px]">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs bg-muted/50">SL</TableHead>
                  <TableHead className="text-xs bg-muted/50">Name</TableHead>
                  <TableHead className="text-xs bg-muted/50">Company</TableHead>
                  <TableHead className="text-xs bg-muted/50">Designation</TableHead>
                  <TableHead className="text-xs bg-muted/50">Department</TableHead>
                  <TableHead className="text-xs bg-muted/50">Nationality</TableHead>
                  <TableHead className="text-xs bg-muted/50">QID No</TableHead>
                  <TableHead className="text-xs bg-muted/50">QID Expiry</TableHead>
                  <TableHead className="text-xs bg-muted/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array(5).fill(0).map((_, i) => (
                    <TableRow key={i}>{Array(9).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                  ))
                ) : inactive.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-14">
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
                      <TableCell className="text-xs font-mono whitespace-nowrap">{emp.qid_no || '—'}</TableCell>
                      <TableCell className="text-xs whitespace-nowrap">{formatDate(emp.qid_expiry)}</TableCell>
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
                                  Reactivate <strong>{emp.name}</strong>? They will appear in all active lists.
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
          Showing <strong>{inactive.length}</strong> inactive records
        </div>
      </Card>
    </div>
  );
}