import { useState, useEffect, useMemo, useCallback, useRef, type DragEvent } from 'react';
import type { DailyActivity, GoogleCalendarEvent } from '@/types';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useSocket } from '@/store/socket';
import { activityApi } from '@/api/activities';
import { calendarApi } from '@/api/calendar';
import { showToast } from '@/components/ui/Toast';
import CalendarSidebar from './CalendarSidebar';
import CalendarCardSettings, { type CombinedItem } from './CalendarCardSettings';

export type CalendarViewMode = 'day' | 'week';

interface CalendarViewProps {
  activities: DailyActivity[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenActivity?: (activity: DailyActivity) => void;
  onCreateActivity?: (date: Date, time?: { startTime: string; endTime: string }) => void;
  onRefreshActivities?: () => void;
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

const DAY_NAMES = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const FULL_DAY_NAMES = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // 60px per jam => 1 menit = 1px
const DROP_SNAP_MINUTES = 15;

function getSnappedDropMinutes(clientY: number, timelineColumn: HTMLElement): number {
  const rect = timelineColumn.getBoundingClientRect();
  const rawMinutes = ((clientY - rect.top) / HOUR_HEIGHT) * 60;
  const snappedMinutes = Math.round(rawMinutes / DROP_SNAP_MINUTES) * DROP_SNAP_MINUTES;
  return Math.min(24 * 60 - DROP_SNAP_MINUTES, Math.max(0, snappedMinutes));
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
}

// Algoritma penataan kolom event yang tumpang tindih ala Notion / Google Calendar
function computeTimedItemsLayout(items: CombinedItem[]): TimedItemGeometry[] {
  const parsed = items
    .map((item) => {
      const startMin = parseTimeToMinutes(item.time);
      if (startMin === null) return null;

      let endMin: number | null = null;
      if (item.type === 'activity' && item.act.endTime) {
        endMin = parseTimeToMinutes(item.act.endTime);
      } else if (item.type === 'google' && item.gEv.end) {
        endMin = parseTimeToMinutes(item.gEv.end);
      }

      if (endMin === null || endMin <= startMin) {
        endMin = Math.min(1440, startMin + 45); // durasi default 45 menit jika tidak ada jam selesai
      }

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

  const columns: typeof parsed[] = [];

  for (const p of parsed) {
    let placed = false;
    for (let c = 0; c < columns.length; c++) {
      const lastInCol = columns[c][columns[c].length - 1];
      if (lastInCol.endMin <= p.startMin) {
        columns[c].push(p);
        placed = true;
        break;
      }
    }
    if (!placed) {
      columns.push([p]);
    }
  }

  const result: TimedItemGeometry[] = [];
  for (let c = 0; c < columns.length; c++) {
    for (const p of columns[c]) {
      let overlaps = 0;
      for (let otherC = 0; otherC < columns.length; otherC++) {
        const hasOverlap = columns[otherC].some(
          (other) => Math.max(p.startMin, other.startMin) < Math.min(p.endMin, other.endMin),
        );
        if (hasOverlap) overlaps++;
      }
      result.push({
        ...p,
        colIndex: c,
        totalCols: Math.max(1, overlaps, c + 1),
      });
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
}: CalendarViewProps) {
  const [currentYear, setCurrentYear] = useState(selectedDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(selectedDate.getMonth()); // 0-indexed
  const [viewMode, setViewMode] = useState<CalendarViewMode>('week');
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<GoogleCalendarEvent | null>(null);
  const [selectedCardItem, setSelectedCardItem] = useState<CombinedItem | null>(null);
  const [importing, setImporting] = useState(false);
  const [now, setNow] = useState(new Date());

  const {
    status: gcalStatus,
    loading: gcalLoading,
    connecting: gcalConnecting,
    connect: connectGcal,
    disconnect: disconnectGcal,
    fetchEvents,
    importEvents,
    autoSync,
  } = useGoogleCalendar();

  const { socket } = useSocket();

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
    if (!gcalStatus.connected) {
      setGoogleEvents([]);
      return;
    }
    try {
      const events = await fetchEvents(rangeStart.toISOString(), rangeEnd.toISOString());
      setGoogleEvents(events);
    } catch (e) {
      console.error('Gagal memuat event Google Calendar:', e);
    }
  }, [gcalStatus.connected, fetchEvents, rangeStart, rangeEnd]);

  useEffect(() => {
    void loadGoogleEvents();
  }, [loadGoogleEvents]);

  // Sinkronkan data kartu yang sedang dipilih saat data aktivitas/googleEvents diperbarui
  useEffect(() => {
    if (!selectedCardItem) return;
    if (selectedCardItem.type === 'activity') {
      const updated = activities.find((a) => a.id === selectedCardItem.act.id);
      if (updated) {
        setSelectedCardItem({
          type: 'activity',
          id: `act-${updated.id}`,
          act: updated,
          time: updated.startTime,
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
        });
      }
    }
  }, [activities, googleEvents]);

  const [dragOverSlot, setDragOverSlot] = useState<{ dayDate: string; startMinutes: number } | null>(null);

  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);

  // Tangani kartu yang di-drop ke kalender dari sidebar atau ke atas kartu lain
  // Ref untuk item yang sedang dipilih agar event listener selalu mendapatkan nilai terbaru
  const selectedCardItemRef = useRef<CombinedItem | null>(null);
  selectedCardItemRef.current = selectedCardItem;

  // Tipe aksi riwayat untuk undo (Ctrl+Z)
  type UndoAction =
    | {
        type: 'delete';
        item: CombinedItem;
        title: string;
      }
    | {
        type: 'drag-from-sidebar-item';
        activityId: string;
        title: string;
        prevDate: string | null;
        prevStartTime: string | null;
        prevEndTime: string | null;
      }
    | {
        type: 'drag-from-sidebar-team-task';
        createdActivityId: string;
        title: string;
      }
    | {
        type: 'move-calendar-card';
        itemType: 'activity' | 'google';
        rawId: string;
        title: string;
        prevDate: string | null;
        prevStartTime: string | null;
        prevEndTime: string | null;
      };

  // Stack riwayat untuk undo (Ctrl+Z)
  const undoStackRef = useRef<UndoAction[]>([]);

  // Fungsi membatalkan aksi terakhir (Undo / Ctrl+Z)
  const handleUndo = useCallback(async () => {
    if (undoStackRef.current.length === 0) {
      showToast('Tidak ada kegiatan yang bisa diurungkan.');
      return;
    }

    const last = undoStackRef.current.pop();
    if (!last) return;

    if (last.type === 'move-calendar-card') {
      try {
        if (last.itemType === 'activity') {
          await activityApi.update(last.rawId, {
            ...(last.prevDate ? { date: last.prevDate } : {}),
            startTime: last.prevStartTime,
            endTime: last.prevEndTime,
          });

          if (onRefreshActivities) onRefreshActivities();
        } else {
          await calendarApi.updateEvent(last.rawId, {
            ...(last.prevDate ? { date: last.prevDate } : {}),
            startTime: last.prevStartTime,
            endTime: last.prevEndTime,
          });

          void loadGoogleEvents();
        }

        setSelectedCardItem(null);
        showToast(`Posisi kegiatan "${last.title}" dikembalikan.`);
      } catch (err) {
        console.error('[CalendarView] Gagal mengembalikan posisi kegiatan:', err);
        showToast('Gagal mengembalikan posisi kegiatan.');
      }
      return;
    }

    if (last.type === 'drag-from-sidebar-item') {
      try {
        await activityApi.update(last.activityId, {
          startTime: null,
          endTime: null,
          ...(last.prevDate ? { date: last.prevDate } : {}),
        });

        if (onRefreshActivities) onRefreshActivities();
        setSelectedCardItem(null);
        showToast(`"${last.title}" dikembalikan ke menu "Belum di kalender".`);
      } catch (err) {
        console.error('[CalendarView] Gagal mengembalikan item ke menu:', err);
        showToast('Gagal mengembalikan item ke menu.');
      }
      return;
    }

    if (last.type === 'drag-from-sidebar-team-task') {
      try {
        await activityApi.remove(last.createdActivityId);

        if (onRefreshActivities) onRefreshActivities();
        setSelectedCardItem(null);
        showToast(`Tugas "${last.title}" dikembalikan ke menu "Belum di kalender".`);
      } catch (err) {
        console.error('[CalendarView] Gagal mengembalikan tugas ke menu:', err);
        showToast('Gagal mengembalikan tugas ke menu.');
      }
      return;
    }

    if (last.type === 'delete') {
      const { item, title } = last;
      try {
        if (item.type === 'activity') {
          const act = item.act;
          const restored = await activityApi.create({
            title: act.title || 'Tanpa judul',
            description: act.description || undefined,
            date: act.date ? new Date(act.date).toISOString() : new Date().toISOString(),
            startTime: act.startTime || undefined,
            endTime: act.endTime || undefined,
            type: act.type || 'CUSTOM',
            taskId: act.taskId || undefined,
            icon: act.icon || undefined,
            checklist: act.checklistItems?.length ? act.checklistItems.map((c) => ({ text: c.text })) : undefined,
          });

          if (onRefreshActivities) onRefreshActivities();
          setSelectedCardItem({
            type: 'activity',
            id: `act-${restored.id}`,
            act: restored,
            time: restored.startTime,
          });
        } else {
          const gEv = item.gEv;
          const restored = await activityApi.create({
            title: gEv.title || 'Event Google',
            description: gEv.description || undefined,
            date: gEv.start ? new Date(gEv.start).toISOString() : new Date().toISOString(),
            startTime: gEv.start && gEv.start.includes('T') ? gEv.start : undefined,
            endTime: gEv.end && gEv.end.includes('T') ? gEv.end : undefined,
            type: 'CUSTOM',
          });

          if (onRefreshActivities) onRefreshActivities();
          void loadGoogleEvents();
          setSelectedCardItem({
            type: 'activity',
            id: `act-${restored.id}`,
            act: restored,
            time: restored.startTime,
          });
        }

        showToast(`Kegiatan "${title}" dipulihkan.`);
      } catch (err) {
        console.error('[CalendarView] Gagal memulihkan kegiatan:', err);
        showToast('Gagal memulihkan kegiatan.');
      }
      return;
    }
  }, [onRefreshActivities, loadGoogleEvents]);

  // Fungsi menghapus kartu terpilih
  const handleDeleteCard = useCallback(
    async (itemToDelete: CombinedItem) => {
      const isAct = itemToDelete.type === 'activity';
      const act = isAct ? itemToDelete.act : null;
      const gEv = !isAct ? itemToDelete.gEv : null;
      const title = (isAct ? act?.title : gEv?.title) || 'Tanpa judul';

      try {
        if (isAct && act) {
          await activityApi.remove(act.id);
        } else if (gEv) {
          await calendarApi.deleteEvent(gEv.id);
          void loadGoogleEvents();
        }

        undoStackRef.current.push({ type: 'delete', item: itemToDelete, title });
        setSelectedCardItem(null);
        if (onRefreshActivities) onRefreshActivities();

        showToast(`Kegiatan "${title}" dihapus`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo();
          },
        });
      } catch (err) {
        console.error('[CalendarView] Gagal menghapus kegiatan:', err);
        showToast('Gagal menghapus kegiatan.');
      }
    },
    [onRefreshActivities, handleUndo, loadGoogleEvents],
  );

  // Tangani kartu yang di-drop ke kalender dari sidebar atau perpindahan kartu kalender
  const handleDropPayload = async (
    targetDate: Date,
    requestedStartMinutes: number,
    rawJson: string,
  ) => {
    if (!rawJson) return;
    try {
      const payload = JSON.parse(rawJson) as {
        source: 'item' | 'team-task' | 'calendar-card';
        id: string;
        title: string;
        taskId?: string;
        type?: DailyActivity['type'];
        itemType?: 'activity' | 'google';
        fullId?: string;
        originalDate?: string | null;
        originalStartTime?: string | null;
        originalEndTime?: string | null;
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
        if (
          payload.originalStartTime &&
          new Date(payload.originalStartTime).getTime() === newStart.getTime() &&
          payload.originalEndTime &&
          new Date(payload.originalEndTime).getTime() === newEnd.getTime()
        ) {
          return;
        }

        const newDateStr = new Date(newStart.getFullYear(), newStart.getMonth(), newStart.getDate(), 0, 0, 0, 0).toISOString();

        if (payload.itemType === 'activity') {
          await activityApi.update(payload.id, {
            date: newDateStr,
            startTime: newStartTimeStr,
            endTime: newEndTimeStr,
          });

          if (onRefreshActivities) {
            onRefreshActivities();
          }
        } else {
          await calendarApi.updateEvent(payload.id, {
            date: newDateStr,
            startTime: newStartTimeStr,
            endTime: newEndTimeStr,
          });

          void loadGoogleEvents();
        }

        undoStackRef.current.push({
          type: 'move-calendar-card',
          itemType: payload.itemType || 'activity',
          rawId: payload.id,
          title: payload.title,
          prevDate: payload.originalDate || null,
          prevStartTime: payload.originalStartTime || null,
          prevEndTime: payload.originalEndTime || null,
        });

        showToast(`Kegiatan "${payload.title}" dipindahkan`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo();
          },
        });
        return;
      }

      // 2. Kasus drop dari sidebar (item atau team-task)
      const dateStr = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0).toISOString();

      const startTimeStr = newStart.toISOString();
      const endTimeStr = newEnd.toISOString();

      if (payload.source === 'item') {
        const originalAct = activities.find((a) => a.id === payload.id);
        const prevDate = originalAct?.date || null;
        const prevStartTime = originalAct?.startTime || null;
        const prevEndTime = originalAct?.endTime || null;

        await activityApi.update(payload.id, {
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
        });

        undoStackRef.current.push({
          type: 'drag-from-sidebar-item',
          activityId: payload.id,
          title: payload.title,
          prevDate,
          prevStartTime,
          prevEndTime,
        });

        showToast(`"${payload.title}" dijadwalkan ke kalender`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo();
          },
        });
      } else if (payload.source === 'team-task') {
        const created = await activityApi.create({
          title: payload.title,
          taskId: payload.taskId,
          type: 'TASK',
          date: dateStr,
          startTime: startTimeStr,
          endTime: endTimeStr,
          icon: 'check',
        });

        undoStackRef.current.push({
          type: 'drag-from-sidebar-team-task',
          createdActivityId: created.id,
          title: payload.title,
        });

        showToast(`Tugas "${payload.title}" dijadwalkan ke kalender`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => {
            void handleUndo();
          },
        });
      }

      if (onRefreshActivities) {
        onRefreshActivities();
      }
    } catch (e) {
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
    setDragOverCardId(null);

    const raw = event.dataTransfer.getData('application/json') || event.dataTransfer.getData('text/plain');
    if (!raw) return;

    const startMinutes = getSnappedDropMinutes(event.clientY, timelineColumn);
    void handleDropPayload(targetDate, startMinutes, raw);
  };

  const viewMenuRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const isInitialActivitiesMount = useRef(true);


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

  // Otomatis gulir halaman ke jam saat ini saat masuk mode Minggu atau Hari
  useEffect(() => {
    if (viewMode === 'week' || viewMode === 'day') {
      const scrollHour = Math.max(0, new Date().getHours() - 1);
      const targetOffset = scrollHour * HOUR_HEIGHT;
      if (timelineScrollRef.current) {
        const rect = timelineScrollRef.current.getBoundingClientRect();
        const absoluteTop = rect.top + window.scrollY;
        window.scrollTo({ top: absoluteTop + targetOffset, behavior: 'smooth' });
      }
    }
  }, [viewMode]);

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

      // Pintasan Undo: Ctrl+Z atau Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        void handleUndo();
        return;
      }

      // Pintasan Hapus: Delete atau Backspace saat ada kartu yang dipilih
      if (selectedCardItemRef.current && (e.key === 'Delete' || e.key === 'Backspace')) {
        e.preventDefault();
        void handleDeleteCard(selectedCardItemRef.current);
        return;
      }

      // Pintasan Escape: Deselect kartu terpilih
      if (e.key === 'Escape' && selectedCardItemRef.current) {
        e.preventDefault();
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

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleDeleteCard]);

  // Hitung 7 hari untuk mode minggu aktif
  const weekDays = useMemo(() => {
    const start = new Date(selectedDate);
    let dayOfWeek = start.getDay() - 1;
    if (dayOfWeek === -1) dayOfWeek = 6;
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
    const today = new Date();
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

  // Sinkronisasi 2 arah otomatis untuk seluruh rentang kalender aktif
  const triggerAutoSync = useCallback(async () => {
    if (!gcalStatus.connected || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      await autoSync(rangeStart.toISOString(), rangeEnd.toISOString());
      await loadGoogleEvents();
      if (onRefreshActivities) onRefreshActivities();
    } catch (err) {
      console.error('[CalendarView] autoSync error:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [gcalStatus.connected, autoSync, rangeStart, rangeEnd, loadGoogleEvents, onRefreshActivities]);

  // Otomatis sinkron saat pertama kali terhubung atau kalender dibuka, dan berjalan rutin setiap 15 detik
  useEffect(() => {
    if (!gcalStatus.connected) return;

    void triggerAutoSync();

    const intervalId = setInterval(() => {
      void triggerAutoSync();
    }, 15 * 1000);

    return () => clearInterval(intervalId);
  }, [gcalStatus.connected, triggerAutoSync]);

  // Sinkronisasi real-time via WebSocket saat server memancarkan event calendar:synced
  useEffect(() => {
    if (!socket) return;
    const handleRemoteSync = () => {
      void loadGoogleEvents();
    };
    socket.on('calendar:synced', handleRemoteSync);
    return () => {
      socket.off('calendar:synced', handleRemoteSync);
    };
  }, [socket, loadGoogleEvents]);

  // Sinkronisasi otomatis saat terjadi perubahan pada aktivitas lokal
  useEffect(() => {
    if (isInitialActivitiesMount.current) {
      isInitialActivitiesMount.current = false;
      return;
    }
    if (!gcalStatus.connected) return;

    const timer = setTimeout(() => {
      void triggerAutoSync();
    }, 1000);

    return () => clearTimeout(timer);
  }, [activities, gcalStatus.connected, triggerAutoSync]);

  // Sinkronisasi otomatis saat jendela/tab difokuskan kembali
  useEffect(() => {
    if (!gcalStatus.connected) return;

    function handleFocusOrVisible() {
      if (document.visibilityState === 'visible') {
        void triggerAutoSync();
      }
    }

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [gcalStatus.connected, triggerAutoSync]);




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
        },
      ]);
      setSelectedEvent(null);
      if (onRefreshActivities) onRefreshActivities();
    } catch {
      // abaikan kegagalan
    } finally {
      setImporting(false);
    }
  }

  // Helper untuk mendapatkan gabungan aktivitas & Google event pada suatu hari
  const getDayItems = useCallback(
    (dayDate: Date): CombinedItem[] => {
      const dayActivities = activities.filter((act) => {
        const itemDateStr = act.startTime || act.date;
        if (!itemDateStr) return false;
        const actDate = new Date(itemDateStr);
        return isSameDay(actDate, dayDate);
      });

      const dayGoogleEvents = googleEvents.filter((gEv) => {
        if (!gEv.start) return false;
        const gDate = new Date(gEv.start);
        return isSameDay(gDate, dayDate) && !dayActivities.some((act) => act.googleEventId === gEv.id);
      });

      const items: CombinedItem[] = [
        ...dayActivities.map((act) => ({
          type: 'activity' as const,
          id: `act-${act.id}`,
          act,
          time: act.startTime,
        })),
        ...dayGoogleEvents.map((gEv) => ({
          type: 'google' as const,
          id: `gcal-${gEv.id}`,
          gEv,
          time: gEv.start,
        })),
      ];

      return items;
    },
    [activities, googleEvents],
  );

  const today = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const currentTimeTop = (currentMinutes / 60) * HOUR_HEIGHT;
  const currentTimeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  // Render card kegiatan pada timeline bergaya Notion Calendar
  function renderEventCard(geo: TimedItemGeometry, cardDate: Date) {
    const { item, top, height, colIndex, totalCols } = geo;
    const isAct = item.type === 'activity';
    const hasGoogle = isAct && Boolean(item.act.googleEventId);
    const isDragOverThis = dragOverCardId === item.id;
    const isDraggingThis = draggingCardId === item.id;

    // Periksa apakah kartu sudah melewati garis merah (waktu sekarang)
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startOfCardDay = new Date(cardDate.getFullYear(), cardDate.getMonth(), cardDate.getDate()).getTime();
    const isDayInPast = startOfCardDay < startOfToday;
    const isToday = startOfCardDay === startOfToday;
    const isPassedRedLine = isDayInPast || (isToday && geo.startMin < currentMinutes);

    const widthPercent = 100 / totalCols;
    const leftPercent = colIndex * widthPercent;

    const isSelectedCard = selectedCardItem?.id === item.id;

    return (
      <div
        key={item.id}
        draggable={true}
        onDragStart={(e) => {
          e.stopPropagation();
          const durationMinutes = Math.max(15, (geo.endMin - geo.startMin) || 60);
          const rawId = isAct ? item.act.id : item.gEv.id;
          const cardPayload = {
            source: 'calendar-card' as const,
            itemType: isAct ? ('activity' as const) : ('google' as const),
            id: rawId,
            fullId: item.id,
            title: (isAct ? item.act.title : item.gEv.title) || 'Tanpa judul',
            originalDate: isAct ? (item.act.date || null) : (item.gEv.start || null),
            originalStartTime: isAct ? (item.act.startTime || null) : (item.gEv.start || null),
            originalEndTime: isAct ? (item.act.endTime || null) : (item.gEv.end || null),
            durationMinutes,
          };
          e.dataTransfer.setData('application/json', JSON.stringify(cardPayload));
          e.dataTransfer.setData('text/plain', JSON.stringify(cardPayload));
          e.dataTransfer.effectAllowed = 'move';
          setDraggingCardId(item.id);
        }}
        onDragEnd={() => {
          setDraggingCardId(null);
          setDragOverCardId(null);
          setDragOverSlot(null);
        }}
        onClick={(e) => {
          e.stopPropagation();
          setSelectedCardItem(item);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          setDragOverCardId(item.id);
        }}
        onDragLeave={(e) => {
          e.stopPropagation();
          if (dragOverCardId === item.id) {
            setDragOverCardId(null);
          }
        }}
        onDrop={(e) => {
          const timelineColumn = e.currentTarget.parentElement;
          if (timelineColumn) handleTimelineDrop(e, cardDate, timelineColumn);
        }}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${leftPercent}% + 2px)`,
          width: `calc(${widthPercent}% - 4px)`,
        }}
        className={`absolute z-10 overflow-hidden rounded-md border-l-[3.5px] px-2 py-1 text-xs cursor-grab active:cursor-grabbing select-none transition-all shadow-xs hover:shadow-md hover:z-20 ${
          isDraggingThis
            ? 'opacity-40 scale-[0.98] ring-2 ring-blue-400 z-40 !cursor-grabbing'
            : isSelectedCard
              ? 'ring-2 ring-blue-600 shadow-md z-30 scale-[1.01] !opacity-100'
              : isPassedRedLine
                ? 'opacity-40 hover:opacity-100'
                : 'opacity-100'
        } ${
          isDragOverThis
            ? 'ring-2 ring-violet-500 bg-violet-100/95 shadow-md z-30 scale-[1.01] !opacity-100'
            : 'border-blue-600 bg-blue-50/90 text-blue-950 border-r border-t border-b border-blue-200/60 hover:bg-blue-100'
        }`}
        title={isAct ? item.act.title : item.gEv.title}
      >
        {isDragOverThis && (
          <div className="absolute inset-0 bg-violet-600/15 backdrop-blur-[0.5px] flex items-center justify-center pointer-events-none z-20">
            <span className="rounded bg-violet-700 px-1.5 py-0.5 text-[9px] font-bold text-white shadow-xs animate-pulse">
              Letakkan di waktu ini
            </span>
          </div>
        )}
        <div className="flex items-center gap-1 leading-tight">
          <span className="truncate font-semibold text-[11px]">
            {isAct ? item.act.title : item.gEv.title}
          </span>
          {(hasGoogle || !isAct) && (
            <span title="Tersinkron ke Google Calendar" className="shrink-0 text-blue-500">
              <svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
              </svg>
            </span>
          )}
        </div>
        {height >= 36 && (
          <div className="mt-0.5 text-[10px] text-gray-500 font-mono">
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
                disabled={gcalLoading}
                onClick={() => void disconnectGcal()}
                className="inline-flex items-center rounded-lg border border-red-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-red-600 shadow-xs transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                title="Putuskan akun Google Calendar"
              >
                {gcalLoading ? 'Memutuskan…' : 'Putuskan'}
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
                  className={`py-2 px-1 text-center border-r border-gray-100 last:border-r-0 cursor-pointer select-none transition ${
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
                    className="border-b border-gray-100 text-right pr-2 text-[11px] font-mono text-gray-400 pt-1 select-none"
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
                        startMinutes: getSnappedDropMinutes(e.clientY, e.currentTarget),
                      });
                    }}
                    onDrop={(e) => {
                      handleTimelineDrop(e, dayDate, e.currentTarget);
                    }}
                    className={`relative border-r border-gray-100 last:border-r-0 ${
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
                            if (onCreateActivity) {
                              const target = new Date(dayDate);
                              target.setHours(hour, 0, 0, 0);
                              const end = new Date(target.getTime() + 3600000);
                              onCreateActivity(target, { startTime: target.toISOString(), endTime: end.toISOString() });
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            const timelineColumn = e.currentTarget.parentElement;
                            if (timelineColumn) {
                              setDragOverSlot({
                                dayDate: toISODate(dayDate),
                                startMinutes: getSnappedDropMinutes(e.clientY, timelineColumn),
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
                          className={`border-b border-gray-100 transition cursor-pointer ${
                            isDragOver ? 'bg-violet-100/70 ring-1 ring-inset ring-violet-400' : 'hover:bg-gray-50/60'
                          }`}
                          title={`Tambah kegiatan pada ${String(hour).padStart(2, '0')}:00`}
                        />
                      );
                    })}

                    {dragOverSlot?.dayDate === toISODate(dayDate) && (
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute left-0 right-0 z-40 border-t-2 border-violet-500"
                        style={{ top: `${dragOverSlot.startMinutes}px` }}
                      />
                    )}

                    {/* Blok-blok kegiatan terpeta sesuai jam */}
                    {timedItems.map((geo) => renderEventCard(geo, dayDate))}
                  </div>
                );
              })}

              {/* Garis Horizontal Waktu Sekarang (Merah ala Notion Calendar) - diletakkan setelah kolom hari dengan z-30 agar kartu saat di-hover tetap di belakang garis */}
              <div
                style={{ top: `${currentTimeTop}px`, left: '64px', right: 0 }}
                className="absolute z-30 pointer-events-none flex items-center"
              >
                <div className="h-2 w-2 rounded-full bg-red-600 -ml-1 shrink-0" />
                <div className="h-[2px] w-full bg-red-500 shadow-xs" />
              </div>
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
                    className="border-b border-gray-100 text-right pr-2 text-[11px] font-mono text-gray-400 pt-1 select-none"
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
                    startMinutes: getSnappedDropMinutes(e.clientY, e.currentTarget),
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
                        if (onCreateActivity) {
                          const target = new Date(selectedDate);
                          target.setHours(hour, 0, 0, 0);
                          const end = new Date(target.getTime() + 3600000);
                          onCreateActivity(target, { startTime: target.toISOString(), endTime: end.toISOString() });
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        const timelineColumn = e.currentTarget.parentElement;
                        if (timelineColumn) {
                          setDragOverSlot({
                            dayDate: toISODate(selectedDate),
                            startMinutes: getSnappedDropMinutes(e.clientY, timelineColumn),
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
                      className={`border-b border-gray-100 transition cursor-pointer ${
                        isDragOver ? 'bg-violet-100/70 ring-1 ring-inset ring-violet-400' : 'hover:bg-gray-50/60'
                      }`}
                      title={`Tambah kegiatan pada ${String(hour).padStart(2, '0')}:00`}
                    />
                  );
                })}

                {dragOverSlot?.dayDate === toISODate(selectedDate) && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute left-0 right-0 z-40 border-t-2 border-violet-500"
                    style={{ top: `${dragOverSlot.startMinutes}px` }}
                  />
                )}

                {/* Blok-blok kegiatan terpeta sesuai jam */}
                {computeTimedItemsLayout(getDayItems(selectedDate)).map((geo) =>
                  renderEventCard(geo, selectedDate),
                )}
              </div>

              {/* Garis Horizontal Waktu Sekarang (Merah ala Notion Calendar jika hari ini) - diletakkan setelah kolom hari dengan z-30 agar kartu saat di-hover tetap di belakang garis */}
              {isSameDay(selectedDate, today) && (
                <div
                  style={{ top: `${currentTimeTop}px`, left: '64px', right: 0 }}
                  className="absolute z-30 pointer-events-none flex items-center"
                >
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
              onRefresh={() => {
                if (onRefreshActivities) onRefreshActivities();
                void loadGoogleEvents();
              }}
              onOpenActivity={onOpenActivity}
              onDelete={handleDeleteCard}
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
    </div>
  );
}
