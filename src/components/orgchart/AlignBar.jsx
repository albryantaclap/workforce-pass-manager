import React from 'react';
import { Trash2, Lock, Unlock, Copy } from 'lucide-react';

const ALIGN = [
  { key: 'left', label: 'Align L' },
  { key: 'center', label: 'Align C' },
  { key: 'right', label: 'Align R' },
  { key: 'top', label: 'Align T' },
  { key: 'middle', label: 'Align M' },
  { key: 'bottom', label: 'Align B' },
];
const DISTRIBUTE = [
  { key: 'h', label: 'Space H' },
  { key: 'v', label: 'Space V' },
];
const ORDER = [
  { key: 'front', label: 'Front' },
  { key: 'forward', label: 'Forward' },
  { key: 'backward', label: 'Backward' },
  { key: 'back', label: 'Back' },
];
const btn = 'px-2 py-1 rounded text-[11px] font-medium hover:bg-muted disabled:opacity-40 whitespace-nowrap';

export default function AlignBar({
  selectionCount, onAlign, onDistribute, onOrder, onGroup, onLock, onDelete, onDuplicate, anyLocked, canEdit,
}) {
  if (!canEdit || selectionCount < 2) return null;
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl border bg-card/95 backdrop-blur px-2 py-1.5 shadow-lg">
      <span className="text-[11px] font-semibold text-muted-foreground">{selectionCount} selected</span>
      <div className="w-px h-5 bg-border" />
      {ALIGN.map(a => (
        <button key={a.key} type="button" className={btn} onClick={() => onAlign(a.key)}>{a.label}</button>
      ))}
      <div className="w-px h-5 bg-border" />
      {DISTRIBUTE.map(d => (
        <button key={d.key} type="button" className={btn} onClick={() => onDistribute(d.key)}>{d.label}</button>
      ))}
      <div className="w-px h-5 bg-border" />
      {ORDER.map(o => (
        <button key={o.key} type="button" className={btn} onClick={() => onOrder(o.key)}>{o.label}</button>
      ))}
      <div className="w-px h-5 bg-border" />
      <button type="button" className={btn} onClick={() => onGroup(true)}>Group</button>
      <button type="button" className={btn} onClick={() => onGroup(false)}>Ungroup</button>
      <button type="button" className={`${btn} inline-flex items-center gap-1`} onClick={onLock}>
        {anyLocked ? <Unlock className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
        {anyLocked ? 'Unlock' : 'Lock'}
      </button>
      <button type="button" className={`${btn} inline-flex items-center gap-1`} onClick={onDuplicate}>
        <Copy className="w-3 h-3" /> Duplicate
      </button>
      <button type="button" className={`${btn} inline-flex items-center gap-1 text-red-600 hover:bg-red-50`} onClick={onDelete}>
        <Trash2 className="w-3 h-3" /> Delete
      </button>
    </div>
  );
}