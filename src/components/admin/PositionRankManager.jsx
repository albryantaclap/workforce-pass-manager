import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Pencil, Trash2, Plus, Check, X } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function PositionRankManager() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState({});
  const [newRow, setNewRow] = useState({ position: '', rank: '' });
  const [showNew, setShowNew] = useState(false);

  const { data: ranks = [], isLoading } = useQuery({
    queryKey: ['positionRanks'],
    queryFn: () => base44.entities.PositionRank.list(),
  });

  const sorted = [...ranks].sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999) || (a.position || '').localeCompare(b.position || ''));

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

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Position Hierarchy</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Lower rank number = higher seniority. Used to sort employees in Onboarding Monitoring.</p>
        </div>
        <Button size="sm" onClick={() => setShowNew(true)} className="gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Position
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs w-8">#</TableHead>
              <TableHead className="text-xs">Position / Designation</TableHead>
              <TableHead className="text-xs w-24">Rank</TableHead>
              <TableHead className="text-xs w-28">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {showNew && (
              <TableRow className="bg-green-50/50">
                <TableCell />
                <TableCell>
                  <Input autoFocus value={newRow.position} onChange={e => setNewRow(p => ({ ...p, position: e.target.value }))} placeholder="e.g. Site Manager" className="h-7 text-xs" />
                </TableCell>
                <TableCell>
                  <Input type="number" value={newRow.rank} onChange={e => setNewRow(p => ({ ...p, rank: e.target.value }))} placeholder="e.g. 10" className="h-7 text-xs w-20" />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveNew}><Check className="w-3.5 h-3.5 text-green-600" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setShowNew(false); setNewRow({ position: '', rank: '' }); }}><X className="w-3.5 h-3.5 text-red-500" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            )}
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">Loading...</TableCell></TableRow>
            ) : sorted.length === 0 && !showNew ? (
              <TableRow><TableCell colSpan={4} className="text-center text-xs text-muted-foreground py-6">No position ranks defined yet.</TableCell></TableRow>
            ) : sorted.map((r, i) => (
              <TableRow key={r.id}>
                <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                <TableCell>
                  {editingId === r.id
                    ? <Input value={editDraft.position} onChange={e => setEditDraft(p => ({ ...p, position: e.target.value }))} className="h-7 text-xs" />
                    : <span className="text-sm font-medium">{r.position}</span>}
                </TableCell>
                <TableCell>
                  {editingId === r.id
                    ? <Input type="number" value={editDraft.rank} onChange={e => setEditDraft(p => ({ ...p, rank: e.target.value }))} className="h-7 text-xs w-20" />
                    : <span className="inline-block bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded">{r.rank}</span>}
                </TableCell>
                <TableCell>
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
      </div>
    </Card>
  );
}