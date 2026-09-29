import { useState, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import type {
  DailyActivity,
  GoogleCalendarEvent,
  RecurrenceConfig,
  RecurrenceEditScope,
  RecurrenceEndType,
  RecurrenceFrequency,
} from '@/types';
import RecurrenceScopeModal from './RecurrenceScopeModal';
import { activityApi } from '@/api/activities';
import { calendarApi } from '@/api/calendar';
import {
  DAY_NAMES_ID,
  DAY_PILLS_ID,
  formatRecurrenceLabel,
  getDayBefore,
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

export type CalendarUndoAction =
  | {
      id: number;
      type: 'delete';
      item: CombinedItem;
      title: string;
      pendingDelete: Promise<void>;
    }
  | {
      id: number;
      type: 'drag-from-sidebar-item';
      activityId: string;
      title: string;
      prevDate: string | null;
      prevStartTime: string | null;
      prevEndTime: string | null;
      googleEventId?: string | null;
    }
  | {
      id: number;
      type: 'drag-from-sidebar-team-task' | 'drag-from-sidebar-personal-task';
      createdActivityId: string;
      title: string;
      googleEventId?: string | null;
    }
  | {
      id: number;
      type: 'move-calendar-card';
      itemType: 'activity' | 'google';
      rawId: string;
      title: string;
      prevDate: string | null;
      prevStartTime: string | null;
      prevEndTime: string | null;
      prevAllDay?: boolean;
      prevRecurrence?: RecurrenceConfig | null;
    }
  | {
      id: number;
      type: 'recurring-move-this-event' | 'recurring-edit-this-event';
      createdActivityId: string;
      masterActivityId: string;
      prevExcludeDates: string[];
      instanceDateStr: string;
      title: string;
    }
  | {
      id: number;
      type: 'recurring-move-following' | 'recurring-edit-following';
      createdActivityId: string;
      masterActivityId: string;
      prevRecurrence: RecurrenceConfig | null;
      title: string;
    }
  | {
      id: number;
      type: 'recurring-delete-this-event';
      masterActivityId: string;
      prevExcludeDates: string[];
      instanceDateStr: string;
      title: string;
    }
  | {
      id: number;
      type: 'recurring-delete-following';
      masterActivityId: string;
      prevRecurrence: RecurrenceConfig | null;
      title: string;
    }
  | {
      id: number;
      type: 'card-settings-update';
      activityId: string;
      title: string;
      prevSnapshot: {
        title: string;
        startTime: string | null;
        endTime: string | null;
        date: string | null;
        color: string | null;
        allDay?: boolean;
        recurrence?: RecurrenceConfig | null;
      };
    }
  | {
      id: number;
      type: 'reorder-calendar-columns';
      date: string;
      columns: string[][];
      title: string;
    };

interface CalendarCardSettingsProps {
  selectedItem: CombinedItem;
  onClose: () => void;
  onRefresh?: () => void;
  onOpenActivity?: (activity: DailyActivity) => void;
  onDelete?: (item: CombinedItem) => Promise<void>;
  onRecordUndo?: (action: CalendarUndoAction) => void;
  onUndo?: (actionId?: number) => void;
  getNextUndoId?: () => number;
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
  onRecordUndo,
  onUndo,
  getNextUndoId,
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

  // State menu Warna & modal konfirmasi cakupan kegiatan berulang
  const [color, setColor] = useState<string | null>(null);
  const [colorMenuOpen, setColorMenuOpen] = useState(false);
  const colorButtonRef = useRef<HTMLButtonElement | null>(null);
  const colorMenuRef = useRef<HTMLDivElement | null>(null);
  const [colorMenuPos, setColorMenuPos] = useState<{ top: number; left: number }>({
    top: -9999,
    left: -9999,
  });

  interface ScopeModalState {
    isOpen: boolean;
    actionType: 'move' | 'time' | 'rename' | 'color' | 'delete';
    pendingOverride?: {
      nextTitle?: string;
      nextStartTimeStr?: string;
      nextEndTimeStr?: string;
      nextDateStr?: string;
      nextColor?: string | null;
    };
  }

  const [scopeModal, setScopeModal] = useState<ScopeModalState>({
    isOpen: false,
    actionType: 'rename',
  });

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
    setScopeModal({ isOpen: false, actionType: 'rename' });
    if (isAct && act) {
      setTitle(act.title || '');
      const instanceDate = toDateInputValue(selectedItem.time || act.date);
      setDateStr(instanceDate);
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
      const instanceDate = toDateInputValue(selectedItem.time || gEv.start);
      setDateStr(instanceDate);
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

  const isRepeating = Boolean(
    (isAct && act?.recurrence) ||
    (!isAct && (gEv?.recurringEventId || gEv?.id?.includes('_'))),
  );

  // Simpan perubahan ke backend
  const handleSave = (
    override?: {
      nextTitle?: string;
      allDay?: boolean;
      nextDateStr?: string;
      nextRecurrence?: RecurrenceConfig | null;
      nextColor?: string | null;
      nextStartTimeStr?: string;
      nextEndTimeStr?: string;
    },
    skipUndo = false,
  ): Promise<void> => {
    if (deletingRef.current) return Promise.resolve();
    const effectiveTitle = override?.nextTitle !== undefined ? override.nextTitle : title;
    const effectiveAllDay = override?.allDay !== undefined ? override.allDay : isAllDay;
    const effectiveDateStr = override?.nextDateStr !== undefined ? override.nextDateStr : dateStr;
    const effectiveRecurrence =
      override?.nextRecurrence !== undefined ? override.nextRecurrence : recurrence;
    const effectiveColor =
      override?.nextColor !== undefined ? override.nextColor : color;
    const effectiveStartTimeStr = override?.nextStartTimeStr ?? startTimeStr;
    const effectiveEndTimeStr = override?.nextEndTimeStr ?? endTimeStr;
    const previousSave = savingPromiseRef.current;

    const previousSnapshot =
      !skipUndo && !isRepeating && isAct && act && onRecordUndo && getNextUndoId
        ? {
            title: act.title || 'Tanpa judul',
            startTime: act.startTime || null,
            endTime: act.endTime || null,
            date: act.date ? new Date(act.date).toISOString() : null,
            color: act.color || null,
            allDay: act.allDay,
            recurrence: null,
          }
        : null;

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
            title: effectiveTitle.trim() || 'Tanpa judul',
            date: `${effectiveDateStr}T00:00:00.000Z`,
            startTime: startIso,
            endTime: endIso,
            allDay: effectiveAllDay,
            recurrence: effectiveRecurrence,
            color: effectiveColor,
          });

          if (previousSnapshot && onRecordUndo && getNextUndoId) {
            const actionId = getNextUndoId();
            onRecordUndo({
              id: actionId,
              type: 'card-settings-update',
              activityId: act.id,
              title: effectiveTitle.trim() || 'Tanpa judul',
              prevSnapshot: previousSnapshot,
            });
            showToast(`Pengaturan kegiatan "${effectiveTitle.trim() || 'Tanpa judul'}" disimpan`, {
              label: 'Urungkan (Ctrl+Z)',
              onAction: () => onUndo?.(actionId),
            });
          }
        } else if (gEv) {
          await calendarApi.updateEvent(gEv.id, {
            title: effectiveTitle.trim() || 'Tanpa judul',
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
    setColorMenuOpen(false);
    if (!isRepeating) {
      setColor(chosenColorId);
      void handleSave({ nextColor: chosenColorId });
    } else {
      setScopeModal({
        isOpen: true,
        actionType: 'color',
        pendingOverride: { nextColor: chosenColorId },
      });
    }
  };

  // Konfirmasi perubahan cakupan (move, time, rename, color, delete)
  const handleConfirmScope = async (scope: RecurrenceEditScope) => {
    const { actionType, pendingOverride } = scopeModal;
    setScopeModal((prev) => ({ ...prev, isOpen: false }));

    const effectiveDateStr = pendingOverride?.nextDateStr !== undefined ? pendingOverride.nextDateStr : dateStr;
    const effectiveStartTimeStr = pendingOverride?.nextStartTimeStr ?? startTimeStr;
    const effectiveEndTimeStr = pendingOverride?.nextEndTimeStr ?? endTimeStr;
    const effectiveTitle = (pendingOverride?.nextTitle !== undefined ? pendingOverride.nextTitle : title).trim() || 'Tanpa judul';
    const effectiveColor = pendingOverride?.nextColor !== undefined ? pendingOverride.nextColor : color;

    const instanceDate = toDateInputValue(selectedItem.time || (isAct ? act?.date : gEv?.start));

    if (actionType === 'delete') {
      if (scope === 'ALL_EVENTS') {
        await handleDelete();
      } else if (scope === 'THIS_EVENT') {
        if (isAct && act) {
          const prevExcludeDates = [...(act.recurrence?.excludeDates || [])];
          const updatedExclude = [...prevExcludeDates, instanceDate];
          await activityApi.update(act.id, {
            recurrence: {
              ...act.recurrence,
              excludeDates: updatedExclude,
            },
          });
          if (onRecordUndo && getNextUndoId) {
            const actionId = getNextUndoId();
            onRecordUndo({
              id: actionId,
              type: 'recurring-delete-this-event',
              masterActivityId: act.id,
              prevExcludeDates,
              instanceDateStr: instanceDate,
              title: act.title || 'Tanpa judul',
            });
            showToast(`Kegiatan "${act.title || 'Tanpa judul'}" pada ${instanceDate} dihapus`, {
              label: 'Urungkan (Ctrl+Z)',
              onAction: () => onUndo?.(actionId),
            });
          }
        } else if (gEv) {
          await calendarApi.deleteEvent(gEv.id);
        }
        onClose();
        onRefresh?.();
      } else if (scope === 'THIS_AND_FOLLOWING') {
        if (isAct && act) {
          const prevRecurrence = act.recurrence ? { ...act.recurrence } : null;
          const dayBefore = getDayBefore(instanceDate);
          await activityApi.update(act.id, {
            recurrence: {
              ...act.recurrence,
              endType: 'ON_DATE',
              untilDate: dayBefore,
            },
          });
          if (onRecordUndo && getNextUndoId) {
            const actionId = getNextUndoId();
            onRecordUndo({
              id: actionId,
              type: 'recurring-delete-following',
              masterActivityId: act.id,
              prevRecurrence,
              title: act.title || 'Tanpa judul',
            });
            showToast(`Kegiatan "${act.title || 'Tanpa judul'}" dan seterusnya dihapus`, {
              label: 'Urungkan (Ctrl+Z)',
              onAction: () => onUndo?.(actionId),
            });
          }
        }
        onClose();
        onRefresh?.();
      }
      return;
    }

    if (scope === 'ALL_EVENTS') {
      const prevSnapshot =
        isAct && act
          ? {
              title: act.title || 'Tanpa judul',
              startTime: act.startTime || null,
              endTime: act.endTime || null,
              date: act.date ? new Date(act.date).toISOString() : null,
              color: act.color || null,
              allDay: act.allDay,
              recurrence: act.recurrence ? { ...act.recurrence } : null,
            }
          : null;

      if (pendingOverride?.nextColor !== undefined) setColor(effectiveColor);
      if (pendingOverride?.nextTitle !== undefined) setTitle(effectiveTitle);
      if (pendingOverride?.nextDateStr !== undefined) setDateStr(effectiveDateStr);
      if (pendingOverride?.nextStartTimeStr !== undefined) setStartTimeStr(effectiveStartTimeStr);
      if (pendingOverride?.nextEndTimeStr !== undefined) setEndTimeStr(effectiveEndTimeStr);
      await handleSave(pendingOverride, true);

      if (isAct && act && prevSnapshot && onRecordUndo && getNextUndoId) {
        const actionId = getNextUndoId();
        onRecordUndo({
          id: actionId,
          type: 'card-settings-update',
          activityId: act.id,
          title: effectiveTitle,
          prevSnapshot,
        });
        showToast(`Perubahan kegiatan "${effectiveTitle}" disimpan`, {
          label: 'Urungkan (Ctrl+Z)',
          onAction: () => onUndo?.(actionId),
        });
      }
      return;
    }

    if (scope === 'THIS_EVENT') {
      if (isAct && act && act.recurrence) {
        // 1. Tambahkan tanggal instance ke excludeDates pada master
        const prevExcludeDates = [...(act.recurrence.excludeDates || [])];
        const updatedExclude = [...prevExcludeDates, instanceDate];
        await activityApi.update(act.id, {
          recurrence: {
            ...act.recurrence,
            excludeDates: updatedExclude,
          },
        });

        // 2. Buat kegiatan baru mandiri (non-repeating)
        let startIso: string | null = null;
        let endIso: string | null = null;
        if (!isAllDay) {
          startIso = new Date(`${effectiveDateStr}T${effectiveStartTimeStr}:00`).toISOString();
          endIso = new Date(`${effectiveDateStr}T${effectiveEndTimeStr}:00`).toISOString();
        }
        const created = await activityApi.create({
          title: effectiveTitle,
          description: act.description,
          date: new Date(`${effectiveDateStr}T00:00:00`).toISOString(),
          startTime: startIso,
          endTime: endIso,
          allDay: isAllDay,
          type: act.type || 'CUSTOM',
          status: act.status || 'PENDING',
          icon: act.icon,
          color: effectiveColor,
          recurrence: null,
        });

        if (onRecordUndo && getNextUndoId) {
          const actionId = getNextUndoId();
          onRecordUndo({
            id: actionId,
            type: 'recurring-edit-this-event',
            createdActivityId: created.id,
            masterActivityId: act.id,
            prevExcludeDates,
            instanceDateStr: instanceDate,
            title: effectiveTitle,
          });
          showToast(`Perubahan kegiatan "${effectiveTitle}" disimpan`, {
            label: 'Urungkan (Ctrl+Z)',
            onAction: () => onUndo?.(actionId),
          });
        }
      } else if (gEv) {
        await calendarApi.updateEvent(gEv.id, {
          title: effectiveTitle,
          colorId: effectiveColor,
        });
      }
      onClose();
      onRefresh?.();
      return;
    }

    if (scope === 'THIS_AND_FOLLOWING') {
      if (isAct && act && act.recurrence) {
        const prevRecurrence = { ...act.recurrence };
        // 1. Potong master lama hingga hari sebelum instance ini
        const dayBefore = getDayBefore(instanceDate);
        await activityApi.update(act.id, {
          recurrence: {
            ...act.recurrence,
            endType: 'ON_DATE',
            untilDate: dayBefore,
          },
        });

        // 2. Buat kegiatan baru berulang mulai dari effectiveDateStr
        let startIso: string | null = null;
        let endIso: string | null = null;
        if (!isAllDay) {
          startIso = new Date(`${effectiveDateStr}T${effectiveStartTimeStr}:00`).toISOString();
          endIso = new Date(`${effectiveDateStr}T${effectiveEndTimeStr}:00`).toISOString();
        }

        let nextRecurrence: RecurrenceConfig = { ...act.recurrence };
        if (nextRecurrence.freq === 'WEEKLY' && effectiveDateStr !== instanceDate) {
          const oldDay = toLocalMidnight(instanceDate).getDay();
          const newDay = toLocalMidnight(effectiveDateStr).getDay();
          if (oldDay !== newDay) {
            const currentDays =
              nextRecurrence.byDays && nextRecurrence.byDays.length > 0
                ? nextRecurrence.byDays
                : [oldDay];
            const updatedDays = currentDays.includes(oldDay)
              ? currentDays.map((d) => (d === oldDay ? newDay : d))
              : [...currentDays, newDay];
            nextRecurrence.byDays = [...new Set(updatedDays)].sort((a, b) => a - b);
          }
        }

        const created = await activityApi.create({
          title: effectiveTitle,
          description: act.description,
          date: new Date(`${effectiveDateStr}T00:00:00`).toISOString(),
          startTime: startIso,
          endTime: endIso,
          allDay: isAllDay,
          type: act.type || 'CUSTOM',
          status: act.status || 'PENDING',
          icon: act.icon,
          color: effectiveColor,
          recurrence: nextRecurrence,
        });

        if (onRecordUndo && getNextUndoId) {
          const actionId = getNextUndoId();
          onRecordUndo({
            id: actionId,
            type: 'recurring-edit-following',
            createdActivityId: created.id,
            masterActivityId: act.id,
            prevRecurrence,
            title: effectiveTitle,
          });
          showToast(`Perubahan kegiatan "${effectiveTitle}" dan seterusnya disimpan`, {
            label: 'Urungkan (Ctrl+Z)',
            onAction: () => onUndo?.(actionId),
          });
        }
      }
      onClose();
      onRefresh?.();
      return;
    }
  };

  const handleCloseScopeModal = () => {
    const { actionType } = scopeModal;
    setScopeModal({ isOpen: false, actionType: 'rename' });
    if (isAct && act) {
      if (actionType === 'rename') setTitle(act.title || '');
      if (actionType === 'time') {
        setStartTimeStr(toTimeInputValue(act.startTime));
        setEndTimeStr(toTimeInputValue(act.endTime));
      }
      if (actionType === 'move') {
        setDateStr(toDateInputValue(selectedItem.time || act.date));
      }
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

  const handleTitleBlur = () => {
    const trimmed = title.trim();
    const originalTitle = (isAct ? act?.title : gEv?.title) || '';
    if (trimmed === originalTitle) return;
    if (isRepeating) {
      setScopeModal({
        isOpen: true,
        actionType: 'rename',
        pendingOverride: { nextTitle: trimmed },
      });
    } else {
      void handleSave({ nextTitle: trimmed });
    }
  };

  const handleDeleteClick = () => {
    if (isRepeating) {
      setScopeModal({
        isOpen: true,
        actionType: 'delete',
      });
    } else {
      void handleDelete();
    }
  };

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
          onBlur={handleTitleBlur}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur();
            }
          }}
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
                  if (isRepeating) {
                    setScopeModal({
                      isOpen: true,
                      actionType: 'time',
                      pendingOverride: { nextStartTimeStr: val, nextEndTimeStr },
                    });
                  } else {
                    void handleSave({ nextStartTimeStr: val, nextEndTimeStr });
                  }
                }}
                placeholder="Mulai"
                className="w-[78px]"
              />

              <span className="text-gray-400 text-xs shrink-0">→</span>

              <TimePickerInput
                value={endTimeStr}
                onChange={(val) => {
                  setEndTimeStr(val);
                  if (isRepeating) {
                    setScopeModal({
                      isOpen: true,
                      actionType: 'time',
                      pendingOverride: { nextEndTimeStr: val },
                    });
                  } else {
                    void handleSave({ nextEndTimeStr: val });
                  }
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
                if (isRepeating) {
                  setScopeModal({
                    isOpen: true,
                    actionType: 'move',
                    pendingOverride: { nextDateStr: next },
                  });
                } else {
                  void handleSave({ nextDateStr: next });
                }
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

      {/* Integrasi Google Calendar */}
      {isAct && act && (
        <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-gray-50 border border-gray-100 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <svg className="w-4 h-4 shrink-0 text-blue-500" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zm0-12H5V6h14v2z" />
            </svg>
            <span className="truncate text-[11px] font-medium text-gray-700">
              {act.googleEventId ? 'Tersinkron ke Google Calendar' : 'Belum di Google Calendar'}
            </span>
          </div>


        </div>
      )}

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
          onClick={handleDeleteClick}
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

      {/* Popup Modal Konfirmasi Cakupan Perubahan Kegiatan Berulang */}
      <RecurrenceScopeModal
        isOpen={scopeModal.isOpen}
        actionType={scopeModal.actionType}
        targetDate={toDateInputValue(selectedItem.time || (isAct ? act?.date : gEv?.start) || dateStr)}
        recurrence={isAct ? act?.recurrence : null}
        activityTitle={title}
        onSelect={(scope) => void handleConfirmScope(scope)}
        onClose={handleCloseScopeModal}
      />
    </div>
  );
}
