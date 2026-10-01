import { useState, useEffect, useMemo, useCallback, useRef, type DragEvent } from 'react';
import type { DailyActivity, GoogleCalendarEvent, RecurrenceConfig, RecurrenceEditScope } from '@/types';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { activityApi } from '@/api/activities';
import { calendarApi } from '@/api/calendar';
import { showToast } from '@/components/ui/Toast';
import CalendarSidebar from './CalendarSidebar';
import CalendarCardSettings, { type CombinedItem, type CalendarUndoAction } from './CalendarCardSettings';
import RecurrenceScopeModal from './RecurrenceScopeModal';
import { doesActivityOccurOnDate, getDayBefore, getNthWeekdayInfo, projectActivityOntoDate } from '@/lib/recurrence';
import { getCalendarColorMeta } from '@/lib/calendarColors';
import { calendarCardEnd, isCalendarCardPast } from '@/lib/calendarTiming';
import { useCalendarSync } from '@/store/calendarSync';

export type CalendarViewMode = 'day' | 'week';

interface CalendarViewProps {
  activities: DailyActivity[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenActivity?: (activity: DailyActivity) => void;
  onCreateActivity?: (date: Date, time?: { startTime: string; endTime: string }) => void;
  onRefreshActivities?: () => void;
  onDeleteActivity?: (activityId: string) => void;
  onMoveActivity: (
    activityId: string,
    position: {
      date?: string;
      startTime: string | null;
      endTime: string | null;
      allDay?: boolean;
      recurrence?: RecurrenceConfig | null;
    },
  ) => Promise<DailyActivity>;
}

interface LinkedActivityMove {
  token: symbol;
  activity: DailyActivity;
  saving: boolean;
  observedEvent?: GoogleCalendarEvent;
}

interface OptimisticRecurringMove {
  id: string;
  masterActivityId: string;
  scope: 'THIS_EVENT' | 'THIS_AND_FOLLOWING';
  updatedMasterRecurrence: RecurrenceConfig | null;
  optimisticActivity?: DailyActivity;
  realCreatedId?: string;
}

const MONTH_NAMES = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const FULL_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // 60px per jam => 1 menit = 1px
const DROP_SNAP_MINUTES = 15;

function getSnappedDropMinutes(
  clientY: number,
  timelineColumn: HTMLElement,
  grabOffsetMinutes = 0,
  durationMinutes = 60,
): number {
  const rect = timelineColumn.getBoundingClientRect();
  const rawMinutes = ((clientY - rect.top) / HOUR_HEIGHT) * 60 - grabOffsetMinutes;
  const snappedMinutes = Math.round(rawMinutes / DROP_SNAP_MINUTES) * DROP_SNAP_MINUTES;
  const boundedDuration = Math.min(24 * 60, Math.max(DROP_SNAP_MINUTES, durationMinutes));
  return Math.min(24 * 60 - boundedDuration, Math.max(0, snappedMinutes));
}

function getDropTiming(rawJson: string): { grabOffsetMinutes: number; durationMinutes: number } {
  try {
    const payload = JSON.parse(rawJson) as {
      source?: string;
      durationMinutes?: number;
      grabOffsetMinutes?: number;
    };
    const durationMinutes = payload.source === 'calendar-card' && Number.isFinite(payload.durationMinutes)
      ? Math.max(DROP_SNAP_MINUTES, payload.durationMinutes!)
      : 60;
    const grabOffsetMinutes = payload.source === 'calendar-card' && Number.isFinite(payload.grabOffsetMinutes)
      ? Math.min(durationMinutes, Math.max(0, payload.grabOffsetMinutes!))
      : 0;
    return { grabOffsetMinutes, durationMinutes };
  } catch {
    return { grabOffsetMinutes: 0, durationMinutes: 60 };
  }
}

function dateAtMinutes(date: Date, minutes: number): Date {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  result.setMinutes(minutes);
  return result;
}

function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function googleEventMatchesActivityTime(event: GoogleCalendarEvent, activity: DailyActivity): boolean {
  if (Boolean(event.allDay) !== Boolean(activity.allDay)) return false;
  if (activity.allDay) {
    const date = new Date(activity.date);
    return event.start === toISODate(date) && event.end === toISODate(dateAtMinutes(date, 1440));
  }
  if (!event.start || !activity.startTime) return false;
  return new Date(event.start).getTime() === new Date(activity.startTime).getTime() &&
    calendarCardEnd(event.start, event.end) === calendarCardEnd(activity.startTime, activity.endTime);
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  if (timeStr.includes('T')) {
    const d = new Date(timeStr);
    if (isNaN(d.getTime())) return null;
    return d.getHours() * 60 + d.getMinutes();
  }
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    if (!isNaN(hours) && !isNaN(minutes) && hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60) {
      return hours * 60 + minutes;
    }
  }
  return null;
}

interface TimedItemGeometry {
  item: CombinedItem;
  startMin: number;
  endMin: number;
  top: number;
  height: number;
  colIndex: number;
  totalCols: number;
  colSpan: number;
}

// Algoritma penataan kolom event yang tumpang tindih ala Notion / Google Calendar
function computeTimedItemsLayout(items: CombinedItem[]): TimedItemGeometry[] {
  const parsed = items
    .map((item) => {
      const startMin = parseTimeToMinutes(item.time);
      if (startMin === null) return null;

      const end = calendarCardEnd(item.time, item.type === 'activity' ? item.act.endTime : item.gEv.end);
      const actualDuration = end && item.time ? (new Date(end).getTime() - new Date(item.time).getTime()) / 60000 : 60;
      const endMin = Math.min(1440, startMin + actualDuration);

      const duration = Math.max(30, endMin - startMin);
      const top = (startMin / 60) * HOUR_HEIGHT;
      const height = Math.max(26, (duration / 60) * HOUR_HEIGHT - 2);

      return {
        item,
        startMin,
        endMin,
        top,
        height,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  parsed.sort((a, b) => a.startMin - b.startMin || (b.endMin - b.startMin) - (a.endMin - a.startMin));

  if (parsed.length === 0) return [];

  // 1. Kelompokkan ke dalam kluster event yang saling tumpang tindih
  const clusters: (typeof parsed)[] = [];
  let currentCluster: typeof parsed = [];
  let clusterEnd = -1;

  for (const item of parsed) {
    if (currentCluster.length === 0) {
      currentCluster.push(item);
      clusterEnd = item.endMin;
    } else {
      if (item.startMin < clusterEnd) {
        // Tumpang tindih dengan kluster saat ini
        currentCluster.push(item);
        clusterEnd = Math.max(clusterEnd, item.endMin);
      } else {
        // Kluster baru
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterEnd = item.endMin;
      }
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  // 2. Untuk setiap kluster, alokasikan sub-kolom secara berdampingan rapi ala Google & Notion Calendar
  const result: TimedItemGeometry[] = [];
  for (const cluster of clusters) {
    const columns: (typeof parsed)[] = [];
    for (const item of cluster) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const lastInCol = columns[c][columns[c].length - 1];
        if (lastInCol.endMin <= item.startMin) {
          columns[c].push(item);
          placed = true;
          break;
        }
      }
      if (!placed) {
        columns.push([item]);
      }
    }

    const totalCols = Math.max(1, columns.length);
    for (const [colIndex, column] of columns.entries()) {
      for (const item of column) {
        let colSpan = 1;
        for (let nextCol = colIndex + 1; nextCol < columns.length; nextCol++) {
          const hasOverlap = columns[nextCol].some(
            (other) => Math.max(item.startMin, other.startMin) < Math.min(item.endMin, other.endMin),
          );
          if (hasOverlap) break;
          colSpan++;
        }
        result.push({
          ...item,
          colIndex,
          totalCols,
          colSpan,
        });
      }
    }
  }

  return result;
}

export default function CalendarView({
  activities,
  selectedDate,
  onSelectDate,
  onOpenActivity,
  onCreateActivity,
  onRefreshActivities,
  onDeleteActivity,
  onMoveActivity,
}: CalendarViewProps) {
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth()); // 0-indexed
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [linkedActivityMoves, setLinkedActivityMoves] = useState<Map<string, LinkedActivityMove>>(new Map());
  const linkedActivityMovesRef = useRef(linkedActivityMoves);
  const updateLinkedActivityMove = useCallback((eventId: string, move?: LinkedActivityMove) => {
    const next = new Map(linkedActivityMovesRef.current);
    if (move) next.set(eventId, move);
    else next.delete(eventId);
    linkedActivityMovesRef.current = next;
    setLinkedActivityMoves(next);
  }, []);
  const [selectedEvent, setSelectedEvent] = useState<GoogleCalendarEvent | null>(null);
  const [selectedCardItem, setSelectedCardItem] = useState<CombinedItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [now, setNow] = useState(new Date());

  const [recurringMovePrompt, setRecurringMovePrompt] = useState<{
    isOpen: boolean;
    activity?: DailyActivity;
    googleEvent?: GoogleCalendarEvent;
    payload: {
      id: string;
      title: string;
      itemType?: 'activity' | 'google';
      hasRecurrence?: boolean;
      recurrence?: RecurrenceConfig | null;
      recurringEventId?: string | null;
      cardDate?: string | null;
      cardStartTime?: string | null;
      cardEndTime?: string | null;
      originalDate?: string | null;
      originalStartTime?: string | null;
      originalEndTime?: string | null;
      originalAllDay?: boolean;
    };
    targetDate: Date;
    startMinutes: number;
    durationMinutes: number;
    instanceDateStr: string;
  } | null>(null);

  const [recurringDeletePrompt, setRecurringDeletePrompt] = useState<{
    isOpen: boolean;
    item: CombinedItem;
    instanceDateStr: string;
  } | null>(null);

  // Ref untuk mencatat id aktivitas & event google yang dihapus agar langsung hilang dari UI secara optimistik
  const deletedActivityIdsRef = useRef<Set<string>>(new Set());
  const deletedGoogleIdsRef = useRef<Set<string>>(new Set());
  const deletingIdsRef = useRef<Set<string>>(new Set());

  // State & rekonsiliasi pemindahan kegiatan berulang optimistik (zero-delay)
  const [optimisticRecurringMoves, setOptimisticRecurringMoves] = useState<OptimisticRecurringMove[]>([]);

  useEffect(() => {
    if (optimisticRecurringMoves.length === 0) return;
    setOptimisticRecurringMoves((prev) =>
      prev.filter((m) => {
        if (!m.realCreatedId) return true;
        // Hapus entri optimistik jika kegiatan asli dari server sudah masuk ke props activities
        return !activities.some((a) => a.id === m.realCreatedId);
      }),
    );
  }, [activities, optimisticRecurringMoves.length]);

  // Menggabungkan activities dari props dengan modifikasi master & kartu optimistik tanpa jeda
  const effectiveActivities = useMemo(() => {
    if (optimisticRecurringMoves.length === 0) {
      return activities.filter((act) => !deletedActivityIdsRef.current.has(act.id));
    }

    const modifiedMasters = new Map<string, RecurrenceConfig | null>();
    const extraActivities: DailyActivity[] = [];

    for (const move of optimisticRecurringMoves) {
      modifiedMasters.set(move.masterActivityId, move.updatedMasterRecurrence);
      if (move.optimisticActivity) {
        const hasRealInProps = move.realCreatedId && activities.some((a) => a.id === move.realCreatedId);
        if (!hasRealInProps) {
          extraActivities.push(move.optimisticActivity);
        }
      }
    }

    const updated = activities
      .filter((act) => !deletedActivityIdsRef.current.has(act.id))
      .map((act) => {
        if (modifiedMasters.has(act.id)) {
          const overridden = modifiedMasters.get(act.id);
          return {
            ...act,
            recurrence: overridden ?? undefined,
          };
        }
        return act;
      });

    return [...updated, ...extraActivities];
  }, [activities, optimisticRecurringMoves]);

  const googleEventsRequestRef = useRef(0);
  const nextUndoIdRef = useRef(1);
  const isUndoingRef = useRef(false);

  const onRefreshActivitiesRef = useRef(onRefreshActivities);
  onRefreshActivitiesRef.current = onRefreshActivities;

  const onDeleteActivityRef = useRef(onDeleteActivity);
  onDeleteActivityRef.current = onDeleteActivity;

  const { revision: calendarRevision, setRange: setSyncRange, change: calendarChange } = useCalendarSync();

  const {
    status: gcalStatus,
    disconnecting: gcalDisconnecting,
    connecting: gcalConnecting,
    connect: connectGcal,
    disconnect: disconnectGcal,
    fetchEvents,
    importEvents,
  } = useGoogleCalendar();

  const connectionRef = useRef(gcalStatus.connectionId);
  connectionRef.current = gcalStatus.connectionId;

  // Rentang waktu sinkronisasi Google Calendar berdasarkan bulan aktif
  const { rangeStart, rangeEnd } = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);

    const endDate = new Date(lastDayOfMonth);
    endDate.setDate(endDate.getDate() + 7);
    endDate.setHours(23, 59, 59, 999);

    return { rangeStart: startDate, rangeEnd: endDate };
  }, [currentYear, currentMonth]);

  // Muat event Google Calendar jika terhubung
  const loadGoogleEvents = useCallback(async () => {
    const requestId = ++googleEventsRequestRef.current;
    if (!gcalStatus.connected) {
      setGoogleEvents([]);
      return;
    }
    try {
      const events = await fetchEvents(rangeStart.toISOString(), rangeEnd.toISOString());
      if (requestId !== googleEventsRequestRef.current) return;
      // ID instance berulang berbeda: jangan sembunyikan seluruh rangkaian.
      const activeEvents = events.filter((g) => !deletedGoogleIdsRef.current.has(g.id));
      for (const [eventId, move] of linkedActivityMovesRef.current) {
        const event = activeEvents.find(candidate => candidate.id === eventId);
        if (move.saving) {
          updateLinkedActivityMove(eventId, { ...move, observedEvent: event });
        } else if (event && googleEventMatchesActivityTime(event, move.activity)) {
          updateLinkedActivityMove(eventId);
        }
      }
      setGoogleEvents(activeEvents);
    } catch (e) {
      console.error('Gagal memuat event Google Calendar:', e);
    }
  }, [gcalStatus.connected, gcalStatus.connectionId, fetchEvents, rangeStart, rangeEnd, updateLinkedActivityMove]);

  useEffect(() => {
    ++googleEventsRequestRef.current;
    setRecurringMovePrompt(null); setRecurringDeletePrompt(null);
    setGoogleEvents([]); setSelectedCardItem(null); setSelectedEvent(null);
    selectedCardItemRef.current = null; undoStackRef.current = [];
    deletedActivityIdsRef.current.clear(); deletedGoogleIdsRef.current.clear();
    deletingIdsRef.current.clear(); pendingActivityMoveIdsRef.current.clear();
    linkedActivityMovesRef.current = new Map();
    setLinkedActivityMoves(linkedActivityMovesRef.current);
    setOptimisticRecurringMoves([]);
    clearDragState();
  }, [gcalStatus.connectionId, gcalStatus.connected]);

  useEffect(() => {
    if (!calendarChange) return;
    ++googleEventsRequestRef.current;
    const activity = calendarChange.activity;
    if (activity?.googleEventId) {
      setGoogleEvents(previous => previous.map(event => event.id === activity.googleEventId ? {
        ...event, title: activity.title, description: activity.description,
        start: activity.startTime || activity.date.slice(0, 10),
        end: activity.endTime || activity.date.slice(0, 10),
        allDay: activity.allDay, colorId: activity.color,
      } : event));
    } else if (calendarChange.action === 'delete') {
      const id = calendarChange.googleEventId || calendarChange.eventId;
      setGoogleEvents(previous => previous.filter(event => event.id !== id && event.recurringEventId !== id));
    }
  }, [calendarChange]);

  useEffect(() => {
    for (const [eventId, move] of linkedActivityMoves) {
      const activity = activities.find(candidate => candidate.id === move.activity.id);
      if (!activity || activity.googleEventId !== eventId || activity.recurrence || deletedActivityIdsRef.current.has(activity.id)) {
        updateLinkedActivityMove(eventId);
      }
    }
  }, [activities, googleEvents, linkedActivityMoves, updateLinkedActivityMove]);

  const moveActivity = useCallback(async (
    activityId: string,
    position: Parameters<CalendarViewProps['onMoveActivity']>[1],
  ): Promise<DailyActivity> => {
    const original = activities.find(activity => activity.id === activityId);
    const eventId = original?.googleEventId;
    if (!gcalStatus.connected || !eventId || original.recurrence) {
      return onMoveActivity(activityId, position);
    }

    const previousMove = linkedActivityMovesRef.current.get(eventId);
    const move: LinkedActivityMove = {
      token: Symbol(), activity: { ...original, ...position }, saving: true,
    };
    // A response requested before this move cannot confirm its new position.
    ++googleEventsRequestRef.current;
    updateLinkedActivityMove(eventId, move);
    try {
      const saved = await onMoveActivity(activityId, position);
      const current = linkedActivityMovesRef.current.get(eventId);
      if (current?.token === move.token) {
        if (saved.googleEventId !== eventId || saved.recurrence ||
            (current.observedEvent && googleEventMatchesActivityTime(current.observedEvent, saved))) {
          updateLinkedActivityMove(eventId);
        } else {
          updateLinkedActivityMove(eventId, { ...current, activity: saved, saving: false });
        }
      }
      return saved;
    } catch (error) {
      if (linkedActivityMovesRef.current.get(eventId)?.token === move.token) {
        updateLinkedActivityMove(eventId, previousMove);
      }
      throw error;
    }
  }, [activities, gcalStatus.connected, onMoveActivity, updateLinkedActivityMove]);

  // Sinkronkan data kartu yang sedang dipilih saat data aktivitas/googleEvents diperbarui
  useEffect(() => {
    if (!selectedCardItem) return;
    if (selectedCardItem.type === 'activity') {
      const updated = effectiveActivities.find((a) => a.id === selectedCardItem.act.id);
      if (updated) {
        const instanceDate = selectedCardItem.instanceDate;
        const projected =
          updated.recurrence && instanceDate
            ? projectActivityOntoDate(updated, new Date(`${instanceDate}T12:00:00`))
            : updated;
        setSelectedCardItem({
          type: 'activity',
          id: selectedCardItem.id,
          act: updated,
          time: projected.startTime,
          instanceDate,
        });
      } else {
        setSelectedCardItem(null);
      }
    } else if (selectedCardItem.type === 'google') {
      const updated = googleEvents.find((g) => g.id === selectedCardItem.gEv.id);
      if (updated) {
        setSelectedCardItem({
          type: 'google',
          id: `gcal-${updated.id}`,
          gEv: updated,
          time: updated.start,
          instanceDate: selectedCardItem.instanceDate,
        });
      }
    }
  }, [effectiveActivities, googleEvents]);

  const [dragOverSlot, setDragOverSlot] = useState<{ dayDate: string; startMinutes: number } | null>(null);

  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const dragTimingRef = useRef<{ grabOffsetMinutes: number; durationMinutes: number } | null>(null);
  const pendingActivityMoveIdsRef = useRef<Set<string>>(new Set());

  const previewDropMinutes = (clientY: number, timelineColumn: HTMLElement) => {
    const timing = dragTimingRef.current;
    return getSnappedDropMinutes(
      clientY,
      timelineColumn,
      timing?.grabOffsetMinutes ?? 0,
      timing?.durationMinutes ?? 60,
    );
  };

  // Tangani kartu yang di-drop ke kalender dari sidebar atau ke atas kartu lain
  // Ref untuk item yang sedang dipilih agar event listener selalu mendapatkan nilai terbaru
  const selectedCardItemRef = useRef<CombinedItem | null>(null);
  selectedCardItemRef.current = selectedCardItem;

  // Stack riwayat untuk undo (Ctrl+Z)
  const undoStackRef = useRef<CalendarUndoAction[]>([]);

  const recordUndo = (action: CalendarUndoAction) => {
    // Pure LIFO: entri aksi terakhir selalu berada di ujung stack sehingga urutan Ctrl+Z persis terbalik dari urutan eksekusi
    undoStackRef.current.push(action);
    if (undoStackRef.current.length > 30) {
      undoStackRef.current.splice(0, undoStackRef.current.length - 30);
    }
  };

  // Fungsi membatalkan aksi terakhir (Undo / Ctrl+Z)
  const handleUndo = useCallback(async (actionId?: number) => {
    if (isUndoingRef.current) return;
    const index = actionId === undefined
      ? undoStackRef.current.length - 1
      : undoStackRef.current.findIndex((action) => action.id === actionId);
    if (index < 0) {
      showToast('Tidak ada kegiatan yang bisa diurungkan.');
      return;
    }

    isUndoingRef.current = true;
    try {
      const [last] = undoStackRef.current.splice(index, 1);
      if (!last) return;

      if (last.type === 'move-calendar-card') {
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`Posisi kegiatan "${last.title}" dikembalikan.`);

        if (last.itemType !== 'activity') {
          setGoogleEvents((prev) =>
            prev.map((g) => {
              if (g.id !== last.rawId) return g;
              const datePrefix = last.prevDate || (g.start && g.start.includes('T') ? g.start.split('T')[0] : g.start);
              const newStart = last.prevStartTime
                ? (last.prevStartTime.includes('T') ? last.prevStartTime : `${datePrefix}T${last.prevStartTime}`)
                : g.start;
              const newEnd = last.prevEndTime
                ? (last.prevEndTime.includes('T') ? last.prevEndTime : `${datePrefix}T${last.prevEndTime}`)
                : g.end;
              return { ...g, start: newStart, end: newEnd };
            }),
          );
        }
        isUndoingRef.current = false;

        try {
          if (last.itemType === 'activity') {
            await moveActivity(last.rawId, {
              ...(last.prevDate ? { date: last.prevDate } : {}),
              startTime: last.prevStartTime,
              endTime: last.prevEndTime,
              ...(last.prevAllDay !== undefined ? { allDay: last.prevAllDay } : {}),
              ...(last.prevRecurrence !== undefined ? { recurrence: last.prevRecurrence } : {}),
            });
          } else {
            await calendarApi.updateEvent(last.rawId, {
              ...(last.prevDate ? { date: last.prevDate } : {}),
              startTime: last.prevStartTime,
              endTime: last.prevEndTime,
            });
          }

          onRefreshActivities?.();
          void loadGoogleEvents();
        } catch (err) {
          console.error('[CalendarView] Gagal mengembalikan posisi kegiatan:', err);
          onRefreshActivities?.();
          void loadGoogleEvents();
          showToast('Gagal mengembalikan posisi kegiatan.');
          recordUndo(last);
        }
        return;
      }

      if (last.type === 'drag-from-sidebar-item') {
        const act = activities.find((a) => a.id === last.activityId);
        const gId = last.googleEventId || act?.googleEventId;
        if (gId) {
          deletedGoogleIdsRef.current.add(gId);
          setGoogleEvents((prev) => prev.filter((g) => g.id !== gId));
        }

        deletedActivityIdsRef.current.add(last.activityId);
        onDeleteActivity?.(last.activityId);
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`"${last.title}" dikembalikan ke menu "Belum di kalender".`);
        isUndoingRef.current = false;

        try {
          await activityApi.update(last.activityId, {
            startTime: null,
            endTime: null,
            ...(last.prevDate ? { date: last.prevDate } : {}),
          });
          deletedActivityIdsRef.current.delete(last.activityId);
          onRefreshActivities?.();
        } catch (err) {
          console.error('[CalendarView] Gagal mengembalikan item ke menu:', err);
          deletedActivityIdsRef.current.delete(last.activityId);
          if (gId) deletedGoogleIdsRef.current.delete(gId);
          onRefreshActivities?.();
          showToast('Gagal mengembalikan item ke menu.');
          recordUndo(last);
        }
        return;
      }

      if (last.type === 'drag-from-sidebar-team-task' || last.type === 'drag-from-sidebar-personal-task') {
        const act = activities.find((a) => a.id === last.createdActivityId);
        const gId = last.googleEventId || act?.googleEventId;
        if (gId) {
          deletedGoogleIdsRef.current.add(gId);
          setGoogleEvents((prev) => prev.filter((g) => g.id !== gId));
        }

        deletedActivityIdsRef.current.add(last.createdActivityId);
        onDeleteActivity?.(last.createdActivityId);
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`${last.type === 'drag-from-sidebar-personal-task' ? 'Tugas pribadi' : 'Tugas'} "${last.title}" dikembalikan ke menu "Belum di kalender".`);
        isUndoingRef.current = false;

        try {
          await activityApi.remove(last.createdActivityId);
          deletedActivityIdsRef.current.delete(last.createdActivityId);
          onRefreshActivities?.();
        } catch (err) {
          console.error('[CalendarView] Gagal mengembalikan tugas ke menu:', err);
          deletedActivityIdsRef.current.delete(last.createdActivityId);
          if (gId) deletedGoogleIdsRef.current.delete(gId);
          onRefreshActivities?.();
          showToast('Gagal mengembalikan tugas ke menu.');
          recordUndo(last);
        }
        return;
      }

      if (last.type === 'recurring-move-this-event' || last.type === 'recurring-edit-this-event') {
        const masterAct = activities.find((a) => a.id === last.masterActivityId);
        const undoId = `undo-this-event-${Date.now()}-${Math.random()}`;
        const undoEntry: OptimisticRecurringMove = {
          id: undoId,
          masterActivityId: last.masterActivityId,
          scope: 'THIS_EVENT',
          updatedMasterRecurrence: {
            ...(masterAct?.recurrence || {}),
            excludeDates: last.prevExcludeDates,
          },
        };

        deletedActivityIdsRef.current.add(last.createdActivityId);
        onDeleteActivity?.(last.createdActivityId);
        setOptimisticRecurringMoves((prev) => [
          ...prev.filter((m) => m.masterActivityId !== last.masterActivityId && m.realCreatedId !== last.createdActivityId),
          undoEntry,
        ]);
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`Perubahan kegiatan "${last.title}" pada ${last.instanceDateStr} diurungkan.`);
        isUndoingRef.current = false;

        try {
          await activityApi.remove(last.createdActivityId);
          await activityApi.update(last.masterActivityId, {
            recurrence: {
              ...(masterAct?.recurrence || {}),
              excludeDates: last.prevExcludeDates,
            },
          });
          await onRefreshActivities?.();
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== undoId));
          deletedActivityIdsRef.current.delete(last.createdActivityId);
        } catch (err) {
          console.error('[CalendarView] Gagal mengurungkan aksi this-event:', err);
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== undoId));
          deletedActivityIdsRef.current.delete(last.createdActivityId);
          onRefreshActivities?.();
          recordUndo(last);
          showToast('Gagal mengurungkan perubahan kegiatan.');
        }
        return;
      }

      if (last.type === 'recurring-move-following' || last.type === 'recurring-edit-following') {
        const undoId = `undo-following-${Date.now()}-${Math.random()}`;
        const undoEntry: OptimisticRecurringMove = {
          id: undoId,
          masterActivityId: last.masterActivityId,
          scope: 'THIS_AND_FOLLOWING',
          updatedMasterRecurrence: last.prevRecurrence,
        };

        deletedActivityIdsRef.current.add(last.createdActivityId);
        onDeleteActivity?.(last.createdActivityId);
        setOptimisticRecurringMoves((prev) => [
          ...prev.filter((m) => m.masterActivityId !== last.masterActivityId && m.realCreatedId !== last.createdActivityId),
          undoEntry,
        ]);
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`Perubahan kegiatan "${last.title}" dan seterusnya diurungkan.`);
        isUndoingRef.current = false;

        try {
          await activityApi.remove(last.createdActivityId);
          await activityApi.update(last.masterActivityId, {
            recurrence: last.prevRecurrence,
          });
          await onRefreshActivities?.();
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== undoId));
          deletedActivityIdsRef.current.delete(last.createdActivityId);
        } catch (err) {
          console.error('[CalendarView] Gagal mengurungkan aksi following:', err);
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== undoId));
          deletedActivityIdsRef.current.delete(last.createdActivityId);
          onRefreshActivities?.();
          recordUndo(last);
          showToast('Gagal mengurungkan perubahan kegiatan.');
        }
        return;
      }

      if (last.type === 'recurring-delete-this-event') {
        const masterAct = activities.find((a) => a.id === last.masterActivityId);
        const undoId = `undo-del-this-${Date.now()}-${Math.random()}`;
        const undoEntry: OptimisticRecurringMove = {
          id: undoId,
          masterActivityId: last.masterActivityId,
          scope: 'THIS_EVENT',
          updatedMasterRecurrence: {
            ...(masterAct?.recurrence || {}),
            excludeDates: last.prevExcludeDates,
          },
        };

        setOptimisticRecurringMoves((prev) => [
          ...prev.filter((m) => m.masterActivityId !== last.masterActivityId),
          undoEntry,
        ]);
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`Penghapusan kegiatan "${last.title}" pada ${last.instanceDateStr} diurungkan.`);
        isUndoingRef.current = false;

        try {
          await activityApi.update(last.masterActivityId, {
            recurrence: {
              ...(masterAct?.recurrence || {}),
              excludeDates: last.prevExcludeDates,
            },
          });
          await onRefreshActivities?.();
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== undoId));
        } catch (err) {
          console.error('[CalendarView] Gagal mengurungkan penghapusan this-event:', err);
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== undoId));
          onRefreshActivities?.();
          recordUndo(last);
          showToast('Gagal mengurungkan penghapusan kegiatan.');
        }
        return;
      }

      if (last.type === 'recurring-delete-following') {
        const undoId = `undo-del-following-${Date.now()}-${Math.random()}`;
        const undoEntry: OptimisticRecurringMove = {
          id: undoId,
          masterActivityId: last.masterActivityId,
          scope: 'THIS_AND_FOLLOWING',
          updatedMasterRecurrence: last.prevRecurrence,
        };

        setOptimisticRecurringMoves((prev) => [
          ...prev.filter((m) => m.masterActivityId !== last.masterActivityId),
          undoEntry,
        ]);
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`Penghapusan kegiatan "${last.title}" dan seterusnya diurungkan.`);
        isUndoingRef.current = false;

        try {
          await activityApi.update(last.masterActivityId, {
            recurrence: last.prevRecurrence,
          });
          await onRefreshActivities?.();
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== undoId));
        } catch (err) {
          console.error('[CalendarView] Gagal mengurungkan penghapusan following:', err);
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== undoId));
          onRefreshActivities?.();
          recordUndo(last);
          showToast('Gagal mengurungkan penghapusan kegiatan.');
        }
        return;
      }

      if (last.type === 'card-settings-update') {
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`Pengaturan kegiatan "${last.title}" dikembalikan.`);
        isUndoingRef.current = false;

        try {
          await activityApi.update(last.activityId, {
            title: last.prevSnapshot.title,
            startTime: last.prevSnapshot.startTime,
            endTime: last.prevSnapshot.endTime,
            ...(last.prevSnapshot.date ? { date: last.prevSnapshot.date } : {}),
            color: last.prevSnapshot.color,
            allDay: last.prevSnapshot.allDay,
            recurrence: last.prevSnapshot.recurrence,
          });
          onRefreshActivities?.();
        } catch (err) {
          console.error('[CalendarView] Gagal mengembalikan pengaturan kegiatan:', err);
          onRefreshActivities?.();
          recordUndo(last);
          showToast('Gagal mengembalikan pengaturan kegiatan.');
        }
        return;
      }

      if (last.type === 'delete') {
        const { item, title } = last;
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        showToast(`Kegiatan "${title}" dipulihkan.`);

        if (item.type === 'activity') {
          deletedActivityIdsRef.current.delete(item.act.id);
        } else {
          deletedGoogleIdsRef.current.delete(item.gEv.id);
          setGoogleEvents((prev) => prev.some((g) => g.id === item.gEv.id) ? prev : [...prev, item.gEv]);
        }
        isUndoingRef.current = false;

        try {
          await last.pendingDelete;
          if (item.type === 'activity') {
            const act = item.act;
            await activityApi.create({
              title: act.title || 'Tanpa judul',
              description: act.description || undefined,
              date: act.date ? new Date(act.date).toISOString() : new Date().toISOString(),
              startTime: act.startTime || undefined,
              endTime: act.endTime || undefined,
              allDay: act.allDay,
              type: act.type || 'CUSTOM',
              status: act.status || 'PENDING',
              taskId: act.taskId || undefined,
              icon: act.icon || undefined,
              color: act.color || undefined,
              recurrence: act.recurrence ?? undefined,
              order: act.order ?? 0,
              createdAt: act.createdAt || undefined,
              customValues: act.customValues ?? undefined,
              checklist: act.checklistItems?.length ? act.checklistItems.map((c) => ({ text: c.text })) : undefined,
            });
          } else {
            const gEv = item.gEv;
            const createdG = await calendarApi.createEvent({
              title: gEv.title || 'Event Google',
              description: gEv.description || undefined,
              date: gEv.start && !gEv.start.includes('T') ? gEv.start : undefined,
              startTime: gEv.start && gEv.start.includes('T') ? gEv.start : undefined,
              endTime: gEv.end && gEv.end.includes('T') ? gEv.end : undefined,
            });
            const restoredGEv = { ...gEv, id: createdG.id };
            googleEventsRequestRef.current++;
            setGoogleEvents((prev) => prev.some((g) => g.id === createdG.id) ? prev : [...prev.filter((g) => g.id !== item.gEv.id), restoredGEv]);
          }

          onRefreshActivities?.();
          void loadGoogleEvents();
        } catch (err) {
          console.error('[CalendarView] Gagal memulihkan kegiatan:', err);
          if (item.type === 'activity') {
            deletedActivityIdsRef.current.add(item.act.id);
          } else {
            deletedGoogleIdsRef.current.add(item.gEv.id);
            setGoogleEvents((prev) => prev.filter((g) => g.id !== item.gEv.id));
          }
          recordUndo(last);
          showToast('Gagal memulihkan kegiatan. Coba urungkan lagi.');
        }
        return;
      }
    } finally {
      isUndoingRef.current = false;
    }
  }, [onRefreshActivities, onDeleteActivity, loadGoogleEvents, moveActivity, activities]);

  // Fungsi internal menghapus kartu terpilih
  const executeDeleteCard = useCallback(
    async (itemToDelete: CombinedItem) => {
      const isAct = itemToDelete.type === 'activity';
      const act = isAct ? itemToDelete.act : null;
      const gEv = !isAct ? itemToDelete.gEv : null;
      const title = (isAct ? act?.title : gEv?.title) || 'Tanpa judul';

      const targetActId = isAct ? act?.id : null;
      const targetGoogleId = isAct ? act?.googleEventId : gEv?.id;
      const targetId = targetActId || targetGoogleId;
      if (!targetId) return;

      if (deletingIdsRef.current.has(targetId)) return;
      deletingIdsRef.current.add(targetId);

      // Segera reset kartu terpilih agar event keyboard/klik berikutnya tidak menghapus ganda kartu yang sama
      selectedCardItemRef.current = null;
      setSelectedCardItem(null);

      const actionId = nextUndoIdRef.current++;
      // Sembunyikan kartu segera, lalu simpan urutan aksi saat tombol ditekan.
      if (targetActId) {
        deletedActivityIdsRef.current.add(targetActId);
        onDeleteActivity?.(targetActId);
      }
      if (targetGoogleId) {
        googleEventsRequestRef.current++;
        deletedGoogleIdsRef.current.add(targetGoogleId);
        setGoogleEvents((prev) => prev.filter((g) => g.id !== targetGoogleId));
      }

      const pendingDelete = isAct && act
        ? activityApi.remove(act.id).then(() => undefined)
        : calendarApi.deleteEvent(gEv!.id).then(() => undefined);
      recordUndo({ id: actionId, type: 'delete', item: itemToDelete, title, pendingDelete });

      showToast(`Kegiatan "${title}" dihapus`, {
        label: 'Urungkan (Ctrl+Z)',
        onAction: () => {
          void handleUndo(actionId);
        },
      });

      try {
        await pendingDelete;

      } catch (err) {
        console.error('[CalendarView] Gagal menghapus kegiatan:', err);
        if (gEv) setGoogleEvents(events => events.some(event => event.id === gEv.id) ? events : [...events, gEv]);
        // Rollback optimistic delete & keluarkan entri dari stack jika request gagal
        undoStackRef.current = undoStackRef.current.filter((a) => a.id !== actionId);
        if (targetActId) deletedActivityIdsRef.current.delete(targetActId);
        if (targetGoogleId) {
          deletedGoogleIdsRef.current.delete(targetGoogleId);
        }
        if (onRefreshActivities) onRefreshActivities();

        showToast('Gagal menghapus kegiatan.');
        throw err;
      } finally {
        deletingIdsRef.current.delete(targetId);
      }
    },
    [onRefreshActivities, onDeleteActivity, handleUndo],
  );

  const handleConfirmRecurringDelete = async (scope: RecurrenceEditScope) => {
    if (!recurringDeletePrompt) return;
    const { item, instanceDateStr } = recurringDeletePrompt;
    setRecurringDeletePrompt(null);

    const isAct = item.type === 'activity';
    const act = isAct ? item.act : null;
    const title = (isAct ? act?.title : null) || 'Tanpa judul';

    if (scope === 'ALL_EVENTS') {
      await executeDeleteCard(item);
      return;
    }

    if (scope === 'THIS_EVENT') {
      const actionId = nextUndoIdRef.current++;
      if (isAct && act && act.recurrence) {
        const prevExcludeDates = [...(act.recurrence.excludeDates || [])];
        const updatedExcludeDates = [...prevExcludeDates, instanceDateStr];
        await activityApi.update(act.id, {
          recurrence: {
            ...act.recurrence,
            excludeDates: updatedExcludeDates,
          },
        });
        recordUndo({
          id: actionId,
          type: 'recurring-delete-this-event',
          masterActivityId: act.id,
          prevExcludeDates,
          instanceDateStr,
          title,
        });
      }
      selectedCardItemRef.current = null;
      setSelectedCardItem(null);
      onRefreshActivities?.();
      showToast(`Kegiatan "${title}" pada ${instanceDateStr} dihapus`, {
        label: 'Urungkan (Ctrl+Z)',
        onAction: () => {
          void handleUndo(actionId);
        },
      });
      return;
    }

    if (scope === 'THIS_AND_FOLLOWING') {
      const actionId = nextUndoIdRef.current++;
      if (isAct && act && act.recurrence) {
        const prevRecurrence = { ...act.recurrence };
        const dayBefore = getDayBefore(instanceDateStr);
        await activityApi.update(act.id, {
          recurrence: {
            ...act.recurrence,
            endType: 'ON_DATE',
            untilDate: dayBefore,
          },
        });
        recordUndo({
          id: actionId,
          type: 'recurring-delete-following',
          masterActivityId: act.id,
          prevRecurrence,
          title,
        });
      }
      selectedCardItemRef.current = null;
      setSelectedCardItem(null);
      onRefreshActivities?.();
      showToast(`Kegiatan "${title}" dan seterusnya dihapus`, {
        label: 'Urungkan (Ctrl+Z)',
        onAction: () => {
          void handleUndo(actionId);
        },
      });
      return;
    }
  };

  // Fungsi menghapus kartu terpilih (mendukung prompt kegiatan berulang)
  const handleDeleteCard = useCallback(
    async (itemToDelete: CombinedItem, forceAll = false) => {
      const isAct = itemToDelete.type === 'activity';
      const act = isAct ? itemToDelete.act : null;

      if (!forceAll && isAct && act?.recurrence) {
        const instanceDateStr =
          itemToDelete.instanceDate ||
          toISODate(new Date(itemToDelete.time || act.date));
        setRecurringDeletePrompt({
          isOpen: true,
          item: itemToDelete,
          instanceDateStr,
        });
        return;
      }

      await executeDeleteCard(itemToDelete);
    },
    [executeDeleteCard],
  );

  const handleConfirmRecurringMove = async (scope: RecurrenceEditScope) => {
    if (!recurringMovePrompt) return;
    const { activity: originalAct, payload, targetDate, startMinutes, durationMinutes, instanceDateStr } = recurringMovePrompt;
    setRecurringMovePrompt(null);

    const actionId = nextUndoIdRef.current++;
    const newStart = dateAtMinutes(targetDate, startMinutes);
    const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);
    const newStartTimeStr = newStart.toISOString();
    const newEndTimeStr = newEnd.toISOString();
    const newDateStr = new Date(newStart.getFullYear(), newStart.getMonth(), newStart.getDate(), 0, 0, 0, 0).toISOString();

    if (payload.itemType === 'google') {
      try {
        await calendarApi.updateEvent(payload.id, {
          date: newDateStr,
          startTime: newStartTimeStr,
          endTime: newEndTimeStr,
          scope,
          instanceDate: instanceDateStr,
        });

        recordUndo({
          id: actionId,
          type: 'move-calendar-card',
          itemType: 'google',
          rawId: payload.id,
          title: payload.title,
          prevDate: payload.originalDate || null,
          prevStartTime: payload.originalStartTime || null,
          prevEndTime: payload.originalEndTime || null,
          prevAllDay: payload.originalAllDay,
        });

        onRefreshActivities?.();
        void loadGoogleEvents();

        showToast(`Kegiatan "${payload.title}" dipindahkan`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo(actionId);
          },
        });
      } catch {
        showToast('Gagal memindahkan kegiatan Google Calendar');
      }
      return;
    }

    if (!originalAct) return;
    if (pendingActivityMoveIdsRef.current.has(payload.id)) return;
    pendingActivityMoveIdsRef.current.add(payload.id);

    try {
      if (scope === 'ALL_EVENTS') {
        const origDateObj = new Date(originalAct.date || originalAct.startTime || newStart);
        const origAnchorDate = new Date(origDateObj.getFullYear(), origDateObj.getMonth(), origDateObj.getDate(), 0, 0, 0, 0);
        const targetMidnight = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);

        const finalAnchorDate = targetMidnight < origAnchorDate ? targetMidnight : origAnchorDate;

        let nextRecurrence: RecurrenceConfig | null = originalAct.recurrence ? { ...originalAct.recurrence } : null;
        const prevRecurrence = originalAct.recurrence ? { ...originalAct.recurrence } : null;

        if (nextRecurrence) {
          const sourceDateObj = payload.cardDate ? new Date(`${payload.cardDate}T12:00:00`) : origDateObj;
          const sourceDay = sourceDateObj.getDay();
          const targetDay = targetDate.getDay();

          if (nextRecurrence.freq === 'WEEKLY' && sourceDay !== targetDay) {
            const currentDays = nextRecurrence.byDays && nextRecurrence.byDays.length > 0
              ? nextRecurrence.byDays
              : [sourceDay];
            const updatedDays = currentDays.includes(sourceDay)
              ? currentDays.map((d) => (d === sourceDay ? targetDay : d))
              : [...currentDays, targetDay];
            nextRecurrence.byDays = [...new Set(updatedDays)].sort((a, b) => a - b);
          } else if (nextRecurrence.freq === 'MONTHLY' && !isSameDay(sourceDateObj, targetDate)) {
            if (nextRecurrence.byWeekOfMonth !== undefined && nextRecurrence.byWeekOfMonth !== null) {
              const { week, dayOfWeek } = getNthWeekdayInfo(targetDate);
              nextRecurrence.byWeekOfMonth = { week, dayOfWeek };
            } else {
              nextRecurrence.byMonthDay = targetDate.getDate();
            }
          }
        }

        const seriesStart = dateAtMinutes(finalAnchorDate, startMinutes);
        const seriesEnd = new Date(seriesStart.getTime() + durationMinutes * 60 * 1000);

        await onMoveActivity(payload.id, {
          date: finalAnchorDate.toISOString(),
          startTime: seriesStart.toISOString(),
          endTime: seriesEnd.toISOString(),
          allDay: false,
          recurrence: nextRecurrence,
        });

        recordUndo({
          id: actionId,
          type: 'move-calendar-card',
          itemType: 'activity',
          rawId: payload.id,
          title: payload.title,
          prevDate: payload.originalDate || null,
          prevStartTime: payload.originalStartTime || null,
          prevEndTime: payload.originalEndTime || null,
          prevAllDay: payload.originalAllDay,
          prevRecurrence,
        });

        onRefreshActivities?.();
        void loadGoogleEvents();

        showToast(`Kegiatan "${payload.title}" dipindahkan`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo(actionId);
          },
        });
        return;
      }

      if (scope === 'THIS_EVENT') {
        const prevExcludeDates = [...(originalAct.recurrence?.excludeDates || [])];
        const updatedExcludeDates = [...prevExcludeDates, instanceDateStr];

        // Optimistic UI Update: seketika tanpa delay
        const optimisticId = `optimistic-exc-${Date.now()}`;
        const optimisticAct: DailyActivity = {
          ...originalAct,
          id: optimisticId,
          date: newDateStr,
          startTime: newStartTimeStr,
          endTime: newEndTimeStr,
          allDay: false,
          recurrence: {
            isException: true,
            masterActivityId: originalAct.id,
          },
        };
        const moveEntry: OptimisticRecurringMove = {
          id: optimisticId,
          masterActivityId: originalAct.id,
          scope: 'THIS_EVENT',
          updatedMasterRecurrence: {
            ...originalAct.recurrence,
            excludeDates: updatedExcludeDates,
          },
          optimisticActivity: optimisticAct,
        };
        setOptimisticRecurringMoves((prev) => [...prev, moveEntry]);

        try {
          await activityApi.update(originalAct.id, {
            recurrence: {
              ...originalAct.recurrence,
              excludeDates: updatedExcludeDates,
            },
          });

          const created = await activityApi.create({
            title: originalAct.title || 'Tanpa judul',
            description: originalAct.description,
            date: newDateStr,
            startTime: newStartTimeStr,
            endTime: newEndTimeStr,
            allDay: false,
            type: originalAct.type || 'CUSTOM',
            status: originalAct.status || 'PENDING',
            icon: originalAct.icon ?? undefined,
            color: originalAct.color,
            recurrence: originalAct.recurrence
              ? {
                  isException: true,
                  masterActivityId: originalAct.id,
                }
              : null,
          });

          // Catat real id untuk rekonsiliasi mulus setelah fetch
          setOptimisticRecurringMoves((prev) =>
            prev.map((m) => (m.id === optimisticId ? { ...m, realCreatedId: created.id } : m)),
          );

          recordUndo({
            id: actionId,
            type: 'recurring-move-this-event',
            createdActivityId: created.id,
            masterActivityId: originalAct.id,
            prevExcludeDates,
            instanceDateStr,
            title: payload.title,
          });

          onRefreshActivities?.();
          void loadGoogleEvents();
          showToast(`Kegiatan "${payload.title}" dipindahkan`, {
            label: 'Urungkan (Ctrl+Z)',
            onAction: () => {
              void handleUndo(actionId);
            },
          });
        } catch (createErr) {
          console.error('[CalendarView] Gagal membuat exception event, membatalkan perubahan master:', createErr);
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== optimisticId));
          await activityApi.update(originalAct.id, {
            recurrence: {
              ...originalAct.recurrence,
              excludeDates: prevExcludeDates,
            },
          }).catch((rollbackErr) => {
            console.error('[CalendarView] Gagal rollback master activity:', rollbackErr);
          });
          onRefreshActivities?.();
          showToast('Gagal memindahkan kegiatan berulang. Perubahan dibatalkan.');
        }
        return;
      }

      if (scope === 'THIS_AND_FOLLOWING') {
        const prevRecurrence = originalAct.recurrence ? { ...originalAct.recurrence } : null;
        const dayBefore = getDayBefore(instanceDateStr);

        let nextRecurrence: RecurrenceConfig | null = originalAct.recurrence
          ? {
              ...originalAct.recurrence,
              excludeDates: (originalAct.recurrence.excludeDates || []).filter(
                (d) => d >= toISODate(targetDate),
              ),
            }
          : null;
        if (nextRecurrence) {
          delete (nextRecurrence as Record<string, unknown>).isException;
          delete (nextRecurrence as Record<string, unknown>).masterActivityId;
          if (!nextRecurrence.freq) {
            nextRecurrence.freq = 'DAILY';
          }
          const sourceDateObj = new Date(`${instanceDateStr}T12:00:00`);
          const sourceDay = sourceDateObj.getDay();
          const targetDay = targetDate.getDay();
          if (nextRecurrence.freq === 'WEEKLY' && sourceDay !== targetDay) {
            const currentDays = nextRecurrence.byDays && nextRecurrence.byDays.length > 0
              ? nextRecurrence.byDays
              : [sourceDay];
            const updatedDays = currentDays.includes(sourceDay)
              ? currentDays.map((d) => (d === sourceDay ? targetDay : d))
              : [...currentDays, targetDay];
            nextRecurrence.byDays = [...new Set(updatedDays)].sort((a, b) => a - b);
          } else if (nextRecurrence.freq === 'MONTHLY' && !isSameDay(sourceDateObj, targetDate)) {
            if (nextRecurrence.byWeekOfMonth !== undefined && nextRecurrence.byWeekOfMonth !== null) {
              const { week, dayOfWeek } = getNthWeekdayInfo(targetDate);
              nextRecurrence.byWeekOfMonth = { week, dayOfWeek };
            } else {
              nextRecurrence.byMonthDay = targetDate.getDate();
            }
          }
        }

        // Optimistic UI Update: seketika tanpa delay
        const optimisticId = `optimistic-foll-${Date.now()}`;
        const optimisticAct: DailyActivity = {
          ...originalAct,
          id: optimisticId,
          date: newDateStr,
          startTime: newStartTimeStr,
          endTime: newEndTimeStr,
          allDay: false,
          recurrence: nextRecurrence,
        };
        const moveEntry: OptimisticRecurringMove = {
          id: optimisticId,
          masterActivityId: originalAct.id,
          scope: 'THIS_AND_FOLLOWING',
          updatedMasterRecurrence: {
            ...originalAct.recurrence,
            endType: 'ON_DATE',
            untilDate: dayBefore,
          },
          optimisticActivity: optimisticAct,
        };
        setOptimisticRecurringMoves((prev) => [...prev, moveEntry]);

        try {
          await activityApi.update(originalAct.id, {
            recurrence: {
              ...originalAct.recurrence,
              endType: 'ON_DATE',
              untilDate: dayBefore,
            },
          });

          const created = await activityApi.create({
            title: originalAct.title || 'Tanpa judul',
            description: originalAct.description,
            date: newDateStr,
            startTime: newStartTimeStr,
            endTime: newEndTimeStr,
            allDay: false,
            type: originalAct.type || 'CUSTOM',
            status: originalAct.status || 'PENDING',
            icon: originalAct.icon ?? undefined,
            color: originalAct.color,
            recurrence: nextRecurrence,
          });

          // Catat real id untuk rekonsiliasi mulus setelah fetch
          setOptimisticRecurringMoves((prev) =>
            prev.map((m) => (m.id === optimisticId ? { ...m, realCreatedId: created.id } : m)),
          );

          recordUndo({
            id: actionId,
            type: 'recurring-move-following',
            createdActivityId: created.id,
            masterActivityId: originalAct.id,
            prevRecurrence,
            title: payload.title,
          });

          onRefreshActivities?.();
          void loadGoogleEvents();
          showToast(`Kegiatan "${payload.title}" dan seterusnya dipindahkan`, {
            label: 'Urungkan (Ctrl+Z)',
            onAction: () => {
              void handleUndo(actionId);
            },
          });
        } catch (createErr) {
          console.error('[CalendarView] Gagal membuat seri perulangan baru, membatalkan perubahan master:', createErr);
          setOptimisticRecurringMoves((prev) => prev.filter((m) => m.id !== optimisticId));
          await activityApi.update(originalAct.id, {
            recurrence: prevRecurrence,
          }).catch((rollbackErr) => {
            console.error('[CalendarView] Gagal rollback master activity:', rollbackErr);
          });
          onRefreshActivities?.();
          showToast('Gagal memindahkan kegiatan berulang. Perubahan dibatalkan.');
        }
        return;
      }
    } finally {
      pendingActivityMoveIdsRef.current.delete(payload.id);
    }
  };

  // Tangani kartu yang di-drop ke kalender dari sidebar atau perpindahan kartu kalender
  const handleDropPayload = async (
    targetDate: Date,
    requestedStartMinutes: number,
    rawJson: string,
  ) => {
    if (!rawJson) return;
    try {
      const payload = JSON.parse(rawJson) as {
        source: 'item' | 'team-task' | 'personal-task' | 'calendar-card';
        id: string;
        title: string;
        taskId?: string;
        type?: DailyActivity['type'];
        itemType?: 'activity' | 'google';
        fullId?: string;
        cardDate?: string | null;
        cardStartTime?: string | null;
        cardEndTime?: string | null;
        hasRecurrence?: boolean;
        recurrence?: RecurrenceConfig | null;
        recurringEventId?: string | null;
        originalDate?: string | null;
        originalStartTime?: string | null;
        originalEndTime?: string | null;
        originalAllDay?: boolean;
        durationMinutes?: number;
      };

      const durationMinutes = payload.source === 'calendar-card' ? payload.durationMinutes || 60 : 60;
      const latestStartMinutes = Math.max(0, 24 * 60 - durationMinutes);
      const startMinutes = Math.min(requestedStartMinutes, latestStartMinutes);
      const newStart = dateAtMinutes(targetDate, startMinutes);
      const newEnd = new Date(newStart.getTime() + durationMinutes * 60 * 1000);

      // 1. Kasus pemindahan kartu kalender (Drag & Drop antar slot atau tanggal)
      if (payload.source === 'calendar-card') {
        const newStartTimeStr = newStart.toISOString();
        const newEndTimeStr = newEnd.toISOString();

        // Cek apakah posisi dan waktu sama persis (tidak ada perpindahan)
        const isSameTime = (
          (payload.cardStartTime && new Date(payload.cardStartTime).getTime() === newStart.getTime() &&
           payload.cardEndTime && new Date(payload.cardEndTime).getTime() === newEnd.getTime()) ||
          (payload.originalStartTime &&
           new Date(payload.originalStartTime).getTime() === newStart.getTime() &&
           payload.originalEndTime &&
           new Date(payload.originalEndTime).getTime() === newEnd.getTime())
        );
        if (isSameTime && (!payload.cardDate || payload.cardDate === toISODate(targetDate))) {
          return;
        }

        const newDateStr = new Date(newStart.getFullYear(), newStart.getMonth(), newStart.getDate(), 0, 0, 0, 0).toISOString();

        let actionId: number;
        if (payload.itemType === 'activity') {
          if (pendingActivityMoveIdsRef.current.has(payload.id)) return;
          let originalAct = activities.find((a) => a.id === payload.id);
          if (originalAct?.googleEventId?.includes('_')) {
            const baseId = originalAct.googleEventId.split('_')[0];
            const master = activities.find((a) => a.googleEventId === baseId);
            if (master) originalAct = master;
          }
          const isRepeating = Boolean(
            (payload.hasRecurrence || originalAct?.recurrence) &&
            (!originalAct?.recurrence?.isException || !originalAct?.recurrence?.masterActivityId)
          );

          if (isRepeating && originalAct) {
            const instanceDateStr = payload.cardDate || toISODate(new Date(payload.cardStartTime || originalAct.startTime || originalAct.date));
            setRecurringMovePrompt({
              isOpen: true,
              activity: originalAct,
              payload,
              targetDate,
              startMinutes,
              durationMinutes,
              instanceDateStr,
            });
            return;
          }

          actionId = nextUndoIdRef.current++;
          pendingActivityMoveIdsRef.current.add(payload.id);
          try {
            await moveActivity(payload.id, {
              date: newDateStr,
              startTime: newStartTimeStr,
              endTime: newEndTimeStr,
              allDay: false,
            });
          } finally {
            pendingActivityMoveIdsRef.current.delete(payload.id);
          }

        } else {
          const gEv = googleEvents.find((g) => g.id === payload.id);
          const isGoogleRepeating = Boolean(
            payload.hasRecurrence ||
            payload.recurringEventId ||
            gEv?.recurringEventId ||
            payload.id.includes('_')
          );

          if (isGoogleRepeating) {
            const instanceDateStr = payload.cardDate || toISODate(new Date(payload.cardStartTime || gEv?.start || targetDate));
            setRecurringMovePrompt({
              isOpen: true,
              googleEvent: gEv,
              payload,
              targetDate,
              startMinutes,
              durationMinutes,
              instanceDateStr,
            });
            return;
          }

          actionId = nextUndoIdRef.current++;
          setGoogleEvents((prev) =>
            prev.map((g) =>
              g.id === payload.id
                ? { ...g, start: newStartTimeStr, end: newEndTimeStr }
                : g,
            ),
          );

          await calendarApi.updateEvent(payload.id, {
            date: newDateStr,
            startTime: newStartTimeStr,
            endTime: newEndTimeStr,
          });
        }

        recordUndo({
          id: actionId,
          type: 'move-calendar-card',
          itemType: payload.itemType || 'activity',
          rawId: payload.id,
          title: payload.title,
          prevDate: payload.originalDate || null,
          prevStartTime: payload.originalStartTime || null,
          prevEndTime: payload.originalEndTime || null,
          prevAllDay: payload.originalAllDay,
        });

        showToast(`Kegiatan "${payload.title}" dipindahkan`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo(actionId);
          },
        });
        return;
      }

      // 2. Kasus drop dari sidebar (item atau team-task)
      const actionId = nextUndoIdRef.current++;
      const dateStr = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0).toISOString();

      const startTimeStr = newStart.toISOString();
      const endTimeStr = newEnd.toISOString();

      if (payload.source === 'item') {
        const originalAct = activities.find((a) => a.id === payload.id);
        const prevDate = originalAct?.date || null;
        const prevStartTime = originalAct?.startTime || null;
        const prevEndTime = originalAct?.endTime || null;
        if (originalAct?.googleEventId) {
          deletedGoogleIdsRef.current.delete(originalAct.googleEventId);
        }

        const updated = await activityApi.update(payload.id, {
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
        });

        const finalGoogleEventId = updated?.googleEventId;
        if (finalGoogleEventId) {
          deletedGoogleIdsRef.current.delete(finalGoogleEventId);
        }

        recordUndo({
          id: actionId,
          type: 'drag-from-sidebar-item',
          activityId: payload.id,
          title: payload.title,
          prevDate,
          prevStartTime,
          prevEndTime,
          googleEventId: finalGoogleEventId || originalAct?.googleEventId,
        });

        showToast(`"${payload.title}" dijadwalkan ke kalender`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo(actionId);
          },
        });
      } else if (payload.source === 'team-task' || payload.source === 'personal-task') {
        const isPersonal = payload.source === 'personal-task';
        const created = await activityApi.create({
          title: payload.title,
          taskId: payload.taskId,
          type: 'TASK',
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          icon: 'check',
        });

        const finalGoogleEventId = created?.googleEventId;
        if (finalGoogleEventId) {
          deletedGoogleIdsRef.current.delete(finalGoogleEventId);
        }

        recordUndo({
          id: actionId,
          type: isPersonal ? 'drag-from-sidebar-personal-task' : 'drag-from-sidebar-team-task',
          createdActivityId: created.id,
          title: payload.title,
          googleEventId: finalGoogleEventId,
        });

        showToast(`${isPersonal ? 'Tugas pribadi' : 'Tugas'} "${payload.title}" dijadwalkan ke kalender`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo(actionId);
          },
        });
      }

    } catch (e) {
      if (connectionRef.current === gcalStatus.connectionId) {
        try {
          const failed = JSON.parse(rawJson) as { id: string; itemType?: string };
          const previous = googleEvents.find(event => event.id === failed.id);
          if (failed.itemType === 'google' && previous) setGoogleEvents(events => events.map(event => event.id === previous.id ? previous : event));
        } catch { /* Invalid drag data has no optimistic card to restore. */ }
      }
      console.error('[CalendarView] Gagal menjadwalkan kartu ke kalender:', e);
      showToast('Gagal menyimpan waktu kegiatan. Silakan coba lagi.');
    }
  };

  const handleTimelineDrop = (
    event: DragEvent<HTMLDivElement>,
    targetDate: Date,
    timelineColumn: HTMLElement,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverSlot(null);

    const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    if (!raw) return;

    const timing = getDropTiming(raw);
    const startMinutes = getSnappedDropMinutes(
      event.clientY,
      timelineColumn,
      timing.grabOffsetMinutes,
      timing.durationMinutes,
    );
    clearDragState();
    void handleDropPayload(targetDate, startMinutes, raw);
  };

  const clearDragState = useCallback(() => {
    dragTimingRef.current = null;
    setDraggingCardId(null);
    setDragOverSlot(null);
  }, []);

  useEffect(() => {
    const afterDrop = () => { queueMicrotask(clearDragState); };
    const cancel = (event: KeyboardEvent) => { if (event.key === 'Escape') clearDragState(); };
    document.addEventListener('drop', afterDrop, true);
    document.addEventListener('dragend', clearDragState, true);
    document.addEventListener('keydown', cancel);
    window.addEventListener('blur', clearDragState);
    return () => {
      document.removeEventListener('drop', afterDrop, true);
      document.removeEventListener('dragend', clearDragState, true);
      document.removeEventListener('keydown', cancel);
      window.removeEventListener('blur', clearDragState);
    };
  }, [clearDragState]);

  // Sinkronisasi otomatis ala Notion saat pengguna kembali ke tab (focus / visibilitychange / online)
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== 'visible') return;
      // Jangan refresh saat sedang aktif menyeret kartu agar tidak mengganggu interaksi pengguna
      if (draggingCardId) return;
      onRefreshActivitiesRef.current?.();
      void loadGoogleEvents();
    };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    return () => {
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
    };
  }, [draggingCardId, loadGoogleEvents]);

  const viewMenuRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);



  // Sinkronkan state tahun & bulan saat selectedDate berubah dari luar
  useEffect(() => {
    setCurrentYear(selectedDate.getFullYear());
    setCurrentMonth(selectedDate.getMonth());
  }, [selectedDate]);

  // Pembaruan waktu sekarang setiap menit untuk garis merah Notion Calendar
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // Tutup dropdown menu saat klik di luar
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setIsViewMenuOpen(false);
      }
    }
    if (isViewMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isViewMenuOpen]);

  // Dukungan pintasan keyboard: 1/D (Hari), 0/W (Minggu), Delete/Backspace (Hapus kartu), Ctrl+Z (Undo), Escape (Deselect)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isInput) return;

      // Cegah eksekusi berulang dari key repeat OS saat tombol ditekan lama
      if (e.repeat) return;

      // Pintasan Undo: Ctrl+Z atau Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void handleUndo();
        return;
      }

      // Pintasan Hapus: Delete atau Backspace saat ada kartu yang dipilih
      if (selectedCardItemRef.current && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        void handleDeleteCard(selectedCardItemRef.current);
        return;
      }

      // Pintasan Escape: Deselect kartu terpilih
      if (e.key === 'Escape' && selectedCardItemRef.current) {
        e.preventDefault();
        selectedCardItemRef.current = null;
        setSelectedCardItem(null);
        return;
      }

      if (e.key === '1' || e.key.toLowerCase() === 'd') {
        setViewMode('day');
        setIsViewMenuOpen(false);
      } else if (e.key === '0' || e.key.toLowerCase() === 'w') {
        setViewMode('week');
        setIsViewMenuOpen(false);
      }
    }

    // Capture mendahului UndoStackProvider di halaman tabel agar satu Ctrl+Z
    // hanya menjalankan satu riwayat saat kalender aktif.
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [handleUndo, handleDeleteCard]);

  // Hitung 7 hari untuk mode minggu aktif (Minggu s.d. Sabtu seperti Google Calendar)
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    const dayOfWeek = start.getDay(); // 0 = Minggu, 1 = Senin, ..., 6 = Sabtu
    start.setDate(start.getDate() - dayOfWeek);
    start.setHours(0, 0, 0, 0);

    const result: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      result.push(d);
    }
    return result;
  }, [selectedDate]);

  // Navigasi prev sesuai mode tampilan
  function handlePrev() {
    if (viewMode === 'week') {
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() - 7);
      onSelectDate(nextDate);
      setCurrentMonth(nextDate.getMonth());
      setCurrentYear(nextDate.getFullYear());
    } else {
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() - 1);
      onSelectDate(nextDate);
      setCurrentMonth(nextDate.getMonth());
      setCurrentYear(nextDate.getFullYear());
    }
  }

  // Navigasi next sesuai mode tampilan
  function handleNext() {
    if (viewMode === 'week') {
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 7);
      onSelectDate(nextDate);
      setCurrentMonth(nextDate.getMonth());
      setCurrentYear(nextDate.getFullYear());
    } else {
      const nextDate = new Date(selectedDate);
      nextDate.setDate(nextDate.getDate() + 1);
      onSelectDate(nextDate);
      setCurrentMonth(nextDate.getMonth());
      setCurrentYear(nextDate.getFullYear());
    }
  }

  function handleToday() {
    const today = now;
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
    onSelectDate(today);
  }

  // Judul dinamis pada toolbar
  const headerTitle = useMemo(() => {
    if (viewMode === 'week') {
      const first = weekDays[0];
      const last = weekDays[6];
      if (first.getMonth() === last.getMonth()) {
        return `${first.getDate()} – ${last.getDate()} ${MONTH_NAMES[first.getMonth()]} ${first.getFullYear()}`;
      }
      return `${first.getDate()} ${MONTH_NAMES[first.getMonth()]} – ${last.getDate()} ${MONTH_NAMES[last.getMonth()]} ${last.getFullYear()}`;
    }
    const dayName = FULL_DAY_NAMES[selectedDate.getDay()];
    return `${dayName}, ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }, [viewMode, weekDays, selectedDate]);

  useEffect(() => {
    setSyncRange(rangeStart.toISOString(), rangeEnd.toISOString());
  }, [setSyncRange, rangeStart, rangeEnd]);

  useEffect(() => {
    if (calendarRevision > 0) {
      onRefreshActivitiesRef.current?.();
    }
    void loadGoogleEvents();
  }, [calendarRevision, loadGoogleEvents]);

  // Impor event Google Calendar yang dipilih menjadi aktivitas Purrific
  async function handleImportGoogleEvent(event: GoogleCalendarEvent) {
    try {
      setImporting(true);
      await importEvents([
        {
          id: event.id,
          title: event.title,
          description: event.description,
          start: event.start || new Date().toISOString(),
          end: event.end,
          recurringEventId: event.recurringEventId || (event.id.includes('_') ? event.id.split('_')[0] : undefined),
        },
      ]);
      setSelectedEvent(null);
      onRefreshActivitiesRef.current?.();
    } catch {
      // abaikan kegagalan
    } finally {
      setImporting(false);
    }
  }

  // Helper untuk mendapatkan gabungan aktivitas & Google event pada suatu hari
  const getDayItems = useCallback(
    (dayDate: Date): CombinedItem[] => {
      const dayActivities = effectiveActivities
        .filter((act) => {
          if (deletedActivityIdsRef.current.has(act.id)) return false;
          if (act.googleEventId && deletedGoogleIdsRef.current.has(act.googleEventId)) return false;
          const itemDateStr = act.date || act.startTime;
          if (!itemDateStr) return false;
          if (act.recurrence) {
            return doesActivityOccurOnDate(itemDateStr, act.recurrence, dayDate);
          }
          const actDate = new Date(itemDateStr);
          return isSameDay(actDate, dayDate);
        })
        .map((act) => (act.recurrence ? projectActivityOntoDate(act, dayDate) : act));

      const dayGoogleEvents = googleEvents.filter((gEv) => {
        const baseGId = gEv.recurringEventId || (gEv.id.includes('_') ? gEv.id.split('_')[0] : gEv.id);
        if (deletedGoogleIdsRef.current.has(gEv.id)) return false;
        const move = linkedActivityMoves.get(gEv.id);
        // Local moves own the card across dates until a fetched Google event catches up.
        if (move && effectiveActivities.some(activity => activity.id === move.activity.id && activity.googleEventId === gEv.id &&
            !deletedActivityIdsRef.current.has(activity.id))) return false;
        if (!gEv.start) return false;
        const gStartStr = gEv.start;
        const gDate = new Date(gStartStr);
        if (!isSameDay(gDate, dayDate)) return false;

        // De-duplikasi terhadap aktivitas lokal HARI INI maupun seri berulang lokal:
        const isDuplicateOfActivity =
          dayActivities.some((act) => act.googleEventId === gEv.id) ||
          effectiveActivities.some(
            (act) =>
              !deletedActivityIdsRef.current.has(act.id) &&
              Boolean(act.recurrence) &&
              act.googleEventId === baseGId,
          );

        return !isDuplicateOfActivity;
      });

      const dayKey = toISODate(dayDate);
      const items: CombinedItem[] = [
        ...dayActivities.map((act) => ({
          type: 'activity' as const,
          id: act.recurrence ? `act-${act.id}-${dayKey}` : `act-${act.id}`,
          act,
          time: act.startTime,
          instanceDate: dayKey,
        })),
        ...dayGoogleEvents.map((gEv) => ({
          type: 'google' as const,
          id: `gcal-${gEv.id}`,
          gEv,
          time: gEv.start,
          instanceDate: dayKey,
        })),
      ];

      return items;
    },
    [effectiveActivities, googleEvents, linkedActivityMoves],
  );

  function renderAllDayRow(days: Date[]) {
    const items = days.map((day) => getDayItems(day).filter((item) =>
      item.type === 'activity' ? item.act.allDay : item.gEv.allDay));
    if (!items.some((dayItems) => dayItems.length)) return null;
    return (
      <div className={`grid border-b border-gray-200 ${days.length === 7 ? 'grid-cols-[64px_repeat(7,1fr)]' : 'grid-cols-[64px_1fr]'}`}>
        <div className="flex items-center justify-center border-r border-gray-200 p-1 text-center text-[10px] text-gray-500">Sepanjang hari</div>
        {items.map((dayItems, index) => (
          <div key={toISODate(days[index])} className="space-y-1 border-r border-gray-200 p-1 last:border-r-0">
            {dayItems.map((item) => {
              const activity = item.type === 'activity' ? item.act : null;
              const masterAct = activity ? (effectiveActivities.find((a) => a.id === activity.id) ?? activity) : null;
              const google = item.type === 'google' ? item.gEv : null;
              const title = activity?.title || google?.title || 'Tanpa judul';
              const color = getCalendarColorMeta(masterAct?.color || google?.colorId);
              return (
                <button key={item.id} type="button" title={title} draggable
                  className={`w-full truncate rounded border-l-2 px-2 py-1 text-left text-[11px] font-medium ${color.bgClass} ${color.borderClass} ${color.textClass} ${draggingCardId === item.id ? 'opacity-40' : 'opacity-100'}`}
                  onClick={() => setSelectedCardItem(item.type === 'activity' && masterAct ? { ...item, act: masterAct } : item)}
                  onDragStart={(event) => {
                    event.stopPropagation();
                    if (activity && pendingActivityMoveIdsRef.current.has(activity.id)) {
                      event.preventDefault();
                      return;
                    }
                    const hasRecurrence = item.type === 'activity'
                      ? Boolean(masterAct?.recurrence)
                      : Boolean(google?.recurringEventId || (google?.id && google.id.includes('_')));
                    const payload = JSON.stringify({
                      source: 'calendar-card',
                      itemType: item.type,
                      id: activity?.id || google?.id,
                      fullId: item.id,
                      title,
                      cardDate: toISODate(days[index]),
                      cardStartTime: null,
                      cardEndTime: null,
                      hasRecurrence,
                      recurrence: masterAct?.recurrence || null,
                      recurringEventId: item.type === 'activity' ? (masterAct?.googleEventId || null) : (google?.recurringEventId || (google?.id?.includes('_') ? google.id.split('_')[0] : null)),
                      originalDate: masterAct?.date || google?.start,
                      originalStartTime: masterAct?.startTime || null,
                      originalEndTime: masterAct?.endTime || null,
                      originalAllDay: true,
                      durationMinutes: 60,
                      grabOffsetMinutes: 0,
                    });
                    event.dataTransfer.setData('application/json', payload);
                    event.dataTransfer.setData('text/plain', payload);
                    event.dataTransfer.effectAllowed = 'move';
                    dragTimingRef.current = { durationMinutes: 60, grabOffsetMinutes: 0 };
                    setDraggingCardId(item.id);
                  }}
                  onDragEnd={clearDragState}
                >{title}</button>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  const today = now;
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeTop = (currentMinutes / 60) * HOUR_HEIGHT;
  const currentTimeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Indeks kolom hari ini dalam 7 hari minggu aktif (-1 jika tidak di minggu ini)
  const todayWeekIndex = useMemo(() => {
    return weekDays.findIndex((d) => isSameDay(d, today));
  }, [weekDays, today]);

  // Render card kegiatan pada timeline bergaya Google & Notion Calendar
  function renderEventCard(geo: TimedItemGeometry, cardDate: Date) {
    const { item, top, height, colIndex, totalCols, colSpan } = geo;
    const isAct = item.type === 'activity';
    const masterAct = isAct ? (effectiveActivities.find((a) => a.id === item.act.id) ?? item.act) : null;
    const colorId = isAct ? (masterAct?.color || null) : (item.gEv.colorId || null);
    const colorMeta = getCalendarColorMeta(colorId);
    const hasRecurrence = isAct
      ? Boolean(item.act.recurrence || masterAct?.recurrence)
      : Boolean(item.gEv.recurringEventId || item.gEv.id.includes('_'));
    const showRecurrenceIndicator = hasRecurrence;
    const isDraggingThis = draggingCardId === item.id;
    const effectiveEnd = calendarCardEnd(item.time, isAct ? item.act.endTime : item.gEv.end);
    const isPastCard = isCalendarCardPast(effectiveEnd, now);

    const isSelectedCard =
      selectedCardItem?.id === item.id ||
      (isAct &&
        selectedCardItem?.type === 'activity' &&
        selectedCardItem.act.id === item.act.id &&
        selectedCardItem.id === `act-${item.act.id}`);

    const isMultiCol = totalCols > 1;
    const span = colSpan || 1;
    const singleColWidth = 100 / totalCols;
    const leftPercent = colIndex * singleColWidth;
    const isFirstCol = colIndex === 0;
    const isLastCol = colIndex + span >= totalCols;
    // Cascading overlap ala Google Calendar: kartu di kolom kiri diperlebar (~1.7x)
    // memanjang ke bawah kartu di sebelah kanannya agar judul & waktu tetap terbaca.
    const widthPercent = isLastCol
      ? 100 - leftPercent
      : Math.min(100 - leftPercent, singleColWidth * (span + 0.7));
    const leftOffsetPx = isFirstCol ? 2 : 0;
    const rightOffsetPx = isLastCol ? 4 : 0;
    const widthSubtractPx = leftOffsetPx + rightOffsetPx;
    const cardZIndex = isDraggingThis
      ? 40
      : isSelectedCard
        ? 30
        : 10 + colIndex;

    const isDarkText = Boolean(colorMeta.isDarkText);

    return (
      <div
        key={item.id}
        draggable={true}
        onDragStart={(e) => {
          e.stopPropagation();
          if (isAct && pendingActivityMoveIdsRef.current.has(item.act.id)) {
            e.preventDefault();
            return;
          }
          const durationMinutes = Math.max(15, effectiveEnd && item.time
            ? (new Date(effectiveEnd).getTime() - new Date(item.time).getTime()) / 60000 : 60);
          const grabOffsetMinutes = Math.min(
            durationMinutes,
            Math.max(0, ((e.clientY - e.currentTarget.getBoundingClientRect().top) / HOUR_HEIGHT) * 60),
          );
          const rawId = isAct ? item.act.id : item.gEv.id;
          const cardPayload = {
            source: 'calendar-card' as const,
            itemType: isAct ? ('activity' as const) : ('google' as const),
            id: rawId,
            fullId: item.id,
            title: (isAct ? item.act.title : item.gEv.title) || 'Tanpa judul',
            cardDate: toISODate(cardDate),
            cardStartTime: item.time || null,
            cardEndTime: effectiveEnd || null,
            hasRecurrence,
            recurrence: isAct ? (masterAct?.recurrence || null) : null,
            recurringEventId: isAct ? (masterAct?.googleEventId || null) : (item.gEv.recurringEventId || (item.gEv.id.includes('_') ? item.gEv.id.split('_')[0] : null)),
            originalDate: isAct ? (masterAct?.date || null) : (item.gEv.start || null),
            originalStartTime: isAct ? (masterAct?.startTime || null) : (item.gEv.start || null),
            originalEndTime: isAct ? (masterAct?.endTime || null) : (item.gEv.end || null),
            originalAllDay: isAct ? masterAct?.allDay : item.gEv.allDay,
            durationMinutes,
            grabOffsetMinutes,
          };
          e.dataTransfer.setData('application/json', JSON.stringify(cardPayload));
          e.dataTransfer.setData('text/plain', JSON.stringify(cardPayload));
          e.dataTransfer.effectAllowed = 'move';
          dragTimingRef.current = { grabOffsetMinutes, durationMinutes };
          setDraggingCardId(item.id);
        }}
        onDragEnd={clearDragState}
        onClick={(e) => {
          e.stopPropagation();
          if (isAct) {
            setSelectedCardItem({
              ...item,
              act: masterAct ?? item.act,
            });
          } else {
            setSelectedCardItem(item);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          const timelineColumn = e.currentTarget.parentElement;
          if (timelineColumn) {
            setDragOverSlot({
              dayDate: toISODate(cardDate),
              startMinutes: previewDropMinutes(e.clientY, timelineColumn),
            });
          }
        }}
        onDrop={(e) => {
          const timelineColumn = e.currentTarget.parentElement;
          if (timelineColumn) handleTimelineDrop(e, cardDate, timelineColumn);
        }}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${leftPercent}% + ${leftOffsetPx}px)`,
          width: `calc(${widthPercent}% - ${widthSubtractPx}px)`,
          zIndex: cardZIndex,
          backgroundColor: colorMeta.solidHex,
        }}
        className={`absolute overflow-hidden rounded-[6px] border border-white ${
          isMultiCol ? 'px-1.5 py-0.5' : 'px-2 py-1'
        } text-xs cursor-grab active:cursor-grabbing select-none transition-all shadow-2xs hover:brightness-95 hover:shadow-md hover:!z-30 ${
          isDarkText ? 'text-gray-950' : 'text-white'
        } ${isDraggingThis ? 'opacity-40' : isPastCard ? 'opacity-60' : 'opacity-100'} ${
          isDraggingThis
            ? 'scale-[0.98] ring-2 ring-white !z-40 !cursor-grabbing'
            : isSelectedCard
              ? 'ring-2 ring-offset-1 ring-gray-900 shadow-md !z-30 scale-[1.01]'
              : ''
        }`}
        title={isAct ? item.act.title : item.gEv.title}
      >
        <div className={`flex items-center ${isMultiCol ? 'gap-0.5' : 'gap-1'} leading-tight min-w-0`}>
          <span
            className={`min-w-0 flex-1 font-semibold text-[11px] ${
              isMultiCol ? 'overflow-hidden whitespace-nowrap text-clip' : 'truncate'
            }`}
          >
            {isAct ? item.act.title : item.gEv.title}
          </span>
          {showRecurrenceIndicator && (
            <span
              title={isAct && item.act.recurrence?.isException ? 'Kegiatan berulang (jadwal diubah)' : 'Kegiatan berulang'}
              className={`shrink-0 ${isDarkText ? 'text-gray-800' : 'text-white/90'}`}
            >
              <svg
                width="9"
                height="9"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </span>
          )}
        </div>
        {height >= 36 && (
          <div
            className={`mt-0.5 whitespace-nowrap text-[11px] leading-tight ${
              isMultiCol ? 'overflow-hidden text-clip' : 'truncate'
            } ${isDarkText ? 'text-gray-900/85' : 'text-white/95'}`}
          >
            {formatTime(item.time)}
            {isAct && item.act.endTime && ` – ${formatTime(item.act.endTime)}`}
            {!isAct && item.gEv.end && ` – ${formatTime(item.gEv.end)}`}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 font-givonic">
      {/* Header toolbar kalender */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3.5 shadow-sm">
        {/* Navigasi tanggal & pengatur tampilan */}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-semibold text-gray-900 min-w-[140px]">
            {headerTitle}
          </h2>

          <div className="flex items-center rounded-lg border border-gray-200 p-0.5 bg-gray-50">
            <button
              type="button"
              onClick={handlePrev}
              title="Sebelumnya"
              className="rounded p-1 text-gray-600 hover:bg-white hover:text-gray-900 transition shadow-none hover:shadow-xs"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleNext}
              title="Berikutnya"
              className="rounded p-1 text-gray-600 hover:bg-white hover:text-gray-900 transition shadow-none hover:shadow-xs"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <button
            type="button"
            onClick={handleToday}
            className="rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
          >
            Hari Ini
          </button>

          {/* Tombol & Menu pengatur tampilan di samping "Hari ini" */}
          <div className="relative" ref={viewMenuRef}>
            <button
              type="button"
              onClick={() => setIsViewMenuOpen((prev) => !prev)}
              aria-haspopup="menu"
              aria-expanded={isViewMenuOpen}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition shadow-none hover:shadow-xs"
            >
              <span>{viewMode === 'day' ? 'Hari' : 'Minggu'}</span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                className={`transition-transform duration-150 text-gray-500 ${isViewMenuOpen ? 'rotate-180' : ''}`}
              >
                <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Menu Dropdown Tampilan Berlatar Belakang Putih */}
            {isViewMenuOpen && (
              <div
                role="menu"
                className="absolute left-0 mt-1.5 z-50 w-52 overflow-hidden rounded-xl border border-gray-200 bg-white p-1.5 text-xs text-gray-800 shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setViewMode('day');
                    setIsViewMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                    viewMode === 'day'
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 text-center text-blue-600 font-bold">
                      {viewMode === 'day' ? '✓' : ''}
                    </span>
                    <span>Hari</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400">1 atau D</span>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setViewMode('week');
                    setIsViewMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                    viewMode === 'week'
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 text-center text-blue-600 font-bold">
                      {viewMode === 'week' ? '✓' : ''}
                    </span>
                    <span>Minggu</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400">0 atau W</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Kontrol integrasi Google Calendar */}
        <div className="flex items-center gap-2">
          {gcalStatus.connected ? (
            <div className="flex items-center gap-2">
              {/* Google Profile Card */}
              <div
                title={gcalStatus.email ?? 'Google Calendar Terhubung'}
                className="flex items-center gap-2.5 rounded-full border border-blue-200 bg-blue-50/80 pl-1 pr-3 py-1 text-xs shadow-xs"
              >
                {/* Avatar with Google G badge */}
                <div className="relative h-6 w-6 shrink-0">
                  {gcalStatus.avatarUrl ? (
                    <img
                      src={gcalStatus.avatarUrl}
                      alt={gcalStatus.name || 'Google Profile'}
                      className="h-6 w-6 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-600 font-semibold text-white text-[10px]">
                      {(gcalStatus.name || gcalStatus.email || 'G').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-white ring-1 ring-white">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                  </span>
                </div>

                {/* Name & Email */}
                <div className="flex flex-col text-left leading-tight min-w-0 max-w-[130px] sm:max-w-[180px]">
                  <span className="truncate font-semibold text-gray-900 text-[11px]">
                    {gcalStatus.name || gcalStatus.email?.split('@')[0] || 'Google User'}
                  </span>
                  {gcalStatus.email && (
                    <span className="truncate text-[10px] text-gray-500">
                      {gcalStatus.email}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                disabled={gcalDisconnecting}
                onClick={() => void disconnectGcal()}
                className="inline-flex items-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-600 shadow-xs transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 cursor-pointer"
                title="Putuskan akun Google Calendar"
              >
                {gcalDisconnecting ? 'Memutuskan…' : 'Putuskan'}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={gcalConnecting}
              onClick={connectGcal}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition shadow-xs"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              {gcalConnecting ? 'Menghubungkan…' : 'Hubungkan Google Calendar'}
            </button>
          )}

          {onCreateActivity && (
            <button
              type="button"
              onClick={() => onCreateActivity(selectedDate)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
            >
              + Kegiatan
            </button>
          )}
        </div>
      </div>

      {/* Kontainer Utama: Kalender + Sidebar "Belum di Kalender" */}
      <div ref={calendarContainerRef} className="flex gap-4 w-full min-w-0 items-start">
        <div className="flex-1 min-w-0 space-y-4">


      {/* ============================================================== */}
      {/* 2. TAMPILAN MINGGU ALA NOTION CALENDAR (WHITE BACKGROUND)       */}
      {/* ============================================================== */}
      {viewMode === 'week' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col">
          {/* Header 7 Hari */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-200 bg-white sticky top-0 z-20">
            <div className="p-2 border-r border-gray-200 text-[11px] font-medium text-gray-400 flex items-center justify-center">
              WAKTU
            </div>
            {weekDays.map((dayDate, idx) => {
              const isToday = isSameDay(dayDate, today);
              const isSelected = isSameDay(dayDate, selectedDate);

              return (
                <div
                  key={idx}
                  onClick={() => onSelectDate(dayDate)}
                  className={`py-2 px-1 text-center border-r border-gray-200 last:border-r-0 cursor-pointer select-none transition ${
                    isSelected ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                    {DAY_NAMES[idx]}
                  </div>
                  <div className="mt-1 flex justify-center">
                    <span
                      className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition ${
                        isToday
                          ? 'bg-blue-600 text-white shadow-xs'
                          : isSelected
                            ? 'border-2 border-blue-600 text-blue-700 font-extrabold'
                            : 'text-gray-800'
                      }`}
                    >
                      {dayDate.getDate()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>


          {renderAllDayRow(weekDays)}
          {/* Timeline Grid Jam Vertikal 24 Jam */}
          <div
            ref={timelineScrollRef}
            className="bg-white relative select-none"
          >
            <div
              className="grid grid-cols-[64px_repeat(7,1fr)] relative"
              style={{ height: `${24 * HOUR_HEIGHT}px` }}
            >
              {/* Kolom Label Jam (Sisi Kiri) */}
              <div className="border-r border-gray-200 bg-white relative">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    className="border-b border-gray-200 text-right pr-2 text-[11px] font-mono text-gray-400 pt-1 select-none"
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}

                {/* Badge Waktu Riil Merah (Notion Calendar Style) */}
                <div
                  style={{ top: `${currentTimeTop}px` }}
                  className="absolute right-1 -translate-y-1/2 z-40 flex items-center"
                >
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-xs">
                    {currentTimeLabel}
                  </span>
                </div>
              </div>

              {/* 7 Kolom Hari */}
              {weekDays.map((dayDate, idx) => {
                const isSelected = isSameDay(dayDate, selectedDate);
                const items = getDayItems(dayDate);
                const timedItems = computeTimedItemsLayout(items);

                return (
                  <div
                    key={idx}
                    onClick={() => onSelectDate(dayDate)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.dataTransfer.dropEffect = 'move';
                      setDragOverSlot({
                        dayDate: toISODate(dayDate),
                        startMinutes: previewDropMinutes(e.clientY, e.currentTarget),
                      });
                    }}
                    onDrop={(e) => {
                      handleTimelineDrop(e, dayDate, e.currentTarget);
                    }}
                    className={`relative border-r border-gray-200 last:border-r-0 ${
                      isSelected ? 'bg-blue-50/10' : 'bg-white'
                    }`}
                  >
                    {/* Garis kisi per jam */}
                    {HOURS.map((hour) => {
                      const isDragOver =
                        dragOverSlot?.dayDate === toISODate(dayDate) &&
                        Math.floor(dragOverSlot.startMinutes / 60) === hour;
                      return (
                        <div
                          key={hour}
                          style={{ height: `${HOUR_HEIGHT}px` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedCardItem(null);
                            selectedCardItemRef.current = null;
                            onSelectDate(dayDate);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            const timelineColumn = e.currentTarget.parentElement;
                            if (timelineColumn) {
                              setDragOverSlot({
                                dayDate: toISODate(dayDate),
                                startMinutes: previewDropMinutes(e.clientY, timelineColumn),
                              });
                            }
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                              setDragOverSlot(null);
                            }
                          }}
                          onDrop={(e) => {
                            const timelineColumn = e.currentTarget.parentElement;
                            if (timelineColumn) handleTimelineDrop(e, dayDate, timelineColumn);
                          }}
                          className={`border-b border-gray-200 transition ${
                            isDragOver ? 'bg-orange-100/70 ring-1 ring-inset ring-orange-400' : 'hover:bg-gray-50/60'
                          }`}
                        />
                      );
                    })}

                    {dragOverSlot?.dayDate === toISODate(dayDate) && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 right-0 z-40 border-t-2 border-orange-500"
                        style={{ top: `${dragOverSlot.startMinutes}px` }}
                      />
                    )}

                    {/* Blok-blok kegiatan terpeta sesuai jam */}
                    {timedItems.map((geo) => renderEventCard(geo, dayDate))}
                  </div>
                );
              })}

              {/* Garis Horizontal Waktu Sekarang (Merah ala Notion Calendar jika minggu aktif mencakup hari ini) */}
              {todayWeekIndex !== -1 && (
                <div
                  style={{ top: `${currentTimeTop}px`, left: '64px', right: 0 }}
                  className="absolute z-30 pointer-events-none flex items-center"
                >
                  {/* Label "Hari ini" di samping kanan titik merah di atas garis */}
                  <div
                    style={{ left: `calc(${(todayWeekIndex / 7) * 100}% + 6px)` }}
                    className="absolute -top-5 flex items-center"
                  >
                    <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs leading-none select-none tracking-wide whitespace-nowrap">
                      Hari ini
                    </span>
                  </div>
                  {/* Titik merah penanda di awal kolom hari ini */}
                  <div
                    style={{ left: `calc(${(todayWeekIndex / 7) * 100}% - 4px)` }}
                    className="absolute h-2 w-2 rounded-full bg-red-600"
                  />
                  <div className="h-[2px] w-full bg-red-500 shadow-xs" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. TAMPILAN HARI ALA NOTION CALENDAR (WHITE BACKGROUND)        */}
      {/* ============================================================== */}
      {viewMode === 'day' && (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm flex flex-col">
          {/* Header Hari Terpilih */}
          <div className="grid grid-cols-[64px_1fr] border-b border-gray-200 bg-white sticky top-0 z-20">
            <div className="p-2 border-r border-gray-200 text-[11px] font-medium text-gray-400 flex items-center justify-center">
              WAKTU
            </div>
            <div className="py-2.5 px-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-600 text-white text-sm font-bold shadow-xs">
                  {selectedDate.getDate()}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {FULL_DAY_NAMES[selectedDate.getDay()]}, {selectedDate.getDate()}{' '}
                    {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                  </h3>
                  <span className="text-[11px] text-gray-500">
                    {getDayItems(selectedDate).length} Kegiatan tercatat
                  </span>
                </div>
              </div>

              {onCreateActivity && (
                <button
                  type="button"
                  onClick={() => onCreateActivity(selectedDate)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition shadow-xs"
                >
                  + Tambah Kegiatan
                </button>
              )}
            </div>
          </div>


          {renderAllDayRow([selectedDate])}
          {/* Timeline Grid Jam Vertikal 24 Jam */}
          <div
            ref={timelineScrollRef}
            className="bg-white relative select-none"
          >
            <div
              className="grid grid-cols-[64px_1fr] relative"
              style={{ height: `${24 * HOUR_HEIGHT}px` }}
            >
              {/* Kolom Label Jam (Sisi Kiri) */}
              <div className="border-r border-gray-200 bg-white relative">
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    style={{ height: `${HOUR_HEIGHT}px` }}
                    className="border-b border-gray-200 text-right pr-2 text-[11px] font-mono text-gray-400 pt-1 select-none"
                  >
                    {String(hour).padStart(2, '0')}:00
                  </div>
                ))}

                {/* Badge Waktu Riil Merah (Notion Calendar Style) */}
                {isSameDay(selectedDate, today) && (
                  <div
                    style={{ top: `${currentTimeTop}px` }}
                    className="absolute right-1 -translate-y-1/2 z-40 flex items-center"
                  >
                    <span className="rounded-full bg-red-600 px-1.5 py-0.5 font-mono text-[9px] font-bold text-white shadow-xs">
                      {currentTimeLabel}
                    </span>
                  </div>
                )}
              </div>

              {/* Kolom Tunggal Hari Terpilih */}
              <div
                className="relative bg-white"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setDragOverSlot({
                    dayDate: toISODate(selectedDate),
                    startMinutes: previewDropMinutes(e.clientY, e.currentTarget),
                  });
                }}
                onDrop={(e) => {
                  handleTimelineDrop(e, selectedDate, e.currentTarget);
                }}
              >
                {/* Garis kisi per jam */}
                {HOURS.map((hour) => {
                  const isDragOver =
                    dragOverSlot?.dayDate === toISODate(selectedDate) &&
                    Math.floor(dragOverSlot.startMinutes / 60) === hour;
                  return (
                    <div
                      key={hour}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedCardItem(null);
                        selectedCardItemRef.current = null;
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const timelineColumn = e.currentTarget.parentElement;
                        if (timelineColumn) {
                          setDragOverSlot({
                            dayDate: toISODate(selectedDate),
                            startMinutes: previewDropMinutes(e.clientY, timelineColumn),
                          });
                        }
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDragOverSlot(null);
                        }
                      }}
                      onDrop={(e) => {
                        const timelineColumn = e.currentTarget.parentElement;
                        if (timelineColumn) handleTimelineDrop(e, selectedDate, timelineColumn);
                      }}
                      className={`border-b border-gray-200 transition ${
                        isDragOver ? 'bg-orange-100/70 ring-1 ring-inset ring-orange-400' : 'hover:bg-gray-50/60'
                      }`}
                    />
                  );
                })}

                {dragOverSlot?.dayDate === toISODate(selectedDate) && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 right-0 z-40 border-t-2 border-orange-500"
                    style={{ top: `${dragOverSlot.startMinutes}px` }}
                  />
                )}

                {/* Blok-blok kegiatan terpeta sesuai jam */}
                {computeTimedItemsLayout(getDayItems(selectedDate)).map((geo) =>
                  renderEventCard(geo, selectedDate),
                )}
              </div>

              {/* Garis Horizontal Waktu Sekarang (Merah ala Notion Calendar jika hari ini) */}
              {isSameDay(selectedDate, today) && (
                <div
                  style={{ top: `${currentTimeTop}px`, left: '64px', right: 0 }}
                  className="absolute z-30 pointer-events-none flex items-center"
                >
                  <div className="absolute left-2 -top-5 flex items-center">
                    <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs leading-none select-none tracking-wide whitespace-nowrap">
                      Hari ini
                    </span>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-red-600 -ml-1 shrink-0" />
                  <div className="h-[2px] w-full bg-red-500 shadow-xs" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
        </div>

        {/* Kolom Kanan: Sidebar Item belum terjadwal + Settings Card Terpilih */}
        <div className="sticky top-6 flex w-80 shrink-0 flex-col gap-3 self-start">
          <CalendarSidebar
            activities={activities}
            onRefresh={onRefreshActivities}
          />

          {selectedCardItem && (
            <CalendarCardSettings
              selectedItem={selectedCardItem}
              onClose={() => setSelectedCardItem(null)}
              onOpenActivity={onOpenActivity}
              onDelete={handleDeleteCard}
              onRefresh={onRefreshActivities}
              onRecordUndo={recordUndo}
              onUndo={handleUndo}
              getNextUndoId={() => nextUndoIdRef.current++}
            />
          )}
        </div>
      </div>



      {/* ============================================================== */}
      {/* 5. MODAL DETAIL EVENT GOOGLE CALENDAR                           */}
      {/* ============================================================== */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl border border-gray-100 flex flex-col gap-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-200">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </span>
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">
                    Google Calendar
                  </span>
                  <h3 className="text-base font-semibold text-gray-900">{selectedEvent.title}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedEvent(null)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2 text-xs text-gray-600">
              {selectedEvent.start && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-medium">Waktu:</span>
                  <span>
                    {new Date(selectedEvent.start).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                    {selectedEvent.start.includes('T') && ` (${formatTime(selectedEvent.start)})`}
                  </span>
                </div>
              )}
              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <span className="text-gray-400 font-medium">Lokasi:</span>
                  <span>{selectedEvent.location}</span>
                </div>
              )}
              {selectedEvent.description && (
                <div className="pt-2 border-t border-gray-100 text-gray-700 whitespace-pre-line">
                  {selectedEvent.description}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-3 border-t border-gray-100">
              {selectedEvent.htmlLink ? (
                <a
                  href={selectedEvent.htmlLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-blue-600 hover:underline"
                >
                  Buka di Google Calendar ↗
                </a>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedEvent(null)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Tutup
                </button>
                <button
                  type="button"
                  disabled={importing}
                  onClick={() => void handleImportGoogleEvent(selectedEvent)}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition disabled:opacity-60"
                >
                  {importing ? 'Mengimpor…' : 'Impor ke Purrific'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Cakupan Pemindahan Kegiatan Berulang */}
      {recurringMovePrompt && (
        <RecurrenceScopeModal
          isOpen={recurringMovePrompt.isOpen}
          actionType="move"
          targetDate={recurringMovePrompt.instanceDateStr}
          recurrence={recurringMovePrompt.activity?.recurrence || null}
          activityTitle={recurringMovePrompt.activity?.title || recurringMovePrompt.googleEvent?.title || recurringMovePrompt.payload.title}
          onSelect={(scope) => void handleConfirmRecurringMove(scope)}
          onClose={() => setRecurringMovePrompt(null)}
        />
      )}

      {/* Modal Konfirmasi Cakupan Penghapusan Kegiatan Berulang */}
      {recurringDeletePrompt && (
        <RecurrenceScopeModal
          isOpen={recurringDeletePrompt.isOpen}
          actionType="delete"
          targetDate={recurringDeletePrompt.instanceDateStr}
          recurrence={recurringDeletePrompt.item.type === 'activity' ? recurringDeletePrompt.item.act.recurrence : null}
          activityTitle={(recurringDeletePrompt.item.type === 'activity' ? recurringDeletePrompt.item.act.title : null) || 'Tanpa judul'}
          onSelect={(scope) => void handleConfirmRecurringDelete(scope)}
          onClose={() => setRecurringDeletePrompt(null)}
        />
      )}
    </div>
  );
}
