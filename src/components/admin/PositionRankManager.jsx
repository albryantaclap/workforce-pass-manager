import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Pencil, Trash2, Plus, Check, X, Search, Upload, ChevronDown, ChevronRight } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

// Rank level labels for display grouping
const RANK_LABELS = {
  1: 'Executive Management',
  2: 'Senior Management',
  3: 'Middle Management',
  4: 'Supervisory Level',
  5: 'Foreman Level',
  6: 'Professional Level',
  7: 'Specialist Level',
  8: 'Administrative / Office Level',
  9: 'Technical Skilled Level',
  10: 'Operators Level',
  11: 'Drivers Level',
  12: 'Skilled Trade Level',
  13: 'Semi-Skilled Level',
  14: 'General Workforce',
};

const RANK_COLORS = {
  1: 'bg-purple-100 text-purple-800',
  2: 'bg-indigo-100 text-indigo-800',
  3: 'bg-blue-100 text-blue-800',
  4: 'bg-cyan-100 text-cyan-800',
  5: 'bg-teal-100 text-teal-800',
  6: 'bg-green-100 text-green-800',
  7: 'bg-emerald-100 text-emerald-800',
  8: 'bg-amber-100 text-amber-800',
  9: 'bg-orange-100 text-orange-800',
  10: 'bg-red-100 text-red-800',
  11: 'bg-rose-100 text-rose-800',
  12: 'bg-pink-100 text-pink-800',
  13: 'bg-slate-100 text-slate-700',
  14: 'bg-gray-100 text-gray-700',
};

export default function PositionRankManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [newRow, setNewRow] = useState({ position: '', rank: '' });
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const { data: ranks = [], isLoading } = useQuery({
    queryKey: ['positionRanks'],
    queryFn: () => base44.entities.PositionRank.list(),
  });

  const sorted = useMemo(() => {
    const filtered = search.trim()
      ? ranks.filter(r => r.position?.toLowerCase().includes(search.toLowerCase()))
      : ranks;
    return [...filtered].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || (a.position || '').localeCompare(b.position || ''));
  }, [ranks, search]);

  // Group by rank level
  const grouped = useMemo(() => {
    const map = {};
    for (const r of sorted) {
      const key = r.rank ?? 9999;
      if (!map[key]) map[key] = [];
      map[key].push(r);
    }
    return Object.entries(map).sort(([a], [b]) => Number(a) - Number(b));
  }, [sorted]);

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.PositionRank.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positionRanks'] }); setShowNew(false); setNewRow({ position: '', rank: '' }); toast({ title: 'Position rank added' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.PositionRank.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positionRanks'] }); setEditingId(null); toast({ title: 'Position rank updated' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.PositionRank.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['positionRanks'] }); toast({ title: 'Position rank deleted' }); },
  });

  const startEdit = (r) => { setEditingId(r.id); setEditDraft({ position: r.position, rank: r.rank }); };
  const saveEdit = () => updateMutation.mutate({ id: editingId, data: { position: editDraft.position, rank: Number(editDraft.rank) } });
  const saveNew = () => {
    if (!newRow.position || newRow.rank === '') return;
    createMutation.mutate({ position: newRow.position, rank: Number(newRow.rank), is_active: true });
  };

  const toggleGroup = (key) => setCollapsedGroups(p => ({ ...p, [key]: !p[key] }));

  // Bulk import: each line "Position Name, Rank" or "Rank, Position Name"
  const handleBulkImport = async () => {
    const lines = importText.split('\n').map(l => l.trim()).filter(Boolean);
    const toCreate = [];
    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 2) continue;
      const maybeRank = Number(parts[0]);
      if (!isNaN(maybeRank) && maybeRank > 0) {
        toCreate.push({ position: parts.slice(1).join(',').trim(), rank: maybeRank, is_active: true });
      } else {
        const rankPart = Number(parts[parts.length - 1]);
        if (!isNaN(rankPart) && rankPart > 0) {
          toCreate.push({ position: parts.slice(0, -1).join(',').trim(), rank: rankPart, is_active: true });
        }
      }
    }
    if (toCreate.length === 0) { toast({ title: 'No valid rows found', description: 'Format: "Position Name, Rank" or "Rank, Position Name"', variant: 'destructive' }); return; }
    await base44.entities.PositionRank.bulkCreate(toCreate);
    qc.invalidateQueries({ queryKey: ['positionRanks'] });
    setShowImport(false);
    setImportText('');
    toast({ title: `Imported ${toCreate.length} positions` });
  };

  const rankBadgeClass = (rank) => RANK_COLORS[rank] || 'bg-slate-100 text-slate-700';

  return (
    <Card className="p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Position Hierarchy</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lower rank = higher seniority. Rank 1 = Executive Management … Rank 14 = General Workforce.
            Employees not found in this list are sorted to the bottom automatically.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button size="sm" variant="outline" onClick={() => setShowImport(s => !s)} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" /> Bulk Import
          </Button>
          <Button size="sm" onClick={() => { setShowNew(true); setShowImport(false); }} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> Add Position
          </Button>
        </div>
      </div>

      {/* Bulk Import Panel */}
      {showImport && (
        <div className="border rounded-lg p-4 bg-amber-50/50 space-y-2">
          <p className="text-xs font-semibold text-amber-800">Bulk Import</p>
          <p className="text-xs text-muted-foreground">One entry per line. Format: <code className="bg-white px-1 rounded">Position Name, Rank</code> or <code className="bg-white px-1 rounded">Rank, Position Name</code></p>
          <textarea
            className="w-full h-40 border rounded p-2 text-xs font-mono resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={"Project Manager, 1\nSite Supervisor, 4\n5, General Foreman"}
            value={importText}
            onChange={e => setImportText(e.target.value)}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleBulkImport}>Import</Button>
            <Button size="sm" variant="outline" onClick={() => { setShowImport(false); setImportText(''); }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          className="pl-8 h-8 text-xs"
          placeholder="Search position..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && <button onClick={() => setSearch('')} className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
      </div>

      {/* Add New Row (inline at top) */}
      {showNew && (
        <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
          <Input autoFocus value={newRow.position} onChange={e => setNewRow(p => ({ ...p, position: e.target.value }))} placeholder="Position name" className="h-8 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && saveNew()} />
          <Input type="number" value={newRow.rank} onChange={e => setNewRow(p => ({ ...p, rank: e.target.value }))} placeholder="Rank (1-14)" className="h-8 text-xs w-28" onKeyDown={e => e.key === 'Enter' && saveNew()} />
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={saveNew}><Check className="w-4 h-4 text-green-600" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setShowNew(false); setNewRow({ position: '', rank: '' }); }}><X className="w-4 h-4 text-red-500" /></Button>
        </div>
      )}

      {/* Stats */}
      <div className="text-xs text-muted-foreground">{ranks.length} positions defined · {Object.keys(RANK_LABELS).length} rank levels</div>

      {/* Grouped Table */}
      {isLoading ? (
        <div className="text-center text-xs text-muted-foreground py-8">Loading...</div>
      ) : grouped.length === 0 ? (
        <div className="text-center text-xs text-muted-foreground py-8">No positions found{search ? ` matching "${search}"` : ''}.</div>
      ) : (
        <div className="space-y-2">
          {grouped.map(([rankKey, rows]) => {
            const rank = Number(rankKey);
            const label = RANK_LABELS[rank] || `Rank ${rank}`;
            const collapsed = collapsedGroups[rankKey];
            return (
              <div key={rankKey} className="border rounded-lg overflow-hidden">
                {/* Group Header */}
                <button
                  className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  onClick={() => toggleGroup(rankKey)}
                >
                  <div className="flex items-center gap-2">
                    {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${rankBadgeClass(rank)}`}>Rank {rank}</span>
                    <span className="text-xs font-semibold text-slate-700">{label}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{rows.length} positions</span>
                </button>
                {/* Group Rows */}
                {!collapsed && (
                  <Table>
                    <TableBody>
                      {rows.map((r, i) => (
                        <TableRow key={r.id} className="hover:bg-slate-50/50">
                          <TableCell className="text-xs text-muted-foreground w-8 pl-8">{i + 1}</TableCell>
                          <TableCell className="py-1.5">
                            {editingId === r.id
                              ? <Input autoFocus value={editDraft.position} onChange={e => setEditDraft(p => ({ ...p, position: e.target.value }))} className="h-7 text-xs" onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }} />
                              : <span className="text-sm">{r.position}</span>}
                          </TableCell>
                          <TableCell className="py-1.5 w-24">
                            {editingId === r.id
                              ? <Input type="number" value={editDraft.rank} onChange={e => setEditDraft(p => ({ ...p, rank: e.target.value }))} className="h-7 text-xs w-20" onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditingId(null); }} />
                              : <span className={`text-xs font-bold px-2 py-0.5 rounded ${rankBadgeClass(r.rank)}`}>{r.rank}</span>}
                          </TableCell>
                          <TableCell className="py-1.5 w-24">
                            {editingId === r.id ? (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}><Check className="w-3.5 h-3.5 text-green-600" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                              </div>
                            ) : (
                              <div className="flex gap-1">
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(r)}><Pencil className="w-3.5 h-3.5" /></Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500 hover:text-red-700" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}