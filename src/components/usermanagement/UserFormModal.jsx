import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { UserPlus, Save, Mail, Link2, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { updateUserRbac, applyPreset } from '@/lib/rbacService';
import { useToast } from '@/components/ui/use-toast';

export default function UserFormModal({ user, currentUser, employees, onClose, onSaved }) {
  const { toast } = useToast();
  const isEdit = !!user?.id;

  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [rbacRole, setRbacRole] = useState('User');
  const [platformRole, setPlatformRole] = useState('user');
  const [personnelId, setPersonnelId] = useState('');
  const [accountStatus, setAccountStatus] = useState('active');
  const [personnelSearch, setPersonnelSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setEmail(user.email || '');
      setFullName(user.full_name || '');
      setRbacRole(user.rbac_role || 'User');
      setPlatformRole(user.role || 'user');
      setPersonnelId(user.personnel_id || '');
      setAccountStatus(user.account_status || 'active');
    }
  }, [user]);

  const filteredEmployees = useMemo(() => {
    if (!personnelSearch) return employees.slice(0, 10);
    const q = personnelSearch.toLowerCase();
    return employees.filter(e =>
      (e.name || '').toLowerCase().includes(q) ||
      (e.qid_no || '').toLowerCase().includes(q) ||
      (e.staff_no || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }, [employees, personnelSearch]);

  const selectedEmployee = employees.find(e => e.id === personnelId);

  const handleInvite = async () => {
    setLoading(true);
    try {
      const platRole = rbacRole === 'Admin' ? 'admin' : 'user';
      await base44.users.inviteUser(email, platRole);
      toast({
        title: 'User invited',
        description: `${email} has been invited as ${rbacRole}. They will appear in the list after they accept and log in. You can then configure their permissions and scope.`,
      });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to invite user', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const updates = {
        rbac_role: rbacRole,
        personnel_id: personnelId || '',
        account_status: accountStatus,
      };
      // Only update platform role if changing from user to admin or vice versa
      const newPlatformRole = rbacRole === 'Admin' ? 'admin' : 'user';
      if (newPlatformRole !== platformRole) {
        updates.role = newPlatformRole;
      }

      await updateUserRbac(user.id, updates, currentUser, {
        rbac_role: user.rbac_role,
        account_status: user.account_status,
        email: user.email,
      });

      // If role changed and it's a preset role, apply the preset permissions
      if (rbacRole !== user.rbac_role && rbacRole !== 'Custom') {
        await applyPreset(user.id, user.email, rbacRole, currentUser);
      }

      toast({ title: 'User updated', description: `${fullName || email} updated successfully` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to update user', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEdit ? <><Shield className="w-5 h-5 text-primary" /> Edit User</> : <><UserPlus className="w-5 h-5 text-primary" /> Add User</>}
          </DialogTitle>
        </DialogHeader>

        {!isEdit && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
            New users are invited via email. After they accept the invitation and log in,
            they will appear in this list — then you can configure their permissions and access scope.
          </div>
        )}

        <div className="space-y-4">
          {/* Email */}
          <div>
            <Label className="text-xs">Email Address</Label>
            <div className="relative mt-1">
              <Mail className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="user@example.com"
                disabled={isEdit}
              />
            </div>
          </div>

          {/* RBAC Role */}
          <div>
            <Label className="text-xs">RBAC Role</Label>
            <Select value={rbacRole} onValueChange={setRbacRole}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin — Full system access</SelectItem>
                <SelectItem value="Manager">Manager — Module access (configurable)</SelectItem>
                <SelectItem value="Supervisor">Supervisor — Operational access (configurable)</SelectItem>
                <SelectItem value="User">User — Basic/restricted access</SelectItem>
                <SelectItem value="Custom">Custom — Permissions set individually</SelectItem>
              </SelectContent>
            </Select>
            {isEdit && rbacRole !== 'Custom' && rbacRole !== user?.rbac_role && (
              <p className="text-xs text-amber-600 mt-1">
                Saving will apply the {rbacRole} preset permissions (overwrites current permissions).
              </p>
            )}
          </div>

          {/* Personnel Link */}
          {isEdit && (
            <div>
              <Label className="text-xs flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5" /> Link to Personnel Record (Employee)
              </Label>
              {selectedEmployee ? (
                <div className="flex items-center justify-between p-2 mt-1 border rounded-lg bg-muted/50">
                  <div className="text-xs">
                    <span className="font-medium">{selectedEmployee.name}</span>
                    <span className="text-muted-foreground ml-2">{selectedEmployee.company} · {selectedEmployee.department || '—'}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setPersonnelId('')}>Unlink</Button>
                </div>
              ) : (
                <>
                  <Input
                    className="mt-1"
                    placeholder="Search by name, QID, or staff no..."
                    value={personnelSearch}
                    onChange={e => setPersonnelSearch(e.target.value)}
                  />
                  {personnelSearch && (
                    <div className="mt-1 border rounded-lg max-h-48 overflow-y-auto">
                      {filteredEmployees.map(emp => (
                        <button
                          key={emp.id}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-muted border-b last:border-0"
                          onClick={() => { setPersonnelId(emp.id); setPersonnelSearch(''); }}
                        >
                          <span className="font-medium">{emp.name}</span>
                          <span className="text-muted-foreground ml-2">{emp.company} · {emp.department || '—'} · {emp.qid_no || '—'}</span>
                        </button>
                      ))}
                      {filteredEmployees.length === 0 && (
                        <div className="px-3 py-2 text-xs text-muted-foreground">No matches found</div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Account Status */}
          {isEdit && (
            <div>
              <Label className="text-xs">Account Status</Label>
              <Select value={accountStatus} onValueChange={setAccountStatus}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active — Full access</SelectItem>
                  <SelectItem value="inactive">Inactive — No access (preserves audit history)</SelectItem>
                  <SelectItem value="locked">Locked — No access (temporarily suspended)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          {isEdit ? (
            <Button onClick={handleSave} disabled={loading}>
              <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          ) : (
            <Button onClick={handleInvite} disabled={loading || !email}>
              <Mail className="w-4 h-4" /> {loading ? 'Inviting...' : 'Send Invitation'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}