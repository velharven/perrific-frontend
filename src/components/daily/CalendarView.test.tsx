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
import { showToast } from "@/components/ui/Toast";

const mocks = vi.hoisted(() => ({
  fetchEvents: vi.fn().mockResolvedValue([]),
  setRange: vi.fn(),
  status: { connected: false } as GoogleCalendarStatus,
  syncing: false,
  disconnecting: false,
  disconnect: vi.fn(),
  autoSync: vi.fn(),
  revision: 0,
  change: null as CalendarChange | null,
  updateActivity: vi.fn().mockResolvedValue({}),
  createActivity: vi.fn().mockResolvedValue({ id: "created-act-1" }),
  removeActivity: vi.fn().mockResolvedValue({}),
  updateGoogleEvent: vi.fn().mockResolvedValue({}),
  deleteGoogleEvent: vi.fn().mockResolvedValue({}),
  createGoogleEvent: vi.fn().mockResolvedValue({ id: "created-google-1" }),
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
vi.mock("@/api/calendar", () => ({
  calendarApi: {
    updateEvent: (...args: unknown[]) => mocks.updateGoogleEvent(...args),
    deleteEvent: (...args: unknown[]) => mocks.deleteGoogleEvent(...args),
    createEvent: (...args: unknown[]) => mocks.createGoogleEvent(...args),
  },
}));
vi.mock("@/components/ui/Toast", () => ({ showToast: vi.fn() }));
vi.mock("./CalendarSidebar", () => ({
  default: ({
    onClose,
    onScheduleItem,
  }: {
    onClose?: () => void;
    onScheduleItem?: (payload: any) => void;
  }) => (
    <div data-testid="calendar-sidebar">
      {onClose && <button onClick={onClose}>Tutup Sidebar</button>}
      {onScheduleItem && (
        <button
          onClick={() =>
            onScheduleItem({
              source: "item",
              id: "unsched-1",
              title: "Tugas Baru",
              targetDate: new Date("2026-09-30T12:00:00"),
              startTime: "2026-09-30T10:00:00.000Z",
              endTime: "2026-09-30T11:00:00.000Z",
            })
          }
        >
          Mock Schedule Item
        </button>
      )}
    </div>
  ),
}));
vi.mock("./CalendarCardSettings", () => ({
  default: ({
    onClose,
    onDateChanged,
  }: {
    onClose?: () => void;
    onDateChanged?: (d: Date) => void;
  }) => (
    <div data-testid="calendar-card-settings">
      {onClose && <button onClick={onClose}>Tutup Settings</button>}
      {onDateChanged && (
        <button onClick={() => onDateChanged(new Date("2026-09-30T12:00:00"))}>
          Mock Pindah Tanggal
        </button>
      )}
    </div>
  ),
}));

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
  mocks.deleteGoogleEvent.mockReset().mockResolvedValue({});
  mocks.createGoogleEvent.mockReset().mockResolvedValue({ id: "created-google-1" });
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

it("keeps connected Google profile clean without visible sync buttons while syncing in the background", async () => {
  mocks.status = { connected: true, syncedAt: "2026-09-29T03:00:00Z" };
  render(<CalendarView {...props} activities={[]} />);
  await act(async () => {});
  // Verify manual refresh button and status text are removed from the UI
  expect(screen.queryByTitle("Sinkronkan sekarang dengan Google Calendar")).toBeNull();
  expect(screen.queryByTitle("Sinkronisasi terakhir")).toBeNull();
  expect(screen.queryByText("Tersinkron")).toBeNull();
  // Disconnect button remains available
  expect(screen.getByRole("button", { name: /putuskan/i })).toBeTruthy();
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

    it("optimistically renders THIS_EVENT at target position immediately without delay", async () => {
      const recurringAct = fixture({
        id: "standup-opt-1",
        title: "Daily Standup Optimistic",
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

      let resolveCreate: (val: any) => void;
      const pendingCreate = new Promise((resolve) => {
        resolveCreate = resolve;
      });
      mocks.createActivity.mockReturnValueOnce(pendingCreate);

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-28T00:00:00+07:00")}
          activities={[recurringAct]}
        />,
      );

      const cards = screen.getAllByTitle("Daily Standup Optimistic");
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

      // Pilih Event Ini dan Terapkan
      fireEvent.click(screen.getByText("Event ini"));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      // Seketika itu juga (walaupun createActivity masih pending di server),
      // kartu optimistik sudah ter-render di posisi baru (top: 960px = 16:00)!
      const allRenderedCards = screen.getAllByTitle("Daily Standup Optimistic");
      expect(allRenderedCards.length).toBeGreaterThan(0);
      const movedCard = allRenderedCards.find((c) => c.style.top === "960px");
      expect(movedCard).toBeDefined();

      // Selesaikan promise
      await act(async () => {
        resolveCreate!({ id: "detached-opt-created" });
        await Promise.resolve();
      });
    });

    it("optimistically undos THIS_EVENT recurring move immediately on frame 0 before API resolves", async () => {
      const recurringAct = fixture({
        id: "standup-opt-undo-1",
        title: "Daily Standup Undo Opt",
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

      mocks.createActivity.mockResolvedValueOnce({
        id: "detached-opt-undo-1",
        title: "Daily Standup Undo Opt",
        startTime: "2026-09-28T16:00:00+07:00",
        endTime: "2026-09-28T17:00:00+07:00",
      });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-28T00:00:00+07:00")}
          activities={[recurringAct]}
        />,
      );

      const cards = screen.getAllByTitle("Daily Standup Undo Opt");
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

      fireEvent.click(screen.getByText("Event ini"));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      expect(screen.getAllByTitle("Daily Standup Undo Opt").length).toBeGreaterThan(0);

      let resolveRemove: (val: any) => void;
      const pendingRemove = new Promise((resolve) => {
        resolveRemove = resolve;
      });
      mocks.removeActivity.mockReturnValueOnce(pendingRemove);

      // Tekan Ctrl+Z (Undo)
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      // Pada frame 0 (sebelum server selesai): toast undo langsung muncul & API removeActivity dipanggil
      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/Perubahan kegiatan "Daily Standup Undo Opt".*diurungkan/),
      );
      expect(mocks.removeActivity).toHaveBeenCalledWith("detached-opt-undo-1");

      // Selesaikan pendingRemove
      await act(async () => {
        resolveRemove!(true);
        await Promise.resolve();
      });
    });

    it("optimistically undos THIS_AND_FOLLOWING recurring move immediately on frame 0 before API resolves", async () => {
      const recurringAct = fixture({
        id: "standup-opt-undo-following",
        title: "Daily Standup Following Opt",
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

      mocks.createActivity.mockResolvedValueOnce({
        id: "series-new-following-1",
        title: "Daily Standup Following Opt",
        startTime: "2026-09-29T16:00:00+07:00",
        endTime: "2026-09-29T17:00:00+07:00",
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

      const cards = screen.getAllByTitle("Daily Standup Following Opt");
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

      fireEvent.click(screen.getByText(/Event ini dan/));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      let resolveRemove: (val: any) => void;
      const pendingRemove = new Promise((resolve) => {
        resolveRemove = resolve;
      });
      mocks.removeActivity.mockReturnValueOnce(pendingRemove);

      // Tekan Ctrl+Z (Undo)
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      expect(showToast).toHaveBeenCalledWith(
        expect.stringMatching(/Perubahan kegiatan "Daily Standup Following Opt" dan seterusnya diurungkan/),
      );
      expect(mocks.removeActivity).toHaveBeenCalledWith("series-new-following-1");

      await act(async () => {
        resolveRemove!(true);
        await Promise.resolve();
      });
    });

    it("undoes sequential recurring moves in strict reverse chronological order (THIS_EVENT then ALL_EVENTS)", async () => {
      const card1 = fixture({
        id: "act-card-1",
        title: "Card 1",
        date: "2026-09-28T00:00:00Z",
        startTime: "2026-09-28T09:00:00+07:00",
        endTime: "2026-09-28T10:00:00+07:00",
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "NEVER",
          excludeDates: [],
        },
      });

      const card2 = fixture({
        id: "act-card-2",
        title: "Card 2",
        date: "2026-09-28T00:00:00Z",
        startTime: "2026-09-28T11:00:00+07:00",
        endTime: "2026-09-28T12:00:00+07:00",
        recurrence: {
          freq: "DAILY",
          interval: 1,
          endType: "NEVER",
          excludeDates: [],
        },
      });

      mocks.createActivity.mockResolvedValueOnce({ id: "card-2-detached" });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-28T00:00:00+07:00")}
          activities={[card1, card2]}
        />,
      );

      // 1. Pindahkan Card 2 ke atas dengan opsi "Event ini"
      const card2Element = screen.getAllByTitle("Card 2")[0];
      const dataTransfer2 = transfer();
      dragStart(card2Element, dataTransfer2);

      const targetCol2 = card2Element.parentElement!;
      const drop2 = createEvent.drop(targetCol2, { dataTransfer: dataTransfer2 });
      Object.defineProperty(drop2, "clientY", { value: 420 }); // 07:00
      await act(async () => {
        fireEvent(targetCol2, drop2);
        await Promise.resolve();
      });

      fireEvent.click(screen.getByText("Event ini"));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      expect(mocks.updateActivity).toHaveBeenCalledWith("act-card-2", {
        recurrence: {
          freq: "DAILY",
          interval: 1,
          excludeDates: ["2026-09-28"],
          endType: "NEVER",
        },
      });
      expect(mocks.createActivity).toHaveBeenCalledTimes(1);

      // 2. Pindahkan Card 1 dengan opsi "Semua event"
      const card1Element = screen.getAllByTitle("Card 1")[0];
      const dataTransfer1 = transfer();
      dragStart(card1Element, dataTransfer1);

      const targetCol1 = card1Element.parentElement!;
      const drop1 = createEvent.drop(targetCol1, { dataTransfer: dataTransfer1 });
      Object.defineProperty(drop1, "clientY", { value: 840 }); // 14:00
      await act(async () => {
        fireEvent(targetCol1, drop1);
        await Promise.resolve();
      });

      fireEvent.click(screen.getByText("Semua event"));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      expect(props.onMoveActivity).toHaveBeenCalledTimes(1);

      // 3. Tekan Ctrl+Z pertama -> Harus membatalkan Card 1 (aksi terakhir)
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      // Card 1 dipulihkan posisinya via onMoveActivity
      expect(props.onMoveActivity).toHaveBeenCalledTimes(2);
      const [undoneId1, restoredData1] = props.onMoveActivity.mock.calls[1];
      expect(undoneId1).toBe("act-card-1");
      expect(restoredData1.startTime).toBe("2026-09-28T09:00:00+07:00");
      expect(restoredData1.endTime).toBe("2026-09-28T10:00:00+07:00");

      // Card 2 belum di-undo pada Ctrl+Z pertama
      expect(mocks.removeActivity).not.toHaveBeenCalled();

      // 4. Tekan Ctrl+Z kedua -> Sekarang giliran Card 2 yang dibatalkan
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      expect(mocks.removeActivity).toHaveBeenCalledWith("card-2-detached");
      expect(mocks.updateActivity).toHaveBeenLastCalledWith("act-card-2", {
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

  describe("Google & Notion Calendar cascading overlapping card layout", () => {
    it("renders 2 overlapping cards with cascading overlap width, rising z-index, white border, and no reorder button", () => {
      const cardA = fixture({
        id: "overlap-a",
        title: "Design Review",
        date: "2026-09-29T00:00:00Z",
        startTime: "2026-09-29T14:00:00+07:00",
        endTime: "2026-09-29T15:30:00+07:00",
      });
      const cardB = fixture({
        id: "overlap-b",
        title: "Sprint Planning",
        date: "2026-09-29T00:00:00Z",
        startTime: "2026-09-29T14:00:00+07:00",
        endTime: "2026-09-29T15:00:00+07:00",
      });

      render(<CalendarView {...props} activities={[cardA, cardB]} />);

      const elA = screen.getByTitle("Design Review");
      const elB = screen.getByTitle("Sprint Planning");

      // Longer duration event placed in left column (colIndex 0) with cascading width (85%),
      // shorter in right column (colIndex 1) stacked on top (zIndex 11 vs 10)
      expect(elA.style.left).toBe("calc(0% + 2px)");
      expect(elA.style.width).toBe("calc(85% - 2px)");
      expect(elA.style.zIndex).toBe("10");

      expect(elB.style.left).toBe("calc(50% + 0px)");
      expect(elB.style.width).toBe("calc(50% - 4px)");
      expect(elB.style.zIndex).toBe("11");

      // White separator border applied
      expect(elA.className).toContain("border-white");
      expect(elB.className).toContain("border-white");

      // No ⋮⋮ column reorder button is rendered
      expect(screen.queryByRole("button", { name: /Ubah urutan/i })).toBeNull();
      expect(elA.textContent).not.toContain("⋮⋮");
      expect(elB.textContent).not.toContain("⋮⋮");
    });

    it("renders 3 overlapping cards with Google Calendar cascading widths (~56.67% on col 0 & 1, ~33.33% on col 2) and expands colSpan when free", () => {
      const longEvent = fixture({
        id: "long-1",
        title: "Workshop",
        date: "2026-09-29T00:00:00Z",
        startTime: "2026-09-29T09:00:00+07:00",
        endTime: "2026-09-29T12:00:00+07:00",
      });
      const earlyB = fixture({
        id: "early-b",
        title: "Sync A",
        date: "2026-09-29T00:00:00Z",
        startTime: "2026-09-29T09:00:00+07:00",
        endTime: "2026-09-29T10:00:00+07:00",
      });
      const earlyC = fixture({
        id: "early-c",
        title: "Sync B",
        date: "2026-09-29T00:00:00Z",
        startTime: "2026-09-29T09:15:00+07:00",
        endTime: "2026-09-29T10:00:00+07:00",
      });
      const laterSpanEvent = fixture({
        id: "later-span",
        title: "Follow-up",
        date: "2026-09-29T00:00:00Z",
        startTime: "2026-09-29T10:30:00+07:00",
        endTime: "2026-09-29T11:30:00+07:00",
      });

      render(
        <CalendarView
          {...props}
          activities={[longEvent, earlyB, earlyC, laterSpanEvent]}
        />,
      );

      const workshopEl = screen.getByTitle("Workshop");
      const syncAEl = screen.getByTitle("Sync A");
      const syncBEl = screen.getByTitle("Sync B");
      const followUpEl = screen.getByTitle("Follow-up");

      // 3-column cascading widths: col 0 & col 1 get 1.7 * 33.33% = ~56.67% width
      expect(workshopEl.style.width).toContain("56.66");
      expect(syncAEl.style.left).toContain("33.33");
      expect(syncAEl.style.width).toContain("56.66");
      expect(syncBEl.style.left).toContain("66.66");
      expect(syncBEl.style.width).toContain("33.33");

      // Placed in colIndex 1 of 3, and expands across col 1 & col 2 (2/3 width = ~66.67%)
      expect(followUpEl.style.left).toContain("33.33");
      expect(followUpEl.style.width).toContain("66.66");
    });

    it('displays repeat icon on recurring card and modified tooltip on exception card', async () => {
      const recurring = fixture({
        id: 'rec-daily',
        title: 'Daily Meeting',
        date: '2026-09-29T00:00:00Z',
        startTime: '2026-09-29T09:00:00+07:00',
        endTime: '2026-09-29T10:00:00+07:00',
        recurrence: {
          freq: 'DAILY',
          interval: 1,
          endType: 'NEVER',
        },
      });

      const { rerender } = render(
        <CalendarView
          {...props}
          activities={[recurring]}
        />,
      );

      expect(screen.getAllByTitle('Kegiatan berulang').length).toBeGreaterThan(1);

      const exceptionCard = fixture({
        id: 'rec-exception',
        title: 'Daily Meeting (Rescheduled)',
        date: '2026-09-29T00:00:00Z',
        startTime: '2026-09-29T11:00:00+07:00',
        endTime: '2026-09-29T12:00:00+07:00',
        recurrence: {
          freq: 'DAILY',
          interval: 1,
          endType: 'NEVER',
          isException: true,
          masterActivityId: 'rec-daily',
        },
      });

      rerender(
        <CalendarView
          {...props}
          activities={[exceptionCard]}
        />,
      );

      // Exception card only renders on its own date, displaying the modified recurrence tooltip
      expect(screen.getAllByTitle('Kegiatan berulang (jadwal diubah)')).toHaveLength(1);
      expect(screen.queryAllByTitle('Kegiatan berulang')).toHaveLength(0);
    });

    it("opens recurrence scope modal when dragging an imported Google recurring activity", async () => {
      const importedRecurring = fixture({
        id: "imported-rec-1",
        title: "Sprint Sync (Google)",
        googleEventId: "google-master-123",
        date: "2026-09-29T00:00:00Z",
        startTime: "2026-09-29T10:00:00+07:00",
        endTime: "2026-09-29T11:00:00+07:00",
        recurrence: {
          freq: "WEEKLY",
          interval: 1,
          byDays: [2],
          endType: "NEVER",
        },
      });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[importedRecurring]}
        />,
      );

      const cards = screen.getAllByTitle("Sprint Sync (Google)");
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

      // RecurrenceScopeModal options should be visible
      expect(screen.getByText("Pindahkan Kegiatan Berulang")).toBeTruthy();
      expect(screen.getByText("Event ini")).toBeTruthy();
      expect(screen.getByText("Semua event")).toBeTruthy();
    });

    it("opens recurrence scope modal when dragging an unimported recurring Google Calendar event card", async () => {
      mocks.fetchEvents.mockResolvedValueOnce([
        {
          id: "google-series-1_20260929T030000Z",
          recurringEventId: "google-series-1",
          title: "Weekly Planning",
          start: "2026-09-29T10:00:00+07:00",
          end: "2026-09-29T11:00:00+07:00",
        },
      ]);
      mocks.status = { connected: true, email: "user@test.com" } as GoogleCalendarStatus;

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[]}
        />,
      );

      await act(async () => {
        await Promise.resolve();
      });

      const cards = screen.getAllByTitle("Weekly Planning");
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

      expect(screen.getByText("Pindahkan Kegiatan Berulang")).toBeTruthy();
      expect(screen.getByText("Event ini")).toBeTruthy();
      expect(screen.getByText("Semua event")).toBeTruthy();

      // Confirm with ALL_EVENTS
      fireEvent.click(screen.getByText("Semua event"));
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Terapkan" }));
        await Promise.resolve();
      });

      expect(mocks.updateGoogleEvent).toHaveBeenCalledWith(
        "google-series-1_20260929T030000Z",
        expect.objectContaining({
          scope: "ALL_EVENTS",
        }),
      );
    });
  });

  describe("Responsive Mobile & Tablet Calendar Experience", () => {
    it("menampilkan tombol toggle Belum Terjadwal beserta badge count dan membuka drawer saat diklik", async () => {
      const unscheduledAct: DailyActivity = {
        id: "unsched-1",
        userId: "user-1",
        title: "Tugas santai",
        date: "2026-09-29T00:00:00Z",
        startTime: null,
        endTime: null,
        allDay: false,
        type: "CUSTOM",
        status: "PENDING",
        order: 0,
        checklistItems: [],
      };

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[unscheduledAct]}
        />,
      );

      // Pastikan tombol Belum Terjadwal ada di layar
      const toggleBtn = screen.getByRole("button", { name: /Belum Terjadwal/i });
      expect(toggleBtn).toBeTruthy();
      expect(toggleBtn.textContent).toContain("1"); // badge count

      // Klik tombol untuk membuka drawer
      fireEvent.click(toggleBtn);

      // Drawer harus merender CalendarSidebar
      const sidebars = screen.getAllByTestId("calendar-sidebar");
      expect(sidebars.length).toBeGreaterThanOrEqual(1);

      // Klik tombol tutup sidebar di dalam drawer
      const closeBtn = screen.getByRole("button", { name: "Tutup Sidebar" });
      fireEvent.click(closeBtn);
    });

    it("merender strip navigasi 7 hari pada tampilan Hari dan memanggil onSelectDate saat hari diklik", async () => {
      const onSelectDateMock = vi.fn();
      render(
        <CalendarView
          {...props}
          onSelectDate={onSelectDateMock}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[]}
        />,
      );

      // Ubah tampilan ke mode Hari via menu dropdown
      const modeBtn = screen.getByRole("button", { name: "Minggu" });
      fireEvent.click(modeBtn);

      const dayMenuItem = screen.getByRole("menuitem", { name: /Hari/i });
      fireEvent.click(dayMenuItem);

      // Verifikasi judul hari terpilih muncul (di toolbar dan header hari)
      expect(screen.getAllByText(/Selasa, 29 September 2026/i).length).toBeGreaterThanOrEqual(1);

      // Klik salah satu tanggal pada strip navigasi (misal tanggal 28 atau 30)
      const dayButtons = screen.getAllByRole("button").filter(
        (b) => b.textContent?.includes("Sen") || b.textContent?.includes("Rab"),
      );
      expect(dayButtons.length).toBeGreaterThan(0);

      fireEvent.click(dayButtons[0]);
      expect(onSelectDateMock).toHaveBeenCalled();
    });

    it("membuka pengaturan kartu langsung di sidebar kalendar pada desktop saat kartu diklik", async () => {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1200 });

      const scheduledAct: DailyActivity = {
        id: "sched-1",
        userId: "user-1",
        title: "Meeting Penting",
        date: "2026-09-29T00:00:00+07:00",
        startTime: "2026-09-29T09:00:00+07:00",
        endTime: "2026-09-29T10:00:00+07:00",
        allDay: false,
        type: "CUSTOM",
        status: "PENDING",
        order: 0,
        checklistItems: [],
      };

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[scheduledAct]}
        />,
      );

      // Klik kartu kegiatan
      const card = screen.getByText("Meeting Penting");
      fireEvent.click(card);

      // Di desktop, settings langsung terbuka di sidebar tanpa floating action box
      expect(screen.queryByRole("button", { name: "Buka Pengaturan Card" })).toBeNull();
      const settingsList = screen.getAllByTestId("calendar-card-settings");
      expect(settingsList.length).toBeGreaterThanOrEqual(1);

      // Tutup via tombol tutup settings
      const closeSettingsBtn = screen.getAllByRole("button", { name: "Tutup Settings" });
      fireEvent.click(closeSettingsBtn[0]);
      expect(screen.queryByTestId("calendar-card-settings")).toBeNull();
    });

    it("menampilkan floating action box pada layar mobile saat kartu diklik dan dapat membuka modal", async () => {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 500 });

      const scheduledAct: DailyActivity = {
        id: "sched-1",
        userId: "user-1",
        title: "Meeting Penting",
        date: "2026-09-29T00:00:00+07:00",
        startTime: "2026-09-29T09:00:00+07:00",
        endTime: "2026-09-29T10:00:00+07:00",
        allDay: false,
        type: "CUSTOM",
        status: "PENDING",
        order: 0,
        checklistItems: [],
      };

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[scheduledAct]}
        />,
      );

      // Klik kartu kegiatan
      const card = screen.getByText("Meeting Penting");
      fireEvent.click(card);

      // Buka pengaturan via tombol floating action box
      const openSettingsBtn = screen.getByRole("button", { name: "Buka Pengaturan Card" });
      expect(openSettingsBtn).toBeTruthy();
      fireEvent.click(openSettingsBtn);

      // Modal settings harus muncul
      const settingsList = screen.getAllByTestId("calendar-card-settings");
      expect(settingsList.length).toBeGreaterThanOrEqual(1);

      // Klik tombol tutup pengaturan
      const closeSettingsBtn = screen.getAllByRole("button", { name: "Tutup Settings" });
      fireEvent.click(closeSettingsBtn[0]);
    });

    it("menjadwalkan item dari sidebar via onScheduleItem dan beralih ke tanggal target", async () => {
      const onSelectDateMock = vi.fn();
      const unscheduledAct: DailyActivity = {
        id: "unsched-1",
        userId: "user-1",
        title: "Tugas Baru",
        date: "2026-09-29T00:00:00.000Z",
        startTime: null,
        endTime: null,
        type: "TASK",
        status: "PENDING",
        order: 0,
        checklistItems: [],
      };

      mocks.updateActivity.mockResolvedValueOnce({
        ...unscheduledAct,
        date: "2026-09-30T00:00:00.000Z",
        startTime: "2026-09-30T10:00:00.000Z",
        endTime: "2026-09-30T11:00:00.000Z",
      });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          onSelectDate={onSelectDateMock}
          activities={[unscheduledAct]}
        />,
      );

      // Trigger schedule item dari mock sidebar
      const scheduleButtons = screen.getAllByRole("button", { name: "Mock Schedule Item" });
      expect(scheduleButtons.length).toBeGreaterThan(0);

      await act(async () => {
        fireEvent.click(scheduleButtons[0]);
        await Promise.resolve();
      });

      expect(mocks.updateActivity).toHaveBeenCalledWith(
        "unsched-1",
        expect.objectContaining({
          date: expect.any(String),
          startTime: expect.any(String),
          endTime: expect.any(String),
        }),
      );
      expect(onSelectDateMock).toHaveBeenCalledWith(expect.any(Date));
    });

    it("beralih ke tanggal baru saat onDateChanged dipanggil dari pengaturan kartu kegiatan", async () => {
      const onSelectDateMock = vi.fn();
      const scheduledAct: DailyActivity = {
        id: "sched-move-1",
        userId: "user-1",
        title: "Event Pindah Hari",
        date: "2026-09-29T00:00:00+07:00",
        startTime: "2026-09-29T09:00:00+07:00",
        endTime: "2026-09-29T10:00:00+07:00",
        allDay: false,
        type: "CUSTOM",
        status: "PENDING",
        order: 0,
        checklistItems: [],
      };

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          onSelectDate={onSelectDateMock}
          activities={[scheduledAct]}
        />,
      );

      // Buka modal settings dengan klik kartu
      fireEvent.click(screen.getByText("Event Pindah Hari"));
      const openSettingsBtn = screen.getByRole("button", { name: "Buka Pengaturan Card" });
      fireEvent.click(openSettingsBtn);

      // Klik tombol mock pindah tanggal
      const moveButtons = screen.getAllByRole("button", { name: "Mock Pindah Tanggal" });
      expect(moveButtons.length).toBeGreaterThan(0);

      fireEvent.click(moveButtons[0]);
      expect(onSelectDateMock).toHaveBeenCalledWith(expect.any(Date));
    });
  });

  describe("Moving deleted calendar items to unscheduled items instead of permanent deletion", () => {
    it("unschedules Purrific activity on Delete key rather than deleting from database", async () => {
      const onUnscheduleActivityMock = vi.fn();
      const scheduledAct = fixture({
        id: "act-to-unschedule-1",
        title: "Kegiatan Kalender",
        date: "2026-09-29T00:00:00Z",
        startTime: "2026-09-29T10:00:00+07:00",
        endTime: "2026-09-29T11:00:00+07:00",
      });

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[scheduledAct]}
          onUnscheduleActivity={onUnscheduleActivityMock}
        />,
      );

      const card = screen.getByTitle("Kegiatan Kalender");
      fireEvent.click(card);

      await act(async () => {
        fireEvent.keyDown(window, { key: "Delete" });
        await Promise.resolve();
      });

      // Assert: calls activityApi.update with null times instead of activityApi.remove
      expect(mocks.updateActivity).toHaveBeenCalledWith("act-to-unschedule-1", {
        startTime: null,
        endTime: null,
        allDay: false,
        recurrence: null,
      });
      expect(mocks.removeActivity).not.toHaveBeenCalled();
      expect(onUnscheduleActivityMock).toHaveBeenCalledWith("act-to-unschedule-1");
      expect(showToast).toHaveBeenCalledWith(
        'Kegiatan "Kegiatan Kalender" dipindahkan ke daftar item',
        expect.objectContaining({ label: 'Urungkan (Ctrl+Z)' }),
      );

      // Tekan Ctrl+Z untuk undo
      await act(async () => {
        fireEvent.keyDown(window, { key: "z", ctrlKey: true });
        await Promise.resolve();
      });

      // Assert: undo restores original schedule via updateActivity
      expect(mocks.updateActivity).toHaveBeenLastCalledWith("act-to-unschedule-1", {
        date: scheduledAct.date,
        startTime: scheduledAct.startTime,
        endTime: scheduledAct.endTime,
        allDay: false,
        recurrence: null,
      });
      expect(showToast).toHaveBeenCalledWith('Kegiatan "Kegiatan Kalender" dipulihkan.');
    });

    it("copies Google Calendar event to Purrific unscheduled item before deleting from Google", async () => {
      mocks.status = { connected: true };
      mocks.fetchEvents.mockResolvedValue([
        {
          id: "google-ev-to-del",
          title: "Meeting di Google",
          start: "2026-09-29T14:00:00+07:00",
          end: "2026-09-29T15:00:00+07:00",
        },
      ]);

      render(
        <CalendarView
          {...props}
          selectedDate={new Date("2026-09-29T00:00:00+07:00")}
          activities={[]}
        />,
      );

      await act(async () => {});

      const card = screen.getByTitle("Meeting di Google");
      fireEvent.click(card);

      await act(async () => {
        fireEvent.keyDown(window, { key: "Delete" });
        await Promise.resolve();
      });

      // Assert: created unscheduled Purrific activity
      expect(mocks.createActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Meeting di Google",
          startTime: null,
          endTime: null,
          allDay: false,
        }),
      );
      // Assert: deleted from Google Calendar
      expect(mocks.deleteGoogleEvent).toHaveBeenCalledWith("google-ev-to-del");
      expect(showToast).toHaveBeenCalledWith(
        'Kegiatan "Meeting di Google" dipindahkan ke daftar item',
        expect.objectContaining({ label: 'Urungkan (Ctrl+Z)' }),
      );
    });
  });
});
