import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import ConversationList from '@/components/chat/ConversationList';
import ChatWindow from '@/components/chat/ChatWindow';
import NewChatDialog from '@/components/chat/NewChatDialog';

const PAGE_SIZE = 30;

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [typingUsers, setTypingUsers] = useState([]);
  const typingTimerRef = useRef(null);

  // Fetch all users
  const { data: allUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 60000,
  });

  // Fetch conversations
  const { data: allConversations = [] } = useQuery({
    queryKey: ['chat-conversations', user?.email],
    queryFn: async () => {
      const convs = await base44.entities.Conversation.list();
      return convs.filter(c => c.participants?.includes(user?.email));
    },
    enabled: !!user?.email,
    staleTime: 10000,
  });

  // Add unread count to conversations
  const conversations = allConversations.map(conv => {
    const unreadCount = messages.filter(m => 
      m.conversation_id === conv.id && 
      m.sender_email !== user?.email
    ).length;
    return { ...conv, unread_count: unreadCount };
  }).sort((a, b) => new Date(b.last_message_at) - new Date(a.last_message_at));

  const activeConversation = conversations.find(c => c.id === activeConversationId);

  // Load messages for active conversation
  const loadMessages = useCallback(async (reset = false) => {
    if (!activeConversationId) return;
    const currentOffset = reset ? 0 : offset;
    const batch = await base44.entities.ChatMessageV2.filter(
      { conversation_id: activeConversationId, is_deleted: false },
      '-created_date',
      PAGE_SIZE,
      currentOffset
    );
    const sorted = [...batch].reverse();
    if (reset) {
      setMessages(sorted);
      setOffset(PAGE_SIZE);
      setHasMore(batch.length === PAGE_SIZE);
    } else {
      setMessages(prev => [...sorted, ...prev]);
      setOffset(prev => prev + PAGE_SIZE);
      setHasMore(batch.length === PAGE_SIZE);
    }
  }, [activeConversationId, offset]);

  // Initial load when conversation changes
  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setOffset(0);
      setHasMore(true);
      return;
    }
    setOffset(0);
    setHasMore(true);
    base44.entities.ChatMessageV2.filter(
      { conversation_id: activeConversationId, is_deleted: false },
      '-created_date',
      PAGE_SIZE,
      0
    ).then(batch => {
      const sorted = [...batch].reverse();
      setMessages(sorted);
      setOffset(PAGE_SIZE);
      setHasMore(batch.length === PAGE_SIZE);
    });
  }, [activeConversationId]);

  // Real-time message subscription
  useEffect(() => {
    const unsub = base44.entities.ChatMessageV2.subscribe((event) => {
      if (event.data?.conversation_id !== activeConversationId) return;
      if (event.type === 'create' && !event.data?.is_deleted) {
        setMessages(prev => {
          if (prev.find(m => m.id === event.id)) return prev;
          return [...prev, event.data];
        });
      }
      if (event.type === 'update') {
        setMessages(prev => prev.map(m => 
          m.id === event.id ? (event.data?.is_deleted ? null : event.data) : m
        ).filter(Boolean));
      }
      if (event.type === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== event.id));
      }
    });
    return () => unsub();
  }, [activeConversationId]);

  // Conversation participant subscription for typing indicators
  useEffect(() => {
    const unsub = base44.entities.ConversationParticipant.subscribe((event) => {
      if (event.data?.conversation_id !== activeConversationId) return;
      if (event.data?.is_typing) {
        setTypingUsers(prev => [...new Set([...prev, event.data.user_email])]);
      }
    });
    return () => unsub();
  }, [activeConversationId]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ text, mentions, fileUrls }) => {
      const msg = await base44.entities.ChatMessageV2.create({
        conversation_id: activeConversationId,
        sender_id: user.id,
        sender_name: user.full_name || user.email,
        sender_email: user.email,
        message: text,
        mentions,
        file_urls: fileUrls || [],
        status: 'sent',
        edited: false,
        is_deleted: false,
      });

      // Update conversation's last message
      await base44.entities.Conversation.update(activeConversationId, {
        last_message_text: text.slice(0, 100),
        last_message_at: new Date().toISOString(),
        last_message_by: user.email,
      });

      // Notify mentioned users
      for (const mentionEmail of mentions) {
        if (mentionEmail !== user.email) {
          await base44.entities.ChatNotification.create({
            recipient_email: mentionEmail,
            type: 'mention',
            message_id: msg.id,
            sender_name: user.full_name || user.email,
            preview: text.slice(0, 80),
            channel: activeConversationId,
            is_read: false,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['chat-conversations', user?.email] });
      return msg;
    },
  });

  const handleCreateConversation = async (type, name, participants) => {
    const conv = await base44.entities.Conversation.create({
      type,
      name: name || null,
      participants: [...new Set(participants)],
      created_by: user.email,
    });

    // Create participant records
    for (const email of participants) {
      await base44.entities.ConversationParticipant.create({
        conversation_id: conv.id,
        user_email: email,
      });
    }

    queryClient.invalidateQueries({ queryKey: ['chat-conversations', user?.email] });
    setActiveConversationId(conv.id);
  };

  const handleMarkAsRead = async () => {
    if (!activeConversationId) return;
    await base44.entities.ConversationParticipant.filter(
      { conversation_id: activeConversationId, user_email: user?.email }
    ).then(([participant]) => {
      if (participant) {
        base44.entities.ConversationParticipant.update(participant.id, {
          last_read_at: new Date().toISOString(),
        });
      }
    });
  };

  const handleLoadMore = async () => {
    if (!hasMore) return;
    const batch = await base44.entities.ChatMessageV2.filter(
      { conversation_id: activeConversationId, is_deleted: false },
      '-created_date',
      PAGE_SIZE,
      offset
    );
    const sorted = [...batch].reverse();
    setMessages(prev => [...sorted, ...prev]);
    setOffset(prev => prev + PAGE_SIZE);
    setHasMore(batch.length === PAGE_SIZE);
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-background">
      <ConversationList
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        onNewChat={() => setNewChatOpen(true)}
        currentUserEmail={user?.email}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      />

      <ChatWindow
        conversation={activeConversation}
        messages={messages}
        currentUser={user}
        allUsers={allUsers}
        onSendMessage={({ text, mentions, fileUrls }) =>
          sendMutation.mutate({ text, mentions, fileUrls })
        }
        onDeleteMessage={async (msgId) => {
          await base44.entities.ChatMessageV2.update(msgId, { is_deleted: true });
        }}
        onEditMessage={async (msgId, newText) => {
          await base44.entities.ChatMessageV2.update(msgId, {
            message: newText,
            edited: true,
          });
        }}
        onMarkAsRead={handleMarkAsRead}
        isLoading={sendMutation.isPending}
        isLoadingMore={false}
        hasMore={hasMore}
        onLoadMore={handleLoadMore}
        typingUsers={typingUsers}
      />

      <NewChatDialog
        open={newChatOpen}
        onOpenChange={setNewChatOpen}
        allUsers={allUsers}
        currentUser={user}
        onCreateConversation={handleCreateConversation}
      />
    </div>
  );
}