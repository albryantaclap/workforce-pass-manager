import React, { useRef, useEffect } from 'react';
import { MessageCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import MessageBubble from './MessageBubble';
import ChatInput from './ChatInput';

export default function ChatWindow({
  conversation,
  messages,
  currentUser,
  allUsers,
  onSendMessage,
  onDeleteMessage,
  onEditMessage,
  onMarkAsRead,
  isLoading,
  isLoadingMore,
  hasMore,
  onLoadMore,
  typingUsers,
}) {
  const bottomRef = useRef(null);
  const scrollAreaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    onMarkAsRead();
  }, [conversation?.id]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-50" />
          <p className="text-muted-foreground">Select a conversation to start messaging</p>
        </div>
      </div>
    );
  }

  const getConversationTitle = () => {
    if (conversation.type === 'group' && conversation.name) return conversation.name;
    const otherParticipant = conversation.participants.find(p => p !== currentUser?.email);
    return otherParticipant || 'Unknown';
  };

  const typingUserNames = typingUsers
    .filter(e => e !== currentUser?.email)
    .map(e => allUsers.find(u => u.email === e)?.full_name || e.split('@')[0])
    .slice(0, 2);

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-background">
      {/* Header */}
      <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
        <div>
          <p className="font-semibold text-sm">{getConversationTitle()}</p>
          {conversation.type === 'group' && (
            <p className="text-xs text-muted-foreground">
              {conversation.participants.length} members
            </p>
          )}
        </div>
        <Button variant="ghost" size="icon">
          <Info className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4" ref={scrollAreaRef}>
        <div className="space-y-1 min-w-0">
          {hasMore && (
            <div className="text-center py-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? 'Loading...' : 'Load older messages'}
              </Button>
            </div>
          )}
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_email === currentUser?.email}
              allUsers={allUsers}
              showAvatar={idx === 0 || messages[idx - 1]?.sender_email !== msg.sender_email}
              onDelete={() => onDeleteMessage(msg.id)}
              onEdit={(newText) => onEditMessage(msg.id, newText)}
            />
          ))}
          {typingUserNames.length > 0 && (
            <div className="py-2 px-3">
              <p className="text-xs text-muted-foreground italic">
                {typingUserNames.length === 1
                  ? `${typingUserNames[0]} is typing…`
                  : `${typingUserNames.join(', ')} are typing…`}
              </p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-4 bg-card">
        <ChatInput
          allUsers={allUsers}
          currentUser={currentUser}
          conversationId={conversation.id}
          onSend={onSendMessage}
          disabled={isLoading}
        />
      </div>
    </div>
  );
}