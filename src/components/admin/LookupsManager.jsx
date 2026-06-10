import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, Pencil, AlertTriangle, X, Loader2 } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import {
  COMPANIES, LOCATIONS, DEPARTMENTS,
  RLIC_STATUSES, PID_STATUSES, MEDICAL_RESULTS, TRAINING_STATUSES
} from '@/utils/constants';

const COMPANY_TYPES = ['Main', 'Sub-contractor', 'GSO Supervision'];

const DEFAULTS = {
  company:         COMPANIES.map(c => ({ value: c.value, label: c.label })),
  company_type:    COMPANY_TYPES.map(t => ({ value: t, label: t })),
  location:        LOCATIONS.map(l => ({ value: l, label: l })),
  department:      DEPARTMENTS.map(d => ({ value: d, label: d })),
  rlic_status:     RLIC_STATUSES.map(s => ({ value: s.value, label: s.label })),
  pid_status:      PID_STATUSES.map(s => ({ value: s.value, label: s.label })),
  ftw_result:      MEDICAL_RESULTS.map(s => ({ value: s.value, label: s.label })),
  training_status: TRAINING_STATUSES.map(s => ({ value: s.value, label: s.label })),
};

const TYPE_TO_FIELD = {
  company:         'company',
  company_type:    'company_type',
  location:        'current_location',
  department:      'department',
  rlic_status:     'rlic_status',
  pid_status:      'pid_status',
  ftw_result:      'ftw_result',
  training_status: 'training_status',
};

function EditModal({ entry, isBuiltin, onSave, onClose, loading }) {
  const [label, setLabel] = useState(entry.label || '');
  const [value, setValue] = useState(entry.value || '');

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-base">Edit Entry</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          {!isBuiltin && (
            <div>
              <label className="text-xs font-medium text-muted-foreground">Value (stored in employee records)</label>
              <Input value={value} onChange={e => setValue(e.target.value.toUpperCase())} className="mt-1" placeholder="e.g. ACME CORP" />
            </div>
          )}
          <div>
            <label className="text-xs font-medium text-muted-foreground">Display Label</label>
            <Input value={label} onChange={e => setLabel(e.target.value.toUpperCase())} className="mt-1" placeholder="Display name" />
          </div>
          {isBuiltin && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded p-2">
              This is a built-in entry. Only the display label can be changed. The stored value in employee records will remain unchanged.
            </p>
          )}
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button onClick={() => onSave({ newValue: isBuiltin ? entry.value : value, newLabel: label })} disabled={loading || !label.trim()}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving...</> : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function DeleteModal({ entry, usageCount, onConfirm, onClose, loading }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-semibold text-base">Delete Entry</h3>
            <p className="text-sm text-muted-foreground mt-1">
              You are about to remove <strong className="text-foreground">{entry.label}</strong>.
            </p>
          </div>
        </div>
        {usageCount > 0 ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 space-y-1">
            <p className="text-sm text-red-700 font-semibold">⚠ Used by {usageCount} employee record{usageCount !== 1 ? 's' : ''}</p>
            <p className="text-xs text-red-600">
              This entry will be hidden from all new selections and forms. Existing employee records will continue to display this value for historical accuracy.
            </p>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
            <p className="text-sm text-green-700">✓ Not used by any employee records — safe to delete.</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground mb-4">This is a soft delete. The entry can be restored by an admin if needed.</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Deleting...</> : 'Confirm Delete'}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CascadeModal({ oldValue, newValue, usageCount, onConfirm, onSkip, loading }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start gap-3 mb-4">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <h3 className="font-semibold text-base">Update Employee Records?</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-2">
          <strong>{usageCount}</strong> employee record{usageCount !== 1 ? 's' : ''} currently store the value <strong className="text-foreground">"{oldValue}"</strong>.
        </p>
        <p className="text-sm text-muted-foreground mb-4">
          Do you want to update all these records to the new value <strong className="text-foreground">"{newValue}"</strong>?
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onSkip} disabled={loading}>Skip — Keep Old Records</Button>
          <Button onClick={onConfirm} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Updating...</> : `Update ${usageCount} Record${usageCount !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}

function LookupSection({ type, label, hint }) {
  const [newValue, setNewValue]           = useState('');
  const [newLabel, setNewLabel]           = useState('');
  const [editingEntry, setEditingEntry]   = useState(null);
  const [deletingEntry, setDeletingEntry] = useState(null);
  const [deleteUsageCount, setDeleteUsageCount] = useState(0);
  const [cascadeData, setCascadeData]     = useState(null);
  const [savingEdit, setSavingEdit]       = useState(false);
  const [deleting, setDeleting]           = useState(false);
  const [checkingUsage, setCheckingUsage] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allDbEntries = [] } = useQuery({
    queryKey: ['lookups', type],
    queryFn: () => base44.entities.Lookup.filter({ type }),
  });

  const statics = DEFAULTS[type] || [];
  const employeeField = TYPE_TO_FIELD[type];

  const builtinDbMap = {};
  allDbEntries.forEach(entry => { if (entry.is_builtin) builtinDbMap[entry.value] = entry; });

  const visibleBuiltins = statics.filter(s => !builtinDbMap[s.value]?.is_deleted);
  const customEntries = allDbEntries.filter(e => !e.is_builtin && !e.is_deleted);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['lookups', type] });

  const checkUsage = async (value) => {
    if (!employeeField) return 0;
    const employees = await base44.entities.Employee.filter({ [employeeField]: value });
    return employees.length;
  };

  const getCurrentUser = async () => {
    try { const u = await base44.auth.me(); return u?.email || ''; } catch { return ''; }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    const val = newValue.trim().toUpperCase();
    const lbl = (newLabel || newValue).trim().toUpperCase();
    await base44.entities.Lookup.create({ type, value: val, label: lbl, is_builtin: false, is_deleted: false });
    invalidate();
    toast({ title: `${label} entry added` });
    setNewValue('');
    setNewLabel('');
  };

  const openEditBuiltin = (staticEntry) => {
    const dbRecord = builtinDbMap[staticEntry.value];
    setEditingEntry({ value: staticEntry.value, label: dbRecord?.label || staticEntry.label, id: dbRecord?.id || null, _isVirtual: !dbRecord, _isBuiltin: true });
  };

  const openEditCustom = (entry) => {
    setEditingEntry({ value: entry.value, label: entry.label, id: entry.id, _isBuiltin: false });
  };

  const handleSaveEdit = async ({ newValue: nv, newLabel: nl }) => {
    setSavingEdit(true);
    try {
      const userEmail = await getCurrentUser();
      if (editingEntry._isBuiltin) {
        if (editingEntry._isVirtual || !editingEntry.id) {
          await base44.entities.Lookup.create({ type, value: editingEntry.value, label: nl, is_builtin: true, is_deleted: false, updated_by: userEmail });
        } else {
          await base44.entities.Lookup.update(editingEntry.id, { label: nl, updated_by: userEmail });
        }
        invalidate();
        toast({ title: 'Entry label updated' });
        setEditingEntry(null);
        return;
      }
      const oldValue = editingEntry.value;
      if (nv !== oldValue) {
        const count = await checkUsage(oldValue);
        if (count > 0) {
          setEditingEntry(null);
          setCascadeData({ oldValue, newValue: nv, newLabel: nl, dbEntryId: editingEntry.id, usageCount: count });
          setSavingEdit(false);
          return;
        }
      }
      await base44.entities.Lookup.update(editingEntry.id, { value: nv, label: nl, updated_by: userEmail });
      invalidate();
      toast({ title: 'Entry updated' });
      setEditingEntry(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCascadeConfirm = async () => {
    setSavingEdit(true);
    try {
      const userEmail = await getCurrentUser();
      const { oldValue, newValue: nv, newLabel: nl, dbEntryId } = cascadeData;
      await base44.entities.Lookup.update(dbEntryId, { value: nv, label: nl, updated_by: userEmail });
      const employees = await base44.entities.Employee.filter({ [employeeField]: oldValue });
      await Promise.all(employees.map(e => base44.entities.Employee.update(e.id, { [employeeField]: nv })));
      invalidate();
      toast({ title: `Entry updated and ${employees.length} employee record(s) updated` });
      setCascadeData(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCascadeSkip = async () => {
    setSavingEdit(true);
    try {
      const userEmail = await getCurrentUser();
      const { newValue: nv, newLabel: nl, dbEntryId } = cascadeData;
      await base44.entities.Lookup.update(dbEntryId, { value: nv, label: nl, updated_by: userEmail });
      invalidate();
      toast({ title: 'Entry updated (existing records unchanged)' });
      setCascadeData(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const openDeleteBuiltin = async (staticEntry) => {
    setCheckingUsage(true);
    const dbRecord = builtinDbMap[staticEntry.value];
    const count = await checkUsage(staticEntry.value);
    setDeleteUsageCount(count);
    setDeletingEntry({ value: staticEntry.value, label: dbRecord?.label || staticEntry.label, id: dbRecord?.id || null, _isVirtual: !dbRecord, _isBuiltin: true });
    setCheckingUsage(false);
  };

  const openDeleteCustom = async (entry) => {
    setCheckingUsage(true);
    const count = await checkUsage(entry.value);
    setDeleteUsageCount(count);
    setDeletingEntry({ ...entry, _isBuiltin: false });
    setCheckingUsage(false);
  };

  const handleConfirmDelete = async () => {
    setDeleting(true);
    try {
      const userEmail = await getCurrentUser();
      const now = new Date().toISOString();
      if (deletingEntry._isVirtual || !deletingEntry.id) {
        await base44.entities.Lookup.create({ type, value: deletingEntry.value, label: deletingEntry.label, is_builtin: true, is_deleted: true, deleted_by: userEmail, deleted_at: now });
      } else {
        await base44.entities.Lookup.update(deletingEntry.id, { is_deleted: true, deleted_by: userEmail, deleted_at: now });
      }
      invalidate();
      toast({ title: 'Entry removed (soft deleted)' });
      setDeletingEntry(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {editingEntry && <EditModal entry={editingEntry} isBuiltin={editingEntry._isBuiltin} onSave={handleSaveEdit} onClose={() => setEditingEntry(null)} loading={savingEdit} />}
      {deletingEntry && <DeleteModal entry={deletingEntry} usageCount={deleteUsageCount} onConfirm={handleConfirmDelete} onClose={() => setDeletingEntry(null)} loading={deleting} />}
      {cascadeData && <CascadeModal oldValue={cascadeData.oldValue} newValue={cascadeData.newValue} usageCount={cascadeData.usageCount} onConfirm={handleCascadeConfirm} onSkip={handleCascadeSkip} loading={savingEdit} />}

      {hint && <p className="text-xs text-blue-600 bg-blue-50 rounded px-3 py-2">{hint}</p>}

      <form onSubmit={handleAdd} className="flex gap-2">
        <Input placeholder="Value (e.g. ACME CORP)" value={newValue} onChange={e => setNewValue(e.target.value)} className="flex-1" />
        <Input placeholder="Display label (optional)" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="flex-1" />
        <Button type="submit"><Plus className="w-4 h-4 mr-2" /> Add</Button>
      </form>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Built-in entries</p>
        {visibleBuiltins.map(s => {
          const dbRecord = builtinDbMap[s.value];
          const displayLabel = dbRecord?.label || s.label;
          return (
            <div key={s.value} className="flex items-center justify-between px-3 py-2 rounded bg-muted/30 text-sm">
              <span className="uppercase font-medium">{displayLabel}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground font-mono uppercase mr-2">{s.value}</span>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-primary opacity-60 hover:opacity-100" onClick={() => openEditBuiltin(s)} title="Edit display label">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-60 hover:opacity-100" onClick={() => openDeleteBuiltin(s)} disabled={checkingUsage} title="Soft delete">
                  {checkingUsage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </div>
          );
        })}

        {customEntries.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">Custom entries</p>
            {customEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded bg-blue-50 text-sm">
                <span className="uppercase font-medium text-primary">{entry.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground font-mono uppercase mr-2">{entry.value}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-primary opacity-60 hover:opacity-100" onClick={() => openEditCustom(entry)} title="Edit entry">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive opacity-60 hover:opacity-100" onClick={() => openDeleteCustom(entry)} disabled={checkingUsage} title="Soft delete">
                    {checkingUsage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}

        {visibleBuiltins.length === 0 && customEntries.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4">No active entries.</p>
        )}
      </div>
    </div>
  );
}

export default function LookupsManager() {
  return (
    <Card className="p-6">
      <p className="text-xs text-muted-foreground mb-4">
        Manage reference lists used in the personnel form. All entries can be edited or soft-deleted.
        Deleted entries are hidden from new selections but remain visible on existing employee records for historical accuracy.
      </p>
      <Tabs defaultValue="company">
        <TabsList className="mb-4 flex-wrap h-auto gap-1">
          <TabsTrigger value="company">Companies</TabsTrigger>
          <TabsTrigger value="company_type">Company Types</TabsTrigger>
          <TabsTrigger value="location">Locations</TabsTrigger>
          <TabsTrigger value="department">Departments</TabsTrigger>
          <TabsTrigger value="rlic_status">Gate Pass Status</TabsTrigger>
          <TabsTrigger value="pid_status">Project ID Status</TabsTrigger>
          <TabsTrigger value="ftw_result">Medical Result</TabsTrigger>
          <TabsTrigger value="training_status">Training Status</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><LookupSection type="company" label="Company" /></TabsContent>
        <TabsContent value="company_type"><LookupSection type="company_type" label="Company Type" /></TabsContent>
        <TabsContent value="location"><LookupSection type="location" label="Location" /></TabsContent>
        <TabsContent value="department"><LookupSection type="department" label="Department" /></TabsContent>
        <TabsContent value="rlic_status"><LookupSection type="rlic_status" label="Gate Pass Status" hint="Add custom statuses (e.g. UNDER PROCESS). These will appear as filter options in Gate Pass dashboards." /></TabsContent>
        <TabsContent value="pid_status"><LookupSection type="pid_status" label="Project ID Status" hint="Add custom statuses (e.g. UNDER PROCESS). These will appear as filter options in Project ID dashboards." /></TabsContent>
        <TabsContent value="ftw_result"><LookupSection type="ftw_result" label="Medical Result" hint="Add custom medical result statuses (e.g. UNDER REVIEW). These will appear as filter options in the Medical dashboard." /></TabsContent>
        <TabsContent value="training_status"><LookupSection type="training_status" label="Training Status" hint="Add custom training statuses (e.g. IN PROGRESS). These will appear as options in the Training section." /></TabsContent>
      </Tabs>
    </Card>
  );
}