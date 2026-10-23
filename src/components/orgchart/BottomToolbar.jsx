import React from 'react';
import {
  MousePointer2, Hand, UserPlus, Briefcase, Link2, Shapes, Type, StickyNote, Undo2, Redo2, Layers,
} from 'lucide-react';

const TOOLS = [
  { key: 'select', label: 'Select', icon: MousePointer2 },
  { key: 'hand', label: 'Hand / Pan', icon: Hand },
  { key: '__employee', label: 'Add Employee Card', icon: UserPlus },
  { key: '__position', label: 'Add Position', icon: Briefcase },
  { key: 'connector', label: 'Add Connector', icon: Link2 },
  { key: '__shape', label: 'Add Shape', icon: Shapes },
  { key: '__text', label: 'Add Text', icon: Type },
  { key: '__note', label: 'Add Note', icon: StickyNote },
];

export default function BottomToolbar({
  tool, setTool, onAdd, onInsert, onGroup, onUndo, onRedo, canUndo, canRedo, canEdit, selectionCount,
}) {
  const btn = 'flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors disabled:opacity-40';
  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 rounded-xl border bg-card/95 backdrop-blur px-2 py-1.5 shadow-xl">
      {TOOLS.map(({ key, label, icon: Icon }) => {
        const isTool = !key.startsWith('__');
        const active = isTool && tool === key;
        return (
          <button
            key={key}
            type="button"
            title={label}
            disabled={!canEdit && key !== 'select' && key !== 'hand'}
            onClick={() => (isTool ? setTool(key) : onAdd(key.replace('__', '')))}
            className={`${btn} ${active ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-foreground'}`}
          >
            <Icon className="w-4 h-4" />
            <span className="whitespace-nowrap">{label}</span>
          </button>
        );
      })}
      <div className="w-px h-8 bg-border mx-1" />
      <button
        type="button"
        title="Insert existing chart"
        disabled={!canEdit}
        onClick={onInsert}
        className={`${btn} hover:bg-muted text-foreground disabled:opacity-40`}
      >
        <Layers className="w-4 h-4" />
        <span className="whitespace-nowrap">Insert Chart</span>
      </button>
      <div className="w-px h-8 bg-border mx-1" />
      <button type="button" title="Group selected cards" disabled={!canEdit || selectionCount < 2} onClick={() => onGroup(true)} className={`${btn} hover:bg-muted disabled:opacity-40`}>
        <span className="text-xs font-semibold">Group</span>
        <span>Group</span>
      </button>
      <button type="button" title="Ungroup selected cards" disabled={!canEdit || selectionCount < 1} onClick={() => onGroup(false)} className={`${btn} hover:bg-muted disabled:opacity-40`}>
        <span className="text-xs font-semibold">Ungroup</span>
        <span>Ungroup</span>
      </button>
      <div className="w-px h-8 bg-border mx-1" />
      <button type="button" title="Undo" disabled={!canUndo || !canEdit} onClick={onUndo} className={`${btn} hover:bg-muted`}>
        <Undo2 className="w-4 h-4" />
        <span>Undo</span>
      </button>
      <button type="button" title="Redo" disabled={!canRedo || !canEdit} onClick={onRedo} className={`${btn} hover:bg-muted`}>
        <Redo2 className="w-4 h-4" />
        <span>Redo</span>
      </button>
    </div>
  );
}