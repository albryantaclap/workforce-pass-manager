import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/lib/AuthContext';
import { useRbac } from '@/lib/useRbac';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Edit2, X, Clock, Calendar, Settings as SettingsIcon, Sun, Moon } from 'lucide-react';
import ShiftAssignEmployees from './ShiftAssignEmployees';
import { useAttendanceEmployees } from '@/hooks/useAttendanceEmployees';

const DAY_KEYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const SETTINGS_TABS = [
  { key: 'working-days', label: 'Working Days', icon: Calendar },
  { key: 'working-hours', label: 'Working Hours', icon: Clock },
  { key: 'shifts', label: 'Shifts', icon: Clock },
  { key: 'holidays', label: 'Holidays', icon: Sun },
  { key: 'rules', label: 'Late & Overtime Rules', icon: SettingsIcon },
];

export default function AttendanceSettings({ settings, shifts, assignments, holidays }) {
  const [activeTab, setActiveTab] = useState('working-days');
  const { can } = useRbac();
  const canEdit = can('attendance.settings.manage');
  // Lazy-load employees only when the Shifts tab is active (for shift assignment).
  // Not loaded on initial page load or when other settings tabs are open.
  const { data: employees = [] } = useAttendanceEmployees(activeTab === 'shifts');

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {SETTINGS_TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            className={cn('flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
              activeTab === tab.key ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-muted-foreground hover:text-foreground')}>
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'working-days' && <WorkingDaysSettings settings={settings} canEdit={canEdit} />}
      {activeTab === 'working-hours' && <WorkingHoursSettings settings={settings} canEdit={canEdit} />}
      {activeTab === 'shifts' && <ShiftsSettings shifts={shifts} assignments={assignments} employees={employees} canEdit={canEdit} />}
      {activeTab === 'holidays' && <HolidaysSettings holidays={holidays} canEdit={canEdit} />}
      {activeTab === 'rules' && <RulesSettings settings={settings} canEdit={canEdit} />}
    </div>
  );
}

// ── Working Days ──
function WorkingDaysSettings({ settings, canEdit }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [days, setDays] = useState(settings?.working_days || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu']);

  useEffect(() => { if (settings?.working_days) setDays(settings.working_days); }, [settings]);

  const toggle = (day) => {
    if (!canEdit) return;
    setDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const save = async () => {
    try {
      await base44.entities.AttendanceSetting.update(settings.id, { working_days: days, updated_by: user?.email });
      qc.invalidateQueries({ queryKey: ['attendance-settings'] });
      toast({ title: 'Working days updated.' });
    } catch (e) { toast({ title: 'Update failed', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Working Days Configuration</h3>
        <p className="text-sm text-muted-foreground">Select the default working days for the week. Employees on these days are expected to have attendance.</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {DAY_KEYS.map(day => (
          <button key={day} onClick={() => toggle(day)}
            className={cn('px-4 py-2.5 rounded-lg border-2 text-sm font-medium transition-all',
              days.includes(day)
                ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground')}>
            {day}
          </button>
        ))}
      </div>
      {canEdit && <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">Save Working Days</Button>}
    </Card>
  );
}

// ── Working Hours ──
function WorkingHoursSettings({ settings, canEdit }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (settings) {
      setForm({
        default_shift_start: settings.default_shift_start || '07:00',
        default_shift_end: settings.default_shift_end || '17:00',
        break_minutes: settings.break_minutes ?? 60,
        max_working_hours: settings.max_working_hours ?? 12,
        auto_close_buffer_minutes: settings.auto_close_buffer_minutes ?? 120,
        first_punch_window_minutes: settings.first_punch_window_minutes ?? 180,
      });
    }
  }, [settings]);

  const save = async () => {
    try {
      await base44.entities.AttendanceSetting.update(settings.id, { ...form, updated_by: user?.email });
      qc.invalidateQueries({ queryKey: ['attendance-settings'] });
      toast({ title: 'Working hours updated.' });
    } catch (e) { toast({ title: 'Update failed', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Working Hours Configuration</h3>
        <p className="text-sm text-muted-foreground">Default shift times and limits used when no specific shift is assigned.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Default Shift Start">
          <Input type="time" value={form.default_shift_start || ''} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, default_shift_start: e.target.value }))} />
        </Field>
        <Field label="Default Shift End">
          <Input type="time" value={form.default_shift_end || ''} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, default_shift_end: e.target.value }))} />
        </Field>
        <Field label="Break Duration (minutes)">
          <Input type="number" value={form.break_minutes || 0} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, break_minutes: Number(e.target.value) }))} />
        </Field>
        <Field label="Max Working Hours">
          <Input type="number" value={form.max_working_hours || 0} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, max_working_hours: Number(e.target.value) }))} />
        </Field>
        <Field label="Auto-Close Buffer (minutes after shift end)">
          <Input type="number" value={form.auto_close_buffer_minutes || 0} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, auto_close_buffer_minutes: Number(e.target.value) }))} />
        </Field>
        <Field label="First Punch Window (minutes before shift start)">
          <Input type="number" value={form.first_punch_window_minutes || 0} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, first_punch_window_minutes: Number(e.target.value) }))} />
        </Field>
      </div>
      {canEdit && <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">Save Working Hours</Button>}
    </Card>
  );
}

// ── Rules (Late & Overtime) ──
function RulesSettings({ settings, canEdit }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({});

  useEffect(() => {
    if (settings) {
      setForm({
        late_grace_minutes: settings.late_grace_minutes ?? 10,
        half_day_threshold_hours: settings.half_day_threshold_hours ?? 4,
        overtime_start_hours: settings.overtime_start_hours ?? 8,
        auto_close_open_sessions: settings.auto_close_open_sessions ?? true,
      });
    }
  }, [settings]);

  const save = async () => {
    try {
      await base44.entities.AttendanceSetting.update(settings.id, { ...form, updated_by: user?.email });
      qc.invalidateQueries({ queryKey: ['attendance-settings'] });
      toast({ title: 'Attendance rules updated.' });
    } catch (e) { toast({ title: 'Update failed', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card className="p-5 space-y-4">
      <div>
        <h3 className="font-semibold text-foreground">Late & Overtime Rules</h3>
        <p className="text-sm text-muted-foreground">Configure grace periods, half-day thresholds, and overtime calculation.</p>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Field label="Late Grace Period (minutes)">
          <Input type="number" value={form.late_grace_minutes || 0} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, late_grace_minutes: Number(e.target.value) }))} />
        </Field>
        <Field label="Half-Day Threshold (hours)">
          <Input type="number" value={form.half_day_threshold_hours || 0} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, half_day_threshold_hours: Number(e.target.value) }))} />
        </Field>
        <Field label="Overtime Start (hours)">
          <Input type="number" value={form.overtime_start_hours || 0} disabled={!canEdit}
            onChange={e => setForm(f => ({ ...f, overtime_start_hours: Number(e.target.value) }))} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.auto_close_open_sessions} disabled={!canEdit}
          onChange={e => setForm(f => ({ ...f, auto_close_open_sessions: e.target.checked }))} />
        Auto-close open sessions after shift end + buffer (Missing Check-out)
      </label>
      {canEdit && <Button onClick={save} className="bg-emerald-600 hover:bg-emerald-700">Save Rules</Button>}
    </Card>
  );
}

// ── Shifts ──
function ShiftsSettings({ shifts, assignments, employees, canEdit }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);

  const save = async (data, selectedIds = []) => {
    try {
      let shiftId = editing?.id;
      if (shiftId) {
        await base44.entities.AttendanceShift.update(shiftId, { ...data, updated_by: user?.email });
      } else {
        const created = await base44.entities.AttendanceShift.create({ ...data, updated_by: user?.email });
        shiftId = created.id;
      }

      // Sync employee assignments through the existing AttendanceShiftAssignment
      // relationship (assignment_type='employee'). Reassigning removes the old
      // assignment but preserves all attendance/history (records bind to personnel_id).
      const empAssignments = (assignments || []).filter(
        (a) => a.shift_id === shiftId && a.assignment_type === 'employee'
      );
      const existingIds = new Set(empAssignments.map((a) => a.personnel_id).filter(Boolean));
      const toCreate = (selectedIds || []).filter((id) => !existingIds.has(id));
      const toDelete = empAssignments
        .filter((a) => !selectedIds.includes(a.personnel_id))
        .map((a) => a.id);

      if (toCreate.length) {
        await base44.entities.AttendanceShiftAssignment.bulkCreate(
          toCreate.map((pid) => {
            const emp = (employees || []).find((e) => e.id === pid);
            return {
              shift_id: shiftId,
              shift_name: data.shift_name,
              assignment_type: 'employee',
              personnel_id: pid,
              employee_name: emp?.name || '',
              is_active: true,
              updated_by: user?.email,
            };
          })
        );
      }
      for (const aid of toDelete) {
        await base44.entities.AttendanceShiftAssignment.delete(aid);
      }

      qc.invalidateQueries({ queryKey: ['attendance-shifts'] });
      qc.invalidateQueries({ queryKey: ['attendance-assignments'] });
      toast({ title: 'Shift saved.' });
      setEditing(null);
    } catch (e) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
  };

  const del = async (id) => {
    if (!confirm('Delete this shift? Assignments using it will need reassignment.')) return;
    try {
      await base44.entities.AttendanceShift.delete(id);
      qc.invalidateQueries({ queryKey: ['attendance-shifts'] });
      toast({ title: 'Shift deleted.' });
    } catch (e) { toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Shift Management</h3>
          <p className="text-sm text-muted-foreground">Define shifts (Day, Night, Custom) with start/end times and cross-midnight support.</p>
        </div>
        {canEdit && <Button onClick={() => setEditing({})} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Add Shift
        </Button>}
      </div>
      <div className="space-y-2">
        {(shifts || []).map(s => (
          <div key={s.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-3">
              <div className="w-2 h-10 rounded-full" style={{ background: s.color || '#10b981' }} />
              <div>
                <p className="font-medium text-foreground">{s.shift_name}</p>
                <p className="text-xs text-muted-foreground">
                  {s.start_time} → {s.end_time} {s.cross_midnight ? '(cross-midnight)' : ''}
                  · Break: {s.break_minutes || 0}m · Grace: {s.grace_minutes || 0}m · OT after {s.overtime_start_hours || 8}h
                </p>
              </div>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <button onClick={() => setEditing(s)} className="p-1.5 rounded hover:bg-muted"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(s.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
        {(!shifts || shifts.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-8">No shifts configured. Add a shift to get started.</p>
        )}
      </div>
      {editing && <ShiftEditDialog shift={editing} employees={employees} assignments={assignments} onClose={() => setEditing(null)} onSave={save} />}
    </Card>
  );
}

function ShiftEditDialog({ shift, onClose, onSave, employees, assignments }) {
  const [selectedIds, setSelectedIds] = useState(() =>
    shift.id
      ? (assignments || [])
          .filter((a) => a.shift_id === shift.id && a.assignment_type === 'employee' && a.is_active !== false)
          .map((a) => a.personnel_id)
          .filter(Boolean)
      : []
  );
  const [form, setForm] = useState({
    shift_name: shift.shift_name || '',
    start_time: shift.start_time || '07:00',
    end_time: shift.end_time || '17:00',
    break_minutes: shift.break_minutes ?? 60,
    grace_minutes: shift.grace_minutes ?? 10,
    overtime_start_hours: shift.overtime_start_hours ?? 8,
    cross_midnight: shift.cross_midnight ?? false,
    color: shift.color || '#10b981',
    // ── Split-shift punch rules ──
    split_shift_enabled: shift.split_shift_enabled ?? false,
    split_first_in_start: shift.split_first_in_start || '',
    split_first_in_enable_before_min: shift.split_first_in_enable_before_min ?? 30,
    split_first_in_cutoff: shift.split_first_in_cutoff || '',
    split_first_out_required: shift.split_first_out_required ?? true,
    split_first_out_target: shift.split_first_out_target || '',
    split_first_out_enable_before_min: shift.split_first_out_enable_before_min ?? 120,
    split_first_out_window_min: shift.split_first_out_window_min ?? 30,
    split_second_in_required: shift.split_second_in_required ?? true,
    split_second_in_target: shift.split_second_in_target || '',
    split_second_in_enable_before_min: shift.split_second_in_enable_before_min ?? 15,
    split_second_in_window_min: shift.split_second_in_window_min ?? 45,
    split_final_out_earliest: shift.split_final_out_earliest || '',
    split_final_out_enable_before_min: shift.split_final_out_enable_before_min ?? 15,
    split_final_out_latest: shift.split_final_out_latest || '',
    split_break_start: shift.split_break_start || '',
    split_break_end: shift.split_break_end || '',
    split_effective_from: shift.split_effective_from || '',
    split_effective_to: shift.split_effective_to || '',
  });

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold">{shift.id ? 'Edit Shift' : 'New Shift'}</h3>
            {form.cross_midnight && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                Night Shift (crosses midnight)
              </span>
            )}
          </div>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>

        <div className="overflow-y-auto p-4 space-y-4">
          {/* Basic info */}
          <Field label="Shift Name"><Input value={form.shift_name} onChange={e => set('shift_name', e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Start Time"><Input type="time" value={form.start_time} onChange={e => set('start_time', e.target.value)} /></Field>
            <Field label="End Time"><Input type="time" value={form.end_time} onChange={e => set('end_time', e.target.value)} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Field label="Break (min)"><Input type="number" value={form.break_minutes} onChange={e => set('break_minutes', Number(e.target.value))} /></Field>
            <Field label="Grace (min)"><Input type="number" value={form.grace_minutes} onChange={e => set('grace_minutes', Number(e.target.value))} /></Field>
            <Field label="OT Start (hrs)"><Input type="number" value={form.overtime_start_hours} onChange={e => set('overtime_start_hours', Number(e.target.value))} /></Field>
          </div>
          <Field label="Color">
            <Input type="color" value={form.color} onChange={e => set('color', e.target.value)} className="h-8 w-16 p-1" />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.cross_midnight} onChange={e => set('cross_midnight', e.target.checked)} />
            Cross-midnight shift (end time is on the next day)
          </label>

          {/* ── Split-Shift Punch Rules ── */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={form.split_shift_enabled}
                  onCheckedChange={(v) => set('split_shift_enabled', v)}
                />
                <div>
                  <p className="text-sm font-semibold text-foreground">Enable Split-Shift Punch Rules</p>
                  <p className="text-[11px] text-muted-foreground">
                    Configured for FIRST IN / FIRST OUT / SECOND IN / FINAL OUT
                  </p>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              When enabled, employees follow a split shift schedule. All punches stay under the shift
              start date (no separate after-midnight day is created).
            </p>

            {form.split_shift_enabled && (
              <div className="space-y-3 pt-1">
                {/* FIRST IN */}
                <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-bold text-blue-700">FIRST IN</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="First Punch In Start"><Input type="time" value={form.split_first_in_start} onChange={e => set('split_first_in_start', e.target.value)} /></Field>
                    <Field label="Enable Before (min)"><Input type="number" value={form.split_first_in_enable_before_min} onChange={e => set('split_first_in_enable_before_min', Number(e.target.value))} /></Field>
                    <Field label="Cut-Off"><Input type="time" value={form.split_first_in_cutoff} onChange={e => set('split_first_in_cutoff', e.target.value)} /></Field>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Punch enables this many minutes before start; latest accepted punch is the cut-off.</p>
                </div>

                {/* FIRST OUT */}
                <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-700">FIRST OUT</p>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <input type="checkbox" checked={form.split_first_out_required} onChange={e => set('split_first_out_required', e.target.checked)} />
                      Required
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="First Punch Out Target"><Input type="time" value={form.split_first_out_target} onChange={e => set('split_first_out_target', e.target.value)} /></Field>
                    <Field label="Enable Before (min)"><Input type="number" value={form.split_first_out_enable_before_min} onChange={e => set('split_first_out_enable_before_min', Number(e.target.value))} /></Field>
                    <Field label="Window (min)"><Input type="number" value={form.split_first_out_window_min} onChange={e => set('split_first_out_window_min', Number(e.target.value))} /></Field>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Punch enables this many minutes before target; window stays open for Window minutes after target.</p>
                </div>

                {/* SECOND IN */}
                <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-blue-700">SECOND IN</p>
                    <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <input type="checkbox" checked={form.split_second_in_required} onChange={e => set('split_second_in_required', e.target.checked)} />
                      Required
                    </label>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Second Punch In Target"><Input type="time" value={form.split_second_in_target} onChange={e => set('split_second_in_target', e.target.value)} /></Field>
                    <Field label="Enable Before (min)"><Input type="number" value={form.split_second_in_enable_before_min} onChange={e => set('split_second_in_enable_before_min', Number(e.target.value))} /></Field>
                    <Field label="Window (min)"><Input type="number" value={form.split_second_in_window_min} onChange={e => set('split_second_in_window_min', Number(e.target.value))} /></Field>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Supports crossing midnight — a target earlier than the shift start is treated as next day.</p>
                </div>

                {/* FINAL OUT */}
                <div className="rounded-lg bg-white border border-slate-200 p-3 space-y-2">
                  <p className="text-xs font-bold text-blue-700">FINAL OUT</p>
                  <div className="grid grid-cols-3 gap-2">
                    <Field label="Final Punch Out Earliest"><Input type="time" value={form.split_final_out_earliest} onChange={e => set('split_final_out_earliest', e.target.value)} /></Field>
                    <Field label="Enable Before (min)"><Input type="number" value={form.split_final_out_enable_before_min} onChange={e => set('split_final_out_enable_before_min', Number(e.target.value))} /></Field>
                    <Field label="Final Punch Out Latest"><Input type="time" value={form.split_final_out_latest} onChange={e => set('split_final_out_latest', e.target.value)} /></Field>
                  </div>
                  <p className="text-[10px] text-muted-foreground">Earliest/latest support next-day times for cross-midnight shifts.</p>
                </div>

                {/* Break + effective dates */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-1">
                  <Field label="Split Break Start"><Input type="time" value={form.split_break_start} onChange={e => set('split_break_start', e.target.value)} /></Field>
                  <Field label="Split Break End"><Input type="time" value={form.split_break_end} onChange={e => set('split_break_end', e.target.value)} /></Field>
                  <Field label="Effective From"><Input type="date" value={form.split_effective_from} onChange={e => set('split_effective_from', e.target.value)} /></Field>
                  <Field label="Effective To"><Input type="date" value={form.split_effective_to} onChange={e => set('split_effective_to', e.target.value)} /></Field>
                </div>
              </div>
            )}
          </div>

          {/* ── Assign Employees ── */}
          <ShiftAssignEmployees employees={employees} selectedIds={selectedIds} setSelectedIds={setSelectedIds} />
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form, selectedIds)} disabled={!form.shift_name?.trim()}>{shift.id ? 'Update Shift' : 'Save Shift'}</Button>
        </div>
      </Card>
    </div>
  );
}

// ── Holidays ──
function HolidaysSettings({ holidays, canEdit }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);

  const save = async (data) => {
    try {
      if (editing?.id) {
        await base44.entities.AttendanceHoliday.update(editing.id, { ...data, updated_by: user?.email });
      } else {
        await base44.entities.AttendanceHoliday.create({ ...data, updated_by: user?.email });
      }
      qc.invalidateQueries({ queryKey: ['attendance-holidays'] });
      toast({ title: 'Holiday saved.' });
      setEditing(null);
    } catch (e) { toast({ title: 'Save failed', description: e.message, variant: 'destructive' }); }
  };

  const del = async (id) => {
    if (!confirm('Delete this holiday?')) return;
    try {
      await base44.entities.AttendanceHoliday.delete(id);
      qc.invalidateQueries({ queryKey: ['attendance-holidays'] });
      toast({ title: 'Holiday deleted.' });
    } catch (e) { toast({ title: 'Delete failed', description: e.message, variant: 'destructive' }); }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Holiday Management</h3>
          <p className="text-sm text-muted-foreground">Public, company, and emergency holidays. Employees are not marked Absent on holidays.</p>
        </div>
        {canEdit && <Button onClick={() => setEditing({})} className="bg-emerald-600 hover:bg-emerald-700">
          <Plus className="w-4 h-4" /> Add Holiday
        </Button>}
      </div>
      <div className="space-y-2">
        {(holidays || []).map(h => (
          <div key={h.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card">
            <div>
              <p className="font-medium text-foreground">{h.holiday_name}</p>
              <p className="text-xs text-muted-foreground">
                {h.holiday_date} · {h.holiday_type} {h.repeat_yearly ? '· Repeats yearly' : ''}
                {h.company ? ` · ${h.company}` : ''}
              </p>
            </div>
            {canEdit && (
              <div className="flex gap-1">
                <button onClick={() => setEditing(h)} className="p-1.5 rounded hover:bg-muted"><Edit2 className="w-3.5 h-3.5" /></button>
                <button onClick={() => del(h.id)} className="p-1.5 rounded hover:bg-red-50 text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            )}
          </div>
        ))}
        {(!holidays || holidays.length === 0) && (
          <p className="text-sm text-muted-foreground text-center py-8">No holidays configured.</p>
        )}
      </div>
      {editing && <HolidayEditDialog holiday={editing} onClose={() => setEditing(null)} onSave={save} />}
    </Card>
  );
}

function HolidayEditDialog({ holiday, onClose, onSave }) {
  const [form, setForm] = useState({
    holiday_name: holiday.holiday_name || '',
    holiday_date: holiday.holiday_date || '',
    holiday_type: holiday.holiday_type || 'Public Holiday',
    repeat_yearly: holiday.repeat_yearly ?? false,
    company: holiday.company || '',
    remarks: holiday.remarks || '',
  });

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <Card className="max-w-md w-full" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="font-semibold">{holiday.id ? 'Edit Holiday' : 'New Holiday'}</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-4 space-y-3">
          <Field label="Holiday Name"><Input value={form.holiday_name} onChange={e => setForm(f => ({ ...f, holiday_name: e.target.value }))} /></Field>
          <Field label="Holiday Date"><Input type="date" value={form.holiday_date} onChange={e => setForm(f => ({ ...f, holiday_date: e.target.value }))} /></Field>
          <Field label="Holiday Type">
            <select value={form.holiday_type} onChange={e => setForm(f => ({ ...f, holiday_type: e.target.value }))}
              className="w-full h-9 rounded-md border border-input bg-transparent px-3 text-sm">
              <option>Public Holiday</option>
              <option>Company Holiday</option>
              <option>Emergency Holiday</option>
            </select>
          </Field>
          <Field label="Company (optional, empty = all)"><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.repeat_yearly} onChange={e => setForm(f => ({ ...f, repeat_yearly: e.target.checked }))} />
            Repeat yearly
          </label>
          <Field label="Remarks"><Input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></Field>
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-border">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(form)} disabled={!form.holiday_name?.trim() || !form.holiday_date}>Save Holiday</Button>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-muted-foreground uppercase">{label}</label>
      {children}
    </div>
  );
}