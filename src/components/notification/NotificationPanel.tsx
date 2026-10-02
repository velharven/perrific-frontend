import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  CheckCheck,
  Bell,
  CheckSquare,
  Clock,
  AlertCircle,
  Calendar,
  Users,
  Info,
} from 'lucide-react';
import { notificationApi } from '@/api/notifications';
import type { Notification, NotificationType } from '@/types';

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

function formatRelativeTime(dateString: string): string {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSec < 60) return 'Baru saja';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} mnt lalu`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour} jam lalu`;
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay === 1) return 'Kemarin';
    if (diffDay < 7) return `${diffDay} hari lalu`;
    return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  } catch {
    return '';
  }
}

function getNotificationTypeBadge(type: NotificationType) {
  switch (type) {
    case 'TASK_ASSIGNED':
      return {
        label: 'Tugas Baru',
        icon: CheckSquare,
        color: 'bg-blue-50 text-blue-700 border-blue-200',
      };
    case 'TASK_UPDATED':
      return {
        label: 'Tugas Diperbarui',
        icon: Info,
        color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
      };
    case 'DEADLINE_APPROACHING':
      return {
        label: 'Mendekati Tenggat',
        icon: Clock,
        color: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'TASK_OVERDUE':
      return {
        label: 'Terlewat',
        icon: AlertCircle,
        color: 'bg-red-50 text-red-700 border-red-200',
      };
    case 'ACTIVITY_REMINDER':
      return {
        label: 'Pengingat',
        icon: Calendar,
        color: 'bg-purple-50 text-purple-700 border-purple-200',
      };
    case 'TEAM_INVITE':
      return {
        label: 'Undangan Tim',
        icon: Users,
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      };
    case 'SYSTEM':
    default:
      return {
        label: 'Sistem',
        icon: Bell,
        color: 'bg-gray-100 text-gray-700 border-gray-200',
      };
  }
}

export default function NotificationPanel({
  open,
  onClose,
  onUnreadCountChange,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notificationApi.list();
      setNotifications(data || []);
      const unread = (data || []).filter((n) => !n.read).length;
      onUnreadCountChange?.(unread);
    } catch {
      // Abaikan jika error jaringan
    } finally {
      setLoading(false);
    }
  }, [onUnreadCountChange]);

  useEffect(() => {
    if (open) {
      fetchNotifications();
    }
  }, [open, fetchNotifications]);

  // Listener tombol Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  // Real-time synchronization via custom events dispatched by AppLayout socket listener
  useEffect(() => {
    const handleNewNotif = (e: Event) => {
      const customEvent = e as CustomEvent<Notification>;
      if (!customEvent.detail) return;
      setNotifications((prev) => {
        if (prev.some((n) => n.id === customEvent.detail.id)) return prev;
        return [customEvent.detail, ...prev];
      });
    };

    const handleReadNotif = (e: Event) => {
      const customEvent = e as CustomEvent<{ notificationId?: string }>;
      if (!customEvent.detail?.notificationId) return;
      setNotifications((prev) =>
        prev.map((n) => (n.id === customEvent.detail.notificationId ? { ...n, read: true } : n))
      );
    };

    const handleReadAllNotif = () => {
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    };

    window.addEventListener('purrific:notification-new', handleNewNotif);
    window.addEventListener('purrific:notification-read', handleReadNotif);
    window.addEventListener('purrific:notification-read-all', handleReadAllNotif);

    return () => {
      window.removeEventListener('purrific:notification-new', handleNewNotif);
      window.removeEventListener('purrific:notification-read', handleReadNotif);
      window.removeEventListener('purrific:notification-read-all', handleReadAllNotif);
    };
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAll) return;
    try {
      setMarkingAll(true);
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      onUnreadCountChange?.(0);
    } catch {
      // fallback jika rute gagal
    } finally {
      setMarkingAll(false);
    }
  }

  async function handleNotificationClick(item: Notification) {
    if (!item.read) {
      try {
        await notificationApi.markRead(item.id);
        setNotifications((prev) =>
          prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
        );
        const nextUnread = Math.max(0, unreadCount - 1);
        onUnreadCountChange?.(nextUnread);
      } catch {
        // abaikan
      }
    }

    if (item.relatedTaskId) {
      // Tutup notifikasi & navigasi ke halaman harian / board jika ada
      onClose();
      navigate('/daily');
    }
  }

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Panel Notifikasi"
      className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-[340px] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[360px] ${
        open ? 'translate-x-0' : '-translate-x-full pointer-events-none'
      }`}
    >
      {/* Header Panel */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5">
        <div className="flex items-center gap-2">
          {/* Tombol X di pojok kiri atas */}
          <button
            type="button"
            onClick={onClose}
            title="Tutup notifikasi"
            aria-label="Tutup notifikasi"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-perrific-graphite"
          >
            <X size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="font-manrope text-sm font-bold text-perrific-graphite">
              Notifikasi
            </h2>
            {unreadCount > 0 && (
              <span className="flex h-5 items-center justify-center rounded-full bg-perrific-violet/10 px-2 font-mono text-[10px] font-bold text-perrific-violet">
                {unreadCount}
              </span>
            )}
          </div>
        </div>

        {/* Tombol Baca semua notifikasi */}
        <button
          type="button"
          onClick={handleMarkAllRead}
          disabled={unreadCount === 0 || markingAll}
          title="Baca semua notifikasi"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-manrope text-xs font-semibold text-perrific-violet transition hover:bg-perrific-violet/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <CheckCheck size={14} strokeWidth={1.8} aria-hidden="true" />
          <span>Baca semua</span>
        </button>
      </div>

      {/* Konten Notifikasi */}
      <div className="nice-scroll flex-1 overflow-y-auto p-3">
        {loading && notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-gray-400">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-perrific-violet" />
            <p className="mt-3 font-manrope text-xs text-gray-400">Memuat notifikasi…</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-50 text-gray-400 border border-gray-100">
              <Bell size={22} strokeWidth={1.5} />
            </div>
            <h3 className="mt-3 font-manrope text-sm font-bold text-perrific-graphite">
              Belum ada notifikasi
            </h3>
            <p className="mt-1 font-manrope text-xs text-gray-400 leading-relaxed max-w-[24ch]">
              Pemberitahuan tugas, deadline, dan aktivitas tim akan muncul di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((item) => {
              const badge = getNotificationTypeBadge(item.type);
              const BadgeIcon = badge.icon;
              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleNotificationClick(item);
                    }
                  }}
                  className={`group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all cursor-pointer ${
                    item.read
                      ? 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50/60'
                      : 'border-perrific-violet/20 bg-orange-50/20 shadow-2xs hover:bg-orange-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-manrope text-[10px] font-semibold ${badge.color}`}
                    >
                      <BadgeIcon size={11} strokeWidth={1.8} aria-hidden="true" />
                      <span>{badge.label}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[10px] text-gray-400">
                        {formatRelativeTime(item.createdAt)}
                      </span>
                      {!item.read && (
                        <span
                          className="h-2 w-2 rounded-full bg-red-500"
                          title="Belum dibaca"
                          aria-label="Belum dibaca"
                        />
                      )}
                    </div>
                  </div>

                  <h4 className="font-manrope text-xs font-bold text-perrific-graphite leading-snug">
                    {item.title}
                  </h4>

                  {item.message && (
                    <p className="font-manrope text-xs text-perrific-graphite/70 leading-relaxed line-clamp-2">
                      {item.message}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
