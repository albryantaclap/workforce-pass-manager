import React, { useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, AtSign, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function NotificationPanel({ notifications, onClose, onMarkRead, onMarkAllRead }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <div ref={panelRef} className="absolute right-0 top-10 w-80 bg-popover border border-border rounded-xl shadow-xl z-50 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Notifications</span>
          {notifications.length > 0 && (
            <span className="text-xs bg-red-500 text-white rounded-full px-1.5 py-0.5 font-bold">{notifications.length}</span>
          )}
        </div>
        {notifications.length > 0 && (
          <Button variant="ghost" size="sm" className="text-xs h-7" onClick={onMarkAllRead}>
            <CheckCheck className="w-3 h-3 mr-1" /> Mark all read
          </Button>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
            <Bell className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-sm">No unread notifications</p>
          </div>
        ) : (
          notifications.map(n => (
            <div key={n.id} className="flex items-start gap-3 px-4 py-3 hover:bg-accent transition-colors border-b border-border last:border-0">
              <div className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
                n.type === 'mention' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
              )}>
                {n.type === 'mention' ? <AtSign className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground">
                  {n.type === 'mention' ? `${n.sender_name} mentioned you` : `New message from ${n.sender_name}`}
                </p>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{n.preview}</p>
                <p className="text-[10px] text-muted-foreground mt-1">#{n.channel} · {n.created_date ? format(new Date(n.created_date), 'MMM d, HH:mm') : ''}</p>
              </div>
              <button onClick={() => onMarkRead(n.id)} className="p-1 rounded text-muted-foreground hover:text-emerald-600 hover:bg-accent flex-shrink-0" title="Mark as read">
                <Check className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}