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
import { Plus, Pencil, Search, GitBranch, Loader2 } from 'lucide-react';

const STATUS_OPTS = ['Active', 'Vacant', 'On Hold', 'Closed'];
const STATUS_COLORS = {
  Active: 'bg-green-100 text-green-700', Vacant: 'bg-rose-100 text-rose-700',
  'On Hold': 'bg-amber-100 text-amber-700', Closed: 'bg-slate-100 text-slate-700',
};
const EMP_CATS = ['Direct', 'Indirect', 'Contract', 'Temporary'];
const EMPTY = { position_code: '', position_title: '', project_id: '', unit_id: '', reports_to_position_id: '', job_grade: '', position_level: '', employment_category: 'Direct', approved_headcount: 1, filled_headcount: 0, status: 'Vacant', effective_date: '', job_description: '', responsibilities: '', remarks: '' };

export default function OrganizationPositions() {
  const { can } = useRbac();
  const user = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [projectFilter, setProjectFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canManage = can('organization.positions.manage');

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['org-positions'],
    queryFn: async () => (await base44.entities.OrgPosition.filter({ is_active: { $ne: false } }, { sort: '-created_date', limit: 5000 })).items,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ['org-projects'],
    queryFn: async () => (await base44.entities.OrganizationProject.filter({}, { sort: '-created_date', limit: 1000 })).items,
  });
  const { data: units = [] } = useQuery({
    queryKey: ['org-units'],
    queryFn: async () => (await base44.entities.OrgUnit.filter({ is_active: { $ne: false } }, { sort: 'level', limit: 5000 })).items,
  });

  const projectName = (id) => projects.find(p => p.id === id)?.project_name || '';
  const unitName = (id) => units.find(u => u.id === id)?.unit_name || '';
  const posTitle = (id) => positions.find(p => p.id === id)?.position_title || '';

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return positions.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (projectFilter !== 'all') {
        const isCorp = !p.project_id;
        if (projectFilter === 'corporate' && !isCorp) return false;
        if (projectFilter !== 'corporate' && p.project_id !== projectFilter) return false;
      }
      if (unitFilter !== 'all' && p.unit_id !== unitFilter) return false;
      if (!q) return true;
      return [p.position_code, p.position_title, p.job_grade, p.position_level].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [positions, search, statusFilter, projectFilter, unitFilter]);

  const totals = useMemo(() => {
    const approved = filtered.reduce((s, p) => s + (p.approved_headcount || 0), 0);
    const filled = filtered.reduce((s, p) => s + (p.filled_headcount || 0), 0);
    return { approved, filled, vacant: Math.max(0, approved - filled) };
  }, [filtered]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...EMPTY, ...p }); setModalOpen(true); };

  const save = async () => {
    if (!form.position_title?.trim()) { toast({ title: 'Position title is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        approved_headcount: Number(form.approved_headcount) || 0,
        filled_headcount: Number(form.filled_headcount) || 0,
        project_name: form.project_id ? projectName(form.project_id) : '',
        unit_name: form.unit_id ? unitName(form.unit_id) : '',
        reports_to_position_title: form.reports_to_position_id ? posTitle(form.reports_to_position_id) : '',
        updated_by: user?.email || '',
      };
      if (editing) await base44.entities.OrgPosition.update(editing.id, payload);
      else await base44.entities.OrgPosition.create(payload);
      qc.invalidateQueries({ queryKey: ['org-positions'] });
      toast({ title: editing ? 'Position updated' : 'Position created' });
      setModalOpen(false);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  const reportsToOptions = positions.filter(p => p.id !== editing?.id);

  return (
    <div className="space-y-5">
      <OrganizationSubmenuNav />
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><GitBranch className="w-6 h-6 text-orange-600" /> Position Management</h2>
          <p className="text-sm text-muted-foreground mt-1">Position registry with approved headcount and vacancy tracking.</p>
        </div>
        {canManage && <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> New Position</Button>}
      </div>

      {/* Headcount summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3"><p className="text-xs text-muted-foreground">Approved Headcount</p><p className="text-xl font-bold">{totals.approved}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Filled</p><p className="text-xl font-bold text-green-600">{totals.filled}</p></Card>
        <Card className="p-3"><p className="text-xs text-muted-foreground">Vacant</p><p className="text-xl font-bold text-rose-600">{totals.vacant}</p></Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search position code, title, grade, level..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
        <Select value={unitFilter} onValueChange={setUnitFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All units" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All units</SelectItem>
            {units.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <Table className="table-list-view">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">Position Title</TableHead>
                <TableHead className="text-xs">Project</TableHead>
                <TableHead className="text-xs">Unit</TableHead>
                <TableHead className="text-xs">Reports To</TableHead>
                <TableHead className="text-xs">Grade / Level</TableHead>
                <TableHead className="text-xs">Category</TableHead>
                <TableHead className="text-xs text-center">Approved</TableHead>
                <TableHead className="text-xs text-center">Filled</TableHead>
                <TableHead className="text-xs text-center">Vacant</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                {canManage && <TableHead className="text-xs text-right sticky right-0 bg-muted/50">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canManage ? 12 : 11} className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={canManage ? 12 : 11} className="text-center py-10 text-muted-foreground">No positions found.</TableCell></TableRow>
              ) : filtered.map(p => {
                const vacant = Math.max(0, (p.approved_headcount || 0) - (p.filled_headcount || 0));
                return (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="text-xs font-mono uppercase">{p.position_code || '—'}</TableCell>
                    <TableCell className="text-xs font-medium uppercase">{p.position_title}</TableCell>
                    <TableCell className="text-xs uppercase">{p.project_name || (p.project_id ? '' : 'Corporate')}</TableCell>
                    <TableCell className="text-xs uppercase">{p.unit_name || '—'}</TableCell>
                    <TableCell className="text-xs uppercase">{p.reports_to_position_title || '—'}</TableCell>
                    <TableCell className="text-xs uppercase">{[p.job_grade, p.position_level].filter(Boolean).join(' / ') || '—'}</TableCell>
                    <TableCell className="text-xs uppercase">{p.employment_category || '—'}</TableCell>
                    <TableCell className="text-xs text-center">{p.approved_headcount || 0}</TableCell>
                    <TableCell className="text-xs text-center text-green-600">{p.filled_headcount || 0}</TableCell>
                    <TableCell className={`text-xs text-center ${vacant > 0 ? 'text-rose-600 font-semibold' : ''}`}>{vacant}</TableCell>
                    <TableCell><Badge className={STATUS_COLORS[p.status] || 'bg-muted'} variant="secondary">{p.status}</Badge></TableCell>
                    {canManage && (
                      <TableCell className="text-right sticky right-0 bg-white">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Position' : 'New Position'}</DialogTitle>
            <DialogDescription>Positions exist independently of employees and carry approved headcount.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div><Label>Position Code</Label><Input value={form.position_code} onChange={e => setForm({ ...form, position_code: e.target.value })} placeholder="POS-QA-MGR-001" /></div>
            <div><Label>Position Title *</Label><Input value={form.position_title} onChange={e => setForm({ ...form, position_title: e.target.value })} /></div>
            <div><Label>Project</Label>
              <Select value={form.project_id || 'corporate'} onValueChange={v => setForm({ ...form, project_id: v === 'corporate' ? '' : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="corporate">Corporate / Shared</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.project_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Department / Unit</Label>
              <Select value={form.unit_id || 'none'} onValueChange={v => setForm({ ...form, unit_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {units.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name} ({u.unit_type})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reports To Position</Label>
              <Select value={form.reports_to_position_id || 'none'} onValueChange={v => setForm({ ...form, reports_to_position_id: v === 'none' ? '' : v })}>
                <SelectTrigger><SelectValue placeholder="Select parent position" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None (top) —</SelectItem>
                  {reportsToOptions.map(p => <SelectItem key={p.id} value={p.id}>{p.position_title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Employment Category</Label>
              <Select value={form.employment_category} onValueChange={v => setForm({ ...form, employment_category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{EMP_CATS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Job Grade</Label><Input value={form.job_grade} onChange={e => setForm({ ...form, job_grade: e.target.value })} /></div>
            <div><Label>Position Level</Label><Input value={form.position_level} onChange={e => setForm({ ...form, position_level: e.target.value })} placeholder="L1, Manager, Supervisor..." /></div>
            <div><Label>Approved Headcount</Label><Input type="number" min={0} value={form.approved_headcount} onChange={e => setForm({ ...form, approved_headcount: e.target.value })} /></div>
            <div><Label>Filled Headcount</Label><Input type="number" min={0} value={form.filled_headcount} onChange={e => setForm({ ...form, filled_headcount: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_OPTS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Effective Date</Label><Input type="date" value={form.effective_date || ''} onChange={e => setForm({ ...form, effective_date: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Job Description</Label><Textarea value={form.job_description} onChange={e => setForm({ ...form, job_description: e.target.value })} rows={2} /></div>
            <div className="sm:col-span-2"><Label>Responsibilities</Label><Textarea value={form.responsibilities} onChange={e => setForm({ ...form, responsibilities: e.target.value })} rows={2} /></div>
            <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {editing ? 'Save Changes' : 'Create Position'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}