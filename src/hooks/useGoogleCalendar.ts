import { useState, useEffect, useCallback } from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { calendarApi } from '@/api/calendar';
import type { GoogleCalendarStatus, GoogleCalendarEvent } from '@/types';

export function useGoogleCalendar() {
  const [status, setStatus] = useState<GoogleCalendarStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await calendarApi.getStatus();
      setStatus(data);
    } catch {
      setStatus({ connected: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const startLogin = useGoogleLogin({
    flow: 'implicit',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly',
    onSuccess: async (tokenResponse) => {
      try {
        setConnecting(true);
        setError(null);
        const accessToken = (tokenResponse as { access_token?: string }).access_token;
        if (!accessToken) throw new Error('Token Google tidak diterima.');
        const updated = await calendarApi.connect(accessToken);
        setStatus(updated);
      } catch (err) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal menghubungkan Google Calendar.';
        setError(msg);
      } finally {
        setConnecting(false);
      }
    },
    onError: () => {
      setConnecting(false);
      setError('Koneksi Google Calendar dibatalkan atau gagal.');
    },
  });

  const connect = useCallback(() => {
    setError(null);
    startLogin();
  }, [startLogin]);

  const disconnect = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await calendarApi.disconnect();
      setStatus({ connected: false });
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Gagal memutuskan koneksi Google Calendar.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEvents = useCallback(async (from?: string, to?: string): Promise<GoogleCalendarEvent[]> => {
    try {
      setError(null);
      return await calendarApi.listEvents(from, to);
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Gagal memuat event dari Google Calendar.';
      setError(msg);
      throw err;
    }
  }, []);

  const syncActivity = useCallback(async (activityId: string) => {
    try {
      setError(null);
      const result = await calendarApi.syncActivity(activityId);
      setStatus((prev) => ({ ...prev, syncedAt: new Date().toISOString() }));
      return result;
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Gagal menyinkronkan aktivitas ke Google Calendar.';
      setError(msg);
      throw err;
    }
  }, []);

  const importEvents = useCallback(
    async (
      events: Array<{
        id: string;
        title: string;
        description?: string | null;
        start: string;
        end?: string;
      }>,
    ) => {
      try {
        setError(null);
        const result = await calendarApi.importEvents(events);
        setStatus((prev) => ({ ...prev, syncedAt: new Date().toISOString() }));
        return result;
      } catch (err) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal mengimpor event dari Google Calendar.';
        setError(msg);
        throw err;
      }
    },
    [],
  );

  const autoSync = useCallback(
    async (startDate?: string, endDate?: string) => {
      try {
        setSyncing(true);
        setError(null);
        const result = await calendarApi.autoSync(startDate, endDate);
        setStatus((prev) => ({ ...prev, syncedAt: new Date().toISOString() }));
        return result;
      } catch (err) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal sinkronisasi otomatis Google Calendar.';
        setError(msg);
        throw err;
      } finally {
        setSyncing(false);
      }
    },
    [],
  );

  return {
    status,
    loading,
    connecting,
    syncing,
    error,
    connect,
    disconnect,
    refreshStatus,
    fetchEvents,
    syncActivity,
    importEvents,
    autoSync,
  };
}
