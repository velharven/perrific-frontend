import { useState, useEffect, useMemo, useRef } from 'react';
import type { DailyActivity, GoogleCalendarEvent } from '@/types';
import { activityApi } from '@/api/activities';
import { calendarApi } from '@/api/calendar';

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
  const [deleting, setDeleting] = useState(false);
  const savingPromiseRef = useRef<Promise<void> | null>(null);
  const deletingRef = useRef(false);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Inisialisasi state dari item yang dipilih
  useEffect(() => {
    if (isAct && act) {
      setTitle(act.title || '');
      setDateStr(toDateInputValue(act.date));
      const hasTime = Boolean(act.startTime);
      setIsAllDay(!hasTime);
      setStartTimeStr(toTimeInputValue(act.startTime));
      setEndTimeStr(toTimeInputValue(act.endTime || (act.startTime ? new Date(new Date(act.startTime).getTime() + 3600000).toISOString() : '10:00')));
    } else if (gEv) {
      setTitle(gEv.title || 'Event Google');
      setDateStr(toDateInputValue(gEv.start));
      const hasTime = Boolean(gEv.start?.includes('T'));
      setIsAllDay(!hasTime);
      setStartTimeStr(toTimeInputValue(gEv.start));
      setEndTimeStr(toTimeInputValue(gEv.end));
    }
  }, [selectedItem, isAct, act, gEv]);

  const durationText = useMemo(() => {
    if (isAllDay) return 'Sepanjang hari';
    return formatDuration(startTimeStr, endTimeStr);
  }, [isAllDay, startTimeStr, endTimeStr]);

  // Simpan perubahan ke backend
  const handleSave = (): Promise<void> => {
    if (deletingRef.current) return Promise.resolve();
    if (savingPromiseRef.current) return savingPromiseRef.current;
    const save = (async () => {
      try {
      let startIso: string | null = null;
      let endIso: string | null = null;

      if (!isAllDay) {
        startIso = new Date(`${dateStr}T${startTimeStr}:00`).toISOString();
        endIso = new Date(`${dateStr}T${endTimeStr}:00`).toISOString();
      }

      if (isAct && act) {
        await activityApi.update(act.id, {
          title: title.trim() || 'Tanpa judul',
          date: new Date(`${dateStr}T00:00:00`).toISOString(),
          startTime: startIso,
          endTime: endIso,
        });
      } else if (gEv) {
        await calendarApi.updateEvent(gEv.id, {
          title: title.trim() || 'Tanpa judul',
          date: new Date(`${dateStr}T00:00:00`).toISOString(),
          startTime: startIso,
          endTime: endIso,
        });
      }

        onRefresh?.();
      } catch (err) {
        console.error('[CalendarCardSettings] Gagal menyimpan kegiatan:', err);
      }
    })();
    savingPromiseRef.current = save;
    void save.finally(() => {
      if (savingPromiseRef.current === save) savingPromiseRef.current = null;
    });
    return save;
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

  return (
    <div className="w-full shrink-0 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm animate-in fade-in zoom-in-95 duration-150 flex flex-col gap-3 font-givonic">
      {/* Header bar: Label & Close Button */}
      <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
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
            <div className="flex flex-1 items-center gap-1.5">
              <input
                type="time"
                value={startTimeStr}
                onChange={(e) => {
                  setStartTimeStr(e.target.value);
                }}
                onBlur={() => void handleSave()}
                className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-800 focus:border-blue-500 focus:outline-none"
              />

              <span className="text-gray-400 text-xs">→</span>

              <input
                type="time"
                value={endTimeStr}
                onChange={(e) => {
                  setEndTimeStr(e.target.value);
                }}
                onBlur={() => void handleSave()}
                className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs font-medium text-gray-800 focus:border-blue-500 focus:outline-none"
              />

              {durationText && (
                <span className="ml-auto rounded bg-gray-200/60 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 font-medium">
                  {durationText}
                </span>
              )}
            </div>
          ) : (
            <span className="text-xs font-medium text-gray-600">Sepanjang hari</span>
          )}
        </div>

        {/* Tanggal di bawah jam */}
        <div className="flex items-center justify-between pl-6 text-[11px] text-gray-500">
          {showDatePicker ? (
            <input
              type="date"
              value={dateStr}
              onChange={(e) => {
                setDateStr(e.target.value);
                setShowDatePicker(false);
              }}
              onBlur={() => void handleSave()}
              className="rounded border border-gray-200 bg-white px-1 py-0.5 text-xs text-gray-800 focus:border-blue-500 focus:outline-none"
              autoFocus
            />
          ) : (
            <button
              type="button"
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
              setTimeout(() => {
                void handleSave();
              }, 0);
            }}
            className="sr-only peer"
          />
          <div className="w-8 h-4.5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-blue-600 transition-colors" />
        </label>
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
    </div>
  );
}
