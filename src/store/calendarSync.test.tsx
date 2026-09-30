import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CalendarSyncProvider, useCalendarSync } from "./calendarSync";
import { useEffect } from "react";

const mocks = vi.hoisted(() => ({
  user: { id: "user-1" } as { id: string } | null,
  getStatus: vi.fn(),
  autoSync: vi.fn(),
}));
vi.mock("./auth", () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock("./socket", () => ({ useSocket: () => ({ socket: null }) }));
vi.mock("@/api/calendar", () => ({
  calendarApi: { getStatus: mocks.getStatus, autoSync: mocks.autoSync },
}));

const result = {
  pushedCount: 0,
  importedCount: 0,
  updatedCount: 0,
  deletedCount: 0,
  pendingCount: 0,
  syncedAt: "2026-09-29T03:00:00Z",
};
function Probe({ page = "Daily" }: { page?: string }) {
  const sync = useCalendarSync();
  return (
    <div>
      {page}
      <span data-testid="status">
        {sync.status.connected ? "connected" : "disconnected"}
      </span>
      <span data-testid="error">{sync.error}</span>
      <span data-testid="account">{sync.status.connectionId}</span>
      <span data-testid="revision">{sync.revision}</span>
      <span data-testid="synced">{sync.status.syncedAt}</span>
      <button
        onClick={() =>
          sync.setStatus({ connected: true, connectionId: "account-b" })
        }
      >
        switch
      </button>
      <button onClick={() => void sync.autoSync()}>trigger</button>
      <button onClick={() => void sync.autoSync(undefined, undefined, { hydrateRange: true })}>hydrate</button>
      <button onClick={() => sync.setStatus({ connected: false })}>disconnect</button>
    </div>
  );
}
function RangeProbe({ from, to }: { from: string; to: string }) {
  const { setRange } = useCalendarSync();
  useEffect(() => {
    setRange(from, to);
  }, [from, to, setRange]);
  return <Probe />;
}
beforeEach(() => {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue("visible");
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
  mocks.user = { id: "user-1" };
  mocks.getStatus.mockReset().mockResolvedValue({ connected: true });
  mocks.autoSync.mockReset().mockResolvedValue(result);
});

it("switches Google identity while connected and discards late sync and socket data from A", async () => {
  mocks.getStatus.mockResolvedValue({
    connected: true,
    connectionId: "account-a",
  });
  let finishA!: (value: typeof result) => void;
  mocks.autoSync.mockImplementationOnce(
    () =>
      new Promise((done) => {
        finishA = done;
      }),
  );
  render(
    <CalendarSyncProvider>
      <Probe />
    </CalendarSyncProvider>,
  );
  await waitFor(() => expect(mocks.autoSync).toHaveBeenCalledTimes(1));
  await act(async () => {
    screen.getByText("switch").click();
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  await act(async () => {
    finishA({ ...result, pendingCount: 99 });
    window.dispatchEvent(
      new CustomEvent("calendar:mutation", {
        detail: { connectionId: "account-a", pendingCount: 99, retry: true },
      }),
    );
  });
  expect(screen.getByTestId("account").textContent).toBe("account-b");
  expect(screen.getByTestId("error").textContent).toBe("");
});

it("retries failures with backoff and resumes polling after success", async () => {
  vi.useFakeTimers();
  mocks.autoSync.mockRejectedValueOnce(new Error("offline"));
  render(
    <CalendarSyncProvider>
      <Probe />
    </CalendarSyncProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
  await act(async () => {
    vi.advanceTimersByTime(4999);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
  await act(async () => {
    vi.advanceTimersByTime(1);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("polls every 30 seconds across pages, syncs on focus and stops after logout", async () => {
  vi.useFakeTimers();
  const view = render(
    <CalendarSyncProvider>
      <Probe />
    </CalendarSyncProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
  view.rerender(
    <CalendarSyncProvider>
      <Probe page="Project" />
    </CalendarSyncProvider>,
  );
  await act(async () => {
    vi.advanceTimersByTime(30000);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
  mocks.user = null;
  view.rerender(
    <CalendarSyncProvider>
      <Probe page="Login" />
    </CalendarSyncProvider>,
  );
  await act(async () => {
    vi.advanceTimersByTime(60000);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
  expect(screen.getByTestId("status").textContent).toBe("disconnected");
});

it("coalesces overlapping triggers and ignores a response from the logged-out user", async () => {
  let resolve!: (value: typeof result) => void;
  mocks.autoSync.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const view = render(
    <CalendarSyncProvider>
      <Probe />
    </CalendarSyncProvider>,
  );
  await waitFor(() => expect(mocks.autoSync).toHaveBeenCalledTimes(1));
  await act(async () => {
    screen.getByText("trigger").click();
    screen.getByText("trigger").click();
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
  mocks.user = null;
  view.rerender(
    <CalendarSyncProvider>
      <Probe />
    </CalendarSyncProvider>,
  );
  await act(async () => {
    resolve(result);
  });
  expect(screen.getByTestId("status").textContent).toBe("disconnected");
});

it("keeps retrying after a temporary failure without disconnecting the account", async () => {
  mocks.autoSync.mockRejectedValueOnce(new Error("offline"));
  render(
    <CalendarSyncProvider>
      <Probe />
    </CalendarSyncProvider>,
  );
  await waitFor(() =>
    expect(screen.getByTestId("error").textContent).toContain("tertunda"),
  );
  expect(screen.getByTestId("status").textContent).toBe("connected");
  await act(async () => {
    screen.getByText("trigger").click();
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId("error").textContent).toBe("");
});

it("retains the mounted calendar range and syncs the latest range after an in-flight request", async () => {
  let resolve!: (value: typeof result) => void;
  mocks.autoSync.mockImplementationOnce(
    () =>
      new Promise((done) => {
        resolve = done;
      }),
  );
  const from = "2026-10-01T00:00:00Z";
  const to = "2026-11-01T00:00:00Z";
  const view = render(
    <CalendarSyncProvider>
      <RangeProbe from={from} to={to} />
    </CalendarSyncProvider>,
  );
  await waitFor(() => expect(mocks.autoSync).toHaveBeenCalledWith(from, to, { hydrateRange: true }));
  view.rerender(
    <CalendarSyncProvider>
      <RangeProbe from="2026-11-01T00:00:00Z" to="2026-12-01T00:00:00Z" />
    </CalendarSyncProvider>,
  );
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(result);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  expect(mocks.autoSync).toHaveBeenLastCalledWith(
    "2026-11-01T00:00:00Z",
    "2026-12-01T00:00:00Z",
    { hydrateRange: true },
  );
});

it("queues every distinct visible range while a sync is in flight", async () => {
  let finish!: (value: typeof result) => void;
  mocks.autoSync.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  const view = render(<CalendarSyncProvider><RangeProbe from="2026-10-01" to="2026-11-01" /></CalendarSyncProvider>);
  await waitFor(() => expect(mocks.autoSync).toHaveBeenCalledTimes(1));
  view.rerender(<CalendarSyncProvider><RangeProbe from="2026-11-01" to="2026-12-01" /></CalendarSyncProvider>);
  view.rerender(<CalendarSyncProvider><RangeProbe from="2026-12-01" to="2027-01-01" /></CalendarSyncProvider>);
  await act(async () => { finish(result); });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
  expect(mocks.autoSync).toHaveBeenNthCalledWith(2, "2026-11-01", "2026-12-01", { hydrateRange: true });
  expect(mocks.autoSync).toHaveBeenNthCalledWith(3, "2026-12-01", "2027-01-01", { hydrateRange: true });
});

it("pauses polling in hidden and offline tabs and resumes immediately", async () => {
  vi.useFakeTimers();
  render(<CalendarSyncProvider><Probe /></CalendarSyncProvider>);
  await act(async () => {});
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
  const visibility = vi.spyOn(document, "visibilityState", "get");
  const online = vi.spyOn(navigator, "onLine", "get");
  await act(async () => {
    visibility.mockReturnValue("hidden");
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(90000);
    window.dispatchEvent(new Event("focus"));
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
  await act(async () => {
    visibility.mockReturnValue("visible");
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  expect(mocks.autoSync.mock.lastCall?.[2]).toEqual({ hydrateRange: false });
  await act(async () => {
    online.mockReturnValue(false);
    window.dispatchEvent(new Event("offline"));
    vi.advanceTimersByTime(90000);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  await act(async () => {
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
  await act(async () => { screen.getByText("disconnect").click(); });
  await act(async () => {
    vi.advanceTimersByTime(90000);
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
});

it("defers initial range hydration until the connected app is online", async () => {
  vi.useFakeTimers();
  const online = vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
  render(<CalendarSyncProvider><RangeProbe from="2026-11-01" to="2026-12-01" /></CalendarSyncProvider>);
  await act(async () => { vi.advanceTimersByTime(60000); });
  expect(mocks.autoSync).not.toHaveBeenCalled();
  await act(async () => {
    online.mockReturnValue(true);
    window.dispatchEvent(new Event("online"));
  });
  expect(mocks.autoSync).toHaveBeenCalledExactlyOnceWith("2026-11-01", "2026-12-01", { hydrateRange: true });
});

it("retries a failed hydration before importing the next queued month", async () => {
  vi.useFakeTimers();
  let fail!: (reason: Error) => void;
  mocks.autoSync.mockImplementationOnce(() => new Promise((_, reject) => { fail = reject; }));
  const view = render(<CalendarSyncProvider><RangeProbe from="2026-10-01" to="2026-11-01" /></CalendarSyncProvider>);
  await act(async () => {});
  view.rerender(<CalendarSyncProvider><RangeProbe from="2026-11-01" to="2026-12-01" /></CalendarSyncProvider>);
  await act(async () => { fail(new Error("offline")); });
  expect(screen.getByTestId("error").textContent).toContain("tertunda");
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
  expect(mocks.autoSync).toHaveBeenNthCalledWith(2, "2026-10-01", "2026-11-01", { hydrateRange: true });
  expect(mocks.autoSync).toHaveBeenNthCalledWith(3, "2026-11-01", "2026-12-01", { hydrateRange: true });
  expect(screen.getByTestId("error").textContent).toBe("");
  expect(screen.getByTestId("revision").textContent).toBe("2");
});

it("uses capped exponential retry delays without polling over failed requests", async () => {
  vi.useFakeTimers();
  mocks.autoSync.mockRejectedValue(new Error("offline"));
  render(<CalendarSyncProvider><Probe /></CalendarSyncProvider>);
  await act(async () => {});
  let calls = 1;
  for (const delay of [5000, 10000, 20000, 40000, 60000, 60000]) {
    await act(async () => { vi.advanceTimersByTime(delay - 1); });
    expect(mocks.autoSync).toHaveBeenCalledTimes(calls);
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(mocks.autoSync).toHaveBeenCalledTimes(++calls);
  }
});

it("refreshes subscribers when polling imports an event and updates the sync timestamp", async () => {
  vi.useFakeTimers();
  render(<CalendarSyncProvider><Probe /></CalendarSyncProvider>);
  await act(async () => {});
  const initialRevision = Number(screen.getByTestId("revision").textContent);
  mocks.autoSync.mockResolvedValueOnce({ ...result, importedCount: 1, syncedAt: "2026-09-29T03:00:30Z" });
  await act(async () => { vi.advanceTimersByTime(30000); });
  expect(Number(screen.getByTestId("revision").textContent)).toBe(initialRevision + 1);
  expect(screen.getByTestId("synced").textContent).toBe("2026-09-29T03:00:30Z");
});

it("queues a hydration requested during an incremental sync of the same range", async () => {
  render(<CalendarSyncProvider><Probe /></CalendarSyncProvider>);
  await act(async () => {});
  let finish!: (value: typeof result) => void;
  mocks.autoSync.mockImplementationOnce(() => new Promise(done => { finish = done; }));
  await act(async () => { screen.getByText("trigger").click(); });
  await act(async () => {
    screen.getByText("hydrate").click();
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  await act(async () => { finish(result); });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
  expect(mocks.autoSync.mock.calls[1][2]).toEqual({ hydrateRange: false });
  expect(mocks.autoSync.mock.calls[2][2]).toEqual({ hydrateRange: true });
});

it("keeps backing off when successful requests report the same pending changes", async () => {
  vi.useFakeTimers();
  mocks.autoSync.mockResolvedValue({ ...result, pendingCount: 1 });
  render(<CalendarSyncProvider><Probe /></CalendarSyncProvider>);
  await act(async () => {});
  await act(async () => { vi.advanceTimersByTime(5000); });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  await act(async () => { vi.advanceTimersByTime(9999); });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(mocks.autoSync).toHaveBeenCalledTimes(3);
});
