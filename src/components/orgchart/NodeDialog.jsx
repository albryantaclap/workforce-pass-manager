import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Loader2, Link2 } from 'lucide-react';
import { CARD_STYLE_OPTIONS, DENSITY_OPTIONS, SHAPES, defaultNode } from '@/lib/orgChartConstants';

const FIELDS = [
  ['name', 'Full name'],
  ['designation', 'Position / designation'],
  ['department', 'Department'],
  ['company', 'Company'],
  ['project_name', 'Project'],
  ['employee_code', 'Employee ID'],
  ['pid', 'PID number'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['photo_url', 'Profile photo URL'],
  ['employment_status', 'Employment status'],
  ['manager_name', 'Reporting manager'],
  ['position_grade', 'Position grade'],
  ['planned_fill_date', 'Planned fill date'],
  ['footer_text', 'Footer line'],
  ['remarks', 'Remarks'],
];

export default function NodeDialog({ open, mode, node, position, onClose, onSubmit }) {
  const [form, setForm] = useState(null);
  const [tab, setTab] = useState('manual');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (node) setForm({ ...node });
    else setForm({ ...defaultNode('employee', position?.x || 0, position?.y || 0) });
    setTab('manual');
    setQuery('');
    setResults([]);
  }, [open, node, position]);

  if (!form) return null;
  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const search = async () => {
    const term = query.trim();
    if (!term) return;
    setSearching(true);
    try {
      const res = await base44.entities.Employee.filter({
        $or: [
          { name: { $regex: term, $options: 'i' } },
          { pid: term }, { qid_no: term }, { staff_no: term },
        ],
      }, { limit: 20, fields: ['name', 'position_application', 'designation_org_chart', 'department', 'company', 'pid', 'qid_no', 'staff_no', 'photo_url', 'email', 'contact_details', 'personnel_status'] });
      setResults(res.items || []);
    } finally {
      setSearching(false);
    }
  };

  const linkEmployee = (emp) => {
    setForm(prev => ({
      ...prev,
      linked_employee_id: emp.id,
      link_source: 'master_list',
      name: emp.name || '',
      designation: emp.designation_org_chart || emp.position_application || '',
      department: emp.department || '',
      company: emp.company || '',
      pid: emp.pid || '',
      qid: emp.qid_no || '',
      employee_code: emp.staff_no || '',
      email: emp.email || '',
      phone: emp.contact_details || '',
      photo_url: emp.photo_url || '',
      employment_status: emp.personnel_status || '',
    }));
    setTab('manual');
  };

  const submit = async () => {
    setSaving(true);
    try {
      await onSubmit(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!value) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add card' : `Edit card — ${node?.name || 'card'}`}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex items-center gap-1.5">
            {['employee', 'position', 'shape', 'text', 'note'].map(kind => (
              <button
                key={kind}
                type="button"
                onClick={() => set('node_kind', kind)}
                className={`px-2.5 py-1 rounded-full border text-[11px] capitalize ${form.node_kind === kind ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
              >
                {kind}
              </button>
            ))}
            {form.linked_employee_id && (
              <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-600">
                <Link2 className="w-3 h-3" /> Linked to Master List
              </span>
            )}
          </div>

          {form.node_kind === 'shape' && (
            <div className="flex flex-wrap gap-1.5">
              {SHAPES.map(shape => (
                <button
                  key={shape.key}
                  type="button"
                  onClick={() => set('shape', shape.key)}
                  className={`px-2 py-0.5 rounded-full border text-[10px] ${form.shape === shape.key ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-muted'}`}
                >
                  {shape.label}
                </button>
              ))}
            </div>
          )}

          {(form.node_kind === 'text' || form.node_kind === 'note') && (
            <textarea
              value={form.text_content || ''}
              onChange={(e) => set('text_content', e.target.value)}
              rows={3}
              placeholder="Card text"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-xs"
            />
          )}

          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(([key, label]) => (
              <label key={key} className="space-y-1">
                <span className="text-[11px] text-muted-foreground">{label}</span>
                <Input
                  value={form[key] ?? ''}
                  type={key === 'planned_fill_date' ? 'date' : 'text'}
                  onChange={(e) => set(key, e.target.value)}
                  className="h-8 text-xs"
                />
              </label>
            ))}
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Card style</span>
              <select value={form.display_style || 'business'} onChange={(e) => set('display_style', e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
                {CARD_STYLE_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Detail density</span>
              <select value={form.density || 'standard'} onChange={(e) => set('density', e.target.value)} className="w-full h-8 rounded-md border bg-background px-2 text-xs">
                {DENSITY_OPTIONS.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </label>
            <label className="space-y-1">
              <span className="text-[11px] text-muted-foreground">Accent colour</span>
              <input type="color" value={form.accent_color || '#254dd0'} onChange={(e) => set('accent_color', e.target.value)} className="w-full h-8 rounded-md border bg-background" />
            </label>
          </div>

          <div className="rounded-md border p-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">Custom fields</span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[10px]"
                onClick={() => set('extra_fields', [...(form.extra_fields || []), { label: '', value: '' }])}
              >
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {(form.extra_fields || []).map((field, index) => (
              <div key={index} className="flex gap-1.5">
                <Input
                  value={field.label}
                  placeholder="Label"
                  onChange={(e) => {
                    const next = [...form.extra_fields];
                    next[index] = { ...next[index], label: e.target.value };
                    set('extra_fields', next);
                  }}
                  className="h-7 text-[11px]"
                />
                <Input
                  value={field.value}
                  placeholder="Value"
                  onChange={(e) => {
                    const next = [...form.extra_fields];
                    next[index] = { ...next[index], value: e.target.value };
                    set('extra_fields', next);
                  }}
                  className="h-7 text-[11px]"
                />
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-red-600"
                  onClick={() => set('extra_fields', form.extra_fields.filter((_, i) => i !== index))}
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>

          <div className="rounded-md border p-2 space-y-2">
            <span className="text-[11px] font-semibold text-muted-foreground">Fill from the Master List</span>
            <div className="flex gap-1.5">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
                placeholder="Search by name, PID, QID or employee ID"
                className="h-8 text-xs"
              />
              <Button size="sm" className="h-8 px-2" onClick={search} disabled={searching}>
                {searching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
              </Button>
            </div>
            {!!results.length && (
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {results.map(emp => (
                  <button
                    key={emp.id}
                    type="button"
                    onClick={() => linkEmployee(emp)}
                    className="w-full text-left rounded px-2 py-1 hover:bg-muted text-[11px]"
                  >
                    <span className="font-medium">{emp.name}</span>
                    <span className="text-muted-foreground"> · {emp.designation_org_chart || emp.position_application || '—'}{emp.pid ? ` · ${emp.pid}` : ''}</span>
                  </button>
                ))}
              </div>
            )}
            <p className="text-[10px] text-muted-foreground">
              A linked card keeps a reference to the personnel record. Editing the card here never changes the Master List.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving}>
            {mode === 'create' ? 'Add card' : 'Save card'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}