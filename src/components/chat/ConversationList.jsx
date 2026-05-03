import React from 'react';
import { Search, Plus, MessageCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function ConversationList({
  conversations,
  activeConversationId,
  onSelectConversation,
  onNewChat,
  currentUserEmail,
  searchQuery,
  onSearchChange,
}) {
  const getConversationTitle = (conv) => {
    if (conv.type === 'group' && conv.name) return conv.name;
    const otherParticipant = conv.participants.find(p => p !== currentUserEmail);
    return otherParticipant || 'Unknown';
  };

  const filteredConversations = conversations.filter(conv =>
    getConversationTitle(conv).toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="w-64 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> Messages
          </h2>
          <Button
            size="icon"
            variant="ghost"
            onClick={onNewChat}
            className="h-7 w-7"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-1 p-2">
          {filteredConversations.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-xs">
              {searchQuery ? 'No conversations found' : 'No conversations yet'}
            </div>
          ) : (
            filteredConversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => onSelectConversation(conv.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg transition-colors',
                  activeConversationId === conv.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{getConversationTitle(conv)}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message_text || 'No messages yet'}
                    </p>
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-destructive text-white text-[10px] font-bold flex-shrink-0">
                      {conv.unread_count > 99 ? '99+' : conv.unread_count}
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}