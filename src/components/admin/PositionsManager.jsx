import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Pencil, Trash2, Plus, Check, X, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useLookupOptions } from '@/hooks/useLookupOptions';
import DirIndirAssignToggle from './DirIndirAssignToggle';

const TYPE_LABELS = {
  position_application: 'Position (Application)',
  designation_org_chart: 'Designation (Org Chart)',
  both: 'Both',
};

const TYPE_COLORS = {
  position_application: 'bg-blue-100 text-blue-700',
  designation_org_chart: 'bg-emerald-100 text-emerald-700',
  both: 'bg-purple-100 text-purple-700',
};

export default function PositionsManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { departmentOptions } = useLookupOptions();
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [newRow, setNewRow] = useState({ name: '', type: 'position_application', department: '', rank: '' });
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterDept, setFilterDept] = useState('all');

  const { data: positions = [], isLoading } = useQuery({
    queryKey: ['lookupPositions'],
    queryFn: () => base44.entities.LookupPosition.list(),
  });

  const filtered = useMemo(() => {
    let result = positions;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(p => p.name?.toLowerCase().includes(q));
    }
    if (filterType !== 'all') {
      result = result.filter(p => p.type === filterType || (filterType === 'both' && p.type === 'both'));
    }
    if (filterDept !== 'all') {
      result = result.filter(p => p.department === filterDept);
    }
    return result.sort((a, b) => {
      const rankA = a.rank ?? 9999;
      const rankB = b.rank ?? 9999;
      return rankA - rankB || (a.name || '').localeCompare(b.name || '');
    });
  }, [positions, search, filterType, filterDept]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.LookupPosition.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lookupPositions'] }); setShowNew(false); setNewRow({ name: '', type: 'position_application', department: '', rank: '' }); toast({ title: 'Position added' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.LookupPosition.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lookupPositions'] }); setEditingId(null); toast({ title: 'Position updated' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LookupPosition.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lookupPositions'] }); toast({ title: 'Position deleted' }); },
  });

  const startEdit = (p) => { setEditingId(p.id); setEditDraft({ name: p.name, type: p.type, department: p.department || '__any__', rank: p.rank ?? '' }); };
  const saveEdit = () => {
    const dept = editDraft.department === '__any__' ? null : (editDraft.department || null);
    updateMutation.mutate({ id: editingId, data: { name: editDraft.name, type: editDraft.type, department: dept, rank: editDraft.rank ? Number(editDraft.rank) : null, is_active: true } });
  };
  const saveNew = () => {
    if (!newRow.name || !newRow.type) return;
    const dept = newRow.department === '__any__' ? null : (newRow.department || null);
    createMutation.mutate({ name: newRow.name, type: newRow.type, department: dept, rank: newRow.rank ? Number(newRow.rank) : null, is_active: true });
  };

  const toggleActive = (p) => {
    updateMutation.mutate({ id: p.id, data: { is_active: !p.is_active } });
  };

  // Saves the position's DIR/INDIR classification, then cascades the same value
  // to every personnel record holding that position / designation.
  const setDirIndir = async (p, value) => {
    await base44.entities.LookupPosition.update(p.id, { dir_indir: value });
    qc.invalidateQueries({ queryKey: ['lookupPositions'] });
    try {
      const res = await base44.functions.invoke('syncPositionDirIndir', {
        position_name: p.name,
        type: p.type,
        dir_indir: value,
      });
      qc.invalidateQueries({ queryKey: ['employees-active'] });
      qc.invalidateQueries({ queryKey: ['employees-inactive'] });
      toast({
        title: `${p.name} set to ${value}`,
        description: `${res.data?.matched ?? 0} personnel record(s) updated in the Master List.`,
      });
    } catch (err) {
      toast({ title: 'Position saved, but personnel records were not updated', variant: 'destructive' });
    }
  };

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Positions / Designations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage approved position and designation lists. Only active entries appear in dropdowns.
          </p>
        </div>
        <Button size="sm" onClick={() => { setShowNew(true); }} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Position
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative max-w-xs flex-1 min-w-[180px]">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-xs" placeholder="Search position..." value={search} onChange={e => setSearch(e.target.value)} />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="position_application">Position (Application)</SelectItem>
            <SelectItem value="designation_org_chart">Designation (Org Chart)</SelectItem>
            <SelectItem value="both">Both</SelectItem>
          </SelectContent>
        </Select>
        {departmentOptions.length > 0 && (
          <Select value={filterDept} onValueChange={setFilterDept}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departmentOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <span className="text-xs text-muted-foreground">{filtered.length} of {positions.length} entries</span>
      </div>

      {/* Add New Row */}
      {showNew && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg flex-wrap">
          <Input autoFocus value={newRow.name} onChange={e => setNewRow(p => ({ ...p, name: e.target.value }))} placeholder="Position name" className="h-8 text-xs flex-1 min-w-[160px]" onKeyDown={e => e.key === 'Enter' && saveNew()} />
          <Select value={newRow.type} onValueChange={v => setNewRow(p => ({ ...p, type: v }))}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="position_application">Position (Application)</SelectItem>
              <SelectItem value="designation_org_chart">Designation (Org Chart)</SelectItem>
              <SelectItem value="both">Both</SelectItem>
            </SelectContent>
          </Select>
          <Select value={newRow.department} onValueChange={v => setNewRow(p => ({ ...p, department: v }))}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Any Department" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__any__">Any Department</SelectItem>
              {departmentOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="number" value={newRow.rank} onChange={e => setNewRow(p => ({ ...p, rank: e.target.value }))} placeholder="Rank" className="h-8 text-xs w-20" />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveNew}><Check className="w-4 h-4 text-green-600" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setShowNew(false); setNewRow({ name: '', type: 'position_application', department: '', rank: '' }); }}><X className="w-4 h-4 text-red-500" /></Button>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="text-center text-xs text-muted-foreground py-8">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-8">{positions.length === 0 ? 'No positions defined yet.' : 'No results match your filters.'}</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs">Position Name</TableHead>
              <TableHead className="text-xs">Type</TableHead>
              <TableHead className="text-xs">Department</TableHead>
              <TableHead className="text-xs">DIR/INDIR</TableHead>
              <TableHead className="text-xs">Rank</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(p => (
              <TableRow key={p.id} className={cn(!p.is_active && 'opacity-50')}>
                <TableCell className="py-1.5">
                  {editingId === p.id
                    ? <Input autoFocus value={editDraft.name} onChange={e => setEditDraft(d => ({ ...d, name: e.target.value }))} className="h-7 text-xs" onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }} />
                    : <span className="text-sm">{p.name}</span>}
                </TableCell>
                <TableCell className="py-1.5">
                  {editingId === p.id ? (
                    <Select value={editDraft.type} onValueChange={v => setEditDraft(d => ({ ...d, type: v }))}>
                      <SelectTrigger className="h-7 text-xs w-40"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="position_application">Position (Application)</SelectItem>
                        <SelectItem value="designation_org_chart">Designation (Org Chart)</SelectItem>
                        <SelectItem value="both">Both</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${TYPE_COLORS[p.type] || 'bg-slate-100 text-slate-700'}`}>{TYPE_LABELS[p.type] || p.type}</span>
                  )}
                </TableCell>
                <TableCell className="py-1.5">
                  {editingId === p.id
                    ? <Select value={editDraft.department} onValueChange={v => setEditDraft(d => ({ ...d, department: v }))}>
                        <SelectTrigger className="h-7 text-xs w-40"><SelectValue placeholder="Any" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__any__">Any</SelectItem>
                          {departmentOptions.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    : <span className="text-xs text-muted-foreground">{p.department || 'Any'}</span>}
                </TableCell>
                <TableCell className="py-1.5">
                  <DirIndirAssignToggle value={p.dir_indir} onToggle={(v) => setDirIndir(p, v)} />
                </TableCell>
                <TableCell className="py-1.5">
                  {editingId === p.id
                    ? <Input type="number" value={editDraft.rank} onChange={e => setEditDraft(d => ({ ...d, rank: e.target.value }))} className="h-7 text-xs w-16" />
                    : <span className="text-xs text-muted-foreground">{p.rank ?? '—'}</span>}
                </TableCell>
                <TableCell className="py-1.5">
                  <button
                    onClick={() => toggleActive(p)}
                    className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.is_active ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200'}`}
                  >
                    {p.is_active ? 'Active' : 'Inactive'}
                  </button>
                </TableCell>
                <TableCell className="py-1.5">
                  {editingId === p.id ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="w-3.5 h-3.5 text-green-600" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(p)}><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(p.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Card>
  );
}

// Helper since cn from utils may not be imported here
function cn(...classes) {
  return classes.filter(Boolean).join(' ');
}