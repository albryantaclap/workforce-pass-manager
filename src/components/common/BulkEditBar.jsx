import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Users, ChevronDown } from 'lucide-react';

/**
 * A bar shown when filters are active + edit mode is on.
 * Lets user pick a field + value and apply to all filtered records.
 * fields: [{ key, label, type, options }]
 * filteredCount: number
 * onApply: (field, value) => void
 */
export default function BulkEditBar({ fields, filteredCount, onApply, isLoading }) {
  const [field, setField] = useState('');
  const [value, setValue] = useState('');

  const selectedField = fields.find(f => f.key === field);

  const handleApply = () => {
    if (!field || value === '') return;
    onApply(field, value);
    setField('');
    setValue('');
  };

  return (
    <div className="flex flex-wrap items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
      <Users className="w-4 h-4 text-blue-600 shrink-0" />
      <span className="text-blue-700 font-medium shrink-0">Apply to {filteredCount} filtered records:</span>
      <Select value={field} onValueChange={(v) => { setField(v); setValue(''); }}>
        <SelectTrigger className="h-8 w-44 text-xs bg-white">
          <SelectValue placeholder="Select field..." />
        </SelectTrigger>
        <SelectContent>
          {fields.map(f => <SelectItem key={f.key} value={f.key} className="text-xs">{f.label}</SelectItem>)}
        </SelectContent>
      </Select>

      {selectedField && selectedField.type === 'select' && (
        <Select value={value} onValueChange={setValue}>
          <SelectTrigger className="h-8 w-44 text-xs bg-white">
            <SelectValue placeholder="Select value..." />
          </SelectTrigger>
          <SelectContent>
            {selectedField.options.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}

      {selectedField && selectedField.type === 'text' && (
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Enter value..."
          className="h-8 text-xs border border-input rounded px-2 bg-white w-44 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}

      {selectedField && selectedField.type === 'date' && (
        <input
          type="date"
          value={value}
          onChange={e => setValue(e.target.value)}
          className="h-8 text-xs border border-input rounded px-2 bg-white w-44 focus:outline-none focus:ring-1 focus:ring-ring"
        />
      )}

      <Button size="sm" className="h-8 text-xs" onClick={handleApply} disabled={!field || value === '' || isLoading}>
        {isLoading ? 'Applying...' : 'Apply to All'}
      </Button>
    </div>
  );
}