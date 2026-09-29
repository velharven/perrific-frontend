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
      <button
        onClick={() =>
          sync.setStatus({ connected: true, connectionId: "account-b" })
        }
      >
        switch
      </button>
      <button onClick={() => void sync.autoSync()}>trigger</button>
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

it("retries an offline failure with backoff instead of an interval", async () => {
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
    vi.advanceTimersByTime(120000);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("syncs on focus without polling and stops after logout", async () => {
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
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
  await act(async () => {
    window.dispatchEvent(new Event("focus"));
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
  mocks.user = null;
  view.rerender(
    <CalendarSyncProvider>
      <Probe page="Login" />
    </CalendarSyncProvider>,
  );
  await act(async () => {
    vi.advanceTimersByTime(60000);
  });
  expect(mocks.autoSync).toHaveBeenCalledTimes(2);
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
  await waitFor(() => expect(mocks.autoSync).toHaveBeenCalledWith(from, to));
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
  );
});
