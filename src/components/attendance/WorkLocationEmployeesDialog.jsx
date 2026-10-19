import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { Search, Star, UserMinus, Loader2 } from 'lucide-react';
import { logLocationActivity, setPrimaryAssignment } from '@/lib/workLocations';

// Employees authorized to punch at this location, with the primary location per
// employee and the ability to change it or unassign (soft, history retained).
export default function WorkLocationEmployeesDialog({ location, onClose }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ['work-location-assignments', location.id, search],
    queryFn: async () => {
      const q = { location_id: location.id, status: { $ne: 'Inactive' } };
      if (search.trim()) {
        const rx = { $regex: search.trim(), $options: 'i' };
        q.$or = [{ employee_name: rx }, { employee_pid: rx }, { employee_qid: rx }, { company: rx }, { department: rx }];
      }
      return (await base44.entities.WorkLocationAssignment.filter(q, { sort: 'employee_name', limit: 300 })).items;
    },
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['work-location-assignments'] });
    qc.invalidateQueries({ queryKey: ['work-location-assignment-counts'] });
  };

  const makePrimary = async (assignment) => {
    setBusyId(assignment.id);
    try {
      const employeeAssignments =
        (await base44.entities.WorkLocationAssignment.filter(
          { employee_id: assignment.employee_id, status: { $ne: 'Inactive' } },
          { limit: 200 }
        )).items;
      await setPrimaryAssignment(assignment.employee_id, assignment.id, employeeAssignments);
      await logLocationActivity(
        'update', 'WorkLocationAssignment', assignment.id, assignment.employee_name,
        { primary_location: location.location_name, location_code: location.location_code }, ['is_primary'], user?.email
      );
      toast({ title: `${assignment.employee_name} — primary location set.` });
      refresh();
    } catch (e) {
      toast({ title: 'Could not set the primary location', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  const unassign = async (assignment) => {
    setBusyId(assignment.id);
    try {
      await base44.entities.WorkLocationAssignment.update(assignment.id, { status: 'Inactive', is_primary: false });
      await logLocationActivity(
        'update', 'WorkLocationAssignment', assignment.id, assignment.employee_name,
        { location: location.location_name, status: 'Inactive' }, ['status'], user?.email
      );
      toast({ title: `${assignment.employee_name} unassigned from ${location.location_name}.` });
      refresh();
    } catch (e) {
      toast({ title: 'Could not unassign', description: e.message, variant: 'destructive' });
    } finally {
      setBusyId('');
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assigned Employees — {location.location_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input className="pl-9" placeholder="Search assigned personnel..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <div className="max-h-[420px] overflow-y-auto divide-y divide-border/60">
              {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
              {!isLoading && assignments.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground">
                  No employees are assigned to this location yet.
                </div>
              )}
              {assignments.map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-foreground truncate">{a.employee_name || '—'}</p>
                      {a.is_primary && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                          <Star className="w-3 h-3" /> Primary
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[a.employee_pid && `PID ${a.employee_pid}`, a.company, a.department,
                        a.effective_date && `from ${a.effective_date}`].filter(Boolean).join(' • ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {!a.is_primary && (
                      <Button variant="ghost" size="sm" onClick={() => makePrimary(a)} disabled={busyId === a.id} title="Set as primary location">
                        {busyId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Star className="w-3.5 h-3.5" />}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      disabled={busyId === a.id}
                      onClick={() => unassign(a)}
                      title="Unassign from this location"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-muted-foreground">
            Unassigning keeps the assignment history — attendance already recorded at this location is never changed.
          </p>

          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}