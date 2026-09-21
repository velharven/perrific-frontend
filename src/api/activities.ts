import { api } from '@/lib/api';
import type { DailyActivity, ChecklistItem } from '@/types';

export interface ActivityQuery {
  date?: string; // YYYY-MM-DD
  from?: string;
  to?: string;
  status?: string;
  search?: string;
  type?: string;
}

function toQueryString(q?: ActivityQuery): string {
  if (!q) return '';
  const params = new URLSearchParams();
  if (q.date) params.set('date', q.date);
  if (q.from) params.set('from', q.from);
  if (q.to) params.set('to', q.to);
  if (q.status) params.set('status', q.status);
  if (q.search) params.set('search', q.search);
  if (q.type) params.set('type', q.type);
  const s = params.toString();
  return s ? `?${s}` : '';
}

export const activityApi = {
  listMine: (q?: ActivityQuery) =>
    api.get<{ data: DailyActivity[] }>(`/activities/me${toQueryString(q)}`).then((r) => r.data.data),
  create: (body: Record<string, unknown>) =>
    api.post<{ data: DailyActivity }>('/activities', body).then((r) => r.data.data),
  update: (activityId: string, body: Record<string, unknown>) =>
    api.patch<{ data: DailyActivity }>(`/activities/${activityId}`, body).then((r) => r.data.data),
  remove: (activityId: string) =>
    api.delete<{ data: { id: string } }>(`/activities/${activityId}`).then((r) => r.data.data),
  duplicate: (activityId: string) =>
    api.post<{ data: DailyActivity }>(`/activities/${activityId}/duplicate`).then((r) => r.data.data),
  reorder: (orderedIds: string[]) =>
    api.post<{ data: { orderedIds: string[] } }>('/activities/reorder', { orderedIds }).then((r) => r.data.data),

  // Notion checklist blocks
  addChecklist: (activityId: string, text: string) =>
    api.post<{ data: ChecklistItem }>(`/activities/${activityId}/checklist`, { text }).then((r) => r.data.data),
  updateChecklist: (itemId: string, body: Partial<ChecklistItem>) =>
    api.patch<{ data: ChecklistItem }>(`/activities/checklist/${itemId}`, body).then((r) => r.data.data),
  removeChecklist: (itemId: string) =>
    api.delete<{ data: { id: string } }>(`/activities/checklist/${itemId}`).then((r) => r.data.data),
};
