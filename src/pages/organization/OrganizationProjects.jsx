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
import { Plus, Pencil, Search, Briefcase, Loader2 } from 'lucide-react';

const STATUSES = ['Planning', 'Active', 'On Hold', 'Completed', 'Closed', 'Archived'];
const STATUS_COLORS = {
  Active: 'bg-green-100 text-green-700', Planning: 'bg-blue-100 text-blue-700',
  'On Hold': 'bg-amber-100 text-amber-700', Completed: 'bg-emerald-100 text-emerald-700',
  Closed: 'bg-slate-100 text-slate-700', Archived: 'bg-zinc-100 text-zinc-500',
};
const EMPTY = { project_code: '', project_name: '', description: '', client: '', main_contractor: '', consultant: '', location: '', start_date: '', planned_completion_date: '', actual_completion_date: '', status: 'Planning', logo_url: '', remarks: '' };

export default function OrganizationProjects() {
  const { can } = useRbac();
  const user = useCurrentUser();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canManage = can('organization.projects.manage');

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['org-projects'],
    queryFn: async () => (await base44.entities.OrganizationProject.filter({}, '-created_date', 1000)).items,
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return projects.filter(p => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (!q) return true;
      return [p.project_code, p.project_name, p.client, p.main_contractor, p.location].some(v => (v || '').toLowerCase().includes(q));
    });
  }, [projects, search, statusFilter]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setModalOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...EMPTY, ...p }); setModalOpen(true); };

  const save = async () => {
    if (!form.project_name?.trim()) { toast({ title: 'Project name is required', variant: 'destructive' }); return; }
    setSaving(true);
    try {
      const payload = { ...form, updated_by: user?.email || '' };
      if (editing) await base44.entities.OrganizationProject.update(editing.id, payload);
      else await base44.entities.OrganizationProject.create(payload);
      qc.invalidateQueries({ queryKey: ['org-projects'] });
      toast({ title: editing ? 'Project updated' : 'Project created' });
      setModalOpen(false);
    } catch (e) {
      toast({ title: 'Save failed', description: e.message, variant: 'destructive' });
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-5">
      <OrganizationSubmenuNav />
      <div className="flex flex-col sm:flex-row justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Briefcase className="w-6 h-6 text-violet-600" /> Projects & Organizations</h2>
          <p className="text-sm text-muted-foreground mt-1">Manage Oil & Gas projects and their organizational structures.</p>
        </div>
        {canManage && (
          <Button onClick={openNew} className="gap-1.5"><Plus className="w-4 h-4" /> New Project</Button>
        )}
      </div>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search project code, name, client, location..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="table-scroll-x">
          <Table className="table-list-view">
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="text-xs">Code</TableHead>
                <TableHead className="text-xs">Project Name</TableHead>
                <TableHead className="text-xs">Client</TableHead>
                <TableHead className="text-xs">Main Contractor</TableHead>
                <TableHead className="text-xs">Location</TableHead>
                <TableHead className="text-xs">Start</TableHead>
                <TableHead className="text-xs">Planned End</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                {canManage && <TableHead className="text-xs text-right sticky right-0 bg-muted/50">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center py-10 text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin inline" /> Loading...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={canManage ? 9 : 8} className="text-center py-10 text-muted-foreground">No projects found.</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id} className="hover:bg-muted/30">
                  <TableCell className="text-xs font-mono uppercase">{p.project_code || '—'}</TableCell>
                  <TableCell className="text-xs font-medium uppercase">{p.project_name}</TableCell>
                  <TableCell className="text-xs uppercase">{p.client || '—'}</TableCell>
                  <TableCell className="text-xs uppercase">{p.main_contractor || '—'}</TableCell>
                  <TableCell className="text-xs uppercase">{p.location || '—'}</TableCell>
                  <TableCell className="text-xs">{p.start_date || '—'}</TableCell>
                  <TableCell className="text-xs">{p.planned_completion_date || '—'}</TableCell>
                  <TableCell><Badge className={STATUS_COLORS[p.status] || 'bg-muted'} variant="secondary">{p.status}</Badge></TableCell>
                  {canManage && (
                    <TableCell className="text-right sticky right-0 bg-white">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
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
            <DialogTitle>{editing ? 'Edit Project' : 'New Project'}</DialogTitle>
            <DialogDescription>{editing ? 'Update project details.' : 'Register a new Oil & Gas project.'}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
            <div><Label>Project Code</Label><Input value={form.project_code} onChange={e => setForm({ ...form, project_code: e.target.value })} placeholder="GSOQ-PRJ-001" /></div>
            <div><Label>Project Name *</Label><Input value={form.project_name} onChange={e => setForm({ ...form, project_name: e.target.value })} /></div>
            <div><Label>Client</Label><Input value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} /></div>
            <div><Label>Main Contractor</Label><Input value={form.main_contractor} onChange={e => setForm({ ...form, main_contractor: e.target.value })} /></div>
            <div><Label>Consultant</Label><Input value={form.consultant} onChange={e => setForm({ ...form, consultant: e.target.value })} /></div>
            <div><Label>Location</Label><Input value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} /></div>
            <div><Label>Start Date</Label><Input type="date" value={form.start_date || ''} onChange={e => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Planned Completion</Label><Input type="date" value={form.planned_completion_date || ''} onChange={e => setForm({ ...form, planned_completion_date: e.target.value })} /></div>
            <div><Label>Actual Completion</Label><Input type="date" value={form.actual_completion_date || ''} onChange={e => setForm({ ...form, actual_completion_date: e.target.value })} /></div>
            <div><Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2"><Label>Description</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} /></div>
            <div className="sm:col-span-2"><Label>Remarks</Label><Textarea value={form.remarks} onChange={e => setForm({ ...form, remarks: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null} {editing ? 'Save Changes' : 'Create Project'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}