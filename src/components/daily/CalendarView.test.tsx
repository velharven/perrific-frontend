import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CalendarView from "./CalendarView";
import type { DailyActivity, GoogleCalendarStatus } from "@/types";
import { calendarCardEnd, isCalendarCardPast } from "@/lib/calendarTiming";

const mocks = vi.hoisted(() => ({
  fetchEvents: vi.fn().mockResolvedValue([]),
  setRange: vi.fn(),
  status: { connected: false } as GoogleCalendarStatus,
  getLayout: vi.fn().mockResolvedValue([]),
  syncing: false,
  disconnecting: false,
  disconnect: vi.fn(),
  autoSync: vi.fn(),
}));
vi.mock("@/hooks/useGoogleCalendar", () => ({
  useGoogleCalendar: () => ({
    status: mocks.status,
    fetchEvents: mocks.fetchEvents,
    connect: vi.fn(),
    disconnect: mocks.disconnect,
    importEvents: vi.fn(),
    syncing: mocks.syncing,
    disconnecting: mocks.disconnecting,
    autoSync: mocks.autoSync,
  }),
}));
vi.mock("@/store/calendarSync", () => ({
  useCalendarSync: () => ({
    revision: 0,
    setRange: mocks.setRange,
    pendingCount: 0,
    error: null,
    autoSync: mocks.autoSync,
  }),
}));
vi.mock("@/store/socket", () => ({ useSocket: () => ({ socket: null }) }));
vi.mock("@/api/calendar", () => ({
  calendarApi: {
    getLayout: mocks.getLayout,
    saveLayout: vi.fn().mockResolvedValue({}),
  },
}));
vi.mock("@/components/ui/Toast", () => ({ showToast: vi.fn() }));
vi.mock("./CalendarSidebar", () => ({ default: () => null }));
vi.mock("./CalendarCardSettings", () => ({ default: () => null }));

const fixture = (overrides: Partial<DailyActivity> = {}): DailyActivity => ({
  id: "activity-1",
  userId: "user-1",
  title: "Future card",
  date: "2026-09-29T00:00:00Z",
  startTime: "2026-09-29T14:00:00+07:00",
  endTime: "2026-09-29T15:00:00+07:00",
  type: "CUSTOM",
  status: "PENDING",
  order: 0,
  checklistItems: [],
  ...overrides,
});
const props = {
  selectedDate: new Date("2026-09-29T00:00:00+07:00"),
  onSelectDate: vi.fn(),
  onMoveActivity: vi.fn(),
};

function transfer() {
  const values = new Map<string, string>();
  return {
    types: ["application/json"],
    setData: (key: string, value: string) => values.set(key, value),
    getData: (key: string) => values.get(key) || "",
    effectAllowed: "",
    dropEffect: "",
  };
}

function dragStart(
  element: HTMLElement,
  dataTransfer: ReturnType<typeof transfer>,
) {
  const event = createEvent.dragStart(element, { dataTransfer });
  Object.defineProperty(event, "clientY", { value: 0 });
  fireEvent(element, event);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-29T10:00:00+07:00"));
  props.onMoveActivity.mockReset();
  mocks.status = { connected: false };
  mocks.syncing = false;
  mocks.disconnecting = false;
  mocks.disconnect.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("clears Google cards immediately on account change and ignores an old range response", async () => {
  let finishA!: (events: unknown[]) => void;
  mocks.status = { connected: true, connectionId: "account-a" };
  mocks.fetchEvents.mockImplementationOnce(
    () =>
      new Promise((done) => {
        finishA = done;
      }),
  );
  const view = render(<CalendarView {...props} activities={[]} />);
  mocks.status = { connected: true, connectionId: "account-b" };
  mocks.fetchEvents.mockResolvedValue([
    {
      id: "b",
      title: "B card",
      start: "2026-09-29T14:00:00+07:00",
      end: "2026-09-29T15:00:00+07:00",
    },
  ]);
  await act(async () => {
    view.rerender(<CalendarView {...props} activities={[]} />);
  });
  await act(async () => {
    finishA([{ id: "a", title: "A card", start: "2026-09-29T14:00:00+07:00" }]);
  });
  expect(screen.queryByTitle("A card")).toBeNull();
  expect(screen.getByTitle("B card")).toBeTruthy();
  mocks.fetchEvents.mockResolvedValue([]);
});

it("allows disconnecting from the Google profile during sync and disables only while disconnecting", async () => {
  mocks.status = { connected: true };
  mocks.syncing = true;
  const view = render(<CalendarView {...props} activities={[]} />);
  const button = screen.getByRole("button", {
    name: "Putuskan",
  }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  await act(async () => {
    fireEvent.click(button);
  });
  expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  mocks.disconnecting = true;
  view.rerender(<CalendarView {...props} activities={[]} />);
  expect(
    (screen.getByRole("button", { name: "Memutuskan…" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Memutuskan…" }));
  });
  expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  mocks.status = { connected: false };
  mocks.disconnecting = false;
  view.rerender(<CalendarView {...props} activities={[]} />);
  expect(screen.queryByRole("button", { name: "Putuskan" })).toBeNull();
});

describe("calendar drag opacity", () => {
  it("keeps a synchronized all-day card visible and clears its drag opacity on cancel", () => {
    render(
      <CalendarView
        {...props}
        activities={[fixture({ startTime: null, endTime: null, allDay: true })]}
      />,
    );
    expect(screen.getByText("Sepanjang hari")).toBeTruthy();
    const card = screen.getByTitle("Future card");
    expect(card.className).toContain("opacity-100");
    dragStart(card, transfer());
    expect(card.className).toContain("opacity-40");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(card.className).toContain("opacity-100");
  });
  it("clears dragging on drop even when the source element was removed and never emits dragend", async () => {
    const initial = fixture();
    const view = render(<CalendarView {...props} activities={[initial]} />);
    const card = screen.getByTitle(initial.title);
    const dataTransfer = transfer();
    dragStart(card, dataTransfer);
    expect(card.className).toContain("opacity-40");
    view.rerender(<CalendarView {...props} activities={[]} />);
    await act(async () => {
      fireEvent.drop(document.body, { dataTransfer });
      await Promise.resolve();
    });
    view.rerender(
      <CalendarView
        {...props}
        activities={[
          fixture({
            date: "2026-09-30T00:00:00Z",
            startTime: "2026-09-30T14:00:00+07:00",
            endTime: "2026-09-30T15:00:00+07:00",
          }),
        ]}
      />,
    );
    expect(screen.getByTitle(initial.title).className).toContain("opacity-100");
    expect(screen.getByTitle(initial.title).className).not.toContain(
      "opacity-40",
    );
  });

  it.each(["Escape", "blur", "dragend"])(
    "clears dragging when cancelled through %s",
    async (event) => {
      render(<CalendarView {...props} activities={[fixture()]} />);
      const card = screen.getByTitle("Future card");
      dragStart(card, transfer());
      if (event === "Escape") fireEvent.keyDown(document, { key: "Escape" });
      else if (event === "blur") fireEvent.blur(window);
      else fireEvent.dragEnd(document);
      expect(card.className).toContain("opacity-100");
    },
  );

  it("clears dragging immediately while saving the moved card is still pending", async () => {
    props.onMoveActivity.mockReturnValue(new Promise(() => {}));
    render(<CalendarView {...props} activities={[fixture()]} />);
    const card = screen.getByTitle("Future card");
    const dataTransfer = transfer();
    dragStart(card, dataTransfer);
    const drop = createEvent.drop(card.parentElement!, { dataTransfer });
    Object.defineProperty(drop, "clientY", { value: 960 });
    await act(async () => {
      fireEvent(card.parentElement!, drop);
      await Promise.resolve();
    });
    expect(props.onMoveActivity).toHaveBeenCalledTimes(1);
    expect(card.className).toContain("opacity-100");
  });

  it("keeps a currently running card solid until its end passes the red line", async () => {
    render(
      <CalendarView
        {...props}
        activities={[
          fixture({
            startTime: "2026-09-29T09:00:00+07:00",
            endTime: "2026-09-29T11:00:00+07:00",
          }),
        ]}
      />,
    );
    expect(screen.getByTitle("Future card").className).toContain("opacity-100");
    await act(async () => {
      vi.advanceTimersByTime(60 * 60 * 1000);
    });
    expect(screen.getByTitle("Future card").className).toContain("opacity-60");
  });
});

describe("calendar completion time", () => {
  it("compares full dates across midnight and only fades at the actual end", () => {
    const end = calendarCardEnd(
      "2026-09-29T23:30:00+07:00",
      "2026-09-30T00:30:00+07:00",
    );
    expect(isCalendarCardPast(end, new Date("2026-09-29T23:59:00+07:00"))).toBe(
      false,
    );
    expect(isCalendarCardPast(end, new Date("2026-09-30T00:29:59+07:00"))).toBe(
      false,
    );
    expect(isCalendarCardPast(end, new Date("2026-09-30T00:30:00+07:00"))).toBe(
      true,
    );
  });
  it("uses the same one-hour fallback as Google and ignores invalid times", () => {
    expect(calendarCardEnd("2026-09-29T14:00:00+07:00", null)).toBe(
      "2026-09-29T08:00:00.000Z",
    );
    expect(isCalendarCardPast(null, new Date())).toBe(false);
    expect(calendarCardEnd("invalid", null)).toBeNull();
  });
});

describe("recurring event movement", () => {
  it("preserves series anchor date so earlier days do not disappear when moving to a later time or day", async () => {
    const dailyAct = fixture({
      id: "daily-standup",
      title: "Daily Standup",
      date: "2026-09-28T00:00:00Z", // Monday anchor
      startTime: "2026-09-28T09:00:00+07:00",
      endTime: "2026-09-28T10:00:00+07:00",
      recurrence: {
        freq: "DAILY",
        interval: 1,
      },
    });

    render(
      <CalendarView
        {...props}
        selectedDate={new Date("2026-09-29T00:00:00+07:00")}
        activities={[dailyAct]}
      />,
    );

    const cards = screen.getAllByTitle("Daily Standup");
    expect(cards.length).toBeGreaterThanOrEqual(1);

    const card = cards[0];
    const dataTransfer = transfer();
    dragStart(card, dataTransfer);

    // Drop on the timeline column at 16:00 (clientY: 960)
    const targetColumn = card.parentElement!;
    const drop = createEvent.drop(targetColumn, { dataTransfer });
    Object.defineProperty(drop, "clientY", { value: 960 }); // 16:00
    await act(async () => {
      fireEvent(targetColumn, drop);
      await Promise.resolve();
    });

    expect(props.onMoveActivity).toHaveBeenCalledTimes(1);
    const [movedId, updateData] = props.onMoveActivity.mock.calls[0];
    expect(movedId).toBe("daily-standup");
    // Anchor date MUST NOT be pushed to future because that would wipe Monday & Tuesday
    const anchorDate = new Date(updateData.date);
    expect(anchorDate.getDate()).toBe(28);
    expect(updateData.recurrence).toEqual({
      freq: "DAILY",
      interval: 1,
    });
  });

  it("shifts weekly byDays when moving across days while preserving series anchor", async () => {
    const weeklyAct = fixture({
      id: "weekly-sync",
      title: "Weekly Sync",
      date: "2026-09-28T00:00:00Z", // Monday anchor
      startTime: "2026-09-28T10:00:00+07:00",
      endTime: "2026-09-28T11:00:00+07:00",
      recurrence: {
        freq: "WEEKLY",
        interval: 1,
        byDays: [1], // Monday
      },
    });

    render(
      <CalendarView
        {...props}
        selectedDate={new Date("2026-09-29T00:00:00+07:00")}
        activities={[weeklyAct]}
      />,
    );

    const card = screen.getByTitle("Weekly Sync");
    const dataTransfer = transfer();
    dragStart(card, dataTransfer);

    // Timeline columns in week grid: children[0]=Gutter, children[1]=Sun, children[2]=Mon, children[3]=Tue, children[4]=Wed
    const targetColumn = (card.parentElement!.parentElement!.children[4] || card.parentElement!) as HTMLElement;
    const drop = createEvent.drop(targetColumn, { dataTransfer });
    Object.defineProperty(drop, "clientY", { value: 660 });
    await act(async () => {
      fireEvent(targetColumn, drop);
      await Promise.resolve();
    });

    expect(props.onMoveActivity).toHaveBeenCalledTimes(1);
    const [movedId, updateData] = props.onMoveActivity.mock.calls[0];
    expect(movedId).toBe("weekly-sync");
    // Anchor date preserved
    const anchorDate = new Date(updateData.date);
    expect(anchorDate.getDate()).toBe(28);
    // Target day code (3 for Wednesday) added/shifted in byDays
    expect(updateData.recurrence.byDays).toContain(3);
  });
});

describe("Notion-style lifecycle sync", () => {
  it("triggers silent refresh on window focus, visibilitychange, and online", async () => {
    const onRefresh = vi.fn();
    render(
      <CalendarView
        {...props}
        activities={[]}
        onRefreshActivities={onRefresh}
      />,
    );

    // Focus triggers refresh
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);

    // Visibility change to visible triggers refresh
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);

    // Visibility change to hidden does NOT trigger refresh
    Object.defineProperty(document, "visibilityState", {
      value: "hidden",
      configurable: true,
    });
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(onRefresh).toHaveBeenCalledTimes(2);

    // Online event triggers refresh when visible
    Object.defineProperty(document, "visibilityState", {
      value: "visible",
      configurable: true,
    });
    await act(async () => {
      window.dispatchEvent(new Event("online"));
    });
    expect(onRefresh).toHaveBeenCalledTimes(3);
  });

  it("does not trigger refresh while user is dragging a card", async () => {
    const onRefresh = vi.fn();
    render(
      <CalendarView
        {...props}
        activities={[fixture()]}
        onRefreshActivities={onRefresh}
      />,
    );

    const card = screen.getByTitle("Future card");
    dragStart(card, transfer());

    // Window focus during active drag should be ignored
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(onRefresh).not.toHaveBeenCalled();

    // After drag cancelled, focus triggers refresh normally
    fireEvent.keyDown(document, { key: "Escape" });
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });
});
