import { api } from '@/lib/api';
import type { Notification } from '@/types';

export const notificationApi = {
  list: () => api.get<{ data: Notification[] }>('/notifications').then((r) => r.data.data),
  markRead: (notificationId: string) =>
    api.patch<{ data: Notification }>(`/notifications/${notificationId}/read`).then((r) => r.data.data),
  markAllRead: () =>
    api.patch<{ message: string }>('/notifications/read-all').then((r) => r.data),
};

