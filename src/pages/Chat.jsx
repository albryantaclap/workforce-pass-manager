import React, { useState, useEffect, useRef, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Hash, Users, Bell, BellOff, Trash2, Edit2, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import MentionInput from '@/components/chat/MentionInput';
import MessageBubble from '@/components/chat/MessageBubble';
import NotificationPanel from '@/components/chat/NotificationPanel';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 30;

export default function Chat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeChannel, setActiveChannel] = useState('general');
  const [messages, setMessages] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const isFirstLoad = useRef(true);

  // Fetch all users for mentions
  const { data: allUsers = [] } = useQuery({
    queryKey: ['chat-users'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 60000,
  });

  // Fetch unread notifications count
  const { data: notifications = [] } = useQuery({
    queryKey: ['chat-notifications', user?.email],
    queryFn: () => base44.entities.ChatNotification.filter({ recipient_email: user?.email, is_read: false }),
    refetchInterval: 5000,
    enabled: !!user?.email,
  });

  const unreadCount = notifications.length;

  // Load initial messages
  const loadMessages = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    const batch = await base44.entities.ChatMessage.filter(
      { channel: activeChannel, is_deleted: false },
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
  }, [activeChannel, offset]);

  // Initial load & channel switch
  useEffect(() => {
    isFirstLoad.current = true;
    setOffset(0);
    setHasMore(true);
    setMessages([]);
    base44.entities.ChatMessage.filter(
      { channel: activeChannel, is_deleted: false },
      '-created_date',
      PAGE_SIZE,
      0
    ).then(batch => {
      const sorted = [...batch].reverse();
      setMessages(sorted);
      setOffset(PAGE_SIZE);
      setHasMore(batch.length === PAGE_SIZE);
      isFirstLoad.current = false;
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    });
  }, [activeChannel]);

  // Real-time subscription
  useEffect(() => {
    const unsub = base44.entities.ChatMessage.subscribe((event) => {
      if (event.data?.channel !== activeChannel) return;
      if (event.type === 'create' && !event.data?.is_deleted) {
        setMessages(prev => {
          if (prev.find(m => m.id === event.id)) return prev;
          return [...prev, event.data];
        });
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
      }
      if (event.type === 'update') {
        setMessages(prev => prev.map(m => m.id === event.id ? (event.data?.is_deleted ? null : event.data) : m).filter(Boolean));
      }
      if (event.type === 'delete') {
        setMessages(prev => prev.filter(m => m.id !== event.id));
      }
    });
    return () => unsub();
  }, [activeChannel]);

  // Also subscribe to notifications in real-time
  useEffect(() => {
    const unsub = base44.entities.ChatNotification.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['chat-notifications', user?.email] });
    });
    return () => unsub();
  }, [user?.email]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async ({ text, mentions }) => {
      const msg = await base44.entities.ChatMessage.create({
        sender_id: user.id,
        sender_name: user.full_name || user.email,
        sender_email: user.email,
        message: text,
        mentions,
        channel: activeChannel,
        is_deleted: false,
        edited: false,
      });
      // Create notifications for mentions
      for (const mentionEmail of mentions) {
        if (mentionEmail !== user.email) {
          await base44.entities.ChatNotification.create({
            recipient_email: mentionEmail,
            type: 'mention',
            message_id: msg.id,
            sender_name: user.full_name || user.email,
            preview: text.slice(0, 80),
            channel: activeChannel,
            is_read: false,
          });
        }
      }
      return msg;
    },
  });

  const handleLoadMore = async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    const batch = await base44.entities.ChatMessage.filter(
      { channel: activeChannel, is_deleted: false },
      '-created_date',
      PAGE_SIZE,
      offset
    );
    const sorted = [...batch].reverse();
    setMessages(prev => [...sorted, ...prev]);
    setOffset(prev => prev + PAGE_SIZE);
    setHasMore(batch.length === PAGE_SIZE);
    setLoadingMore(false);
  };

  const channels = [
    { id: 'general', label: 'General', icon: Hash },
    { id: 'electrical', label: 'Electrical', icon: Hash },
    { id: 'mechanical', label: 'Mechanical', icon: Hash },
    { id: 'civil', label: 'Civil', icon: Hash },
  ];

  return (
    <div className="flex h-[calc(100vh-0px)] bg-background">
      {/* Sidebar */}
      <div className="w-56 bg-card border-r border-border flex flex-col">
        <div className="p-4 border-b border-border">
          <h2 className="font-bold text-sm text-foreground flex items-center gap-2">
            <Users className="w-4 h-4" /> Team Chat
          </h2>
        </div>
        <div className="p-3 flex-1">
          <p className="text-[10px] uppercase font-semibold text-muted-foreground tracking-widest mb-2">Channels</p>
          {channels.map(ch => (
            <button
              key={ch.id}
              onClick={() => setActiveChannel(ch.id)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-1',
                activeChannel === ch.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              <ch.icon className="w-3.5 h-3.5" />
              {ch.label}
            </button>
          ))}
        </div>
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-xs text-muted-foreground truncate">{user?.full_name || user?.email}</span>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="h-14 border-b border-border flex items-center justify-between px-4 bg-card">
          <div className="flex items-center gap-2">
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="font-semibold text-sm">{channels.find(c => c.id === activeChannel)?.label || activeChannel}</span>
          </div>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </Button>
            {showNotifications && (
              <NotificationPanel
                notifications={notifications}
                onClose={() => setShowNotifications(false)}
                onMarkRead={async (id) => {
                  await base44.entities.ChatNotification.update(id, { is_read: true });
                  queryClient.invalidateQueries({ queryKey: ['chat-notifications', user?.email] });
                }}
                onMarkAllRead={async () => {
                  await Promise.all(notifications.map(n => base44.entities.ChatNotification.update(n.id, { is_read: true })));
                  queryClient.invalidateQueries({ queryKey: ['chat-notifications', user?.email] });
                }}
              />
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          {hasMore && (
            <div className="text-center py-2">
              <Button variant="ghost" size="sm" onClick={handleLoadMore} disabled={loadingMore}>
                {loadingMore ? 'Loading...' : 'Load older messages'}
              </Button>
            </div>
          )}
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isOwn={msg.sender_email === user?.email}
              allUsers={allUsers}
              currentUser={user}
              showAvatar={idx === 0 || messages[idx - 1]?.sender_email !== msg.sender_email}
              onDelete={async () => {
                await base44.entities.ChatMessage.update(msg.id, { is_deleted: true });
              }}
              onEdit={async (newText) => {
                await base44.entities.ChatMessage.update(msg.id, { message: newText, edited: true });
              }}
            />
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="border-t border-border p-4 bg-card">
          <MentionInput
            allUsers={allUsers}
            currentUser={user}
            channel={activeChannel}
            onSend={({ text, mentions }) => sendMutation.mutate({ text, mentions })}
            disabled={sendMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}