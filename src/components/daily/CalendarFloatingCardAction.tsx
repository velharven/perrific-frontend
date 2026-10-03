import { X, SlidersHorizontal } from 'lucide-react';
import type { CombinedItem } from './CalendarCardSettings';

export default function CalendarFloatingCardAction({
  item,
  onOpenSettings,
  onClose,
}: {
  item: CombinedItem;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  const title = item.type === 'activity' ? item.act.title : item.gEv.title || 'Event Google';
  const startTime = item.type === 'activity' ? item.act.startTime : item.gEv.start;
  const endTime = item.type === 'activity' ? item.act.endTime : item.gEv.end;

  const formatTime = (isoOrTime?: string | null) => {
    if (!isoOrTime) return '';
    if (isoOrTime.includes('T')) {
      const d = new Date(isoOrTime);
      if (isNaN(d.getTime())) return '';
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
    return isoOrTime.slice(0, 5);
  };

  const startFormatted = formatTime(startTime);
  const endFormatted = formatTime(endTime);
  const timeLabel = startFormatted
    ? `${startFormatted}${endFormatted ? ` – ${endFormatted}` : ''}`
    : '';

  return (
    <div
      role="region"
      aria-label="Aksi kartu kalender"
      className="fixed bottom-5 inset-x-4 z-40 mx-auto max-w-md animate-in slide-in-from-bottom-3 duration-200 lg:hidden"
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-[0_12px_36px_rgba(26,26,30,0.18)] backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="truncate font-manrope text-xs font-bold text-perrific-graphite">{title}</p>
          {timeLabel && (
            <p className="truncate font-mono text-[11px] text-gray-500">
              {timeLabel}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenSettings}
            className="flex items-center gap-1.5 rounded-xl bg-perrific-violet px-3 py-1.5 font-manrope text-xs font-bold text-white shadow-sm transition hover:brightness-110 active:scale-95 cursor-pointer"
          >
            <SlidersHorizontal size={13} strokeWidth={2} />
            Buka Pengaturan Card
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup aksi kartu"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
