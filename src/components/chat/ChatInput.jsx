import React, { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export default function ChatInput({
  allUsers,
  currentUser,
  conversationId,
  onSend,
  disabled,
}) {
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState('');
  const [cursorPos, setCursorPos] = useState(0);
  const [files, setFiles] = useState([]);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleTextChange = (e) => {
    const value = e.target.value;
    setText(value);
    setCursorPos(e.target.selectionStart);

    // Check for @ mentions
    const lastAtSign = value.lastIndexOf('@', cursorPos);
    if (lastAtSign !== -1) {
      const textAfterAt = value.substring(lastAtSign + 1, cursorPos);
      if (!textAfterAt.includes(' ') && !textAfterAt.includes('\n')) {
        setMentionSearch(textAfterAt);
        setShowMentions(true);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const handleMentionSelect = (user) => {
    const lastAtSign = text.lastIndexOf('@', cursorPos);
    const beforeMention = text.substring(0, lastAtSign);
    const afterCursor = text.substring(cursorPos);
    const newText = `${beforeMention}@${user.full_name || user.email} ${afterCursor}`;
    setText(newText);
    setMentions([...new Set([...mentions, user.email])]);
    setShowMentions(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const handleSend = () => {
    if (!text.trim() && files.length === 0) return;
    onSend({ text: text.trim(), mentions, fileUrls: files });
    setText('');
    setMentions([]);
    setFiles([]);
  };

  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files || []);
    setFiles([...files, ...selectedFiles]);
  };

  const filteredUsers = allUsers.filter(
    u => u.email !== currentUser?.email &&
      (u.full_name?.toLowerCase().includes(mentionSearch.toLowerCase()) ||
        u.email.toLowerCase().includes(mentionSearch.toLowerCase()))
  ).slice(0, 5);

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 bg-accent px-2 py-1 rounded text-xs">
              <Paperclip className="w-3 h-3" />
              <span className="truncate">{file.name}</span>
              <button
                onClick={() => setFiles(files.filter((_, i) => i !== idx))}
                className="hover:opacity-70"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="relative">
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          placeholder="Type a message... (use @ to mention someone)"
          className="resize-none pr-10 max-h-24"
          rows={2}
          disabled={disabled}
        />

        {showMentions && mentionSearch && (
          <div className="absolute bottom-full left-0 mb-1 w-full bg-card border border-border rounded-lg shadow-lg z-50">
            {filteredUsers.length > 0 ? (
              filteredUsers.map(user => (
                <button
                  key={user.email}
                  onClick={() => handleMentionSelect(user)}
                  className="w-full text-left px-3 py-2 hover:bg-accent text-xs transition-colors"
                >
                  <p className="font-medium">{user.full_name || user.email}</p>
                  <p className="text-muted-foreground text-xs">{user.email}</p>
                </button>
              ))
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">No users found</div>
            )}
          </div>
        )}

        <div className="absolute bottom-2 right-2 flex gap-1">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            type="button"
          >
            <Paperclip className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="icon"
            className="h-7 w-7"
            onClick={handleSend}
            disabled={disabled || (!text.trim() && files.length === 0)}
            type="button"
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}