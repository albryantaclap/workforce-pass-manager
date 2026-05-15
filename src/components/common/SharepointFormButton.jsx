import React, { useState } from 'react';
import { FolderOpen, ExternalLink, Pencil, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * A button shown in the EmployeeForm header to view/set a SharePoint document link.
 */
export default function SharepointFormButton({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  const handleOpen = () => {
    if (value) window.open(value, '_blank', 'noopener,noreferrer');
    else setEditing(true);
  };

  const handleSave = () => {
    onChange(draft.trim() || '');
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-2 border border-primary rounded-lg px-3 py-1.5 bg-white shadow-sm">
        <FolderOpen className="w-4 h-4 text-blue-500 flex-shrink-0" />
        <input
          autoFocus
          type="url"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Paste SharePoint URL..."
          className="text-sm outline-none min-w-0 w-64"
        />
        <button onClick={handleSave} className="text-green-600 hover:text-green-700">
          <Check className="w-4 h-4" />
        </button>
        <button onClick={() => { setDraft(value || ''); setEditing(false); }} className="text-muted-foreground hover:text-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {value ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpen}
            className="gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
            title="Open SharePoint Documents"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Documents
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            title="Edit SharePoint link"
            onClick={() => { setDraft(value); setEditing(true); }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
        </>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => { setDraft(''); setEditing(true); }}
          className="gap-1.5 text-muted-foreground"
          title="Add SharePoint document link"
        >
          <FolderOpen className="w-3.5 h-3.5" />
          Add Documents
        </Button>
      )}
    </div>
  );
}