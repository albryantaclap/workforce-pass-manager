import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { Shield, RotateCcw, Save, Lock } from 'lucide-react';
import { PERMISSION_CATALOG, ROLE_PRESETS, getAllPermissionKeys, getPresetPermissionKeys } from '@/lib/permissionCatalog';
import { saveUserPermissions, checkLockoutProtection } from '@/lib/rbacService';
import { useToast } from '@/components/ui/use-toast';

export default function PermissionsModal({ user, currentUser, onClose, onSaved }) {
  const { toast } = useToast();
  const [selectedKeys, setSelectedKeys] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState('');

  // Initialize from user's existing permissions (passed in via onSaved data)
  // We expect `user.existingPermissions` to be an array of permission_key strings
  const existingKeys = useMemo(() => {
    return new Set((user?.existingPermissions || []).map(p => p.permission_key));
  }, [user]);

  React.useEffect(() => {
    setSelectedKeys(new Set(existingKeys));
  }, [existingKeys]);

  const togglePermission = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleResource = (moduleKey, resourceKey, allActionKeys) => {
    const resourceKeys = allActionKeys.map(a => `${moduleKey}.${resourceKey}.${a}`);
    const allSelected = resourceKeys.every(k => selectedKeys.has(k));
    setSelectedKeys(prev => {
      const next = new Set(prev);
      if (allSelected) {
        resourceKeys.forEach(k => next.delete(k));
      } else {
        resourceKeys.forEach(k => next.add(k));
      }
      return next;
    });
  };

  const applyPreset = (presetName) => {
    setPreset(presetName);
    const keys = getPresetPermissionKeys(presetName);
    setSelectedKeys(new Set(keys));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Lockout protection: if removing user_management.manage from this user,
      // ensure at least one other active admin retains it.
      const hasUserMgmt = selectedKeys.has('system.user_management.manage');
      const hadUserMgmt = existingKeys.has('system.user_management.manage');
      if (hadUserMgmt && !hasUserMgmt) {
        const safe = await checkLockoutProtection(user.id);
        if (!safe) {
          toast({
            title: 'Cannot remove this permission',
            description: 'This is the last active administrator with User Management access. Grant User Management permission to another admin first.',
            variant: 'destructive',
          });
          setLoading(false);
          return;
        }
      }

      await saveUserPermissions(user.id, user.email, Array.from(selectedKeys), currentUser);
      toast({ title: 'Permissions saved', description: `Updated permissions for ${user.email}` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to save permissions', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            Edit Permissions — {user?.full_name || user?.email}
          </DialogTitle>
        </DialogHeader>

        {/* Preset selector */}
        <div className="flex items-end gap-3 p-3 bg-muted/50 rounded-lg">
          <div className="flex-1">
            <Label className="text-xs text-muted-foreground">Permission Preset</Label>
            <Select value={preset} onValueChange={applyPreset}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select a preset to auto-fill..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Admin">Admin (Full Access)</SelectItem>
                <SelectItem value="Manager">Manager</SelectItem>
                <SelectItem value="Supervisor">Supervisor</SelectItem>
                <SelectItem value="User">User (Basic)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => { setPreset(''); setSelectedKeys(new Set(existingKeys)); }}>
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </Button>
        </div>

        {/* Permission grid */}
        <div className="space-y-4">
          {PERMISSION_CATALOG.map((mod) => (
            <div key={mod.key} className="border rounded-lg overflow-hidden">
              <div className="bg-slate-50 px-3 py-2 font-semibold text-xs uppercase tracking-wide text-slate-600">
                {mod.group}
              </div>
              <div className="divide-y">
                {mod.resources.map((res) => {
                  const allActionKeys = res.actions;
                  const resourcePermKeys = allActionKeys.map(a => `${mod.key}.${res.key}.${a.key}`);
                  const allSelected = resourcePermKeys.every(k => selectedKeys.has(k));
                  const someSelected = resourcePermKeys.some(k => selectedKeys.has(k));

                  return (
                    <div key={res.key} className="flex items-start gap-3 px-3 py-2.5">
                      <div className="flex items-center gap-2 pt-0.5 min-w-[160px]">
                        <Checkbox
                          checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                          onCheckedChange={() => toggleResource(mod.key, res.key, allActionKeys)}
                        />
                        <span className="text-sm font-medium">{res.label}</span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 flex-1">
                        {res.actions.map((act) => {
                          const key = `${mod.key}.${res.key}.${act.key}`;
                          return (
                            <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <Checkbox
                                checked={selectedKeys.has(key)}
                                onCheckedChange={() => togglePermission(key)}
                              />
                              <span className="text-muted-foreground">{act.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Permissions'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}