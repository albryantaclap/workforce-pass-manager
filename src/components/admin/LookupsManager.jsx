import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { COMPANIES, LOCATIONS } from '@/utils/constants';

const COMPANY_TYPES = ['Main', 'Sub-contractor', 'GSO Supervision'];

const DEFAULTS = {
  company: COMPANIES.map(c => ({ value: c.value, label: c.label, type: 'company', _static: true })),
  company_type: COMPANY_TYPES.map(t => ({ value: t, label: t, type: 'company_type', _static: true })),
  location: LOCATIONS.map(l => ({ value: l, label: l, type: 'location', _static: true })),
};

function LookupSection({ type, label }) {
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dbEntries = [] } = useQuery({
    queryKey: ['lookups', type],
    queryFn: () => base44.entities.Lookup.filter({ type }),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Lookup.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', type] });
      toast({ title: `${label} entry added` });
      setNewValue('');
      setNewLabel('');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Lookup.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lookups', type] });
      toast({ title: `Entry removed` });
    },
  });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    createMutation.mutate({ type, value: newValue.trim().toUpperCase(), label: (newLabel || newValue).trim() });
  };

  const statics = DEFAULTS[type] || [];

  return (
    <div className="space-y-4">
      <form onSubmit={handleAdd} className="flex gap-2">
        <Input placeholder="Value (e.g. ACME CORP)" value={newValue} onChange={e => setNewValue(e.target.value)} className="flex-1" />
        <Input placeholder="Display label (optional)" value={newLabel} onChange={e => setNewLabel(e.target.value)} className="flex-1" />
        <Button type="submit" disabled={createMutation.isPending}>
          <Plus className="w-4 h-4 mr-2" /> Add
        </Button>
      </form>

      <div className="space-y-1">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Built-in entries</p>
        {statics.map(s => (
          <div key={s.value} className="flex items-center justify-between px-3 py-2 rounded bg-muted/30 text-sm">
            <span>{s.label}</span>
            <span className="text-xs text-muted-foreground font-mono">{s.value}</span>
          </div>
        ))}

        {dbEntries.length > 0 && (
          <>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mt-4 mb-2">Custom entries</p>
            {dbEntries.map(entry => (
              <div key={entry.id} className="flex items-center justify-between px-3 py-2 rounded bg-blue-50 text-sm">
                <span>{entry.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-mono">{entry.value}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(entry.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function LookupsManager() {
  return (
    <Card className="p-6">
      <p className="text-xs text-muted-foreground mb-4">
        Manage reference lists used in the personnel form. Built-in entries cannot be removed. Custom entries are added on top.
      </p>
      <Tabs defaultValue="company">
        <TabsList className="mb-4">
          <TabsTrigger value="company">Companies</TabsTrigger>
          <TabsTrigger value="company_type">Company Types</TabsTrigger>
          <TabsTrigger value="location">Locations</TabsTrigger>
        </TabsList>
        <TabsContent value="company"><LookupSection type="company" label="Company" /></TabsContent>
        <TabsContent value="company_type"><LookupSection type="company_type" label="Company Type" /></TabsContent>
        <TabsContent value="location"><LookupSection type="location" label="Location" /></TabsContent>
      </Tabs>
    </Card>
  );
}