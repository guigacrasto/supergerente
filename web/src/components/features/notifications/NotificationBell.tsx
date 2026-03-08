import { useEffect, useRef } from 'react';
import { Bell } from 'lucide-react';
import { useNotificationStore } from '@/stores/notificationStore';
import { NotificationPanel } from './NotificationPanel';
import { cn } from '@/lib/utils';

export function NotificationBell() {
  const { unreadCount, panelOpen, togglePanel, closePanel, fetchUnreadCount } =
    useNotificationStore();
  const containerRef = useRef<HTMLDivElement>(null);

  // Poll unread count every 30s
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  // Close panel on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePanel();
      }
    }
    if (panelOpen) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [panelOpen, closePanel]);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={togglePanel}
        className={cn(
          'relative flex items-center justify-center rounded-button p-2 transition-colors cursor-pointer',
          panelOpen
            ? 'bg-primary/10 text-primary'
            : 'text-muted hover:bg-surface-secondary hover:text-foreground'
        )}
        aria-label={`Notificações${unreadCount > 0 ? ` (${unreadCount} não lidas)` : ''}`}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {panelOpen && <NotificationPanel />}
    </div>
  );
}
