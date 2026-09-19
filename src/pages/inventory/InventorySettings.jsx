import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, Tag, Ruler, Warehouse, MapPin, Truck } from 'lucide-react';
import { useInventoryData } from '@/hooks/useInventoryData';
import { createLookup, deleteLookup } from '@/lib/inventoryService';
import { useToast } from '@/components/ui/use-toast';
import { useCurrentUser } from '@/lib/useCurrentUser';
import { useRbac } from '@/lib/useRbac';
import { useQueryClient } from '@tanstack/react-query';

const LOOKUP_TYPES = [
  { type: 'item_category', label: 'Item Categories', icon: Tag, color: 'text-blue-600 bg-blue-50' },
  { type: 'unit', label: 'Units / UOM', icon: Ruler, color: 'text-green-600 bg-green-50' },
  { type: 'store', label: 'Stores', icon: Warehouse, color: 'text-purple-600 bg-purple-50' },
  { type: 'site', label: 'Sites', icon: MapPin, color: 'text-orange-600 bg-orange-50' },
  { type: 'supplier', label: 'Suppliers', icon: Truck, color: 'text-cyan-600 bg-cyan-50' },
];

export default function InventorySettings() {
  const { getLookupOptions } = useInventoryData();
  const [newValues, setNewValues] = useState({});
  const { toast } = useToast();
  const user = useCurrentUser();
  const { can } = useRbac();
  const queryClient = useQueryClient();

  const refresh = () => queryClient.invalidateQueries(['inventory-lookups']);

  const handleAdd = async (type) => {
    const value = (newValues[type] || '').trim();
    if (!value) return;
    try {
      await createLookup({ type, value, label: value });
      toast({ title: `${value} added` });
      setNewValues({ ...newValues, [type]: '' });
      refresh();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  const handleDelete = async (lookup) => {
    if (!confirm(`Remove "${lookup.label}"? This will hide it from dropdowns but retain it for history.`)) return;
    try {
      await deleteLookup(lookup.id, user?.email);
      toast({ title: `${lookup.label} removed` });
      refresh();
    } catch (e) {
      toast({ title: e.message, variant: 'destructive' });
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Inventory Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage lookup values used in dropdowns across the Inventory module</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {LOOKUP_TYPES.map(({ type, label, icon: Icon, color }) => {
          const options = getLookupOptions(type);
          return (
            <Card key={type} className="border-slate-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  {label}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {can('inventory.settings.edit') && (
                  <div className="flex gap-2">
                    <Input
                      value={newValues[type] || ''}
                      onChange={e => setNewValues({ ...newValues, [type]: e.target.value })}
                      placeholder={`Add new ${label.toLowerCase().replace(/s$/, '')}...`}
                      onKeyDown={e => e.key === 'Enter' && handleAdd(type)}
                    />
                    <Button size="icon" onClick={() => handleAdd(type)}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {options.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No {label.toLowerCase()} configured.</p>
                  ) : (
                    options.map(opt => (
                      <div key={opt.id} className="flex items-center justify-between p-2 rounded-lg border border-slate-100">
                        <span className="text-sm font-medium">{opt.label}</span>
                        {can('inventory.settings.edit') && (
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500"
                            onClick={() => handleDelete(opt)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}