import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
  DailyActivity,
  GoogleCalendarEvent,
  RecurrenceConfig,
  RecurrenceEndType,
  RecurrenceFrequency,
} from '@/types';
import { activityApi } from '@/api/activities';
import { calendarApi } from '@/api/calendar';
import {
  DAY_NAMES_ID,
  DAY_PILLS_ID,
  formatRecurrenceLabel,
  getNthWeekdayInfo,
  getRecurrencePresets,
  isSameRecurrence,
  toLocalMidnight,
} from '@/lib/recurrence';
import { CALENDAR_COLORS, getCalendarColorMeta } from '@/lib/calendarColors';
import TimePickerInput from '@/components/ui/TimePickerInput';
import { showToast } from '@/components/ui/Toast';

export type CombinedItem =
  | { type: 'activity'; id: string; act: DailyActivity; time?: string | null }
  | { type: 'google'; id: string; gEv: GoogleCalendarEvent; time?: string };

interface CalendarCardSettingsProps {
  selectedItem: CombinedItem;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenActivity?: (activity: DailyActivity) => void;
  onDelete?: (item: CombinedItem) => Promise<void>;
}

function toDateInputValue(d: Date | string | null | undefined): string {
  if (!d) return new Date().toISOString().split('T')[0];
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
    return d.trim();
  }
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return new Date().toISOString().split('T')[0];
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toTimeInputValue(isoOrTime?: string | null): string {
  if (!isoOrTime) return '09:00';
  if (isoOrTime.includes('T')) {
    const d = new Date(isoOrTime);
    if (isNaN(d.getTime())) return '09:00';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
  const parts = isoOrTime.trim().split(':');
  if (parts.length >= 2) {
    return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}`;
  }
  return '09:00';
}

function parseTimeToMinutes(timeStr?: string | null): number | null {
  if (!timeStr) return null;
  const parts = timeStr.trim().split(':');
  if (parts.length >= 2) {
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
  }
  return null;
}

function formatDuration(startStr: string, endStr: string): string {
  const startM = parseTimeToMinutes(startStr);
  const endM = parseTimeToMinutes(endStr);
  if (startM === null || endM === null) return '';
  let diff = endM - startM;
  if (diff < 0) diff += 1440;
  if (diff === 0) return '0 mnt';
  const hours = Math.floor(diff / 60);
  const mins = diff % 60;
  if (hours > 0 && mins > 0) return `${hours} jam ${mins} mnt`;
  if (hours > 0) return `${hours} jam`;
  return `${mins} mnt`;
}

function formatHumanDate(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(`${dateStr}T00:00:00`);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function defaultUntilDateFromAnchor(anchorStr: string): string {
  const base = toLocalMidnight(anchorStr || new Date());
  const future = new Date(base.getFullYear(), base.getMonth() + 1, base.getDate());
  return toDateInputValue(future);
}

export default function CalendarCardSettings({
  selectedItem,
  onClose,
  onRefresh,
  onOpenActivity,
  onDelete,
}: CalendarCardSettingsProps) {
  const isAct = selectedItem.type === 'activity';
  const act = isAct ? selectedItem.act : null;
  const gEv = !isAct ? selectedItem.gEv : null;

  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [startTimeStr, setStartTimeStr] = useState('09:00');
  const [endTimeStr, setEndTimeStr] = useState('10:00');
  const [isAllDay, setIsAllDay] = useState(false);
  const [recurrence, setRecurrence] = useState<RecurrenceConfig | null>(null);
  const [deleting, setDeleting] = useState(false);
  const savingPromiseRef = useRef<Promise<void> | null>(null);
  const deletingRef = useRef(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // State menu Repeat & modal Custom Repeat
  const [repeatMenuOpen, setRepeatMenuOpen] = useState(false);
  const [customModalOpen, setCustomModalOpen] = useState(false);
  const repeatButtonRef = useRef<HTMLButtonElement | null>(null);
  const repeatMenuRef = useRef<HTMLDivElement | null>(null);
  const [repeatMenuPos, setRepeatMenuPos] = useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  });

  // State menu Warna & modal konfirmasi cakupan warna kegiatan berulang
  const [color, setColor] = useState<string | null>(null);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const colorButtonRef = useRef<HTMLButtonElement | null>(null);
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const [colorMenuPos, setColorMenuPos] = useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  });
  const [scopeModalOpen, setScopeModalOpen] = useState(false);
  const [pendingColor, setPendingColor] = useState<string | null>(null);
  const [selectedScope, setSelectedScope] = useState<'THIS_EVENT' | 'ALL_EVENTS'>('THIS_EVENT');

  // State form Custom Repeat Modal
  const [customInterval, setCustomInterval] = useState<number>(1);
  const [customFreq, setCustomFreq] = useState<RecurrenceFrequency>('WEEKLY');
  const [customByDays, setCustomByDays] = useState<number[]>([0]);
  const [customMonthlyMode, setCustomMonthlyMode] = useState<'DAY_OF_MONTH' | 'NTH_WEEKDAY'>(
    'DAY_OF_MONTH',
  );
  const [customEndType, setCustomEndType] = useState<RecurrenceEndType>('NEVER');
  const [customUntilDate, setCustomUntilDate] = useState<string>('');
  const [customCount, setCustomCount] = useState<number>(13);

  // Inisialisasi state dari item yang dipilih
  useEffect(() => {
    setRepeatMenuOpen(false);
    setCustomModalOpen(false);
    setColorMenuOpen(false);
    setScopeModalOpen(false);
    if (isAct && act) {
      setTitle(act.title || '');
      setDateStr(toDateInputValue(act.date));
      const hasTime = Boolean(act.startTime);
      setIsAllDay(!hasTime);
      setStartTimeStr(toTimeInputValue(act.startTime));
      setEndTimeStr(
        toTimeInputValue(
          act.endTime ||
            (act.startTime
              ? new Date(new Date(act.startTime).getTime() + 3600000).toISOString()
              : '10:00'),
        ),
      );
      setRecurrence(act.recurrence ?? null);
      setColor(act.color ?? null);
    } else if (gEv) {
      setTitle(gEv.title || 'Event Google');
      setDateStr(toDateInputValue(gEv.start));
      const hasTime = Boolean(gEv.start?.includes('T'));
      setIsAllDay(!hasTime);
      setStartTimeStr(toTimeInputValue(gEv.start));
      setEndTimeStr(toTimeInputValue(gEv.end));
      setRecurrence(null);
      setColor(gEv.colorId ?? null);
    }
  }, [selectedItem, isAct, act, gEv]);

  // Hitung posisi menu Repeat agar muncul di sebelah KIRI tombol Repeat
  // dan menyesuaikan posisi vertikal (top) agar selalu terlihat 100% penuh di layar.
  useLayoutEffect(() => {
    if (!repeatMenuOpen) return;

    const updatePosition = () => {
      const btnEl = repeatButtonRef.current;
      const menuEl = repeatMenuRef.current;
      if (!btnEl || !menuEl) return;

      const btnRect = btnEl.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const margin = 12;

      // Tempatkan di sebelah kiri tombol Repeat
      let left = btnRect.left - menuRect.width - 8;
      if (left < margin) {
        // Fallback jika layar terlalu sempit
        left = Math.max(margin, Math.min(btnRect.right - menuRect.width, viewportW - menuRect.width - margin));
      }

      // Sesuaikan tinggi/vertikal agar seluruh menu terlihat penuh
      let top = btnRect.top;
      if (top + menuRect.height > viewportH - margin) {
        top = viewportH - menuRect.height - margin;
      }
      if (top < margin) {
        top = margin;
      }

      setRepeatMenuPos({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [repeatMenuOpen]);

  // Tutup menu Repeat saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!repeatMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        repeatMenuRef.current?.contains(target) ||
        repeatButtonRef.current?.contains(target)
      ) {
        return;
      }
      setRepeatMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRepeatMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [repeatMenuOpen]);

  // Hitung posisi popover palet Warna agar muncul di sebelah KIRI tombol Warna
  useLayoutEffect(() => {
    if (!colorMenuOpen) return;

    const updatePosition = () => {
      const btnEl = colorButtonRef.current;
      const menuEl = colorMenuRef.current;
      if (!btnEl || !menuEl) return;

      const btnRect = btnEl.getBoundingClientRect();
      const menuRect = menuEl.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;
      const margin = 12;

      let left = btnRect.left - menuRect.width - 8;
      if (left < margin) {
        left = Math.max(margin, Math.min(btnRect.right - menuRect.width, viewportW - menuRect.width - margin));
      }

      let top = btnRect.top;
      if (top + menuRect.height > viewportH - margin) {
        top = viewportH - menuRect.height - margin;
      }
      if (top < margin) {
        top = margin;
      }

      setColorMenuPos({ top, left });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [colorMenuOpen]);

  // Tutup menu Warna saat klik di luar atau tekan Escape
  useEffect(() => {
    if (!colorMenuOpen) return;
    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        colorMenuRef.current?.contains(target) ||
        colorButtonRef.current?.contains(target)
      ) {
        return;
      }
      setColorMenuOpen(false);
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setColorMenuOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [colorMenuOpen]);

  const currentColorMeta = useMemo(() => getCalendarColorMeta(color), [color]);

  const durationText = useMemo(() => {
    if (isAllDay) return 'Sepanjang hari';
    return formatDuration(startTimeStr, endTimeStr);
  }, [isAllDay, startTimeStr, endTimeStr]);

  const presets = useMemo(
    () => getRecurrencePresets(dateStr || new Date()),
    [dateStr],
  );

  const isCustomRecurrenceSelected = useMemo(() => {
    if (!recurrence) return false;
    return !presets.some((p) => p.config && isSameRecurrence(p.config, recurrence));
  }, [recurrence, presets]);

  const recurrenceSummaryLabel = useMemo(
    () => formatRecurrenceLabel(recurrence, dateStr || new Date()),
    [recurrence, dateStr],
  );

  // Simpan perubahan ke backend
  const handleSave = (override?: {
    allDay?: boolean;
    nextDateStr?: string;
    nextRecurrence?: RecurrenceConfig | null;
    nextColor?: string | null;
    nextStartTimeStr?: string;
    nextEndTimeStr?: string;
  }): Promise<void> => {
    if (deletingRef.current) return Promise.resolve();
    const effectiveAllDay = override?.allDay !== undefined ? override.allDay : isAllDay;
    const effectiveDateStr = override?.nextDateStr !== undefined ? override.nextDateStr : dateStr;
    const effectiveRecurrence =
      override?.nextRecurrence !== undefined ? override.nextRecurrence : recurrence;
    const effectiveColor =
      override?.nextColor !== undefined ? override.nextColor : color;
    const effectiveStartTimeStr = override?.nextStartTimeStr ?? startTimeStr;
    const effectiveEndTimeStr = override?.nextEndTimeStr ?? endTimeStr;
    const previousSave = savingPromiseRef.current;

    const save = (async () => {
      if (previousSave) await previousSave;
      try {
        let startIso: string | null = null;
        let endIso: string | null = null;

        if (!effectiveAllDay) {
          startIso = new Date(`${effectiveDateStr}T${effectiveStartTimeStr}:00`).toISOString();
          endIso = new Date(`${effectiveDateStr}T${effectiveEndTimeStr}:00`).toISOString();
        }

        if (isAct && act) {
          await activityApi.update(act.id, {
            title: title.trim() || 'Tanpa judul',
            date: `${effectiveDateStr}T00:00:00.000Z`,
            startTime: startIso,
            endTime: endIso,
            recurrence: effectiveRecurrence,
            color: effectiveColor,
          });
        } else if (gEv) {
          await calendarApi.updateEvent(gEv.id, {
            title: title.trim() || 'Tanpa judul',
            date: `${effectiveDateStr}T00:00:00.000Z`,
            startTime: startIso,
            endTime: endIso,
            recurrence: effectiveRecurrence as unknown as Record<string, unknown> | null,
            colorId: effectiveColor,
          });
        }

        onRefresh?.();
      } catch (err) {
        console.error('[CalendarCardSettings] Gagal menyimpan kegiatan:', err);
        showToast('Gagal menyimpan perubahan kegiatan.');
      }
    })();
    savingPromiseRef.current = save;
    void save.finally(() => {
      if (savingPromiseRef.current === save) savingPromiseRef.current = null;
    });
    return save;
  };

  // Tangani pemilihan warna dari palet
  const handleSelectColor = (chosenColorId: string | null) => {
    const isRepeating = Boolean(
      (isAct && act?.recurrence) ||
      (!isAct && (gEv?.recurringEventId || gEv?.id?.includes('_'))),
    );

    if (!isRepeating) {
      setColor(chosenColorId);
      setColorMenuOpen(false);
      void handleSave({ nextColor: chosenColorId });
    } else {
      setColorMenuOpen(false);
      setPendingColor(chosenColorId);
      setSelectedScope('THIS_EVENT');
      setScopeModalOpen(true);
    }
  };

  // Konfirmasi perubahan warna pada kegiatan berulang
  const handleConfirmScopeSave = async () => {
    const chosenColor = pendingColor;
    const scope = selectedScope;
    setScopeModalOpen(false);
    setPendingColor(null);

    if (scope === 'ALL_EVENTS') {
      setColor(chosenColor);
      await handleSave({ nextColor: chosenColor });
    } else {
      // Hanya Event Ini (THIS_EVENT): simpan perubahan warna hanya untuk tanggal terpilih
      if (isAct && act) {
        let startIso: string | null = null;
        let endIso: string | null = null;
        if (!isAllDay) {
          startIso = new Date(`${dateStr}T${startTimeStr}:00`).toISOString();
          endIso = new Date(`${dateStr}T${endTimeStr}:00`).toISOString();
        }
        await activityApi.create({
          title: title.trim() || act.title || 'Tanpa judul',
          description: act.description,
          date: new Date(`${dateStr}T00:00:00`).toISOString(),
          startTime: startIso,
          endTime: endIso,
          type: act.type || 'CUSTOM',
          status: act.status || 'PENDING',
          icon: act.icon,
          color: chosenColor,
          recurrence: null,
        });
      } else if (gEv) {
        await calendarApi.updateEvent(gEv.id, {
          colorId: chosenColor,
        });
      }
      onRefresh?.();
    }
  };

  // Buka modal Custom Repeat dengan nilai awal dari recurrence saat ini
  const openCustomRepeatModal = () => {
    setRepeatMenuOpen(false);
    const anchor = toLocalMidnight(dateStr || new Date());
    const anchorDow = anchor.getDay();

    if (recurrence) {
      setCustomInterval(Math.max(1, recurrence.interval || 1));
      setCustomFreq(recurrence.freq);
      setCustomByDays(
        recurrence.byDays && recurrence.byDays.length > 0
          ? [...recurrence.byDays]
          : [anchorDow],
      );
      setCustomMonthlyMode(recurrence.byWeekOfMonth ? 'NTH_WEEKDAY' : 'DAY_OF_MONTH');
      setCustomEndType(recurrence.endType || 'NEVER');
      setCustomUntilDate(
        recurrence.untilDate || defaultUntilDateFromAnchor(dateStr),
      );
      setCustomCount(recurrence.count && recurrence.count > 0 ? recurrence.count : 13);
    } else {
      setCustomInterval(1);
      setCustomFreq('WEEKLY');
      setCustomByDays([anchorDow]);
      setCustomMonthlyMode('DAY_OF_MONTH');
      setCustomEndType('NEVER');
      setCustomUntilDate(defaultUntilDateFromAnchor(dateStr));
      setCustomCount(13);
    }

    setCustomModalOpen(true);
  };

  const handleSaveCustomRepeat = () => {
    const anchor = toLocalMidnight(dateStr || new Date());
    const { week, dayOfWeek } = getNthWeekdayInfo(anchor);

    const nextConfig: RecurrenceConfig = {
      freq: customFreq,
      interval: Math.max(1, Number(customInterval) || 1),
      endType: customEndType,
    };

    if (customFreq === 'WEEKLY') {
      nextConfig.byDays =
        customByDays.length > 0
          ? [...customByDays].sort((a, b) => a - b)
          : [anchor.getDay()];
    } else if (customFreq === 'MONTHLY') {
      if (customMonthlyMode === 'NTH_WEEKDAY') {
        nextConfig.byWeekOfMonth = { week, dayOfWeek };
      } else {
        nextConfig.byMonthDay = anchor.getDate();
      }
    }

    if (customEndType === 'ON_DATE') {
      nextConfig.untilDate = customUntilDate || defaultUntilDateFromAnchor(dateStr);
    } else if (customEndType === 'AFTER') {
      nextConfig.count = Math.max(1, Number(customCount) || 1);
    }

    setRecurrence(nextConfig);
    setCustomModalOpen(false);
    void handleSave({ nextRecurrence: nextConfig });
  };

  // Hapus kegiatan
  const handleDelete = async () => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    setDeleting(true);
    try {
      await savingPromiseRef.current;
      if (onDelete) {
        await onDelete(selectedItem);
        onClose();
      } else {
        if (!window.confirm(`Hapus kegiatan "${title || 'Tanpa judul'}"?`)) {
          setDeleting(false);
          return;
        }
        if (isAct && act) {
          await activityApi.remove(act.id);
        } else if (gEv) {
          await calendarApi.deleteEvent(gEv.id);
        }
        onClose();
        onRefresh?.();
      }
    } catch (err) {
      console.error('[CalendarCardSettings] Gagal menghapus kegiatan:', err);
    } finally {
      deletingRef.current = false;
      setDeleting(false);
    }
  };

  const anchorDateObj = useMemo(() => toLocalMidnight(dateStr || new Date()), [dateStr]);
  const anchorNthInfo = useMemo(() => getNthWeekdayInfo(anchorDateObj), [anchorDateObj]);

  return (
    <div className="w-full shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3 font-givonic">
      {/* Header bar: Label & Close Button */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-lg transition-colors"
            style={{
              backgroundColor: `${currentColorMeta.solidHex}20`,
              color: currentColorMeta.solidHex,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11 2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1V2zm-4 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V6zm-4 4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-4z" />
            </svg>
          </span>
          <span className="text-[11px] font-bold text-gray-700 tracking-wide uppercase">
            Pengaturan Kegiatan
          </span>
          {(!isAct || Boolean(act?.googleEventId)) && (
            <span title="Tersinkron ke Google Calendar" className="text-blue-500">
              <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
              </svg>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          title="Tutup pengaturan"
          className="flex h-6 w-6 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition cursor-pointer"
        >
          ✕
        </button>
      </div>

      {/* Judul Kegiatan (Input langsung ala Notion) */}
      <div className="pt-0.5">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void handleSave()}
          placeholder="Nama kegiatan…"
          className="w-full rounded-lg border border-transparent px-2 py-1.5 text-sm font-semibold text-gray-900 placeholder:text-gray-400 hover:border-gray-200 focus:border-blue-500 focus:bg-white focus:outline-none transition"
        />
      </div>

      {/* Baris Waktu: Jam Mulai -> Jam Selesai & Durasi */}
      <div className="space-y-1.5 rounded-xl bg-gray-50/80 p-2.5 border border-gray-100">
        <div className="flex items-center gap-2 text-xs text-gray-700">
          {/* Ikon Jam */}
          <span className="text-gray-400 shrink-0">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="6.5" />
              <polyline points="8 4 8 8 10.5 9.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>

          {!isAllDay ? (
            <div className="flex flex-1 items-center gap-1.5 min-w-0">
              <TimePickerInput
                value={startTimeStr}
                onChange={(val) => {
                  setStartTimeStr(val);
                  const startM = parseTimeToMinutes(val);
                  const endM = parseTimeToMinutes(endTimeStr);
                  let nextEndTimeStr = endTimeStr;
                  if (startM !== null && endM !== null && endM <= startM) {
                    const newEndM = (startM + 60) % 1440;
                    const newEndH = String(Math.floor(newEndM / 60)).padStart(2, '0');
                    const newEndMin = String(newEndM % 60).padStart(2, '0');
                    nextEndTimeStr = `${newEndH}:${newEndMin}`;
                    setEndTimeStr(nextEndTimeStr);
                  }
                  void handleSave({ nextStartTimeStr: val, nextEndTimeStr });
                }}
                placeholder="Mulai"
                className="w-[78px]"
              />

              <span className="text-gray-400 text-xs shrink-0">→</span>

              <TimePickerInput
                value={endTimeStr}
                onChange={(val) => {
                  setEndTimeStr(val);
                  void handleSave({ nextEndTimeStr: val });
                }}
                referenceStartTime={startTimeStr}
                placeholder="Selesai"
                className="w-[78px]"
              />

              {durationText && (
                <span className="ml-auto shrink-0 rounded bg-gray-200/60 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 font-medium">
                  {durationText}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs font-medium text-gray-600">Sepanjang hari</span>
          )}
        </div>

        {/* Tanggal di bawah jam */}
        <div className="relative flex items-center justify-between pl-6 text-[11px] text-gray-500">
          {showDatePicker ? (
            <input
              ref={(el) => {
                if (el) {
                  el.focus();
                  try {
                    el.showPicker?.();
                  } catch {
                    // abaikan jika browser tidak mendukung showPicker langsung
                  }
                }
              }}
              type="date"
              value={dateStr}
              onChange={(e) => {
                const next = e.target.value;
                if (!next) return;
                setDateStr(next);
                setShowDatePicker(false);
                void handleSave({ nextDateStr: next });
              }}
              onBlur={() => {
                setTimeout(() => setShowDatePicker(false), 150);
              }}
              className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none cursor-pointer"
            />
          ) : (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowDatePicker(true)}
              className="hover:text-blue-600 transition cursor-pointer font-medium hover:underline"
              title="Klik untuk mengganti tanggal"
            >
              {formatHumanDate(dateStr)}
            </button>
          )}

          {!showDatePicker && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setShowDatePicker(true)}
              className="text-[10px] text-blue-600 hover:underline cursor-pointer"
            >
              Ubah tgl
            </button>
          )}
        </div>
      </div>

      {/* Saklar All-day */}
      <div className="flex items-center justify-between py-1 px-1 text-xs">
        <span className="font-medium text-gray-800">All-day</span>
        <label className="relative inline-flex items-center cursor-pointer select-none">
          <input
            type="checkbox"
            checked={isAllDay}
            onChange={(e) => {
              const val = e.target.checked;
              setIsAllDay(val);
              void handleSave({ allDay: val });
            }}
            className="sr-only peer"
          />
          <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600 transition-colors" />
        </label>
      </div>

      {/* Tombol Pemilih Warna Kegiatan */}
      <div className="relative">
        <button
          ref={colorButtonRef}
          type="button"
          onClick={() => setColorMenuOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition cursor-pointer ${
            colorMenuOpen
              ? 'border-blue-400 bg-blue-50/60 text-blue-700'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
          title="Pilih warna kegiatan"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-3.5 w-3.5 shrink-0 rounded-full shadow-xs"
              style={{ backgroundColor: currentColorMeta.solidHex }}
            />
            <span className="truncate font-medium text-[11.5px]">
              {currentColorMeta.name}
            </span>
          </div>

          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="shrink-0 text-gray-400"
          >
            <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Tombol Repeat / Pengulangan */}
      <div className="relative">
        <button
          ref={repeatButtonRef}
          type="button"
          onClick={() => setRepeatMenuOpen((prev) => !prev)}
          className={`flex w-full items-center justify-between gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition cursor-pointer ${
            repeatMenuOpen
              ? 'border-blue-400 bg-blue-50/60 text-blue-700'
              : recurrence
                ? 'border-blue-200 bg-blue-50/40 text-blue-700 hover:bg-blue-50/70'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
          title="Atur pengulangan kegiatan"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span
              className={`shrink-0 ${
                recurrence || repeatMenuOpen ? 'text-blue-600' : 'text-gray-400'
              }`}
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </span>
            <span className="truncate font-medium text-[11.5px]">
              {recurrenceSummaryLabel}
            </span>
          </div>

          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            className="shrink-0 text-gray-400"
          >
            <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Baris Zona Waktu */}
      <div className="flex items-center gap-2 py-0.5 px-1 text-xs text-gray-600">
        <span className="text-gray-400 shrink-0">
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="8" cy="8" r="6.5" />
            <line x1="1.5" y1="8" x2="14.5" y2="8" />
            <path d="M8 1.5C9.5 3.5 10.5 5.5 10.5 8s-1 4.5-2.5 6.5C6.5 12.5 5.5 10.5 5.5 8s1-4.5 2.5-6.5z" />
          </svg>
        </span>
        <span className="font-medium text-[11px] text-gray-600">GMT+7 Jakarta (WIB)</span>
      </div>

      {/* Aksi Tambahan: Buka Detail / Hapus */}
      <div className="border-t border-gray-100 pt-2 flex items-center justify-between gap-2">
        <div>
          {isAct && act && (
            <button
              type="button"
              onClick={() => onOpenActivity?.(act)}
              className="text-[11px] font-medium text-blue-600 hover:underline cursor-pointer flex items-center gap-1"
            >
              <span>Buka di Tabel</span>
              <span>↗</span>
            </button>
          )}

          {!isAct && gEv?.htmlLink && (
            <a
              href={gEv.htmlLink}
              target="_blank"
              rel="noreferrer"
              className="text-[11px] font-medium text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>Buka di Google Calendar</span>
              <span>↗</span>
            </a>
          )}
        </div>

        <button
          type="button"
          onMouseDown={(e) => {
            // Cegah event blur pada input judul menyimpan ulang sebelum delete
            e.preventDefault();
          }}
          onClick={() => void handleDelete()}
          disabled={deleting}
          className="rounded-lg p-1 text-gray-400 hover:bg-red-50 hover:text-red-600 transition cursor-pointer disabled:opacity-50"
          title="Hapus kegiatan ini"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
            <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
          </svg>
        </button>
      </div>

      {/* Menu Preset Repeat (di samping kiri tombol Repeat, menyesuaikan tinggi layar) */}
      {repeatMenuOpen &&
        createPortal(
          <div
            ref={repeatMenuRef}
            style={{
              position: 'fixed',
              top: repeatMenuPos.top,
              left: repeatMenuPos.left,
              maxHeight: 'calc(100vh - 24px)',
              zIndex: 9999,
            }}
            className="w-64 overflow-y-auto rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl font-givonic animate-in fade-in zoom-in-95 duration-100"
          >
            {presets.map((preset) => {
              const selected = isSameRecurrence(recurrence, preset.config);
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => {
                    setRecurrence(preset.config);
                    setRepeatMenuOpen(false);
                    void handleSave({ nextRecurrence: preset.config });
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition cursor-pointer ${
                    selected
                      ? 'bg-blue-50/80 font-semibold text-blue-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-blue-600">
                    {selected && (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                      </svg>
                    )}
                  </span>
                  <span className="leading-snug">{preset.label}</span>
                </button>
              );
            })}

            <div className="my-1 border-t border-gray-100" />

            <button
              type="button"
              onClick={openCustomRepeatModal}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition cursor-pointer ${
                isCustomRecurrenceSelected
                  ? 'bg-blue-50/80 font-semibold text-blue-700'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <span className="flex h-4 w-4 shrink-0 items-center justify-center text-blue-600">
                {isCustomRecurrenceSelected && (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                  </svg>
                )}
              </span>
              <span className="leading-snug">Kustom...</span>
            </button>
          </div>,
          document.body,
        )}

      {/* Popup Modal Pengulangan Kustom */}
      {customModalOpen &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px] animate-in fade-in duration-150 font-givonic"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) setCustomModalOpen(false);
            }}
          >
            <div className="w-full max-w-[380px] rounded-2xl border border-gray-200 bg-white p-6 shadow-2xl animate-in zoom-in-95 duration-150">
              <h3 className="text-lg font-bold text-gray-900 mb-5">
                Pengulangan kustom
              </h3>

              {/* Ulangi setiap */}
              <div className="flex items-center gap-3 mb-5">
                <span className="text-sm font-medium text-gray-700 shrink-0">
                  Ulangi setiap
                </span>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={customInterval}
                  onChange={(e) =>
                    setCustomInterval(Math.max(1, parseInt(e.target.value, 10) || 1))
                  }
                  className="w-16 rounded-lg border border-gray-200 bg-gray-100/80 px-2.5 py-2 text-center text-sm font-medium text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none"
                />
                <select
                  value={customFreq}
                  onChange={(e) =>
                    setCustomFreq(e.target.value as RecurrenceFrequency)
                  }
                  className="flex-1 rounded-lg border border-gray-200 bg-gray-100/80 px-3 py-2 text-sm font-medium text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                >
                  <option value="DAILY">hari</option>
                  <option value="WEEKLY">minggu</option>
                  <option value="MONTHLY">bulan</option>
                  <option value="YEARLY">tahun</option>
                </select>
              </div>

              {/* Pilihan Hari (Jika Mingguan) */}
              {customFreq === 'WEEKLY' && (
                <div className="mb-5">
                  <div className="text-sm font-medium text-gray-700 mb-2.5">
                    Ulangi pada
                  </div>
                  <div className="flex items-center gap-2">
                    {DAY_PILLS_ID.map((pill) => {
                      const active = customByDays.includes(pill.day);
                      return (
                        <button
                          key={pill.day}
                          type="button"
                          title={pill.label}
                          onClick={() => {
                            setCustomByDays((prev) => {
                              if (prev.includes(pill.day)) {
                                if (prev.length === 1) return prev;
                                return prev.filter((d) => d !== pill.day);
                              }
                              return [...prev, pill.day];
                            });
                          }}
                          className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition cursor-pointer ${
                            active
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}
                        >
                          {pill.short}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Pilihan Bulanan (Jika Bulanan) */}
              {customFreq === 'MONTHLY' && (
                <div className="mb-5">
                  <select
                    value={customMonthlyMode}
                    onChange={(e) =>
                      setCustomMonthlyMode(
                        e.target.value as 'DAY_OF_MONTH' | 'NTH_WEEKDAY',
                      )
                    }
                    className="w-full rounded-lg border border-gray-200 bg-gray-100/80 px-3 py-2 text-sm font-medium text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none cursor-pointer"
                  >
                    <option value="DAY_OF_MONTH">
                      Bulanan pada tanggal {anchorDateObj.getDate()}
                    </option>
                    <option value="NTH_WEEKDAY">
                      Bulanan pada hari {DAY_NAMES_ID[anchorNthInfo.dayOfWeek]}{' '}
                      {anchorNthInfo.ordinalLabel}
                    </option>
                  </select>
                </div>
              )}

              {/* Berakhir */}
              <div className="mb-6">
                <div className="text-sm font-medium text-gray-700 mb-2.5">
                  Berakhir
                </div>
                <div className="space-y-3">
                  {/* Opsi 1: Tidak pernah */}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="recurrenceEndType"
                      checked={customEndType === 'NEVER'}
                      onChange={() => setCustomEndType('NEVER')}
                      className="h-4 w-4 accent-blue-600 cursor-pointer"
                    />
                    <span className="text-sm text-gray-800">Tidak pernah</span>
                  </label>

                  {/* Opsi 2: Pada tanggal */}
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer shrink-0">
                      <input
                        type="radio"
                        name="recurrenceEndType"
                        checked={customEndType === 'ON_DATE'}
                        onChange={() => setCustomEndType('ON_DATE')}
                        className="h-4 w-4 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-800">Pada</span>
                    </label>
                    <input
                      type="date"
                      value={customUntilDate}
                      disabled={customEndType !== 'ON_DATE'}
                      onClick={() => {
                        if (customEndType !== 'ON_DATE') setCustomEndType('ON_DATE');
                      }}
                      onChange={(e) => {
                        setCustomEndType('ON_DATE');
                        setCustomUntilDate(e.target.value);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                        customEndType === 'ON_DATE'
                          ? 'border-gray-300 bg-gray-100/80 text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none'
                          : 'border-gray-200 bg-gray-100/50 text-gray-400 cursor-not-allowed'
                      }`}
                    />
                  </div>

                  {/* Opsi 3: Setelah N kejadian */}
                  <div className="flex items-center justify-between gap-3">
                    <label className="flex items-center gap-3 cursor-pointer shrink-0">
                      <input
                        type="radio"
                        name="recurrenceEndType"
                        checked={customEndType === 'AFTER'}
                        onChange={() => setCustomEndType('AFTER')}
                        className="h-4 w-4 accent-blue-600 cursor-pointer"
                      />
                      <span className="text-sm text-gray-800">Setelah</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={999}
                        value={customCount}
                        disabled={customEndType !== 'AFTER'}
                        onClick={() => {
                          if (customEndType !== 'AFTER') setCustomEndType('AFTER');
                        }}
                        onChange={(e) => {
                          setCustomEndType('AFTER');
                          setCustomCount(
                            Math.max(1, parseInt(e.target.value, 10) || 1),
                          );
                        }}
                        className={`w-20 rounded-lg border px-2.5 py-1.5 text-center text-sm transition ${
                          customEndType === 'AFTER'
                            ? 'border-gray-300 bg-gray-100/80 text-gray-900 focus:border-blue-500 focus:bg-white focus:outline-none'
                            : 'border-gray-200 bg-gray-100/50 text-gray-400 cursor-not-allowed'
                        }`}
                      />
                      <span
                        className={`text-sm ${
                          customEndType === 'AFTER'
                            ? 'text-gray-700'
                            : 'text-gray-400'
                        }`}
                      >
                        kejadian
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tombol Batal & Selesai */}
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCustomModalOpen(false)}
                  className="rounded-full px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveCustomRepeat}
                  className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Popover Menu Palet Warna (Notion Calendar Style) */}
      {colorMenuOpen &&
        createPortal(
          <div
            ref={colorMenuRef}
            style={{
              position: 'fixed',
              top: colorMenuPos.top,
              left: colorMenuPos.left,
              zIndex: 9999,
            }}
            className="w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-xl font-givonic animate-in fade-in zoom-in-95 duration-100"
          >
            <div className="mb-2 px-0.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
              Warna Kegiatan
            </div>
            <div className="grid grid-cols-4 gap-2">
              {CALENDAR_COLORS.map((opt) => {
                const isSelected = (color ?? null) === opt.id;
                return (
                  <button
                    key={String(opt.id)}
                    type="button"
                    title={`${opt.name} (${opt.googleName})`}
                    onClick={() => handleSelectColor(opt.id)}
                    className={`group relative flex h-9 w-full items-center justify-center rounded-lg border transition cursor-pointer hover:scale-105 active:scale-95 ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-400/40'
                        : 'border-transparent hover:border-gray-200'
                    }`}
                  >
                    <span
                      className="h-5 w-5 rounded-full shadow-xs flex items-center justify-center transition"
                      style={{ backgroundColor: opt.solidHex }}
                    >
                      {isSelected && (
                        <svg
                          width="11"
                          height="11"
                          viewBox="0 0 16 16"
                          fill="none"
                          stroke="white"
                          strokeWidth="2.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                        </svg>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}

      {/* Popup Modal Konfirmasi Cakupan Warna Kegiatan Berulang */}
      {scopeModalOpen &&
        createPortal(
          <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px] animate-in fade-in duration-150 font-givonic">
            <div className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shrink-0">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900 leading-snug">
                    Ubah Warna Kegiatan Berulang
                  </h3>
                  <p className="text-[11px] text-gray-500 leading-tight">
                    Pilih cakupan kegiatan yang ingin diubah warnanya
                  </p>
                </div>
              </div>

              {/* Radio Options */}
              <div className="my-4 space-y-2.5">
                <label
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
                    selectedScope === 'THIS_EVENT'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-950'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="recurrence-scope"
                    value="THIS_EVENT"
                    checked={selectedScope === 'THIS_EVENT'}
                    onChange={() => setSelectedScope('THIS_EVENT')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-gray-900">Hanya Event Ini</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Hanya mengubah warna kegiatan pada tanggal {formatHumanDate(dateStr)}.
                    </div>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
                    selectedScope === 'ALL_EVENTS'
                      ? 'border-blue-500 bg-blue-50/50 text-blue-950'
                      : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
                  }`}
                >
                  <input
                    type="radio"
                    name="recurrence-scope"
                    value="ALL_EVENTS"
                    checked={selectedScope === 'ALL_EVENTS'}
                    onChange={() => setSelectedScope('ALL_EVENTS')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div className="text-xs">
                    <div className="font-semibold text-gray-900">Semua Event Ini</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      Mengubah warna seluruh kegiatan dalam rangkaian berulang ini.
                    </div>
                  </div>
                </label>
              </div>

              {/* Footer Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    setScopeModalOpen(false);
                    setPendingColor(null);
                  }}
                  className="rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
                >
                  Batalkan Perubahan
                </button>
                <button
                  type="button"
                  onClick={() => void handleConfirmScopeSave()}
                  className="rounded-xl bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-blue-700 transition cursor-pointer"
                >
                  Simpan Perubahan
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
