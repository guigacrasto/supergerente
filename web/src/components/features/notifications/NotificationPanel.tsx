import { CheckCheck, Loader2 } from 'lucide-react';
import { useNotificationStore, type Notification } from '@/stores/notificationStore';
import { cn } from '@/lib/utils';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function typeIcon(type: string): string {
  switch (type) {
    case 'hot_lead': return '🔥';
    case 'lead_created': return '➕';
    case 'lead_status_changed': return '🔄';
    default: return '📢';
  }
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (id: string) => void;
}) {
  return (
    <button
      onClick={() => !notification.read && onRead(notification.id)}
      className={cn(
        'flex w-full gap-3 px-4 py-3 text-left transition-colors cursor-pointer',
        notification.read
          ? 'bg-transparent opacity-60'
          : 'bg-primary/5 hover:bg-primary/10'
      )}
    >
      <span className="mt-0.5 text-lg shrink-0">{typeIcon(notification.type)}</span>
      <div className="flex-1 min-w-0">
        <p className={cn(
          'text-body-sm truncate',
          notification.read ? 'text-muted' : 'text-foreground font-medium'
        )}>
          {notification.title}
        </p>
        {notification.body && (
          <p className="text-body-sm text-muted mt-0.5 line-clamp-2">
            {notification.body}
          </p>
        )}
        <p className="text-[11px] text-muted mt-1">
          {timeAgo(notification.created_at)}
        </p>
      </div>
      {!notification.read && (
        <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-primary" />
      )}
    </button>
  );
}

export function NotificationPanel() {
  const { notifications, loading, unreadCount, markAsRead, markAllAsRead } =
    useNotificationStore();

  return (
    <div className="absolute right-0 top-full mt-2 z-50 w-80 max-h-[420px] overflow-hidden rounded-card border border-glass-border bg-surface shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-glass-border px-4 py-3">
        <h3 className="font-heading text-body-md font-semibold text-foreground">
          Notificações
        </h3>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1 text-body-sm text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Marcar todas
          </button>
        )}
      </div>

      {/* Body */}
      <div className="overflow-y-auto max-h-[340px] divide-y divide-glass-border">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-8 text-center text-body-sm text-muted">
            Nenhuma notificação
          </div>
        ) : (
          notifications.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              onRead={markAsRead}
            />
          ))
        )}
      </div>
    </div>
  );
}
