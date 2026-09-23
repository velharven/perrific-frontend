import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { DailyActivity, GoogleCalendarEvent } from '@/types';
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar';
import { useSocket } from '@/store/socket';
import { activityApi } from '@/api/activities';
import CalendarSidebar from './CalendarSidebar';

export type CalendarViewMode = 'day' | 'week' | 'month';

interface CalendarViewProps {
  activities: DailyActivity[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onOpenActivity?: (activity: DailyActivity) => void;
  onCreateActivity?: (date: Date) => void;
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

type CombinedItem =
  | { type: 'activity'; id: string; act: DailyActivity; time?: string | null }
  | { type: 'google'; id: string; gEv: GoogleCalendarEvent; time?: string };

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
        totalCols: Math.max(1, overlaps),
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
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [isViewMenuOpen, setIsViewMenuOpen] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<Date | null>(null);
  const [googleEvents, setGoogleEvents] = useState<GoogleCalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<GoogleCalendarEvent | null>(null);
  const [importing, setImporting] = useState(false);
  const [now, setNow] = useState(new Date());
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [dragOverDate, setDragOverDate] = useState<string | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<{ dayDate: string; hour: number } | null>(null);

  // Tangani kartu yang di-drop ke kalender dari sidebar
  const handleDropPayload = async (targetDate: Date, hour: number | null, rawJson: string) => {
    if (!rawJson) return;
    try {
      const payload = JSON.parse(rawJson) as {
        source: 'item' | 'team-task';
        id: string;
        title: string;
        taskId?: string;
        type?: DailyActivity['type'];
      };

      const startH = hour !== null ? hour : 9;
      const endH = hour !== null ? (hour + 1) % 24 : 10;

      const dateISO = toISODate(targetDate);
      const dateStr = new Date(`${dateISO}T00:00:00`).toISOString();

      const startTime = new Date(targetDate);
      startTime.setHours(startH, 0, 0, 0);
      const endTime = new Date(targetDate);
      endTime.setHours(endH, 0, 0, 0);

      if (payload.source === 'item') {
        await activityApi.update(payload.id, {
          date: dateStr,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        });
      } else if (payload.source === 'team-task') {
        await activityApi.create({
          title: payload.title,
          taskId: payload.taskId,
          type: 'TASK',
          date: dateStr,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          icon: 'check',
        });
      }

      if (onRefreshActivities) {
        onRefreshActivities();
      }
    } catch (e) {
      console.error('[CalendarView] Gagal menjadwalkan kartu ke kalender:', e);
    }
  };

  const viewMenuRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const isInitialActivitiesMount = useRef(true);

  const {
    status: gcalStatus,
    connecting: gcalConnecting,
    connect: connectGcal,
    fetchEvents,
    importEvents,
    autoSync,
  } = useGoogleCalendar();

  const { socket } = useSocket();

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

  // Otomatis gulir timeline ke jam saat ini / jam 08:00 saat masuk mode Minggu atau Hari
  useEffect(() => {
    if (viewMode === 'week' || viewMode === 'day') {
      const scrollHour = Math.max(0, new Date().getHours() - 1);
      const targetScrollTop = scrollHour * HOUR_HEIGHT;
      if (timelineScrollRef.current) {
        timelineScrollRef.current.scrollTop = targetScrollTop;
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

  // Dukungan pintasan keyboard: 1/D (Hari), 0/W (Minggu), M (Bulan)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === '1' || e.key.toLowerCase() === 'd') {
        setViewMode('day');
        setIsViewMenuOpen(false);
      } else if (e.key === '0' || e.key.toLowerCase() === 'w') {
        setViewMode('week');
        setIsViewMenuOpen(false);
      } else if (e.key.toLowerCase() === 'm') {
        setViewMode('month');
        setIsViewMenuOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Hitung rentang tanggal kalender bulan aktif
  const { days, rangeStart, rangeEnd } = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - startDayOfWeek);
    startDate.setHours(0, 0, 0, 0);

    let endDayOfWeek = lastDayOfMonth.getDay() - 1;
    if (endDayOfWeek === -1) endDayOfWeek = 6;

    const daysToAdd = 6 - endDayOfWeek;
    const endDate = new Date(lastDayOfMonth);
    endDate.setDate(endDate.getDate() + daysToAdd);
    endDate.setHours(23, 59, 59, 999);

    const result: Date[] = [];
    const curr = new Date(startDate);
    while (curr <= endDate) {
      result.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    return { days: result, rangeStart: startDate, rangeEnd: endDate };
  }, [currentYear, currentMonth]);

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

  // Navigasi prev sesuai mode tampilan
  function handlePrev() {
    if (viewMode === 'month') {
      if (currentMonth === 0) {
        setCurrentMonth(11);
        setCurrentYear((y) => y - 1);
      } else {
        setCurrentMonth((m) => m - 1);
      }
    } else if (viewMode === 'week') {
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
    if (viewMode === 'month') {
      if (currentMonth === 11) {
        setCurrentMonth(0);
        setCurrentYear((y) => y + 1);
      } else {
        setCurrentMonth((m) => m + 1);
      }
    } else if (viewMode === 'week') {
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
    if (viewMode === 'month') {
      return `${MONTH_NAMES[currentMonth]} ${currentYear}`;
    }
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
  }, [viewMode, currentMonth, currentYear, weekDays, selectedDate]);

  // Sinkronisasi 2 arah untuk 1 hari (hari yang dipilih / hari ini) tanpa perlu reload halaman
  const triggerAutoSync = useCallback(async () => {
    if (!gcalStatus.connected || isSyncingRef.current) return;
    isSyncingRef.current = true;
    try {
      const dayStart = new Date(selectedDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(selectedDate);
      dayEnd.setHours(23, 59, 59, 999);

      await autoSync(dayStart.toISOString(), dayEnd.toISOString());
      await loadGoogleEvents();
      if (onRefreshActivities) onRefreshActivities();
    } catch (err) {
      console.error('[CalendarView] autoSync error:', err);
    } finally {
      isSyncingRef.current = false;
    }
  }, [gcalStatus.connected, autoSync, selectedDate, loadGoogleEvents, onRefreshActivities]);

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
        const actDate = new Date(act.date);
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
  function renderEventCard(geo: TimedItemGeometry) {
    const { item, top, height, colIndex, totalCols } = geo;
    const isAct = item.type === 'activity';
    const isDone = isAct && item.act.status === 'COMPLETED';
    const isSkipped = isAct && item.act.status === 'SKIPPED';
    const hasGoogle = isAct && Boolean(item.act.googleEventId);

    const widthPercent = 100 / totalCols;
    const leftPercent = colIndex * widthPercent;

    return (
      <div
        key={item.id}
        onClick={(e) => {
          e.stopPropagation();
          if (isAct && onOpenActivity) onOpenActivity(item.act);
          if (!isAct) setSelectedEvent(item.gEv);
        }}
        style={{
          top: `${top}px`,
          height: `${height}px`,
          left: `calc(${leftPercent}% + 2px)`,
          width: `calc(${widthPercent}% - 4px)`,
        }}
        className={`absolute z-10 overflow-hidden rounded-md border-l-[3.5px] px-2 py-1 text-xs cursor-pointer select-none transition-all shadow-xs hover:shadow-md hover:z-20 ${
          !isAct
            ? 'border-emerald-500 bg-emerald-50/90 text-emerald-950 border-r border-t border-b border-emerald-200/60 hover:bg-emerald-100'
            : isDone
              ? 'border-gray-400 bg-gray-100/90 text-gray-500 line-through border-r border-t border-b border-gray-200'
              : isSkipped
                ? 'border-amber-500 bg-amber-50/90 text-amber-950 border-r border-t border-b border-amber-200/60'
                : 'border-blue-600 bg-blue-50/90 text-blue-950 border-r border-t border-b border-blue-200/60 hover:bg-blue-100'
        }`}
        title={isAct ? item.act.title : item.gEv.title}
      >
        <div className="flex items-center gap-1 leading-tight">
          {!isAct && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
          )}
          <span className="truncate font-semibold text-[11px]">
            {isAct ? item.act.title : item.gEv.title}
          </span>
          {hasGoogle && (
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
              <span>{viewMode === 'day' ? 'Hari' : viewMode === 'week' ? 'Minggu' : 'Bulan'}</span>
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

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setViewMode('month');
                    setIsViewMenuOpen(false);
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition ${
                    viewMode === 'month'
                      ? 'bg-blue-50 font-semibold text-blue-700'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 text-center text-blue-600 font-bold">
                      {viewMode === 'month' ? '✓' : ''}
                    </span>
                    <span>Bulan</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-400">M</span>
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

      {/* Kontainer Utama: Kalender di sisi kiri & Menu Samping di sisi kanan */}
      <div className="flex gap-4 items-start">
        <div className="flex-1 min-w-0 space-y-4">
          {/* ============================================================== */}
          {/* 1. TAMPILAN BULAN (MONTH VIEW)                                 */}
          {/* ============================================================== */}
          {viewMode === 'month' && (
            <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm">
              {/* Nama-nama hari */}
              <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50/80 text-center text-xs font-medium text-gray-500 py-2">
                {DAY_NAMES.map((name) => (
                  <div key={name}>{name}</div>
                ))}
              </div>

              {/* Kotak-kotak tanggal */}
              <div className="grid grid-cols-7 divide-x divide-y divide-gray-100">
                {days.map((dayDate, idx) => {
                  const isCurrentMonth = dayDate.getMonth() === currentMonth;
                  const isToday = isSameDay(dayDate, today);
                  const isSelected = isSameDay(dayDate, selectedDate);
                  const isDragOver = dragOverDate === toISODate(dayDate);

                  const allItems = getDayItems(dayDate);
                  const totalItems = allItems.length;

                  // Aturan format tampilan bulanan:
                  // Jika <= 4 kegiatan: tampilkan 4 kegiatan penuh di 1 hari.
                  // Jika > 4 kegiatan (misal 5): tampilkan 3 kegiatan lalu teks "2 lagi" (total - 3).
                  const visibleItems = totalItems <= 4 ? allItems : allItems.slice(0, 3);
                  const remainingCount = totalItems > 4 ? totalItems - 3 : 0;

                  return (
                    <div
                      key={idx}
                      onClick={() => onSelectDate(dayDate)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverDate(toISODate(dayDate));
                      }}
                      onDragLeave={() => setDragOverDate(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverDate(null);
                        const raw = e.dataTransfer.getData('application/json');
                        void handleDropPayload(dayDate, null, raw);
                      }}
                      className={`group min-h-[116px] p-1.5 flex flex-col transition cursor-pointer select-none ${
                        isCurrentMonth ? 'bg-white' : 'bg-gray-50/40 text-gray-400'
                      } ${
                        isDragOver
                          ? 'ring-2 ring-violet-500 bg-violet-50/40'
                          : isSelected
                            ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/20'
                            : 'hover:bg-gray-50/70'
                      }`}
                    >
                  {/* Header kotak tanggal: angka + tombol tambah */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`inline-flex items-center justify-center text-xs font-semibold ${
                        isToday
                          ? 'h-5 w-5 rounded-full bg-blue-600 text-white'
                          : isCurrentMonth
                            ? 'text-gray-800'
                            : 'text-gray-400'
                      }`}
                    >
                      {dayDate.getDate()}
                    </span>

                    {onCreateActivity && (
                      <button
                        type="button"
                        title="Tambah kegiatan di tanggal ini"
                        onClick={(e) => {
                          e.stopPropagation();
                          onCreateActivity(dayDate);
                        }}
                        className="opacity-0 group-hover:opacity-100 rounded p-0.5 text-gray-400 hover:text-blue-600 hover:bg-gray-100 transition"
                      >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Daftar item kegiatan lokal & event Google */}
                  <div className="flex flex-col gap-1 overflow-hidden pr-0.5">
                    {visibleItems.map((item) => {
                      if (item.type === 'activity') {
                        const act = item.act;
                        const isDone = act.status === 'COMPLETED';
                        const hasGoogle = Boolean(act.googleEventId);

                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onOpenActivity) onOpenActivity(act);
                            }}
                            className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight transition ${
                              isDone
                                ? 'bg-gray-100 text-gray-400 line-through'
                                : 'bg-blue-50/80 text-blue-900 hover:bg-blue-100'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                isDone ? 'bg-gray-400' : 'bg-blue-500'
                              }`}
                            />
                            <span className="truncate flex-1 font-medium">{act.title}</span>
                            {hasGoogle && (
                              <span title="Tersinkron ke Google Calendar" className="shrink-0 text-blue-500">
                                <svg width="9" height="9" viewBox="0 0 16 16" fill="currentColor">
                                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                                </svg>
                              </span>
                            )}
                            {act.startTime && (
                              <span className="text-[10px] text-gray-500 shrink-0">
                                {formatTime(act.startTime)}
                              </span>
                            )}
                          </div>
                        );
                      }

                      const gEv = item.gEv;
                      return (
                        <div
                          key={item.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(gEv);
                          }}
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] leading-tight bg-emerald-50 text-emerald-900 border border-emerald-200/60 hover:bg-emerald-100 transition"
                        >
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" className="shrink-0">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                          </svg>
                          <span className="truncate flex-1 font-medium">{gEv.title}</span>
                          {gEv.start && gEv.start.includes('T') && (
                            <span className="text-[10px] text-emerald-700 shrink-0">
                              {formatTime(gEv.start)}
                            </span>
                          )}
                        </div>
                      );
                    })}

                    {/* Tombol N lagi jika kegiatan > 4 */}
                    {remainingCount > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDayModalDate(dayDate);
                        }}
                        className="mt-0.5 text-left text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline px-1 py-0.5 rounded hover:bg-blue-50/70 transition"
                      >
                        {remainingCount} lagi
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

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

          {/* Baris Sepanjang Hari (All-day) */}
          <div className="grid grid-cols-[64px_repeat(7,1fr)] border-b border-gray-200 bg-gray-50/60 min-h-[38px]">
            <div className="px-2 py-1.5 border-r border-gray-200 text-[10px] font-medium text-gray-400 flex items-center justify-center text-center">
              Sepanjang hari
            </div>
            {weekDays.map((dayDate, idx) => {
              const items = getDayItems(dayDate);
              const allDayItems = items.filter((it) => parseTimeToMinutes(it.time) === null);

              return (
                <div
                  key={idx}
                  onClick={() => onSelectDate(dayDate)}
                  className="p-1 border-r border-gray-100 last:border-r-0 flex flex-col gap-1 min-h-[36px]"
                >
                  {allDayItems.map((it) => {
                    const isAct = it.type === 'activity';
                    return (
                      <div
                        key={it.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isAct && onOpenActivity) onOpenActivity(it.act);
                          if (!isAct) setSelectedEvent(it.gEv);
                        }}
                        className={`truncate rounded px-1.5 py-0.5 text-[10px] font-medium cursor-pointer border ${
                          isAct
                            ? 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {isAct ? it.act.title : it.gEv.title}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* Timeline Grid Jam Vertikal 24 Jam */}
          <div
            ref={timelineScrollRef}
            className="overflow-y-auto max-h-[620px] bg-white relative select-none"
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
                    className={`relative border-r border-gray-100 last:border-r-0 ${
                      isSelected ? 'bg-blue-50/10' : 'bg-white'
                    }`}
                  >
                    {/* Garis kisi per jam */}
                    {HOURS.map((hour) => {
                      const isDragOver =
                        dragOverSlot?.dayDate === toISODate(dayDate) && dragOverSlot?.hour === hour;
                      return (
                        <div
                          key={hour}
                          style={{ height: `${HOUR_HEIGHT}px` }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onCreateActivity) {
                              const target = new Date(dayDate);
                              target.setHours(hour, 0, 0, 0);
                              onCreateActivity(target);
                            }
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            setDragOverSlot({ dayDate: toISODate(dayDate), hour });
                          }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => {
                            e.preventDefault();
                            setDragOverSlot(null);
                            const raw = e.dataTransfer.getData('application/json');
                            void handleDropPayload(dayDate, hour, raw);
                          }}
                          className={`border-b border-gray-100 transition cursor-pointer ${
                            isDragOver ? 'bg-violet-100/70 ring-1 ring-inset ring-violet-400' : 'hover:bg-gray-50/60'
                          }`}
                          title={`Tambah kegiatan pada ${String(hour).padStart(2, '0')}:00`}
                        />
                      );
                    })}

                    {/* Blok-blok kegiatan terpeta sesuai jam */}
                    {timedItems.map((geo) => renderEventCard(geo))}
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

          {/* Baris Sepanjang Hari (All-day) */}
          {(() => {
            const items = getDayItems(selectedDate);
            const allDayItems = items.filter((it) => parseTimeToMinutes(it.time) === null);
            if (allDayItems.length === 0) return null;

            return (
              <div className="grid grid-cols-[64px_1fr] border-b border-gray-200 bg-gray-50/60 min-h-[38px]">
                <div className="px-2 py-1.5 border-r border-gray-200 text-[10px] font-medium text-gray-400 flex items-center justify-center text-center">
                  Sepanjang hari
                </div>
                <div className="p-1.5 flex flex-wrap gap-1.5">
                  {allDayItems.map((it) => {
                    const isAct = it.type === 'activity';
                    return (
                      <div
                        key={it.id}
                        onClick={() => {
                          if (isAct && onOpenActivity) onOpenActivity(it.act);
                          if (!isAct) setSelectedEvent(it.gEv);
                        }}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium cursor-pointer border ${
                          isAct
                            ? 'bg-blue-50 text-blue-900 border-blue-200 hover:bg-blue-100'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {isAct ? it.act.title : it.gEv.title}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Timeline Grid Jam Vertikal 24 Jam */}
          <div
            ref={timelineScrollRef}
            className="overflow-y-auto max-h-[620px] bg-white relative select-none"
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
              <div className="relative bg-white">
                {/* Garis kisi per jam */}
                {HOURS.map((hour) => {
                  const isDragOver =
                    dragOverSlot?.dayDate === toISODate(selectedDate) && dragOverSlot?.hour === hour;
                  return (
                    <div
                      key={hour}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onCreateActivity) {
                          const target = new Date(selectedDate);
                          target.setHours(hour, 0, 0, 0);
                          onCreateActivity(target);
                        }
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setDragOverSlot({ dayDate: toISODate(selectedDate), hour });
                      }}
                      onDragLeave={() => setDragOverSlot(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverSlot(null);
                        const raw = e.dataTransfer.getData('application/json');
                        void handleDropPayload(selectedDate, hour, raw);
                      }}
                      className={`border-b border-gray-100 transition cursor-pointer ${
                        isDragOver ? 'bg-violet-100/70 ring-1 ring-inset ring-violet-400' : 'hover:bg-gray-50/60'
                      }`}
                      title={`Tambah kegiatan pada ${String(hour).padStart(2, '0')}:00`}
                    />
                  );
                })}

                {/* Blok-blok kegiatan terpeta sesuai jam */}
                {computeTimedItemsLayout(getDayItems(selectedDate)).map((geo) =>
                  renderEventCard(geo),
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

        {/* Menu Samping: Item & Team Task belum terjadwal (sisi kanan) */}
        <CalendarSidebar
          activities={activities}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen((v) => !v)}
          onRefresh={onRefreshActivities}
        />
      </div>

      {/* ============================================================== */}
      {/* 4. MODAL SEMUA KEGIATAN PER TANGGAL (Pemicu: "X lagi")        */}
      {/* ============================================================== */}
      {dayModalDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl border border-gray-100 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-blue-600">
                  Daftar Lengkap Kegiatan
                </span>
                <h3 className="text-base font-bold text-gray-900">
                  {FULL_DAY_NAMES[dayModalDate.getDay()]}, {dayModalDate.getDate()}{' '}
                  {MONTH_NAMES[dayModalDate.getMonth()]} {dayModalDate.getFullYear()}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDayModalDate(null)}
                className="rounded-lg p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col gap-2 max-h-[360px] overflow-y-auto pr-1">
              {getDayItems(dayModalDate).map((item) => {
                if (item.type === 'activity') {
                  const act = item.act;
                  const isDone = act.status === 'COMPLETED';
                  const hasGoogle = Boolean(act.googleEventId);

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setDayModalDate(null);
                        if (onOpenActivity) onOpenActivity(act);
                      }}
                      className={`flex items-center justify-between gap-2 rounded-lg border p-2.5 cursor-pointer transition ${
                        isDone
                          ? 'border-gray-200 bg-gray-50 text-gray-400'
                          : 'border-blue-100 bg-blue-50/50 hover:bg-blue-100/60'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            isDone ? 'bg-gray-400' : 'bg-blue-600'
                          }`}
                        />
                        <span className={`text-xs font-medium truncate ${isDone ? 'line-through' : 'text-gray-900'}`}>
                          {act.title}
                        </span>
                        {hasGoogle && (
                          <span title="Tersinkron ke Google Calendar" className="shrink-0 text-blue-500">
                            <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                            </svg>
                          </span>
                        )}
                      </div>
                      {act.startTime && (
                        <span className="text-[11px] font-mono text-gray-500 shrink-0">
                          {formatTime(act.startTime)}
                        </span>
                      )}
                    </div>
                  );
                }

                const gEv = item.gEv;
                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setDayModalDate(null);
                      setSelectedEvent(gEv);
                    }}
                    className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 p-2.5 cursor-pointer hover:bg-emerald-100/60 transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className="shrink-0">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                      </svg>
                      <span className="text-xs font-medium text-emerald-950 truncate">
                        {gEv.title}
                      </span>
                    </div>
                    {gEv.start && gEv.start.includes('T') && (
                      <span className="text-[11px] font-mono text-emerald-700 shrink-0">
                        {formatTime(gEv.start)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
              <button
                type="button"
                onClick={() => {
                  onSelectDate(dayModalDate);
                  setViewMode('day');
                  setDayModalDate(null);
                }}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Buka Tampilan Hari Ini →
              </button>
              <div className="flex items-center gap-2">
                {onCreateActivity && (
                  <button
                    type="button"
                    onClick={() => {
                      onCreateActivity(dayModalDate);
                      setDayModalDate(null);
                    }}
                    className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition"
                  >
                    + Tambah Kegiatan
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDayModalDate(null)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
