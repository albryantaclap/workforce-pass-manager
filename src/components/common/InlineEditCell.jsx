import React, { useState, useRef, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Renders a cell value that becomes editable on click when editMode is true.
 * type: 'text' | 'date' | 'select'
 * options: [{ value, label }] for select type
 */
export default function InlineEditCell({ value, field, empId, type = 'text', options = [], onSave, editMode, className = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  // Reset draft if value changes externally
  useEffect(() => { setDraft(value ?? ''); }, [value]);

  const handleClick = () => {
    if (!editMode) return;
    setDraft(value ?? '');
    setEditing(true);
  };

  const save = () => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(empId, field, draft || null);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value ?? '');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') save();
    if (e.key === 'Escape') cancel();
  };

  if (!editing) {
    return (
      <span
        onClick={handleClick}
        className={`${editMode ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 rounded px-1 -mx-1 transition-colors' : ''} ${className}`}
        title={editMode ? 'Click to edit' : undefined}
      >
        {value || <span className="text-muted-foreground">—</span>}
      </span>
    );
  }

  if (type === 'select') {
    return (
      <div className="flex items-center gap-1 min-w-[120px]">
        <Select value={draft} onValueChange={(v) => { setDraft(v); }}>
          <SelectTrigger className="h-6 text-xs px-1 min-w-[100px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <button onClick={() => { onSave(empId, field, draft || null); setEditing(false); }} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
        <button onClick={cancel} className="text-red-500 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef}
        type={type === 'date' ? 'date' : 'text'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-6 text-xs border border-blue-400 rounded px-1 focus:outline-none focus:ring-1 focus:ring-blue-400 w-full min-w-[80px]"
      />
      <button onClick={save} className="text-green-600 hover:text-green-700"><Check className="w-3.5 h-3.5" /></button>
      <button onClick={cancel} className="text-red-500 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
    </div>
  );
}