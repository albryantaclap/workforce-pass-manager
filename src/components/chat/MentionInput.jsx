import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export default function MentionInput({ allUsers, currentUser, onSend, disabled }) {
  const [text, setText] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null); // { query, startIdx }
  const [suggestions, setSuggestions] = useState([]);
  const [selectedSuggestion, setSelectedSuggestion] = useState(0);
  const textareaRef = useRef(null);

  const extractMentions = (str) => {
    const regex = /@(\S+)/g;
    const matches = [];
    let m;
    while ((m = regex.exec(str)) !== null) {
      const found = allUsers.find(u =>
        (u.full_name || u.email).toLowerCase().replace(/\s+/g, '') === m[1].toLowerCase()
      );
      if (found) matches.push(found.email);
    }
    return [...new Set(matches)];
  };

  const handleChange = (e) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    // Detect @mention trigger
    const before = val.slice(0, cursor);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const query = match[1].toLowerCase();
      const filtered = allUsers.filter(u =>
        u.email !== currentUser?.email &&
        ((u.full_name || '').toLowerCase().includes(query) || u.email.toLowerCase().includes(query))
      ).slice(0, 6);
      setSuggestions(filtered);
      setMentionQuery({ query, startIdx: before.lastIndexOf('@') });
      setSelectedSuggestion(0);
    } else {
      setSuggestions([]);
      setMentionQuery(null);
    }
  };

  const insertMention = (u) => {
    if (!mentionQuery) return;
    const name = (u.full_name || u.email).replace(/\s+/g, '');
    const before = text.slice(0, mentionQuery.startIdx);
    const after = text.slice(mentionQuery.startIdx + mentionQuery.query.length + 1);
    const newText = `${before}@${name} ${after}`;
    setText(newText);
    setSuggestions([]);
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (suggestions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedSuggestion(i => Math.min(i + 1, suggestions.length - 1)); }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedSuggestion(i => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && suggestions.length > 0) { e.preventDefault(); insertMention(suggestions[selectedSuggestion]); return; }
      if (e.key === 'Escape') { setSuggestions([]); setMentionQuery(null); }
    } else if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const mentions = extractMentions(trimmed);
    onSend({ text: trimmed, mentions });
    setText('');
    setSuggestions([]);
  };

  return (
    <div className="relative">
      {suggestions.length > 0 && (
        <div className="absolute bottom-full mb-2 left-0 bg-popover border border-border rounded-lg shadow-lg w-64 z-50 overflow-hidden">
          {suggestions.map((u, i) => (
            <button
              key={u.id}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors',
                i === selectedSuggestion && 'bg-accent'
              )}
              onMouseDown={(e) => { e.preventDefault(); insertMention(u); }}
            >
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold flex-shrink-0">
                {(u.full_name || u.email)[0].toUpperCase()}
              </div>
              <div className="text-left min-w-0">
                <p className="font-medium truncate">{u.full_name || u.email}</p>
                <p className="text-[10px] text-muted-foreground truncate">{u.email}</p>
              </div>
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2 items-end">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder="Type a message… use @ to mention someone"
          disabled={disabled}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[38px] max-h-32 overflow-y-auto"
          style={{ height: 'auto' }}
          onInput={e => {
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
          }}
        />
        <Button onClick={handleSend} disabled={disabled || !text.trim()} size="icon" className="flex-shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}