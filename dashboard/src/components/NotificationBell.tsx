import { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, AlertTriangle, Clock, TrendingDown, Package, CheckCheck, X } from 'lucide-react';
import { api } from '../api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Notification {
  id: number;
  type: 'CRITICAL_STOCK' | 'EXPIRING_SOON' | 'DEVIATION_EXCEEDED' | 'REPLENISHMENT_REQUESTED';
  title: string;
  body: string;
  isRead: boolean;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const typeConfig = {
  CRITICAL_STOCK: {
    icon: AlertTriangle,
    color: 'text-rose-500',
    bg:    'bg-rose-50 dark:bg-rose-950/30',
    dot:   'bg-rose-500',
  },
  EXPIRING_SOON: {
    icon: Clock,
    color: 'text-orange-500',
    bg:    'bg-orange-50 dark:bg-orange-950/30',
    dot:   'bg-orange-500',
  },
  DEVIATION_EXCEEDED: {
    icon: TrendingDown,
    color: 'text-amber-500',
    bg:    'bg-amber-50 dark:bg-amber-950/30',
    dot:   'bg-amber-500',
  },
  REPLENISHMENT_REQUESTED: {
    icon: Package,
    color: 'text-cyan-500',
    bg:    'bg-cyan-50 dark:bg-cyan-950/30',
    dot:   'bg-cyan-500',
  },
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'только что';
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  return `${Math.floor(hours / 24)} дн. назад`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount]     = useState(0);
  const [open, setOpen]                   = useState(false);
  const [loading, setLoading]             = useState(false);
  const dropdownRef                       = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/count');
      setUnreadCount(data.count || 0);
    } catch { /* silent */ }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, []);

  // Polling каждые 2 минуты
  useEffect(() => {
    fetchCount();
    const timer = setInterval(fetchCount, 120_000);
    return () => clearInterval(timer);
  }, [fetchCount]);

  // Открыть дропдаун → подгрузить список
  useEffect(() => {
    if (open) fetchNotifications();
  }, [open, fetchNotifications]);

  // Закрыть по клику вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read', {});
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch { /* silent */ }
  };

  const markOneRead = async (id: number) => {
    try {
      await api.patch('/notifications/read', { ids: [id] });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch { /* silent */ }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors"
        aria-label="Уведомления"
      >
        <Bell className="w-5 h-5 text-slate-500 dark:text-slate-400" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-0.5 bg-rose-500 text-white text-[9px] font-extrabold rounded-full flex items-center justify-center leading-none animate-pulse">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[480px] flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700 shrink-0">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-white">Уведомления</h3>
              {unreadCount > 0 && (
                <span className="bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline px-2 py-1 rounded-lg hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Прочитать все
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                <Bell className="w-10 h-10 mb-2 text-slate-300" />
                <p className="text-sm">Нет уведомлений</p>
              </div>
            ) : (
              <div>
                {notifications.map(n => {
                  const cfg = typeConfig[n.type] ?? typeConfig.CRITICAL_STOCK;
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={n.id}
                      className={`flex gap-3 px-4 py-3 border-b border-slate-50 dark:border-slate-700/40 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30 cursor-pointer ${!n.isRead ? 'bg-cyan-50/30 dark:bg-cyan-950/10' : ''}`}
                      onClick={() => !n.isRead && markOneRead(n.id)}
                    >
                      <div className={`shrink-0 p-2 rounded-xl ${cfg.bg}`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-bold leading-tight ${!n.isRead ? 'text-slate-800 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                            {n.title}
                          </p>
                          {!n.isRead && (
                            <span className={`shrink-0 w-2 h-2 rounded-full mt-1 ${cfg.dot}`} />
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed line-clamp-2">
                          {n.body}
                        </p>
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                          {timeAgo(n.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 shrink-0">
            <a
              href="/settings/notifications"
              className="text-[11px] text-cyan-600 dark:text-cyan-400 hover:underline"
            >
              Настройки уведомлений →
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
