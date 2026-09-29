import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { calendarApi, type CalendarSyncResult } from "@/api/calendar";
import type { DailyActivity, GoogleCalendarStatus } from "@/types";
import { setCalendarConnection } from "@/lib/calendarConnection";
import { useAuth } from "./auth";
import { useSocket } from "./socket";

function defaultRange() {
  const now = new Date();
  return [
    new Date(now.getFullYear(), now.getMonth(), -6).toISOString(),
    new Date(now.getFullYear(), now.getMonth() + 1, 8).toISOString(),
  ] as const;
}
export interface CalendarChange {
  syncRunId?: string;
  connectionId?: string | null;
  action?: string;
  activity?: DailyActivity | null;
  activityId?: string;
  googleEventId?: string | null;
  eventId?: string;
  pendingCount?: number;
  syncedAt?: string | null;
  retry?: boolean;
}
interface CalendarSyncContextValue {
  status: GoogleCalendarStatus;
  loading: boolean;
  syncing: boolean;
  error: string | null;
  pendingCount: number;
  revision: number;
  change: CalendarChange | null;
  setStatus: (status: GoogleCalendarStatus) => void;
  setError: (message: string | null) => void;
  refreshStatus: () => Promise<void>;
  autoSync: (
    from?: string,
    to?: string,
  ) => Promise<CalendarSyncResult | undefined>;
  setRange: (from: string, to: string) => void;
}
const CalendarSyncContext = createContext<CalendarSyncContextValue | null>(
  null,
);
const identity = (s: GoogleCalendarStatus) =>
  s.connected ? s.connectionId || s.email || "legacy" : null;

export function CalendarSyncProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const [status, updateStatus] = useState<GoogleCalendarStatus>({
    connected: false,
  });
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);
  const [revision, setRevision] = useState(0);
  const [change, setChange] = useState<CalendarChange | null>(null);
  const [retryNeeded, setRetryNeeded] = useState(false);
  const retryAttempt = useRef(0);
  const statusRef = useRef(status);
  const rangeRef = useRef<readonly [string, string]>(defaultRange());
  const generation = useRef(0);
  const statusRequest = useRef(0);
  const inFlight = useRef<Promise<CalendarSyncResult | undefined> | null>(null);
  const queued = useRef(false);
  const lastStarted = useRef(0);
  const lastRevisionRun = useRef<string | undefined>(undefined);
  const changedRevision = useCallback((runId?: string) => {
    if (runId && lastRevisionRun.current === runId) return;
    lastRevisionRun.current = runId;
    setRevision((v) => v + 1);
  }, []);
  const setStatus = useCallback((next: GoogleCalendarStatus) => {
    if (identity(statusRef.current) !== identity(next)) {
      generation.current++;
      statusRequest.current++;
      inFlight.current = null;
      queued.current = false;
      setSyncing(false);
      setLoading(false);
      setError(null);
      setPendingCount(0);
      setChange(null);
      setRetryNeeded(false);
      retryAttempt.current = 0;
    }
    setCalendarConnection(next.connected ? next.connectionId : null);
    statusRef.current = next;
    updateStatus(next);
  }, []);
  const refreshStatus = useCallback(async () => {
    if (!user?.id) return;
    const current = generation.current,
      request = ++statusRequest.current;
    setLoading(true);
    try {
      const next = await calendarApi.getStatus();
      if (generation.current === current && statusRequest.current === request)
        setStatus(next);
    } catch {
      if (generation.current === current)
        setError("Gagal memuat status Google Calendar.");
    } finally {
      if (generation.current === current) setLoading(false);
    }
  }, [user?.id, setStatus]);
  const autoSync = useCallback(
    (from?: string, to?: string): Promise<CalendarSyncResult | undefined> => {
      if (from && to) {
        if (rangeRef.current[0] !== from || rangeRef.current[1] !== to)
          queued.current = true;
        rangeRef.current = [from, to];
      }
      if (!user?.id || !statusRef.current.connected)
        return Promise.resolve(undefined);
      if (inFlight.current) return inFlight.current;
      const current = generation.current;
      const run = async () => {
        setSyncing(true);
        setRetryNeeded(false);
        try {
          let result: CalendarSyncResult;
          do {
            queued.current = false;
            lastStarted.current = Date.now();
            const range = rangeRef.current;
            result = await calendarApi.autoSync(range[0], range[1]);
            if (
              generation.current !== current ||
              !statusRef.current.connected ||
              (result.connectionId &&
                result.connectionId !== statusRef.current.connectionId)
            )
              return undefined;
            setPendingCount(result.pendingCount);
            setError(
              result.pendingCount > 0
                ? "Sebagian perubahan menunggu sinkronisasi."
                : null,
            );
            if (result.syncedAt)
              setStatus({ ...statusRef.current, syncedAt: result.syncedAt });
            if (
              result.importedCount ||
              result.updatedCount ||
              result.deletedCount ||
              result.pushedCount
            )
              changedRevision(result.syncRunId);
            if (!result.pendingCount) retryAttempt.current = 0;
          } while (queued.current);
          return result;
        } catch (err) {
          if (generation.current === current) {
            setError("Sinkronisasi tertunda. Akan dicoba kembali otomatis.");
            setRetryNeeded(true);
            const code = (err as { response?: { status?: number } }).response
              ?.status;
            if ([400, 401, 403, 409].includes(code || 0)) await refreshStatus();
          }
          return undefined;
        } finally {
          if (generation.current === current) {
            setSyncing(false);
            inFlight.current = null;
          }
        }
      };
      const promise = run();
      inFlight.current = promise;
      return promise;
    },
    [user?.id, refreshStatus, setStatus, changedRevision],
  );
  const setRange = useCallback(
    (from: string, to: string) => {
      if (rangeRef.current[0] !== from || rangeRef.current[1] !== to)
        queued.current = true;
      rangeRef.current = [from, to];
      void autoSync();
    },
    [autoSync],
  );
  useEffect(() => {
    generation.current++;
    statusRequest.current++;
    inFlight.current = null;
    queued.current = false;
    if (!user?.id) rangeRef.current = defaultRange();
    setStatus({ connected: false });
    setSyncing(false);
    setError(null);
    if (user?.id) void refreshStatus();
    return () => {
      generation.current++;
      setCalendarConnection(undefined);
    };
  }, [user?.id, refreshStatus, setStatus]);
  useEffect(() => {
    if (!user?.id || !status.connected) return;
    void autoSync();
    const resume = () => {
      if (document.visibilityState !== "visible") return;
      void autoSync();
    };
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [
    user?.id,
    status.connected,
    status.connectionId,
    status.email,
    autoSync,
    refreshStatus,
  ]);
  useEffect(() => {
    if (!status.connected || syncing || (!retryNeeded && pendingCount === 0))
      return;
    const timer = window.setTimeout(
      () => {
        void autoSync();
      },
      Math.min(60000, 5000 * 2 ** retryAttempt.current++),
    );
    return () => window.clearTimeout(timer);
  }, [
    status.connected,
    status.connectionId,
    syncing,
    retryNeeded,
    pendingCount,
    autoSync,
  ]);
  useEffect(() => {
    const changed = (payload?: CalendarChange) => {
      if (
        !payload ||
        (payload.connectionId !== undefined &&
          payload.connectionId !== statusRef.current.connectionId)
      )
        return;
      if (payload.pendingCount !== undefined) {
        setPendingCount(payload.pendingCount);
        setError(
          payload.pendingCount > 0
            ? "Sebagian perubahan menunggu sinkronisasi."
            : null,
        );
      }
      if (payload.syncedAt)
        setStatus({ ...statusRef.current, syncedAt: payload.syncedAt });
      if (payload.retry) setRetryNeeded(true);
      if (payload.activity || payload.action === "delete")
        setChange({ ...payload });
      else if (
        payload.action === "autoSync" ||
        payload.action === "import" ||
        payload.action === "update"
      )
        changedRevision(payload.syncRunId);
    };
    const mutation = (event: Event) =>
      changed((event as CustomEvent<CalendarChange>).detail);
    const connectionChanged = () => {
      void refreshStatus();
    };
    window.addEventListener("calendar:mutation", mutation);
    socket?.on("calendar:synced", changed);
    socket?.on("calendar:connection-changed", connectionChanged);
    return () => {
      window.removeEventListener("calendar:mutation", mutation);
      socket?.off("calendar:synced", changed);
      socket?.off("calendar:connection-changed", connectionChanged);
    };
  }, [socket, refreshStatus, setStatus, changedRevision]);
  return (
    <CalendarSyncContext.Provider
      value={{
        status,
        loading,
        syncing,
        error,
        pendingCount,
        revision,
        change,
        setStatus,
        setError,
        refreshStatus,
        autoSync,
        setRange,
      }}
    >
      {children}
    </CalendarSyncContext.Provider>
  );
}
export function useCalendarSync() {
  const context = useContext(CalendarSyncContext);
  if (!context)
    throw new Error(
      "useCalendarSync harus dipakai di dalam CalendarSyncProvider",
    );
  return context;
}
