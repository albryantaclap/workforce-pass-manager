import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useManagerFilter } from '@/hooks/useManagerFilter';
import { Users } from 'lucide-react';

export default function ManagerFilter() {
  const { selectedManager, setSelectedManager, managers } = useManagerFilter();

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <Users className="w-4 h-4 text-muted-foreground" />
        <label className="text-sm font-medium text-muted-foreground">Manager</label>
      </div>
      <Select value={selectedManager} onValueChange={setSelectedManager}>
        <SelectTrigger className="w-48">
          <SelectValue placeholder="All Managers" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={null}>All Managers</SelectItem>
          {managers.map(m => (
            <SelectItem key={m.id} value={m.id}>{m.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}