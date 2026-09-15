import React, { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Globe, Users, Building2, Layers, MapPin, Save } from 'lucide-react';
import { saveUserScope } from '@/lib/rbacService';
import { useToast } from '@/components/ui/use-toast';

const COMPANIES = [
  'GSO QATAR', 'ITELLIGENT', 'ANION', 'SEA QUEEN', 'LMV E AND I', 'METAL WORLD',
  'ASMA', 'FIT', 'SPRAY CON', 'EMKAN', 'ENERTEC', 'CRYSTAL', 'MEGATRONICS (GSO)',
  'ENERSERVE (GSO)', 'ENERTEC (GSO)', 'NTC (GSO)', 'MIR (GSO)', 'SWAN GLOBAL (GSO)',
  'SIGEL (GSO)', 'AL-RAMSHA (GSO)', 'ALTHAF (GSO)', 'ZEAL-IT',
];

const DEPARTMENTS = ['Electrical', 'Mechanical', 'Civil', 'Services'];

export default function AccessScopeModal({ user, currentUser, existingScope, locations, onClose, onSaved }) {
  const { toast } = useToast();
  const [scopeMode, setScopeMode] = useState('all');
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [locs, setLocs] = useState([]);
  const [assignedTeamOnly, setAssignedTeamOnly] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (existingScope) {
      setScopeMode(existingScope.scope_mode || 'all');
      setCompanies(existingScope.companies || []);
      setDepartments(existingScope.departments || []);
      setLocs(existingScope.locations || []);
      setAssignedTeamOnly(existingScope.assigned_team_only || false);
    }
  }, [existingScope]);

  const toggleArrayItem = (arr, setArr, value) => {
    setArr(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const scopeData = {
        scope_mode: scopeMode,
        companies: scopeMode === 'all' ? [] : companies,
        departments: scopeMode === 'all' ? [] : departments,
        locations: scopeMode === 'all' ? [] : locs,
        assigned_team_only: assignedTeamOnly,
      };
      await saveUserScope(user.id, user.email, scopeData, currentUser);
      toast({ title: 'Access scope saved', description: `Scope updated for ${user.email}` });
      onSaved();
      onClose();
    } catch (e) {
      toast({ title: 'Error', description: e.message || 'Failed to save scope', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-primary" />
            Access Scope — {user?.full_name || user?.email}
          </DialogTitle>
        </DialogHeader>

        <RadioGroup value={scopeMode} onValueChange={setScopeMode} className="space-y-3">
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
            <RadioGroupItem value="all" />
            <div>
              <span className="text-sm font-medium flex items-center gap-1.5"><Globe className="w-4 h-4" /> All Personnel</span>
              <p className="text-xs text-muted-foreground">Full access to all personnel records</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
            <RadioGroupItem value="assigned_team" />
            <div>
              <span className="text-sm font-medium flex items-center gap-1.5"><Users className="w-4 h-4" /> Assigned Team Only</span>
              <p className="text-xs text-muted-foreground">Only personnel whose Assigned Manager is this user (requires personnel link)</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-muted/50">
            <RadioGroupItem value="custom" />
            <div>
              <span className="text-sm font-medium flex items-center gap-1.5"><Layers className="w-4 h-4" /> Custom (Company / Department / Location)</span>
              <p className="text-xs text-muted-foreground">Restrict by specific companies, departments, and/or locations</p>
            </div>
          </label>
        </RadioGroup>

        {scopeMode === 'custom' && (
          <div className="space-y-4 mt-2">
            {/* Companies */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <Building2 className="w-3.5 h-3.5" /> Companies
              </Label>
              <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg">
                {COMPANIES.map(c => (
                  <label key={c} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={companies.includes(c)} onCheckedChange={() => toggleArrayItem(companies, setCompanies, c)} />
                    {c}
                  </label>
                ))}
              </div>
            </div>

            {/* Departments */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <Layers className="w-3.5 h-3.5" /> Departments
              </Label>
              <div className="flex flex-wrap gap-3 p-2 border rounded-lg">
                {DEPARTMENTS.map(d => (
                  <label key={d} className="flex items-center gap-2 text-xs cursor-pointer">
                    <Checkbox checked={departments.includes(d)} onCheckedChange={() => toggleArrayItem(departments, setDepartments, d)} />
                    {d}
                  </label>
                ))}
              </div>
            </div>

            {/* Locations */}
            <div>
              <Label className="text-xs font-semibold flex items-center gap-1.5 mb-2">
                <MapPin className="w-3.5 h-3.5" /> Locations
              </Label>
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

        {scopeMode === 'assigned_team' && (
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
            This user will only see personnel whose <strong>Assigned Manager</strong> is linked to this user account.
            Make sure the user's personnel record is linked (User → Personnel ID) and that they are set as
            <strong> is_manager = true</strong> on their Employee record.
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={loading}>
            <Save className="w-4 h-4" /> {loading ? 'Saving...' : 'Save Scope'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}