import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RotateCcw, Search, Trash2, User } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/components/ui/use-toast';

export default function DeletedPersonnel() {
  const [search, setSearch] = useState('');
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: deleted = [], isLoading } = useQuery({
    queryKey: ['deleted-employees'],
    queryFn: () => base44.entities.DeletedEmployee.filter({ recovered: false }, '-deleted_at', 200),
  });

  const recoverMutation = useMutation({
    mutationFn: async (record) => {
      const { employee_data, original_id } = record;

      // Check if original record exists in inactive pool
      const existing = await base44.entities.Employee.filter({ is_active: false }, '-created_date', 5000);
      const match = existing.find(e => e.id === original_id);

      if (match) {
        // Safe targeted update — only restore is_active, don't overwrite any other fields
        await base44.entities.Employee.update(original_id, { is_active: true });
      } else {
        // Original gone — re-create with clean snapshot data
        const { id, created_date, updated_date, _last_updated_by, ...cleanData } = employee_data;
        await base44.entities.Employee.create({ ...cleanData, is_active: true });
      }

      await Promise.all([
        base44.entities.DeletedEmployee.update(record.id, { recovered: true }),
        base44.entities.ActivityLog.create({
          action: 'create',
          entity_name: 'Employee',
          entity_id: original_id,
          performed_by: 'system-recovery',
          record_snapshot: employee_data,
          changed_fields: ['is_active'],
          record_name: record.employee_name,
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
      toast({ title: 'Employee recovered successfully', description: 'The record has been restored.' });
    },
  });

  const filtered = useMemo(() => deleted.filter(r =>
    r.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.company?.toLowerCase().includes(search.toLowerCase()) ||
    r.department?.toLowerCase().includes(search.toLowerCase()) ||
    r.deleted_by?.toLowerCase().includes(search.toLowerCase())
  ), [deleted, search]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-red-100 rounded-lg">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Deleted Personnel</h1>
          <p className="text-sm text-muted-foreground">View and recover deleted employee records</p>
        </div>
        <Badge variant="outline" className="ml-auto text-red-600 border-red-200 bg-red-50">
          {deleted.length} deleted record{deleted.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, company, department, or deleted by..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">Loading...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Trash2 className="w-12 h-12 text-muted-foreground mb-3 opacity-30" />
            <p className="text-muted-foreground font-medium">No deleted records found</p>
            <p className="text-sm text-muted-foreground mt-1">Deleted employees will appear here for recovery</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Employee</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Company</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Department</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Deleted By</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Deleted At</th>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((record, i) => (
                <tr key={record.id} className={i % 2 === 0 ? 'bg-white' : 'bg-muted/20'}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-3.5 h-3.5 text-red-500" />
                      </div>
                      <div>
                        <div className="font-medium">{record.employee_name}</div>
                        <div className="text-xs text-muted-foreground">{record.employee_data?.designation_org_chart || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{record.company || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.department || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{record.deleted_by || '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {record.deleted_at ? format(new Date(record.deleted_at), 'dd MMM yyyy, HH:mm') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                      onClick={() => recoverMutation.mutate(record)}
                      disabled={recoverMutation.isPending}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Recover
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}