import {
  act,
  cleanup,
  createEvent,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useState, type ComponentProps } from "react";
import CalendarView from "./CalendarView";
import type { DailyActivity, GoogleCalendarStatus } from "@/types";
import { calendarCardEnd, isCalendarCardPast } from "@/lib/calendarTiming";
import type { CalendarChange } from '@/store/calendarSync';

const mocks = vi.hoisted(() => ({
  fetchEvents: vi.fn().mockResolvedValue([]),
  setRange: vi.fn(),
  status: { connected: false } as GoogleCalendarStatus,
  getLayout: vi.fn().mockResolvedValue([]),
  syncing: false,
  disconnecting: false,
  disconnect: vi.fn(),
  autoSync: vi.fn(),
  revision: 0,
  change: null as CalendarChange | null,
  updateActivity: vi.fn().mockResolvedValue({}),
  createActivity: vi.fn().mockResolvedValue({ id: "created-act-1" }),
  removeActivity: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/api/activities", () => ({
  activityApi: {
    update: (...args: unknown[]) => mocks.updateActivity(...args),
    create: (...args: unknown[]) => mocks.createActivity(...args),
    remove: (...args: unknown[]) => mocks.removeActivity(...args),
  },
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
    revision: mocks.revision,
    change: mocks.change,
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
  mocks.fetchEvents.mockReset().mockResolvedValue([]);
  mocks.autoSync.mockReset();
  mocks.revision = 0;
  mocks.change = null;
  mocks.setRange.mockReset();
  mocks.updateActivity.mockReset().mockResolvedValue({});
  mocks.createActivity.mockReset().mockResolvedValue({ id: "created-act-1" });
  mocks.removeActivity.mockReset().mockResolvedValue({});
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("replaces a Google card with its imported Daily activity without reloading", async () => {
  mocks.status = { connected: true };
  mocks.fetchEvents.mockResolvedValue([{ id: "google-event", title: "Google card", start: "2026-09-29T14:00:00+07:00" }]);
  const view = render(<CalendarView {...props} activities={[]} />);
  await act(async () => {});
  expect(screen.getByTitle("Google card")).toBeTruthy();
  view.rerender(<CalendarView {...props} activities={[fixture({ googleEventId: "google-event" })]} />);
  expect(screen.queryByTitle("Google card")).toBeNull();
  expect(screen.getByTitle("Future card")).toBeTruthy();
});

it("keeps a Google card visible until its linked activity exists on that date", async () => {
  mocks.status = { connected: true };
  mocks.fetchEvents.mockResolvedValue([{ id: "google-event", title: "Google moved card", start: "2026-09-29T14:00:00+07:00" }]);
  render(<CalendarView {...props} activities={[fixture({ googleEventId: "google-event", date: "2026-09-30T00:00:00Z" })]} />);
  await act(async () => {});
  expect(screen.getByTitle("Google moved card")).toBeTruthy();
});

it("deduplicates recurring Google instances using their explicit series relationship even on excluded dates", async () => {
  mocks.status = { connected: true };
  mocks.fetchEvents.mockResolvedValue([
    { id: "series-master_20260928", recurringEventId: "series-master", title: "Google instance", start: "2026-09-28T14:00:00+07:00" },
    { id: "series-master_20260929", recurringEventId: "series-master", title: "Google instance", start: "2026-09-29T14:00:00+07:00" },
  ]);
  render(
    <CalendarView
      {...props}
      activities={[
        fixture({
          date: "2026-09-28T00:00:00Z",
          startTime: "2026-09-28T14:00:00+07:00",
          endTime: "2026-09-28T15:00:00+07:00",
          googleEventId: "series-master",
          recurrence: {
            freq: "DAILY",
            interval: 1,
            excludeDates: ["2026-09-29"],
            endType: "NEVER",
          },
        }),
      ]}
    />,
  );
  await act(async () => {});
  expect(screen.queryByTitle("Google instance")).toBeNull();
  expect(screen.getAllByTitle("Future card").length).toBeGreaterThan(0);
});

describe("linked activity movement", () => {
  type MovePosition = Parameters<ComponentProps<typeof CalendarView>["onMoveActivity"]>[1];

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: Error) => void;
    const promise = new Promise<T>((done, fail) => {
      resolve = done;
      reject = fail;
    });
    return { promise, resolve, reject };
  }

  const initial = fixture({ googleEventId: "google-event" });
  const originalGoogle = {
    id: "google-event",
    title: initial.title,
    start: initial.startTime!,
    end: initial.endTime!,
  };

  function renderOptimisticCalendar() {
    mocks.status = { connected: true, connectionId: "account-a" };
    mocks.fetchEvents.mockResolvedValue([originalGoogle]);
    mocks.updateActivity.mockImplementation(async (_id, position) => ({ ...initial, ...position }));
    let replaceActivities!: (activities: DailyActivity[]) => void;

    function CalendarParent() {
      const [activities, setActivities] = useState([initial]);
      replaceActivities = setActivities;
      const move = async (id: string, position: MovePosition) => {
        props.onMoveActivity(id, position);
        const original = activities.find(activity => activity.id === id)!;
        setActivities(previous => previous.map(activity => activity.id === id ? { ...activity, ...position } : activity));
        try {
          const saved = await mocks.updateActivity(id, position);
          setActivities(previous => previous.map(activity => activity.id === id ? saved : activity));
          return saved;
        } catch (error) {
          setActivities(previous => previous.map(activity => activity.id === id ? original : activity));
          throw error;
        }
      };
      return <CalendarView {...props} activities={activities} onMoveActivity={move} />;
    }

    const view = render(<CalendarParent />);
    return {
      refresh: async () => {
        await act(async () => {
          mocks.revision++;
          view.rerender(<CalendarParent />);
        });
      },
      replaceActivities: async (activities: DailyActivity[]) => {
        await act(async () => { replaceActivities(activities); });
      },
    };
  }

  async function dropOnNextDate() {
    await act(async () => {});
    const card = screen.getByTitle(initial.title);
    const sourceColumn = card.parentElement!;
    const targetColumn = sourceColumn.nextElementSibling!;
    const dataTransfer = transfer();
    dragStart(card, dataTransfer);
    const drop = createEvent.drop(targetColumn, { dataTransfer });
    Object.defineProperty(drop, "clientY", { value: 960 });
    await act(async () => { fireEvent(targetColumn, drop); });
    return { sourceColumn, targetColumn };
  }

  function expectSingleCardIn(column: Element) {
    const cards = screen.getAllByTitle(initial.title);
    expect(cards).toHaveLength(1);
    expect(cards[0].parentElement).toBe(column);
    expect(cards[0].className).not.toContain("opacity-40");
  }

  function movedActivity() {
    return fixture({ ...props.onMoveActivity.mock.calls[0][1], googleEventId: "google-event" });
  }

  it("keeps one card across dates while saving and receiving stale Google responses, then releases it after Google catches up", async () => {
    const view = renderOptimisticCalendar();
    const save = deferred<DailyActivity>();
    mocks.updateActivity.mockReturnValueOnce(save.promise);
    const { targetColumn } = await dropOnNextDate();
    expect(props.onMoveActivity).toHaveBeenCalledTimes(1);
    expectSingleCardIn(targetColumn);

    await view.refresh();
    expectSingleCardIn(targetColumn);
    const moved = movedActivity();
    await act(async () => { save.resolve(moved); });
    await view.refresh();
    expectSingleCardIn(targetColumn);

    mocks.fetchEvents.mockResolvedValue([{ ...originalGoogle, start: moved.startTime!, end: moved.endTime! }]);
    await view.refresh();
    expectSingleCardIn(targetColumn);

    // A subsequent external Google move must remain visible until its activity catches up.
    mocks.fetchEvents.mockResolvedValue([{ ...originalGoogle, title: "External Google move" }]);
    await view.refresh();
    expect(screen.getByTitle("External Google move")).toBeTruthy();
  });

  it("recognizes Google confirmation received before the save response", async () => {
    const view = renderOptimisticCalendar();
    const save = deferred<DailyActivity>();
    mocks.updateActivity.mockReturnValueOnce(save.promise);
    const { targetColumn } = await dropOnNextDate();
    expectSingleCardIn(targetColumn);
    const moved = movedActivity();
    mocks.fetchEvents.mockResolvedValue([{ ...originalGoogle, start: moved.startTime!, end: moved.endTime! }]);
    await view.refresh();
    await act(async () => { save.resolve(moved); });
    expectSingleCardIn(targetColumn);
    mocks.fetchEvents.mockResolvedValue([{ ...originalGoogle, title: "External Google move" }]);
    await view.refresh();
    expect(screen.getByTitle("External Google move")).toBeTruthy();
  });

  it("restores one card at the original date when saving fails and removes the movement protection", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const view = renderOptimisticCalendar();
      const save = deferred<DailyActivity>();
      mocks.updateActivity.mockReturnValueOnce(save.promise);
      const { sourceColumn, targetColumn } = await dropOnNextDate();
      expectSingleCardIn(targetColumn);
      const moved = movedActivity();
      await act(async () => { save.reject(new Error("Save failed")); });
      expectSingleCardIn(sourceColumn);
      mocks.fetchEvents.mockResolvedValue([{ ...originalGoogle, title: "External Google move", start: moved.startTime!, end: moved.endTime! }]);
      await view.refresh();
      expect(screen.getByTitle("External Google move")).toBeTruthy();
    } finally {
      errorLog.mockRestore();
    }
  });

  it("keeps one card when Undo restores the original date while Google still has the moved date", async () => {
    const view = renderOptimisticCalendar();
    const { sourceColumn, targetColumn } = await dropOnNextDate();
    const moved = movedActivity();
    expectSingleCardIn(targetColumn);
    mocks.fetchEvents.mockResolvedValue([{ ...originalGoogle, start: moved.startTime!, end: moved.endTime! }]);
    await view.refresh();
    const undo = deferred<DailyActivity>();
    mocks.updateActivity.mockReturnValueOnce(undo.promise);
    await act(async () => { fireEvent.keyDown(window, { key: "z", ctrlKey: true }); });
    expectSingleCardIn(sourceColumn);
    await view.refresh();
    expectSingleCardIn(sourceColumn);
    await act(async () => { undo.resolve(initial); });
    await view.refresh();
    expectSingleCardIn(sourceColumn);
    mocks.fetchEvents.mockResolvedValue([originalGoogle]);
    await view.refresh();
    expectSingleCardIn(sourceColumn);
  });

  it("restores the previous movement protection if Undo fails before Google catches up", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const view = renderOptimisticCalendar();
      const { sourceColumn, targetColumn } = await dropOnNextDate();
      expectSingleCardIn(targetColumn);
      const undo = deferred<DailyActivity>();
      mocks.updateActivity.mockReturnValueOnce(undo.promise);
      await act(async () => { fireEvent.keyDown(window, { key: "z", ctrlKey: true }); });
      expectSingleCardIn(sourceColumn);
      await act(async () => { undo.reject(new Error("Undo failed")); });
      expectSingleCardIn(targetColumn);
      await view.refresh();
      expectSingleCardIn(targetColumn);
    } finally {
      errorLog.mockRestore();
    }
  });

  it("clears movement protection on account change and ignores late save and fetch responses", async () => {
    const view = renderOptimisticCalendar();
    const save = deferred<DailyActivity>();
    mocks.updateActivity.mockReturnValueOnce(save.promise);
    const { targetColumn } = await dropOnNextDate();
    expectSingleCardIn(targetColumn);
    const oldFetch = deferred<typeof originalGoogle[]>();
    mocks.fetchEvents.mockReturnValueOnce(oldFetch.promise);
    await view.refresh();
    mocks.status = { connected: true, connectionId: "account-b" };
    mocks.fetchEvents.mockResolvedValue([{ ...originalGoogle, title: "Account B card" }]);
    await view.refresh();
    expect(screen.getByTitle("Account B card")).toBeTruthy();
    await act(async () => {
      save.resolve(movedActivity());
      oldFetch.resolve([originalGoogle]);
    });
    expect(screen.getByTitle("Account B card")).toBeTruthy();
  });

  it.each(["removed", "unlinked"])("releases the Google card when its moved activity is %s", async mode => {
    const view = renderOptimisticCalendar();
    const { targetColumn } = await dropOnNextDate();
    expectSingleCardIn(targetColumn);
    mocks.fetchEvents.mockResolvedValue([{ ...originalGoogle, title: "Remaining Google card" }]);
    await view.refresh();
    expect(screen.queryByTitle("Remaining Google card")).toBeNull();
    await view.replaceActivities(mode === "removed" ? [] : [{ ...movedActivity(), googleEventId: null }]);
    expect(screen.getByTitle("Remaining Google card")).toBeTruthy();
  });
});

it("hydrates the visible range manually and displays the last sync in WIB", async () => {
  mocks.status = { connected: true, syncedAt: "2026-09-29T03:00:00Z" };
  render(<CalendarView {...props} activities={[]} />);
  await act(async () => {});
  fireEvent.click(screen.getByTitle("Sinkronkan sekarang dengan Google Calendar"));
  expect(mocks.autoSync).toHaveBeenCalledWith(...mocks.setRange.mock.lastCall!, { hydrateRange: true });
  const timestamp = screen.getByTitle("Sinkronisasi terakhir");
  expect(timestamp.getAttribute("datetime")).toBe(mocks.status.syncedAt);
  expect(timestamp.textContent).toContain("10.00 WIB");
  await act(async () => { vi.advanceTimersByTime(90000); });
  expect(mocks.autoSync).toHaveBeenCalledTimes(1);
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
        endType: "NEVER",
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

    // Recurrence Scope Modal muncul meminta pilihan cakupan
    expect(screen.getByText("Pindahkan Kegiatan Berulang")).toBeTruthy();
    fireEvent.click(screen.getByText("Semua event"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
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
      endType: "NEVER",
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
        endType: "NEVER",
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

    // Recurrence Scope Modal muncul meminta pilihan cakupan
    expect(screen.getByText("Pindahkan Kegiatan Berulang")).toBeTruthy();
    fireEvent.click(screen.getByText("Semua event"));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
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

  describe("Undo capability for recurring cards and calendar operations", () => {
    it("can undo ALL_EVENTS recurring move restoring previous date, time, and recurrence", async () => {
      const recurringAct = fixture({
        id: "standup-1",
        title: "Daily Standup",
        date: "2026-09-28T00:00:00Z",
        startTime: "2026-09-28T09:00:00+07:00",
        endTime: "2026-09-28T10:00:00+07:00",
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "NEVER",
        },
      });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[recurringAct]}
        />,
      );

      const cards = screen.getAllByTitle("Daily Standup");
      const card = cards[0];
      const dataTransfer = transfer();
      dragStart(card, dataTransfer);

      const targetColumn = card.parentElement!;
      const drop = createEvent.drop(targetColumn, { dataTransfer });
      Object.defineProperty(drop, "clientY", { value: 960 }); // 16:00
      await act(async () => {
        fireEvent(targetColumn, drop);
        await Promise.resolve();
      });

      // Pilih Semua Event
      fireEvent.click(screen.getByText("Semua event"));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      expect(props.onMoveActivity).toHaveBeenCalledTimes(1);

      // Sekarang tekan Ctrl+Z untuk membatalkan
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      expect(props.onMoveActivity).toHaveBeenCalledTimes(2);
      const [undoneId, restoredData] = props.onMoveActivity.mock.calls[1];
      expect(undoneId).toBe("standup-1");
      expect(restoredData.startTime).toBe("2026-09-28T09:00:00+07:00");
      expect(restoredData.endTime).toBe("2026-09-28T10:00:00+07:00");
      expect(restoredData.recurrence).toEqual({
        freq: "DAILY",
        interval: 1,
        endType: "NEVER",
      });
    });

    it("can undo THIS_EVENT recurring move by removing created single instance and restoring master excludeDates", async () => {
      const recurringAct = fixture({
        id: "standup-2",
        title: "Daily Standup 2",
        date: "2026-09-28T00:00:00Z",
        startTime: "2026-09-28T09:00:00+07:00",
        endTime: "2026-09-28T10:00:00+07:00",
        recurrence: {
          freq: "DAILY",
          interval: 1,
          excludeDates: [],
          endType: "NEVER",
        },
      });

      mocks.createActivity.mockResolvedValueOnce({ id: "detached-new-1" });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[recurringAct]}
        />,
      );

      const cards = screen.getAllByTitle("Daily Standup 2");
      const card = cards[0];
      const dataTransfer = transfer();
      dragStart(card, dataTransfer);

      const targetColumn = card.parentElement!;
      const drop = createEvent.drop(targetColumn, { dataTransfer });
      Object.defineProperty(drop, "clientY", { value: 960 });
      await act(async () => {
        fireEvent(targetColumn, drop);
        await Promise.resolve();
      });

      // Pilih Event Ini
      fireEvent.click(screen.getByText("Event ini"));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      // Master di-exclude
      expect(mocks.updateActivity).toHaveBeenCalledWith("standup-2", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          excludeDates: ["2026-09-28"],
          endType: "NEVER",
        },
      });
      // Activity mandiri dibuat
      expect(mocks.createActivity).toHaveBeenCalledTimes(1);

      // Sekarang tekan Ctrl+Z
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      // Menghapus instance baru dan mengembalikan excludeDates pada master
      expect(mocks.removeActivity).toHaveBeenCalledWith("detached-new-1");
      expect(mocks.updateActivity).toHaveBeenLastCalledWith("standup-2", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          excludeDates: [],
          endType: "NEVER",
        },
      });
    });

    it("can undo THIS_AND_FOLLOWING recurring move by removing created series and restoring master recurrence", async () => {
      const recurringAct = fixture({
        id: "standup-3",
        title: "Daily Standup 3",
        date: "2026-09-28T00:00:00Z",
        startTime: "2026-09-28T09:00:00+07:00",
        endTime: "2026-09-28T10:00:00+07:00",
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "NEVER",
        },
      });

      mocks.createActivity.mockResolvedValueOnce({ id: "series-new-1" });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[recurringAct]}
        />,
      );

      const cards = screen.getAllByTitle("Daily Standup 3");
      const card = cards[0];
      const dataTransfer = transfer();
      dragStart(card, dataTransfer);

      const targetColumn = card.parentElement!;
      const drop = createEvent.drop(targetColumn, { dataTransfer });
      Object.defineProperty(drop, "clientY", { value: 960 });
      await act(async () => {
        fireEvent(targetColumn, drop);
        await Promise.resolve();
      });

      // Pilih Event Ini dan Seterusnya
      fireEvent.click(screen.getByText(/Event ini dan/));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      // Master dipotong ke H-1 (2026-09-27)
      expect(mocks.updateActivity).toHaveBeenCalledWith("standup-3", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "ON_DATE",
          untilDate: "2026-09-27",
        },
      });

      // Sekarang tekan Ctrl+Z
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      // Menghapus series baru dan mengembalikan recurrence asli master
      expect(mocks.removeActivity).toHaveBeenCalledWith("series-new-1");
      expect(mocks.updateActivity).toHaveBeenLastCalledWith("standup-3", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "NEVER",
        },
      });
    });

    it("can undo THIS_EVENT recurring delete by restoring excludeDates", async () => {
      const recurringAct = fixture({
        id: "standup-4",
        title: "Daily Standup 4",
        date: "2026-09-28T00:00:00Z",
        startTime: "2026-09-28T09:00:00+07:00",
        endTime: "2026-09-28T10:00:00+07:00",
        recurrence: {
          freq: "DAILY",
          interval: 1,
          excludeDates: [],
          endType: "NEVER",
        },
      });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[recurringAct]}
        />,
      );

      const card = screen.getAllByTitle("Daily Standup 4")[0];
      fireEvent.click(card);

      // Hapus via tombol Delete
      await act(async () => {
        fireEvent.keyDown(window, { key: "Delete" });
        await Promise.resolve();
      });

      // Modal konfirmasi hapus muncul
      expect(screen.getByText("Hapus Kegiatan Berulang")).toBeTruthy();
      fireEvent.click(screen.getByText("Event ini"));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Hapus" }));
        await Promise.resolve();
      });

      expect(mocks.updateActivity).toHaveBeenCalledWith("standup-4", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          excludeDates: ["2026-09-28"],
          endType: "NEVER",
        },
      });

      // Sekarang tekan Ctrl+Z
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      expect(mocks.updateActivity).toHaveBeenLastCalledWith("standup-4", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          excludeDates: [],
          endType: "NEVER",
        },
      });
    });

    it("can undo THIS_AND_FOLLOWING recurring delete by restoring master recurrence", async () => {
      const recurringAct = fixture({
        id: "standup-5",
        title: "Daily Standup 5",
        date: "2026-09-28T00:00:00Z",
        startTime: "2026-09-28T09:00:00+07:00",
        endTime: "2026-09-28T10:00:00+07:00",
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "NEVER",
        },
      });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[recurringAct]}
        />,
      );

      const card = screen.getAllByTitle("Daily Standup 5")[0];
      fireEvent.click(card);

      // Hapus via tombol Delete
      await act(async () => {
        fireEvent.keyDown(window, { key: "Delete" });
        await Promise.resolve();
      });

      // Modal konfirmasi hapus muncul
      expect(screen.getByText("Hapus Kegiatan Berulang")).toBeTruthy();
      fireEvent.click(screen.getByText(/Event ini dan/));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Hapus" }));
        await Promise.resolve();
      });

      expect(mocks.updateActivity).toHaveBeenCalledWith("standup-5", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "ON_DATE",
          untilDate: "2026-09-27",
        },
      });

      // Sekarang tekan Ctrl+Z
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      expect(mocks.updateActivity).toHaveBeenLastCalledWith("standup-5", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "NEVER",
        },
      });
    });
  });
});
