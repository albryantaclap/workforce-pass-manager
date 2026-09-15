import React, { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from '@/components/ui/select';
import { ShieldCheck, Globe, Users, Layers, Building2, MapPin, ChevronDown, ChevronRight, Save } from 'lucide-react';
import { PERMISSION_CATALOG, getPresetPermissionKeys, getAllPermissionKeys } from '@/lib/permissionCatalog';
import { approveUserAccess } from '@/lib/rbacService';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

const COMPANIES = [
  'GSO QATAR', 'ITELLIGENT', 'ANION', 'SEA QUEEN', 'LMV E AND I', 'METAL WORLD',
  'ASMA', 'FIT', 'SPRAY CON', 'EMKAN', 'ENERTEC', 'CRYSTAL', 'MEGATRONICS (GSO)',
  'ENERSERVE (GSO)', 'ENERTEC (GSO)', 'NTC (GSO)', 'MIR (GSO)', 'SWAN GLOBAL (GSO)',
  'SIGEL (GSO)', 'AL-RAMSHA (GSO)', 'ALTHAF (GSO)', 'ZEAL-IT',
];
const DEPARTMENTS = ['Electrical', 'Mechanical', 'Civil', 'Services'];

export default function ApproveRequestModal({ user, currentUser, locations, onClose, onSaved }) {
  const { toast } = useToast();
  const [rbacRole, setRbacRole] = useState('User');
  const [scopeMode, setScopeMode] = useState('all');
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locs, setLocs] = useState([]);
  const [showPerms, setShowPerms] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState(new Set(getPresetPermissionKeys('User')));
  const [loading, setLoading] = useState(false);

  const emp = user?._employee;

  const handleRoleChange = (role) => {
    setRbacRole(role);
    setSelectedKeys(new Set(getPresetPermissionKeys(role)));
  };

  const toggleArrayItem = (arr, setArr, val) => {
    setArr(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val]);
  };

  const togglePermission = (key) => {
    setSelectedKeys(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleResource = (modKey, resKey, actions) => {
    const keys = actions.map(a => `${modKey}.${resKey}.${a.key}`);
    const allSel = keys.every(k => selectedKeys.has(k));
    setSelectedKeys(prev => {
      const next = new Set(prev);
      allSel ? keys.forEach(k => next.delete(k)) : keys.forEach(k => next.add(k));
      return next;
    });
  };

  const handleApprove = async () => {
    setLoading(true);
    try {
      const scopeData = {
        scope_mode: scopeMode,
        companies: scopeMode === 'all' ? [] : companies,
        departments: scopeMode === 'all' ? [] : departments,
        locations: scopeMode === 'all' ? [] : locs,
        assigned_team_only: scopeMode === 'assigned_team',
      };
      await approveUserAccess(user.id, user, {
        rbacRole,
        scopeData,
        permissionKeys: Array.from(selectedKeys),
      }, currentUser);
      toast({ title: 'Access granted', description: `${user.email} can now access the system as ${rbacRole}.` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to approve', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" /> Approve Access Request
          </DialogTitle>
        </DialogHeader>

        {/* User info */}
        <div className="p-3 bg-muted/50 rounded-lg space-y-1">
          <p className="text-sm font-medium">{user?.full_name || emp?.name || '—'}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          {emp && (
            <p className="text-xs text-muted-foreground">
              {emp.company} · {emp.department || '—'} · {emp.designation_org_chart || emp.position_application || '—'}
            </p>
          )}
        </div>

        {/* Role */}
        <div>
          <Label className="text-xs font-semibold">Role</Label>
          <Select value={rbacRole} onValueChange={handleRoleChange}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Admin">Admin — Full system access</SelectItem>
              <SelectItem value="Manager">Manager — Module access (configurable)</SelectItem>
              <SelectItem value="Supervisor">Supervisor — Operational access</SelectItem>
              <SelectItem value="User">User — Basic/restricted access</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            The {rbacRole} preset permissions will be applied. You can customize below.
          </p>
        </div>

        {/* Access Scope */}
        <div>
          <Label className="text-xs font-semibold mb-2 block">Access Scope</Label>
          <RadioGroup value={scopeMode} onValueChange={setScopeMode} className="space-y-2">
            <label className="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="all" />
              <span className="text-sm flex items-center gap-1.5"><Globe className="w-4 h-4" /> All Personnel</span>
            </label>
            <label className="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="assigned_team" />
              <span className="text-sm flex items-center gap-1.5"><Users className="w-4 h-4" /> Assigned Team Only</span>
            </label>
            <label className="flex items-center gap-3 p-2.5 border rounded-lg cursor-pointer hover:bg-muted/50">
              <RadioGroupItem value="custom" />
              <span className="text-sm flex items-center gap-1.5"><Layers className="w-4 h-4" /> Custom (Company / Dept / Location)</span>
            </label>
          </RadioGroup>
          {scopeMode === 'custom' && (
            <div className="space-y-3 mt-2 pl-2">
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1.5"><Building2 className="w-3.5 h-3.5" /> Companies</Label>
                <div className="grid grid-cols-2 gap-1.5 max-h-28 overflow-y-auto p-2 border rounded-lg">
                  {COMPANIES.map(c => (
                    <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={companies.includes(c)} onCheckedChange={() => toggleArrayItem(companies, setCompanies, c)} />
                      {c}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1.5"><Layers className="w-3.5 h-3.5" /> Departments</Label>
                <div className="flex flex-wrap gap-3 p-2 border rounded-lg">
                  {DEPARTMENTS.map(d => (
                    <label key={d} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={departments.includes(d)} onCheckedChange={() => toggleArrayItem(departments, setDepartments, d)} />
                      {d}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5 mb-1.5"><MapPin className="w-3.5 h-3.5" /> Locations</Label>
                <div className="flex flex-wrap gap-3 p-2 border rounded-lg min-h-[2.5rem]">
                  {locations.length === 0 && <span className="text-xs text-muted-foreground">No locations configured</span>}
                  {locations.map(l => (
                    <label key={l} className="flex items-center gap-2 text-xs cursor-pointer">
                      <Checkbox checked={locs.includes(l)} onCheckedChange={() => toggleArrayItem(locs, setLocs, l)} />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Permissions (collapsible) */}
        <div className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setShowPerms(!showPerms)}
            className="w-full flex items-center gap-2 px-3 py-2.5 bg-muted/50 hover:bg-muted text-sm font-semibold"
          >
            {showPerms ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            Module Permissions ({selectedKeys.size} selected)
          </button>
          {showPerms && (
            <div className="space-y-3 p-3 max-h-64 overflow-y-auto">
              {PERMISSION_CATALOG.map((mod) => (
                <div key={mod.key} className="border rounded-lg overflow-hidden">
                  <div className="bg-slate-50 px-3 py-1.5 font-semibold text-xs uppercase tracking-wide text-slate-600">
                    {mod.group}
                  </div>
                  <div className="divide-y">
                    {mod.resources.map((res) => {
                      const keys = res.actions.map(a => `${mod.key}.${res.key}.${a.key}`);
                      const allSel = keys.every(k => selectedKeys.has(k));
                      const someSel = keys.some(k => selectedKeys.has(k));
                      return (
                        <div key={res.key} className="flex items-start gap-3 px-3 py-2">
                          <div className="flex items-center gap-2 pt-0.5 min-w-[140px]">
                            <Checkbox
                              checked={allSel ? true : someSel ? 'indeterminate' : false}
                              onCheckedChange={() => toggleResource(mod.key, res.key, res.actions)}
                            />
                            <span className="text-xs font-medium">{res.label}</span>
                          </div>
                          <div className="flex flex-wrap gap-x-3 gap-y-1 flex-1">
                            {res.actions.map((act) => {
                              const key = `${mod.key}.${res.key}.${act.key}`;
                              return (
                                <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
                                  <Checkbox checked={selectedKeys.has(key)} onCheckedChange={() => togglePermission(key)} />
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
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleApprove} disabled={loading} className="gap-2">
            <Save className="w-4 h-4" /> {loading ? 'Approving...' : 'Approve & Grant Access'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}