import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Check, X, Copy } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/utils/constants';

/**
 * Excel-like inline edit cell.
 * - Click to edit (when editMode=true)
 * - Enter / Tab to save and move to next cell
 * - Escape to cancel
 * - Ctrl+D or right-click → "Fill Down" to copy this value to all filtered rows (via onFillDown)
 * Props:
 *   value, field, empId, type ('text'|'date'|'select'), options, onSave, editMode, className
 *   onFillDown(field, value) — optional, called when user wants to fill the value down
 */
export default function InlineEditCell({ value, field, empId, type = 'text', options = [], onSave, editMode, className = '', onFillDown }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? '');
  const [showMenu, setShowMenu] = useState(false);
  const inputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  useEffect(() => { setDraft(value ?? ''); }, [value]);

  // Close context menu on outside click
  useEffect(() => {
    if (!showMenu) return;
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowMenu(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMenu]);

  const handleClick = () => {
    if (!editMode) return;
    setDraft(value ?? '');
    setEditing(true);
  };

  const save = useCallback(() => {
    setEditing(false);
    if (draft !== (value ?? '')) onSave(empId, field, draft || null);
  }, [draft, value, empId, field, onSave]);

  const cancel = () => {
    setEditing(false);
    setDraft(value ?? '');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') cancel();
    // Ctrl+D = fill down
    if (e.key === 'd' && (e.ctrlKey || e.metaKey) && onFillDown) {
      e.preventDefault();
      save();
      onFillDown(field, draft || null);
    }
  };

  const handleContextMenu = (e) => {
    if (!editMode) return;
    e.preventDefault();
    setShowMenu(true);
  };

  const handleFillDown = () => {
    setShowMenu(false);
    if (onFillDown) onFillDown(field, value ?? null);
  };

  const displayValue = value
    ? (type === 'date' ? formatDate(value) : value)
    : <span className="text-muted-foreground">—</span>;

  if (!editing) {
    return (
      <div className="relative inline-block w-full">
        <span
          onClick={handleClick}
          onContextMenu={handleContextMenu}
          className={`block w-full ${editMode ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 rounded px-1 -mx-1 transition-colors' : ''} ${className}`}
          title={editMode ? 'Click to edit  |  Right-click for more options' : undefined}
        >
          {displayValue}
        </span>
        {showMenu && (
          <div ref={menuRef} className="absolute left-0 top-full z-50 bg-white border border-slate-200 rounded-lg shadow-lg py-1 min-w-[150px]">
            {onFillDown && (
              <button
                className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50 flex items-center gap-2"
                onClick={handleFillDown}
              >
                <Copy className="w-3 h-3" /> Fill Down (all rows)
              </button>
            )}
            <button
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-50"
              onClick={() => { setShowMenu(false); handleClick(); }}
            >
              ✏️ Edit this cell
            </button>
          </div>
        )}
      </div>
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