import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';
import { Search, Check, Loader2 } from 'lucide-react';
import { useAttendanceEmployees } from '@/hooks/useAttendanceEmployees';
import { isAttendanceEligible } from '@/lib/attendanceEligibility';
import { logLocationActivity, todayStr } from '@/lib/workLocations';

// Assign Master List personnel to a work location — single or in bulk.
// Duplicate assignments are never created: an existing (even previously
// unassigned) link to the same location is reactivated instead. One primary
// location per employee is maintained.
export default function WorkLocationAssignDialog({ location, onClose, onSaved }) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState([]);
  const [effectiveDate, setEffectiveDate] = useState(todayStr());
  const [makePrimary, setMakePrimary] = useState(false);
  const [updateMasterList, setUpdateMasterList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: employees = [], isLoading } = useAttendanceEmployees(true);

  const { data: existing = [] } = useQuery({
    queryKey: ['work-location-assignments', location.id, '_all'],
    queryFn: async () =>
      (await base44.entities.WorkLocationAssignment.filter({ location_id: location.id }, { limit: 5000 })).items,
  });

  const assignedIds = useMemo(
    () => new Set(existing.filter((a) => a.status !== 'Inactive').map((a) => a.employee_id)),
    [existing]
  );

  const filtered = useMemo(() => {
    const active = (employees || []).filter(isAttendanceEligible);
    if (!search.trim()) return active;
    const q = search.toLowerCase();
    return active.filter((e) =>
      [e.name, e.pid, e.qid_no, e.staff_no, e.company, e.department, e.position_application]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q)
    );
  }, [employees, search]);

  const selectedEmployees = useMemo(
    () => (employees || []).filter((e) => selectedIds.includes(e.id)),
    [employees, selectedIds]
  );

  const differing = selectedEmployees.filter(
    (e) => (e.work_location || '').trim().toUpperCase() !== (location.location_name || '').trim().toUpperCase()
  );

  const toggle = (id) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const save = async () => {
    if (selectedIds.length === 0) {
      setError('Select at least one employee to assign.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const nowIso = new Date().toISOString();
      const byEmployee = {};
      for (const a of existing) byEmployee[a.employee_id] = a;

      // The selected employees' other assignments — needed to keep exactly one
      // primary location per employee.
      const otherAssignments =
        selectedIds.length > 0
          ? (await base44.entities.WorkLocationAssignment.filter(
              { employee_id: { $in: selectedIds }, status: { $ne: 'Inactive' } },
              { limit: 5000 }
            )).items
          : [];
      const hasPrimary = {};
      for (const a of otherAssignments) if (a.is_primary) hasPrimary[a.employee_id] = true;

      const toCreate = [];
      const toUpdate = [];

      for (const emp of selectedEmployees) {
        const prior = byEmployee[emp.id];
        // One primary location per employee: explicitly requested, or when the
        // employee does not have a primary yet.
        const wantPrimary = makePrimary || !hasPrimary[emp.id];
        const base = {
          employee_name: emp.name || '',
          employee_pid: emp.pid || '',
          employee_qid: emp.qid_no || '',
          company: emp.company || '',
          department: emp.department || '',
          location_name: location.location_name,
          location_code: location.location_code,
          effective_date: effectiveDate,
          assigned_by: user?.email || '',
          assigned_by_name: user?.full_name || '',
          assigned_at: nowIso,
        };
        if (prior) {
          // An existing link to this location is never duplicated — it is
          // reactivated, and only rewritten when something actually changes.
          if (prior.status === 'Active' && prior.effective_date === effectiveDate && (!wantPrimary || prior.is_primary)) continue;
          toUpdate.push({ id: prior.id, ...base, status: 'Active', is_primary: wantPrimary || prior.is_primary });
        } else {
          toCreate.push({ employee_id: emp.id, location_id: location.id, status: 'Active', is_primary: wantPrimary, ...base });
        }
      }

      // Primary is unique per employee within their assignments.
      const clearedIds = makePrimary
        ? otherAssignments
            .filter((a) => a.location_id !== location.id && a.is_primary && selectedIds.includes(a.employee_id))
            .map((a) => a.id)
        : [];

      let created = 0;
      let reactivated = 0;
      if (toCreate.length) {
        await base44.entities.WorkLocationAssignment.bulkCreate(toCreate);
        created = toCreate.length;
      }
      if (toUpdate.length) {
        await base44.entities.WorkLocationAssignment.bulkUpdate(toUpdate);
        reactivated = toUpdate.length;
      }
      if (clearedIds.length) {
        await base44.entities.WorkLocationAssignment.bulkUpdate(clearedIds.map((id) => ({ id, is_primary: false })));
      }

      let masterUpdated = 0;
      if (updateMasterList && differing.length) {
        await base44.entities.Employee.bulkUpdate(
          differing.map((e) => ({ id: e.id, work_location: location.location_name }))
        );
        masterUpdated = differing.length;
      }

      const alreadyAssigned = selectedEmployees.length - created - reactivated;
      await logLocationActivity(
        'update',
        'WorkLocationAssignment',
        location.id,
        location.location_name,
        {
          assigned: created,
          reactivated,
          already_assigned: alreadyAssigned,
          is_primary: makePrimary,
          effective_date: effectiveDate,
          master_list_work_location_updated: masterUpdated,
          employees: selectedEmployees.slice(0, 25).map((e) => e.name),
        },
        ['assignments'],
        user?.email
      );

      toast({
        title: 'Assignments saved',
        description: `${created} assigned · ${reactivated} reactivated · ${alreadyAssigned} already assigned${masterUpdated ? ` · ${masterUpdated} Master List record(s) updated` : ''}`,
      });

      qc.invalidateQueries({ queryKey: ['work-location-assignments'] });
      qc.invalidateQueries({ queryKey: ['work-location-assignment-counts'] });
      if (masterUpdated) {
        qc.invalidateQueries({ queryKey: ['employees', 'active-attendance'] });
        qc.invalidateQueries({ queryKey: ['master-list'] });
      }
      onSaved();
    } catch (e) {
      setError(e.message || 'Could not save the assignments.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Assign Employees to {location.location_name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search by name, employee ID, PID, QID, company or department..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button type="button" onClick={() => setSelectedIds((prev) => Array.from(new Set([...prev, ...filtered.map((e) => e.id)])))}
              className="px-2 py-1 rounded-md border border-border bg-card hover:bg-muted">
              Select all (filtered)
            </button>
            <button type="button" onClick={() => setSelectedIds([])}
              className="px-2 py-1 rounded-md border border-border bg-card hover:bg-muted">
              Clear
            </button>
            <span className="ml-auto font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              {selectedIds.length} selected
            </span>
          </div>

          <div className="max-h-64 overflow-y-auto rounded-lg border border-border bg-card divide-y divide-border/50">
            {isLoading && <div className="p-4 text-sm text-muted-foreground">Loading personnel…</div>}
            {!isLoading && filtered.length === 0 && (
              <div className="p-4 text-sm text-muted-foreground">No matching personnel.</div>
            )}
            {filtered.slice(0, 300).map((emp) => {
              const sel = selectedIds.includes(emp.id);
              const already = assignedIds.has(emp.id);
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => toggle(emp.id)}
                  className={cn('w-full flex items-center gap-2 p-2 text-left hover:bg-muted', sel && 'bg-emerald-50')}
                >
                  <span className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0',
                    sel ? 'bg-emerald-600 border-emerald-600' : 'border-border')}>
                    {sel && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground truncate">{emp.name}</span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {[emp.pid && `PID ${emp.pid}`, emp.company, emp.department].filter(Boolean).join(' • ')}
                    </span>
                  </span>
                  {already && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      Already assigned
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border p-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Effective Date</label>
              <Input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} />
            </div>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} />
                Set as primary location for the selected employees
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={updateMasterList} onChange={(e) => setUpdateMasterList(e.target.checked)} />
                Also update their Work Location on the Master List
              </label>
            </div>
          </div>

          {updateMasterList && differing.length > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2">
              {differing.length} selected employee(s) currently show a different Work Location on the Master List. Their
              record is updated only because you ticked the box above.
            </p>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              Save Assignments
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}