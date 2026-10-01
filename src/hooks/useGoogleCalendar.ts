import { useState, useCallback, useRef } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { calendarApi } from "@/api/calendar";
import { showToast } from "@/components/ui/Toast";
import type { GoogleCalendarEvent } from "@/types";
import { useCalendarSync } from "@/store/calendarSync";

export function useGoogleCalendar() {
  const {
    status,
    loading,
    syncing,
    error,
    setStatus,
    setError,
    refreshStatus,
    autoSync,
  } = useCalendarSync();
  const statusRef = useRef(status);
  statusRef.current = status;
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const disconnectingRef = useRef(false);
  const startLogin = useGoogleLogin({
    flow: "auth-code",
    scope: "https://www.googleapis.com/auth/calendar.events email profile",
    overrideScope: true,
    select_account: true,
    onSuccess: async (codeResponse) => {
      try {
        setConnecting(true);
        setError(null);
        const code = codeResponse.code;
        if (!code) throw new Error("Kode otorisasi Google tidak diterima.");
        const updated = await calendarApi.connect({ code });
        setStatus(updated);
        showToast("Google Calendar berhasil terhubung!");
      } catch (err) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Gagal menghubungkan Google Calendar.";
        setError(msg);
        showToast(msg);
      } finally {
        setConnecting(false);
      }
    },
    onError: () => {
      setConnecting(false);
      setError("Koneksi Google Calendar dibatalkan atau gagal.");
      showToast("Koneksi Google Calendar dibatalkan atau gagal.");
    },
  });

  const connect = useCallback(() => {
    setError(null);
    startLogin();
  }, [startLogin]);

  const disconnect = useCallback(async () => {
    if (disconnectingRef.current) return;
    disconnectingRef.current = true;
    setDisconnecting(true);
    try {
      setError(null);
      await calendarApi.disconnect();
      setStatus({ connected: false });
      showToast("Koneksi Google Calendar berhasil diputus.");
    } catch (err) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data
          ?.message || "Gagal memutuskan koneksi Google Calendar.";
      setError(msg);
      showToast(msg);
    } finally {
      disconnectingRef.current = false;
      setDisconnecting(false);
    }
  }, [setStatus, setError]);

  const fetchEvents = useCallback(
    async (from?: string, to?: string): Promise<GoogleCalendarEvent[]> => {
      const connectionId = statusRef.current.connectionId;
      try {
        const events = await calendarApi.listEvents(from, to);
        if (statusRef.current.connectionId !== connectionId)
          throw new Error("Akun Google telah berubah.");
        return events;
      } catch (err) {
        if (statusRef.current.connectionId !== connectionId) throw err;
        const axiosErr = err as {
          response?: { status?: number; data?: { message?: string } };
        };
        if ([400, 401, 403, 409].includes(axiosErr?.response?.status || 0))
          void refreshStatus();
        const msg =
          axiosErr?.response?.data?.message ||
          "Gagal memuat event dari Google Calendar.";
        setError(msg);
        throw err;
      }
    },
    [setStatus, setError, refreshStatus],
  );

  const syncActivity = useCallback(
    async (activityId: string) => {
      try {
        setError(null);
        const result = await calendarApi.syncActivity(activityId);
        void refreshStatus();
        return result;
      } catch (err) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ||
          "Gagal menyinkronkan aktivitas ke Google Calendar.";
        setError(msg);
        throw err;
      }
    },
    [setStatus, setError, refreshStatus],
  );

  const importEvents = useCallback(
    async (
      events: Array<{
        id: string;
        recurringEventId?: string | null;
        title: string;
        description?: string | null;
        start: string;
        end?: string;
      }>,
    ) => {
      try {
        setError(null);
        const result = await calendarApi.importEvents(events);
        void refreshStatus();
        return result;
      } catch (err) {
        const msg =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message || "Gagal mengimpor event dari Google Calendar.";
        setError(msg);
        throw err;
      }
    },
    [setError, refreshStatus],
  );

  return {
    status,
    loading: loading || disconnecting,
    connecting,
    disconnecting,
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
