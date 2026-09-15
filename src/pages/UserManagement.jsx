import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import {
  fetchAllUsers, fetchAllPermissions, fetchAllScopes, fetchAuditLogs,
  updateUserRbac, checkLockoutProtection,
  getPermissionsForUser, getScopeForUser,
} from '@/lib/rbacService';
import {
  Users, Shield, Globe, UserPlus, Search, Pencil, KeyRound, Power, History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/components/ui/use-toast';
import UserFormModal from '@/components/usermanagement/UserFormModal';
import PermissionsModal from '@/components/usermanagement/PermissionsModal';
import AccessScopeModal from '@/components/usermanagement/AccessScopeModal';
import AccessRequestsTab from '@/components/usermanagement/AccessRequestsTab';

const STATUS_STYLES = {
  active: 'bg-emerald-100 text-emerald-700',
  inactive: 'bg-slate-100 text-slate-500',
  locked: 'bg-red-100 text-red-700',
};

function scopeSummary(scope) {
  if (!scope || scope.scope_mode === 'all') return 'All Personnel';
  if (scope.scope_mode === 'assigned_team') return 'Assigned Team';
  const parts = [];
  if (scope.companies?.length) parts.push(`${scope.companies.length} companies`);
  if (scope.departments?.length) parts.push(`${scope.departments.length} depts`);
  if (scope.locations?.length) parts.push(`${scope.locations.length} locations`);
  return parts.join(' · ') || 'Custom';
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [companyFilter, setCompanyFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modal, setModal] = useState(null); // { type: 'form'|'perms'|'scope', user }

  // Fetch all data
  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['rbac-users'],
    queryFn: fetchAllUsers,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-all'],
    queryFn: async () => {
      const all = await base44.entities.Employee.list('-created_date', 100000);
      return all.filter(e => !e.is_deleted && e.personnel_status !== 'Demobilized');
    },
  });
  const { data: allPermissions = [] } = useQuery({
    queryKey: ['rbac-all-permissions'],
    queryFn: fetchAllPermissions,
  });
  const { data: allScopes = [] } = useQuery({
    queryKey: ['rbac-all-scopes'],
    queryFn: fetchAllScopes,
  });
  const { data: lookups = [] } = useQuery({
    queryKey: ['lookups-locations'],
    queryFn: async () => {
      const all = await base44.entities.Lookup.list('-created_date', 10000);
      return all.filter(l =>
        (l.type === 'work_location' || l.type === 'location') && !l.is_deleted
      );
    },
  });
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['rbac-audit-logs'],
    queryFn: fetchAuditLogs,
  });

  const locations = useMemo(() =>
    [...new Set(lookups.map(l => l.value))].sort(),
  [lookups]);

  const employeeMap = useMemo(() => {
    const m = {};
    for (const e of employees) m[e.id] = e;
    return m;
  }, [employees]);

  const companies = useMemo(() =>
    [...new Set(employees.map(e => e.company).filter(Boolean))].sort(),
  [employees]);
  const departments = useMemo(() =>
    [...new Set(employees.map(e => e.department).filter(Boolean))].sort(),
  [employees]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      if (search) {
        const q = search.toLowerCase();
        const emp = employeeMap[u.personnel_id];
        const name = (u.full_name || emp?.name || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q)) return false;
      }
      if (roleFilter !== 'all' && (u.rbac_role || 'User') !== roleFilter) return false;
      if (statusFilter !== 'all' && (u.account_status || 'active') !== statusFilter) return false;
      if (companyFilter !== 'all') {
        const emp = employeeMap[u.personnel_id];
        if (!emp || emp.company !== companyFilter) return false;
      }
      if (deptFilter !== 'all') {
        const emp = employeeMap[u.personnel_id];
        if (!emp || emp.department !== deptFilter) return false;
      }
      return true;
    });
  }, [users, search, roleFilter, companyFilter, deptFilter, statusFilter, employeeMap]);

  const refreshAll = () => {
    queryClient.invalidateQueries(['rbac-users']);
    queryClient.invalidateQueries(['rbac-all-permissions']);
    queryClient.invalidateQueries(['rbac-all-scopes']);
    queryClient.invalidateQueries(['rbac-audit-logs']);
  };

  const handleToggleStatus = async (u) => {
    const newStatus = u.account_status === 'active' ? 'inactive' : 'active';
    // Lockout protection
    if (newStatus === 'inactive' && (u.rbac_role === 'Admin' || u.role === 'admin' || u.role === 'owner')) {
      const userPerms = allPermissions.filter(p => p.user_id === u.id && p.allowed);
      const hasUserMgmt = userPerms.some(p => p.permission_key === 'system.user_management.manage');
      if (hasUserMgmt || u.role === 'owner' || u.collaborator_role === 'owner') {
        const safe = await checkLockoutProtection(u.id);
        if (!safe) {
          toast({
            title: 'Cannot deactivate',
            description: 'This is the last active administrator with User Management access. Assign another admin first.',
            variant: 'destructive',
          });
          return;
        }
      }
    }
    try {
      await updateUserRbac(u.id, { account_status: newStatus }, currentUser, {
        account_status: u.account_status,
        email: u.email,
        rbac_role: u.rbac_role,
      });
      toast({ title: `User ${newStatus === 'active' ? 'activated' : 'deactivated'}`, description: u.email });
      refreshAll();
    } catch (e) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    }
  };

  const handleResetPassword = (u) => {
    toast({
      title: 'Password Reset',
      description: 'Password resets are handled through the login page "Forgot Password" flow. The user can reset their own password from the login screen.',
    });
  };

  const openModal = (type, user = null) => setModal({ type, user });
  const closeModal = () => setModal(null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="w-6 h-6 text-primary" /> User Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage system users, roles, granular permissions, and access scope.
          </p>
        </div>
        <Button onClick={() => openModal('form')}>
          <UserPlus className="w-4 h-4" /> Add User
        </Button>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">Users ({filteredUsers.length})</TabsTrigger>
          <TabsTrigger value="requests">Access Requests</TabsTrigger>
          <TabsTrigger value="audit">Audit Log</TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Search by name or email..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Roles</SelectItem>
                <SelectItem value="Admin">Admin</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Supervisor">Supervisor</SelectItem>
                <SelectItem value="User">User</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Select value={companyFilter} onValueChange={setCompanyFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Company" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Companies</SelectItem>
                {companies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={deptFilter} onValueChange={setDeptFilter}>
              <SelectTrigger className="w-[140px]"><SelectValue placeholder="Dept" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Depts</SelectItem>
                {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[120px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="locked">Locked</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="border rounded-lg table-scroll-x">
            <Table className="table-list-view">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-muted/50">Name</TableHead>
                  <TableHead className="bg-muted/50">Email</TableHead>
                  <TableHead className="bg-muted/50">Employee ID</TableHead>
                  <TableHead className="bg-muted/50">Company</TableHead>
                  <TableHead className="bg-muted/50">Dept</TableHead>
                  <TableHead className="bg-muted/50">Role</TableHead>
                  <TableHead className="bg-muted/50">Access Scope</TableHead>
                  <TableHead className="bg-muted/50">Status</TableHead>
                  <TableHead className="bg-muted/50 text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Loading users...</TableCell></TableRow>
                ) : filteredUsers.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No users found</TableCell></TableRow>
                ) : filteredUsers.map(u => {
                  const emp = employeeMap[u.personnel_id];
                  const userPerms = getPermissionsForUser(allPermissions, u.id);
                  const userScope = getScopeForUser(allScopes, u.id);
                  const status = u.account_status || 'active';
                  const isSelf = u.id === currentUser?.id;
                  const isBuilder = u.collaborator_role === 'editor' || u.collaborator_role === 'owner';

                  return (
                    <TableRow key={u.id} className="hover:bg-muted/30">
                      <TableCell className="font-medium">
                        {u.full_name || emp?.name || '—'}
                        {isSelf && <span className="text-xs text-muted-foreground ml-1">(You)</span>}
                        {isBuilder && <Badge variant="outline" className="ml-1 text-[9px]">Builder</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{u.email || '—'}</TableCell>
                      <TableCell className="text-xs">{emp?.staff_no || emp?.qid_no || '—'}</TableCell>
                      <TableCell className="text-xs">{emp?.company || '—'}</TableCell>
                      <TableCell className="text-xs">{emp?.department || '—'}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">{u.rbac_role || (isBuilder ? 'Admin' : 'User')}</Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{scopeSummary(userScope)}</TableCell>
                      <TableCell>
                        <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${STATUS_STYLES[status] || STATUS_STYLES.active}`}>
                          {status}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openModal('form', u)} title="Edit">
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openModal('perms', { ...u, existingPermissions: userPerms })} title="Permissions" disabled={isBuilder}>
                            <Shield className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openModal('scope', u)} title="Access Scope" disabled={isBuilder}>
                            <Globe className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleResetPassword(u)} title="Reset Password">
                            <KeyRound className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7"
                            onClick={() => handleToggleStatus(u)}
                            title={status === 'active' ? 'Deactivate' : 'Activate'}
                            disabled={isBuilder || isSelf}
                          >
                            <Power className={`w-3.5 h-3.5 ${status === 'active' ? 'text-emerald-600' : 'text-slate-400'}`} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Access Requests Tab */}
        <TabsContent value="requests">
          <AccessRequestsTab
            users={users}
            employees={employees}
            currentUser={currentUser}
            locations={locations}
            onRefresh={refreshAll}
          />
        </TabsContent>

        {/* Audit Log Tab */}
        <TabsContent value="audit">
          <div className="border rounded-lg table-scroll-x">
            <Table className="table-list-view">
              <TableHeader>
                <TableRow>
                  <TableHead className="bg-muted/50">Date & Time</TableHead>
                  <TableHead className="bg-muted/50">Performed By</TableHead>
                  <TableHead className="bg-muted/50">Affected User</TableHead>
                  <TableHead className="bg-muted/50">Action</TableHead>
                  <TableHead className="bg-muted/50">Field</TableHead>
                  <TableHead className="bg-muted/50">Old Value</TableHead>
                  <TableHead className="bg-muted/50">New Value</TableHead>
                  <TableHead className="bg-muted/50">Description</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLogs.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No audit entries yet
                  </TableCell></TableRow>
                ) : auditLogs.map(log => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs whitespace-nowrap">
                      {log.created_date ? new Date(log.created_date).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </TableCell>
                    <TableCell className="text-xs">{log.performed_by_name || log.performed_by || '—'}</TableCell>
                    <TableCell className="text-xs">{log.affected_user_email || '—'}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[9px]">{log.action_type?.replace(/_/g, ' ')}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{log.field_changed || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={log.old_value}>{log.old_value || '—'}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={log.new_value}>{log.new_value || '—'}</TableCell>
                    <TableCell className="text-xs max-w-[250px]">{log.description || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      {modal?.type === 'form' && (
        <UserFormModal
          user={modal.user}
          currentUser={currentUser}
          employees={employees}
          onClose={closeModal}
          onSaved={refreshAll}
        />
      )}
      {modal?.type === 'perms' && (
        <PermissionsModal
          user={modal.user}
          currentUser={currentUser}
          onClose={closeModal}
          onSaved={refreshAll}
        />
      )}
      {modal?.type === 'scope' && (
        <AccessScopeModal
          user={modal.user}
          currentUser={currentUser}
          existingScope={getScopeForUser(allScopes, modal.user.id)}
          locations={locations}
          onClose={closeModal}
          onSaved={refreshAll}
        />
      )}
    </div>
  );
}