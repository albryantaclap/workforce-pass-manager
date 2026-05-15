import React, { useState } from 'react';
import { FolderOpen, ExternalLink, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { base44 } from '@/api/base44Client';

/**
 * Renders a SharePoint document icon in a table cell.
 * - If url exists: clicking opens it in a new tab.
 * - If canEdit: right-clicking or shift+clicking opens an inline input to set/clear the URL.
 */
export default function SharepointDocIcon({ emp, canEdit = false, onSave }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(emp.sharepoint_url || '');

  const handleOpen = (e) => {
    if (e.shiftKey && canEdit) {
      e.preventDefault();
      setDraft(emp.sharepoint_url || '');
      setEditing(true);
      return;
    }
    if (emp.sharepoint_url) {
      window.open(emp.sharepoint_url, '_blank', 'noopener,noreferrer');
    } else if (canEdit) {
      setDraft('');
      setEditing(true);
    }
  };

  const handleSave = async () => {
    await base44.entities.Employee.update(emp.id, { sharepoint_url: draft || null });
    if (onSave) onSave(emp.id, draft || null);
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1 min-w-[180px]" onClick={e => e.stopPropagation()}>
        <input
          autoFocus
          type="url"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste SharePoint URL..."
          className="flex-1 text-xs border border-primary rounded px-1.5 py-0.5 outline-none min-w-0"
        />
        <button onClick={handleSave} className="text-green-600 hover:text-green-700 flex-shrink-0">
          <Check className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => setEditing(false)} className="text-muted-foreground hover:text-foreground flex-shrink-0">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  if (!emp.sharepoint_url && !canEdit) return <span className="text-muted-foreground text-xs">—</span>;

  return (
    <div className="flex items-center justify-center">
      <button
        onClick={handleOpen}
        title={emp.sharepoint_url ? 'Open Documents' : 'Add SharePoint link (click)'}
        className={`group flex items-center justify-center w-7 h-7 rounded transition-colors ${
          emp.sharepoint_url
            ? 'text-blue-600 hover:bg-blue-50'
            : 'text-muted-foreground/30 hover:text-blue-400 hover:bg-blue-50'
        }`}
      >
        {emp.sharepoint_url ? (
          <ExternalLink className="w-3.5 h-3.5" />
        ) : (
          <FolderOpen className="w-3.5 h-3.5" />
        )}
      </button>
    </div>
  );
}