import { api } from '@/lib/api';
import type { GoogleCalendarStatus, GoogleCalendarEvent, DailyActivity, RecurrenceEditScope } from '@/types';

export interface CalendarSyncResult {
  syncRunId?: string;
  connectionId?: string;
  baselinePending?: boolean;
  pushedCount: number;
  importedCount: number;
  updatedCount: number;
  deletedCount: number;
  pendingCount: number;
  syncedAt: string | null;
}

export interface CalendarSyncOptions {
  hydrateRange?: boolean;
}

export const calendarApi = {
  getStatus: () =>
    api.get<{ data: GoogleCalendarStatus }>('/calendar/google/status').then((r) => r.data.data),

  connect: (payload: string | { code?: string; accessToken?: string; email?: string }, email?: string) => {
    const data = typeof payload === 'string' ? { code: payload, email } : payload;
    return api.post<{ data: GoogleCalendarStatus }>('/calendar/google/connect', data).then((r) => r.data.data);
  },

  disconnect: () =>
    api.post<{ data: { connected: boolean } }>('/calendar/google/disconnect').then((r) => r.data.data),

  listEvents: (from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return api.get<{ data: GoogleCalendarEvent[] }>(`/calendar/google/events${qs}`).then((r) => r.data.data);
  },

  syncActivity: (activityId: string) =>
    api
      .post<{ data: { activity: DailyActivity; googleEventId: string } }>(
        `/calendar/google/sync-activity/${activityId}`,
      )
      .then((r) => r.data.data),

  importEvents: (
    events: Array<{
      id: string;
      recurringEventId?: string | null;
      title: string;
      description?: string | null;
      start: string;
      end?: string;
    }>,
  ) =>
    api.post<{ data: { importedCount: number } }>('/calendar/google/import', { events }).then((r) => r.data.data),

  autoSync: (startDate?: string, endDate?: string, options: CalendarSyncOptions = {}) =>
    api
      .post<{ data: CalendarSyncResult }>('/calendar/google/auto-sync', {
        startDate,
        endDate,
        hydrateRange: options.hydrateRange ?? false,
      })
      .then((r) => r.data.data),

  createEvent: (data: {
    title: string;
    description?: string | null;
    date?: string;
    startTime?: string | null;
    endTime?: string | null;
  }) => api.post<{ data: { id: string } }>('/calendar/google/events', data).then((r) => r.data.data),

  updateEvent: (
    eventId: string,
    data: {
      title?: string;
      description?: string | null;
      date?: string;
      startTime?: string | null;
      endTime?: string | null;
      recurrence?: Record<string, unknown> | null;
      colorId?: string | null;
      scope?: RecurrenceEditScope;
      instanceDate?: string;
    },
  ) => api.patch<{ data: { id: string } }>(`/calendar/google/events/${eventId}`, data).then((r) => r.data.data),

  deleteEvent: (eventId: string) =>
    api.delete<{ data: { id: string } }>(`/calendar/google/events/${eventId}`).then((r) => r.data.data),
};
