import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import {
  MEDICAL_OPTIONS, GP_OPTIONS, TRAINING_OPTIONS, PID_OPTIONS, APPROVAL_STATUS_OPTIONS,
} from './approvedListHelpers';

const EMPTY = {
  full_name: '', qid_number: '', pid_no: '', mobile_number: '', company: '',
  designation_position: '', medical: '', gate_pass_status: '', training_status: '',
  project_id_status: '', manager_assigned: '', work_location: '',
  approval_status: 'Pending', approval_comments: '', approval_date: '', remarks: '',
  personnel_id: null, personnel_match_status: 'Unmatched',
};

export default function ApprovedRecordForm({ open, onClose, onSave, employees = [], initial = null }) {
  const [form, setForm] = useState(EMPTY);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...EMPTY, ...initial } : EMPTY);
      setSearch('');
    }
  }, [open, initial]);

  const matchedEmp = useMemo(
    () => (form.personnel_id ? employees.find(e => e.id === form.personnel_id) : null),
    [form.personnel_id, employees]
  );

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return employees
      .filter(e =>
        (e.name || '').toLowerCase().includes(q) ||
        (e.qid_no || '').toLowerCase().includes(q) ||
        (e.pid || '').toLowerCase().includes(q)
      )
      .slice(0, 10);
  }, [search, employees]);

  const selectPersonnel = (emp) => {
    setForm(f => ({
      ...f,
      personnel_id: emp.id,
      personnel_match_status: 'Matched',
      full_name: emp.name || f.full_name,
      qid_number: emp.qid_no || f.qid_number,
      pid_no: emp.pid || f.pid_no,
      mobile_number: emp.contact_details || f.mobile_number,
      company: emp.company || f.company,
      designation_position: emp.designation_org_chart || emp.position_application || f.designation_position,
      work_location: emp.current_location || f.work_location,
    }));
    setSearch('');
  };

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = () => {
    if (!form.full_name.trim()) return;
    onSave(form);
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit Approved Record' : 'Add Approved Record'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Personnel search & link */}
          <div className="border rounded-lg p-3 bg-muted/30">
            <Label className="text-xs font-semibold">Link to Personnel Record</Label>
            <div className="relative mt-1.5">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name, QID, PID..."
                className="h-8 pl-8 text-sm"
              />
            </div>
            {searchResults.length > 0 && (
              <div className="mt-1.5 border rounded-md bg-white max-h-40 overflow-y-auto">
                {searchResults.map(emp => (
                  <button
                    key={emp.id}
                    onClick={() => selectPersonnel(emp)}
                    className="w-full text-left px-3 py-1.5 text-xs hover:bg-accent border-b last:border-b-0"
                  >
                    <span className="font-medium">{emp.name}</span>
                    <span className="text-muted-foreground ml-2">{emp.qid_no || '—'} · {emp.company || '—'}</span>
                  </button>
                ))}
              </div>
            )}
            {matchedEmp && (
              <p className="text-xs text-emerald-700 mt-1.5">
                ✓ Linked: <strong>{matchedEmp.name}</strong> · {matchedEmp.company}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Full Name"><Input value={form.full_name} onChange={e => setField('full_name', e.target.value)} className="h-8 text-sm" /></Field>
            <Field label="QID Number"><Input value={form.qid_number} onChange={e => setField('qid_number', e.target.value)} className="h-8 text-sm" /></Field>
            <Field label="PID No."><Input value={form.pid_no} onChange={e => setField('pid_no', e.target.value)} className="h-8 text-sm" /></Field>
            <Field label="Mobile Number"><Input value={form.mobile_number} onChange={e => setField('mobile_number', e.target.value)} className="h-8 text-sm" /></Field>
            <Field label="Company"><Input value={form.company} onChange={e => setField('company', e.target.value)} className="h-8 text-sm" /></Field>
            <Field label="Designation / Position"><Input value={form.designation_position} onChange={e => setField('designation_position', e.target.value)} className="h-8 text-sm" /></Field>
            <SelectField label="Medical Status" value={form.medical} onChange={v => setField('medical', v)} options={MEDICAL_OPTIONS} />
            <SelectField label="Gate Pass Status" value={form.gate_pass_status} onChange={v => setField('gate_pass_status', v)} options={GP_OPTIONS} />
            <SelectField label="Training Status" value={form.training_status} onChange={v => setField('training_status', v)} options={TRAINING_OPTIONS} />
            <SelectField label="Project ID Status" value={form.project_id_status} onChange={v => setField('project_id_status', v)} options={PID_OPTIONS} />
            <Field label="Manager Assigned"><Input value={form.manager_assigned} onChange={e => setField('manager_assigned', e.target.value)} className="h-8 text-sm" /></Field>
            <Field label="Work Location"><Input value={form.work_location} onChange={e => setField('work_location', e.target.value)} className="h-8 text-sm" /></Field>
            <SelectField label="Approval Status" value={form.approval_status} onChange={v => setField('approval_status', v)} options={APPROVAL_STATUS_OPTIONS} />
            <Field label="Approval Date"><Input type="date" value={form.approval_date || ''} onChange={e => setField('approval_date', e.target.value)} className="h-8 text-sm" /></Field>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Approval Comments</Label>
            <Textarea value={form.approval_comments} onChange={e => setField('approval_comments', e.target.value)} rows={2} className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Remarks</Label>
            <Textarea value={form.remarks} onChange={e => setField('remarks', e.target.value)} rows={2} className="text-sm" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>{initial ? 'Update' : 'Add'} Record</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SelectField({ label, value, onChange, options }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <Select value={value || '__none'} onValueChange={v => onChange(v === '__none' ? '' : v)}>
        <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="__none">—</SelectItem>
          {options.map(o => <SelectItem key={o.value} value={o.value} className="text-sm">{o.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}