import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useRbac } from '@/lib/useRbac';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useToast } from '@/components/ui/use-toast';
import OrganizationSubmenuNav from '@/components/common/OrganizationSubmenuNav';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Pencil, Search, Building2, Loader2, ChevronRight } from 'lucide-react';

const UNIT_TYPES = ['Corporate', 'Business Unit', 'Division', 'Department', 'Section', 'Team'];
const TYPE_COLORS = {
  Corporate: 'bg-indigo-100 text-indigo-700', 'Business Unit': 'bg-blue-100 text-blue-700',
  Division: 'bg-emerald-100 text-emerald-700', Department: 'bg-violet-100 text-violet-700',
  Section: 'bg-amber-100 text-amber-700', Team: 'bg-cyan-100 text-cyan-700',
};
const EMPTY = { unit_code: '', unit_name: '', unit_type: 'Department', level: 1, parent_unit_id: '', project_id: '', company: '', head_of_unit_id: '', head_of_unit_name: '', display_order: 0, remarks: '' };

export default function OrganizationUnits() {
  const { can } = useRbac();
  const user = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canManage = can('organization.units.manage');

  const { data: units = [], isLoading } = useQuery({
    queryKey: ['org-units'],
    queryFn: async () => (await base44.entities.OrgUnit.filter({ is_active: { $ne: false } }, { sort: 'level', limit: 5000 })).items,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['org-projects'],
    queryFn: async () => (await base44.entities.OrganizationProject.filter({}, { sort: '-created_date', limit: 1000 })).items,
  });
  const { data: employees = [] } = useQuery({
    queryKey: ['employees-active'],
    queryFn: async () => (await base44.entities.Employee.filter({ is_active: true }, { sort: '-created_date', limit: 100000 })).items,
  });

  const projectName = (id) => projects.find(p => p.id === id)?.project_name || '';
  const parentName = (id) => units.find(u => u.id === id)?.unit_name || '';

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return units.filter(u => {
      if (typeFilter !== 'all' && u.unit_type !== typeFilter) return false;
      if (projectFilter !== 'all') {
        const isCorporate = !u.project_id;
        if (projectFilter === 'corporate' && !isCorporate) return false;
        if (projectFilter !== 'corporate' && u.project_id !== projectFilter) return false;
      }
      if (!q) return true;
      return [u.unit_code, u.unit_name, u.company, u.head_of_unit_name].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [units, search, typeFilter, projectFilter]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (u) => { setEditing(u); setForm({ ...EMPTY, ...u }); setModalOpen(true); };

  const save = async () => {
    if (!form.unit_name?.trim()) { toast({ title: 'Unit name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        level: Number(form.level) || 1,
        display_order: Number(form.display_order) || 0,
        parent_unit_name: form.parent_unit_id ? parentName(form.parent_unit_id) : '',
        project_name: form.project_id ? projectName(form.project_id) : '',
        head_of_unit_name: form.head_of_unit_id ? (employees.find(e => e.id === form.head_of_unit_id)?.name || '') : '',
        updated_by: user?.email || '',
      };
      if (editing) await base44.entities.OrgUnit.update(editing.id, payload);
      else await base44.entities.OrgUnit.create(payload);
      qc.invalidateQueries({ queryKey: ['org-units'] });
      toast({ title: editing ? 'Unit updated' : 'Unit created' });
      setModalOpen(false);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  // Prevent setting a unit's parent to itself
  const parentOptions = units.filter(u => u.id !== editing?.id);

  return (
    <div className="space-y-5">
      <OrganizationSubmenuNav />
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Building2 className="w-6 h-6 text-emerald-600" /> Departments & Divisions</h2>
          <p className="text-sm text-muted-foreground mt-1">Build the corporate and project organizational hierarchy.</p>
        </div>
        {canManage && <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> New Unit</Button>}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search unit code, name, company, head..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="All types" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {UNIT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="All projects" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            <SelectItem value="corporate">Corporate / Shared</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <Table className="table-list-view">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">Unit Name</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Level</TableHead>
                <TableHead className="text-xs">Parent Unit</TableHead>
                <TableHead className="text-xs">Project</TableHead>
                <TableHead className="text-xs">Head of Unit</TableHead>
                <TableHead className="text-xs">Company</TableHead>
                {canManage && <TableHead className="text-xs text-right sticky right-0 bg-muted/50">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center py-10 text-muted-foreground">No units found.</TableCell></TableRow>
              ) : filtered.map(u => (
                <TableRow key={u.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs font-mono uppercase">{u.unit_code || '—'}</TableCell>
                  <TableCell className="text-xs font-medium uppercase">{u.unit_name}</TableCell>
                  <TableCell><Badge className={TYPE_COLORS[u.unit_type] || 'bg-muted'} variant="secondary">{u.unit_type}</Badge></TableCell>
                  <TableCell className="text-xs">{u.level || 1}</TableCell>
                  <TableCell className="text-xs">{u.parent_unit_name || <span className="text-muted-foreground">— Top level —</span>}</TableCell>
                  <TableCell className="text-xs uppercase">{u.project_name || (u.project_id ? '' : 'Corporate')}</TableCell>
                  <TableCell className="text-xs uppercase">{u.head_of_unit_name || '—'}</TableCell>
                  <TableCell className="text-xs uppercase">{u.company || '—'}</TableCell>
                  {canManage && (
                    <TableCell className="text-right sticky right-0 bg-white">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(u)}><Pencil className="w-3.5 h-3.5" /></Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Unit' : 'New Organizational Unit'}</DialogTitle>
            <DialogDescription>Create a department, division, section, or team in the hierarchy.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div><Label>Unit Code</Label><Input value={form.unit_code} onChange={e => setForm({ ...form, unit_code: e.target.value })} placeholder="DEPT-QA" /></div>
            <div><Label>Unit Name *</Label><Input value={form.unit_name} onChange={e => setForm({ ...form, unit_name: e.target.value })} /></div>
            <div><Label>Unit Type</Label>
              <Select value={form.unit_type} onValueChange={v => setForm({ ...form, unit_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{UNIT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Level</Label><Input type="number" min={1} value={form.level} onChange={e => setForm({ ...form, level: e.target.value })} /></div>
            <div><Label>Parent Unit</Label>
              <Select value={form.parent_unit_id || 'none'} onValueChange={v => setForm({ ...form, parent_unit_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Top level —</SelectItem>
                  {parentOptions.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name} ({u.unit_type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Project</Label>
              <Select value={form.project_id || 'corporate'} onValueChange={v => setForm({ ...form, project_id: v === 'corporate' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corporate">Corporate / Shared</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Company (contractor unit)</Label><Input value={form.company} onChange={e => setForm({ ...form, company: e.target.value })} /></div>
            <div><Label>Display Order</Label><Input type="number" value={form.display_order} onChange={e => setForm({ ...form, display_order: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Head of Unit</Label>
              <Select value={form.head_of_unit_id || 'none'} onValueChange={v => setForm({ ...form, head_of_unit_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select from Master List" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name} · {e.company}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {editing ? 'Save Changes' : 'Create Unit'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}