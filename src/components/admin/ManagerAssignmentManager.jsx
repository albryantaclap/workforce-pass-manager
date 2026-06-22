import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Users, UserCheck, Search, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';

export default function ManagerAssignmentManager() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [bulkManagerId, setBulkManagerId] = useState('');
  const [bulkBy, setBulkBy] = useState('company');
  const [bulkValue, setBulkValue] = useState('');
  const [bulking, setBulking] = useState(false);

  // All active employees
  const { data: employees = [], isLoading } = useQuery({
    queryKey: ['employees-active'],
    queryFn: () => base44.entities.Employee.filter({ is_active: true }, 'name', 10000),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Employee.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees-active'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  // Managers = active employees with is_manager = true
  const managers = useMemo(() => employees.filter(e => e.is_manager), [employees]);

  // Search filtered employees (non-managers)
  const filteredEmps = useMemo(() => {
    const q = search.trim().toLowerCase();
    return employees.filter(e => {
      if (!q) return true;
      return (
        e.name?.toLowerCase().includes(q) ||
        e.qid_no?.toLowerCase().includes(q) ||
        e.company?.toLowerCase().includes(q) ||
        e.designation_org_chart?.toLowerCase().includes(q) ||
        e.position_application?.toLowerCase().includes(q)
      );
    });
  }, [employees, search]);

  const handleToggleManager = (emp) => {
    if (!emp.is_manager && emp.assigned_manager_id === emp.id) {
      toast.error('Cannot assign employee as their own manager.');
      return;
    }
    updateMutation.mutate({
      id: emp.id,
      data: { is_manager: !emp.is_manager },
    }, {
      onSuccess: () => toast.success(emp.is_manager ? `${emp.name} removed as manager` : `${emp.name} set as manager`),
    });
  };

  const handleAssignManager = (emp, managerId) => {
    if (managerId === emp.id) {
      toast.error('Cannot assign employee as their own manager.');
      return;
    }
    const mgr = managers.find(m => m.id === managerId);
    if (managerId && !mgr?.is_active) {
      toast.error('Cannot assign an inactive person as manager.');
      return;
    }
    updateMutation.mutate({
      id: emp.id,
      data: {
        assigned_manager_id: managerId || null,
        assigned_manager_name: mgr ? mgr.name : null,
      },
    });
  };

  const handleBulkAssign = async () => {
    if (!bulkManagerId || !bulkValue) {
      toast.error('Select a manager and a value to bulk assign.');
      return;
    }
    const mgr = managers.find(m => m.id === bulkManagerId);
    if (!mgr) return;

    const targets = employees.filter(e => {
      if (bulkBy === 'company') return e.company === bulkValue;
      if (bulkBy === 'department') return e.department === bulkValue;
      if (bulkBy === 'position') return e.designation_org_chart === bulkValue || e.position_application === bulkValue;
      return false;
    }).filter(e => e.id !== bulkManagerId);

    if (targets.length === 0) {
      toast.error('No matching employees found.');
      return;
    }

    setBulking(true);
    await Promise.all(targets.map(e =>
      base44.entities.Employee.update(e.id, {
        assigned_manager_id: bulkManagerId,
        assigned_manager_name: mgr.name,
      })
    ));
    queryClient.invalidateQueries({ queryKey: ['employees-active'] });
    queryClient.invalidateQueries({ queryKey: ['employees'] });
    toast.success(`Assigned ${mgr.name} to ${targets.length} employees`);
    setBulking(false);
    setBulkValue('');
    setBulkManagerId('');
  };

  // Unique values for bulk dropdowns
  const companies = useMemo(() => [...new Set(employees.map(e => e.company).filter(Boolean))].sort(), [employees]);
  const departments = useMemo(() => [...new Set(employees.map(e => e.department).filter(Boolean))].sort(), [employees]);
  const positions = useMemo(() => [...new Set([...employees.map(e => e.designation_org_chart), ...employees.map(e => e.position_application)].filter(Boolean))].sort(), [employees]);
  const bulkOptions = bulkBy === 'company' ? companies : bulkBy === 'department' ? departments : positions;

  // Manager summary: count employees per manager
  const managerSummary = useMemo(() => managers.map(m => ({
    ...m,
    count: employees.filter(e => e.assigned_manager_id === m.id).length,
  })), [managers, employees]);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="assign">
        <TabsList>
          <TabsTrigger value="assign"><UserCheck className="w-4 h-4 mr-2" />Assign Managers</TabsTrigger>
          <TabsTrigger value="bulk"><CheckSquare className="w-4 h-4 mr-2" />Bulk Assign</TabsTrigger>
          <TabsTrigger value="managers"><Users className="w-4 h-4 mr-2" />Manager List</TabsTrigger>
        </TabsList>

        {/* ── Tab 1: Individual Assignment ── */}
        <TabsContent value="assign" className="mt-4 space-y-4">
          <Card className="p-4">
            <p className="text-xs text-muted-foreground mb-3">
              Toggle <strong>Is Manager</strong> to make a person selectable as a manager.
              Then use the <strong>Assigned Manager</strong> dropdown to assign each employee.
            </p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search by name, QID, company, position..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </Card>
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                <Table className="table-list-view">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="bg-muted/50">
                      <TableHead className="text-xs bg-muted/50">Name</TableHead>
                      <TableHead className="text-xs bg-muted/50">Company</TableHead>
                      <TableHead className="text-xs bg-muted/50">Designation</TableHead>
                      <TableHead className="text-xs bg-muted/50 text-center">Is Manager</TableHead>
                      <TableHead className="text-xs bg-muted/50">Assigned Manager</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      Array(6).fill(0).map((_, i) => (
                        <TableRow key={i}>{Array(5).fill(0).map((_, j) => <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>)}</TableRow>
                      ))
                    ) : filteredEmps.map(emp => {
                      const currentMgr = emp.assigned_manager_id
                        ? managers.find(m => m.id === emp.assigned_manager_id)
                        : null;
                      const isInactiveMgr = emp.assigned_manager_id && !currentMgr;
                      return (
                        <TableRow key={emp.id} className="hover:bg-muted/30">
                          <TableCell className="text-xs font-medium">{emp.name}</TableCell>
                          <TableCell className="text-xs">{emp.company}</TableCell>
                          <TableCell className="text-xs">{emp.designation_org_chart || emp.position_application || '—'}</TableCell>
                          <TableCell className="text-center">
                            <button
                              onClick={() => handleToggleManager(emp)}
                              className={`text-xs px-2 py-0.5 rounded-full border font-semibold transition-colors ${
                                emp.is_manager
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                  : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              {emp.is_manager ? 'Yes' : 'No'}
                            </button>
                          </TableCell>
                          <TableCell>
                            {isInactiveMgr && (
                              <p className="text-xs text-amber-600 mb-1">⚠ Assigned manager is now inactive</p>
                            )}
                            <Select
                              value={emp.assigned_manager_id || ''}
                              onValueChange={(val) => handleAssignManager(emp, val === '__none__' ? '' : val)}
                            >
                              <SelectTrigger className="h-7 text-xs w-48">
                                <SelectValue placeholder="Unassigned" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="__none__">— Unassigned —</SelectItem>
                                {managers.filter(m => m.id !== emp.id).map(m => (
                                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
            <div className="px-4 py-2 border-t bg-muted/30">
              <span className="text-xs text-muted-foreground"><strong>{filteredEmps.length}</strong> personnel shown</span>
            </div>
          </Card>
        </TabsContent>

        {/* ── Tab 2: Bulk Assign ── */}
        <TabsContent value="bulk" className="mt-4">
          <Card className="p-6 space-y-4">
            <h3 className="text-sm font-semibold">Bulk Assign Manager</h3>
            <p className="text-xs text-muted-foreground">Assign a manager to all employees matching a company, department, or position.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              <div>
                <p className="text-xs font-medium mb-1">Manager</p>
                <Select value={bulkManagerId} onValueChange={setBulkManagerId}>
                  <SelectTrigger><SelectValue placeholder="Select manager..." /></SelectTrigger>
                  <SelectContent>
                    {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Bulk By</p>
                <Select value={bulkBy} onValueChange={v => { setBulkBy(v); setBulkValue(''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="company">Company</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="position">Position / Designation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <p className="text-xs font-medium mb-1">Value</p>
                <Select value={bulkValue} onValueChange={setBulkValue}>
                  <SelectTrigger><SelectValue placeholder={`Select ${bulkBy}...`} /></SelectTrigger>
                  <SelectContent>
                    {bulkOptions.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleBulkAssign} disabled={bulking || !bulkManagerId || !bulkValue}>
                <Plus className="w-4 h-4 mr-2" />
                {bulking ? 'Assigning...' : 'Bulk Assign'}
              </Button>
            </div>
            {bulkManagerId && bulkValue && (
              <p className="text-xs text-muted-foreground">
                Will assign <strong>{managers.find(m => m.id === bulkManagerId)?.name}</strong> to{' '}
                <strong>{employees.filter(e => {
                  if (bulkBy === 'company') return e.company === bulkValue;
                  if (bulkBy === 'department') return e.department === bulkValue;
                  return e.designation_org_chart === bulkValue || e.position_application === bulkValue;
                }).filter(e => e.id !== bulkManagerId).length}</strong> employees
              </p>
            )}
          </Card>
        </TabsContent>

        {/* ── Tab 3: Manager Overview ── */}
        <TabsContent value="managers" className="mt-4">
          <Card className="overflow-hidden">
            <CardHeader className="pb-3"><CardTitle className="text-sm">Managers & Employee Count</CardTitle></CardHeader>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Name</TableHead>
                  <TableHead className="text-xs">Company</TableHead>
                  <TableHead className="text-xs">Designation</TableHead>
                  <TableHead className="text-xs text-center">Employees Assigned</TableHead>
                  <TableHead className="text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {managerSummary.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-sm">No managers set yet. Go to "Assign Managers" tab and toggle Is Manager = Yes.</TableCell></TableRow>
                ) : managerSummary.map(mgr => (
                  <TableRow key={mgr.id}>
                    <TableCell className="text-sm font-medium">{mgr.name}</TableCell>
                    <TableCell className="text-xs">{mgr.company}</TableCell>
                    <TableCell className="text-xs">{mgr.designation_org_chart || mgr.position_application || '—'}</TableCell>
                    <TableCell className="text-center">
                      <span className="text-sm font-bold text-primary">{mgr.count}</span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={() => handleToggleManager(mgr)}
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove as Manager
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}