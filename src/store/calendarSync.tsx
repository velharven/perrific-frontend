import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { calendarApi, type CalendarSyncOptions, type CalendarSyncResult } from "@/api/calendar";
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
    options?: CalendarSyncOptions,
  ) => Promise<CalendarSyncResult | undefined>;
  setRange: (from: string, to: string) => void;
}
const CalendarSyncContext = createContext<CalendarSyncContextValue | null>(
  null,
);
const identity = (s: GoogleCalendarStatus) =>
  s.connected ? s.connectionId || s.email || "legacy" : null;
const canSync = () => document.visibilityState === "visible" && navigator.onLine;
interface SyncRequest {
  from: string;
  to: string;
  hydrateRange: boolean;
}
const sameRange = (a: SyncRequest, b: SyncRequest) => a.from === b.from && a.to === b.to;

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
  // A fast failed retry can leave both syncing and retryNeeded unchanged after
  // React batches updates. Give every unsuccessful attempt a new timer trigger.
  const [retryRevision, setRetryRevision] = useState(0);
  const [available, setAvailable] = useState(canSync);
  const retryAttempt = useRef(0);
  const statusRef = useRef(status);
  const rangeRef = useRef<readonly [string, string]>(defaultRange());
  const generation = useRef(0);
  const statusRequest = useRef(0);
  const inFlight = useRef<Promise<CalendarSyncResult | undefined> | null>(null);
  const queued = useRef<SyncRequest[]>([]);
  const activeRequest = useRef<SyncRequest | null>(null);
  const refreshAfterFailure = useRef(false);
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
      queued.current = [];
      activeRequest.current = null;
      refreshAfterFailure.current = false;
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
    (from?: string, to?: string, options: CalendarSyncOptions = {}): Promise<CalendarSyncResult | undefined> => {
      if (from && to) {
        rangeRef.current = [from, to];
      }
      if (!user?.id || !statusRef.current.connected)
        return Promise.resolve(undefined);
      const request: SyncRequest = {
        from: rangeRef.current[0],
        to: rangeRef.current[1],
        hydrateRange: options.hydrateRange ?? false,
      };
      const active = activeRequest.current;
      if (!active || !sameRange(active, request) || (request.hydrateRange && !active.hydrateRange)) {
        const pending = queued.current.find(item => sameRange(item, request));
        if (pending) pending.hydrateRange ||= request.hydrateRange;
        else queued.current.push(request);
      }
      if (inFlight.current) return inFlight.current;
      // Keep requested ranges until the app can resume, including failed hydration.
      if (!canSync()) return Promise.resolve(undefined);
      const current = generation.current;
      const run = async () => {
        if (generation.current !== current) return undefined;
        setSyncing(true);
        setRetryNeeded(false);
        try {
          let result: CalendarSyncResult | undefined;
          while (queued.current.length && canSync()) {
            const next = queued.current.shift()!;
            activeRequest.current = next;
            result = await calendarApi.autoSync(next.from, next.to, { hydrateRange: next.hydrateRange });
            if (
              generation.current !== current ||
              !statusRef.current.connected ||
              (result.connectionId &&
                result.connectionId !== statusRef.current.connectionId)
            )
              return undefined;
            setPendingCount(result.pendingCount);
            if (result.pendingCount > 0) setRetryRevision(v => v + 1);
            setError(
              result.pendingCount > 0
                ? "Sebagian perubahan menunggu sinkronisasi."
                : null,
            );
            if (result.syncedAt)
              setStatus({ ...statusRef.current, syncedAt: result.syncedAt });
            if (
              next.hydrateRange ||
              refreshAfterFailure.current ||
              result.importedCount ||
              result.updatedCount ||
              result.deletedCount ||
              result.pushedCount
            )
              changedRevision(result.syncRunId);
            refreshAfterFailure.current = false;
            if (!result.pendingCount) retryAttempt.current = 0;
            activeRequest.current = null;
          }
          return result;
        } catch (err) {
          if (generation.current === current) {
            refreshAfterFailure.current = true;
            if (activeRequest.current) queued.current.unshift(activeRequest.current);
            setError("Sinkronisasi tertunda. Akan dicoba kembali otomatis.");
            setRetryNeeded(true);
            setRetryRevision(v => v + 1);
            const code = (err as { response?: { status?: number } }).response
              ?.status;
            if ([400, 401, 403, 409].includes(code || 0)) await refreshStatus();
          }
          return undefined;
        } finally {
          if (generation.current === current) {
            setSyncing(false);
            inFlight.current = null;
            activeRequest.current = null;
          }
        }
      };
      const promise = Promise.resolve().then(run);
      inFlight.current = promise;
      return promise;
    },
    [user?.id, refreshStatus, setStatus, changedRevision],
  );
  const setRange = useCallback(
    (from: string, to: string) => {
      rangeRef.current = [from, to];
      void autoSync(from, to, { hydrateRange: true });
    },
    [autoSync],
  );
  useEffect(() => {
    generation.current++;
    statusRequest.current++;
    inFlight.current = null;
    queued.current = [];
    activeRequest.current = null;
    refreshAfterFailure.current = false;
    retryAttempt.current = 0;
    setRetryNeeded(false);
    setPendingCount(0);
    setChange(null);
    setStatus({ connected: false });
    if (!user?.id) {
      rangeRef.current = defaultRange();
    } else {
      setSyncing(false);
      setError(null);
      void refreshStatus();
    }
    return () => {
      generation.current++;
      setCalendarConnection(undefined);
    };
  }, [user?.id, refreshStatus, setStatus]);
  useEffect(() => {
    if (!user?.id || !status.connected) return;
    setAvailable(canSync());
    void autoSync(undefined, undefined, { hydrateRange: true });
    const resume = () => {
      setAvailable(canSync());
      if (canSync()) void autoSync();
    };
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", resume);
      window.removeEventListener("offline", resume);
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
    if (!user?.id || !status.connected || !available || syncing || retryNeeded || pendingCount > 0)
      return;
    const timer = window.setInterval(() => { void autoSync(); }, 30000);
    return () => window.clearInterval(timer);
  }, [user?.id, status.connected, status.connectionId, available, syncing, retryNeeded, pendingCount, autoSync]);
  useEffect(() => {
    if (!user?.id || !status.connected || !available || syncing || (!retryNeeded && pendingCount === 0))
      return;
    const timer = window.setTimeout(
      () => {
        void autoSync();
      },
      Math.min(60000, 5000 * 2 ** retryAttempt.current++),
    );
    return () => window.clearTimeout(timer);
  }, [
    user?.id,
    available,
    status.connected,
    status.connectionId,
    syncing,
    retryNeeded,
    retryRevision,
    pendingCount,
    autoSync,
  ]);
  useEffect(() => {
    const changed = (payload?: CalendarChange) => {
      if (
        !user?.id ||
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
  }, [user?.id, socket, refreshStatus, setStatus, changedRevision, autoSync]);
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
