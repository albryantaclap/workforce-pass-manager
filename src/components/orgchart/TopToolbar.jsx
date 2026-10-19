import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Save, Download, Share2, History, UploadCloud, Check, AlertCircle, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const STATUS = {
  saved: { label: 'All changes saved', icon: Check, className: 'text-emerald-600' },
  saving: { label: 'Saving…', icon: Loader2, className: 'text-blue-600' },
  dirty: { label: 'Unsaved changes', icon: Save, className: 'text-amber-600' },
  error: { label: 'Save failed — retry', icon: AlertCircle, className: 'text-red-600' },
};

export default function TopToolbar({
  chart, projects, saveState, lastSavedAt, canEdit, myRole,
  onRename, onProjectChange, onSave, onExport, onShare, onVersions, onPublish,
}) {
  const [name, setName] = useState(chart?.name || '');
  const [editing, setEditing] = useState(false);
  const status = STATUS[saveState] || STATUS.saved;
  const StatusIcon = status.icon;

  React.useEffect(() => { setName(chart?.name || ''); }, [chart?.id, chart?.name]);

  const commit = () => {
    setEditing(false);
    const value = name.trim();
    if (value && value !== chart?.name) onRename(value);
    else setName(chart?.name || '');
  };

  return (
    <div className="h-14 flex items-center gap-3 px-3 border-b bg-card shrink-0">
      <Button asChild variant="ghost" size="sm" className="gap-1.5">
        <Link to="/organization/charts">
          <ArrowLeft className="w-4 h-4" />
          Organization Management
        </Link>
      </Button>

      <div className="h-6 w-px bg-border" />

      {editing && canEdit ? (
        <Input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setName(chart?.name || ''); setEditing(false); } }}
          className="h-8 w-64"
        />
      ) : (
        <button
          type="button"
          onClick={() => canEdit && setEditing(true)}
          className="text-sm font-semibold px-2 py-1 rounded hover:bg-muted max-w-[280px] truncate"
          title={canEdit ? 'Rename chart' : 'Read-only'}
        >
          {chart?.name || 'Untitled chart'}
        </button>
      )}

      <select
        value={chart?.project_id || ''}
        onChange={(e) => onProjectChange(e.target.value)}
        disabled={!canEdit}
        className="h-8 rounded-md border bg-background px-2 text-xs max-w-[220px]"
      >
        <option value="">No project (corporate)</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.project_name}</option>
        ))}
      </select>

      <span className={`flex items-center gap-1.5 text-xs ${status.className}`}>
        <StatusIcon className={`w-3.5 h-3.5 ${saveState === 'saving' ? 'animate-spin' : ''}`} />
        {status.label}
        {saveState === 'saved' && lastSavedAt ? ` · ${lastSavedAt.toLocaleTimeString()}` : ''}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{myRole}</span>
        <Button variant="outline" size="sm" onClick={onSave} disabled={!canEdit}>Save</Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onExport}>
          <Download className="w-3.5 h-3.5" /> Export
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onShare}>
          <Share2 className="w-3.5 h-3.5" /> Share
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={onVersions}>
          <History className="w-3.5 h-3.5" /> Versions
        </Button>
        <Button size="sm" className="gap-1.5" onClick={onPublish} disabled={!canEdit}>
          <UploadCloud className="w-3.5 h-3.5" />
          {chart?.status === 'published' ? 'Republish' : 'Publish'}
        </Button>
      </div>
    </div>
  );
}