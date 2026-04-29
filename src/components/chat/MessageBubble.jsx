import React, { useState } from 'react';
import { Trash2, Edit2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

function formatTime(dateStr) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return `Yesterday ${format(d, 'HH:mm')}`;
  return format(d, 'MMM d, HH:mm');
}

function renderMessage(text, mentions, allUsers, currentUser) {
  if (!text) return null;
  const parts = text.split(/(@\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('@')) {
      const name = part.slice(1).toLowerCase();
      const mentionedUser = allUsers.find(u =>
        (u.full_name || u.email).toLowerCase().replace(/\s+/g, '') === name
      );
      const isSelf = mentionedUser?.email === currentUser?.email;
      if (mentionedUser) {
        return (
          <span
            key={i}
            className={cn(
              'font-semibold rounded px-0.5',
              isSelf ? 'bg-amber-200 text-amber-800' : 'bg-blue-100 text-blue-700'
            )}
          >
            {part}
          </span>
        );
      }
    }
    return <span key={i}>{part}</span>;
  });
}

export default function MessageBubble({ message, isOwn, allUsers, currentUser, showAvatar, onDelete, onEdit }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.message);
  const [hovered, setHovered] = useState(false);

  const handleSaveEdit = () => {
    if (editText.trim() && editText !== message.message) {
      onEdit(editText.trim());
    }
    setEditing(false);
  };

  return (
    <div
      className={cn('flex items-end gap-2 group', isOwn ? 'flex-row-reverse' : 'flex-row')}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Avatar */}
      <div className={cn('flex-shrink-0 w-7 h-7', showAvatar ? 'visible' : 'invisible')}>
        <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
          {(message.sender_name || message.sender_email)[0].toUpperCase()}
        </div>
      </div>

      <div className={cn('flex flex-col max-w-[70%]', isOwn ? 'items-end' : 'items-start')}>
        {showAvatar && (
          <div className={cn('flex items-center gap-2 mb-1', isOwn && 'flex-row-reverse')}>
            <span className="text-xs font-semibold text-foreground">{message.sender_name || message.sender_email}</span>
            <span className="text-[10px] text-muted-foreground">{formatTime(message.created_date)}</span>
          </div>
        )}

        <div className="flex items-end gap-1">
          {/* Action buttons (own messages only) */}
          {isOwn && hovered && !editing && (
            <div className="flex gap-1 mb-1">
              <button onClick={() => { setEditText(message.message); setEditing(true); }}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-accent transition-colors">
                <Edit2 className="w-3 h-3" />
              </button>
              <button onClick={onDelete}
                className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-accent transition-colors">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className={cn(
            'rounded-2xl px-3 py-2 text-sm leading-relaxed',
            isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-card border border-border rounded-bl-sm'
          )}>
            {editing ? (
              <div className="flex gap-1 items-center min-w-[200px]">
                <input
                  autoFocus
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSaveEdit();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="flex-1 bg-transparent outline-none text-sm"
                />
                <button onClick={handleSaveEdit} className="text-emerald-400 hover:text-emerald-300"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setEditing(false)} className="text-red-400 hover:text-red-300"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <span>
                {renderMessage(message.message, message.mentions, allUsers, currentUser)}
                {message.edited && <span className="text-[10px] opacity-60 ml-1">(edited)</span>}
              </span>
            )}
          </div>
        </div>

        {!showAvatar && (
          <span className={cn('text-[10px] text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity', isOwn ? 'text-right' : 'text-left')}>
            {formatTime(message.created_date)}
          </span>
        )}
      </div>
    </div>
  );
}