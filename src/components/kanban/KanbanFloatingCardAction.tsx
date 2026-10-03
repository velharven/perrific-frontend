import { X, SlidersHorizontal } from 'lucide-react';
import type { Task } from '@/types';

export default function KanbanFloatingCardAction({
  task,
  columnName,
  onOpenSettings,
  onClose,
}: {
  task: Task;
  columnName?: string;
  onOpenSettings: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="region"
      aria-label="Aksi kartu"
      className="fixed bottom-5 inset-x-4 z-40 mx-auto max-w-md animate-in slide-in-from-bottom-3 duration-200"
    >
      <div className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white/95 px-4 py-3 shadow-[0_12px_36px_rgba(26,26,30,0.18)] backdrop-blur">
        <div className="min-w-0 flex-1">
          <p className="truncate font-manrope text-xs font-bold text-perrific-graphite">{task.title}</p>
          {columnName && (
            <p className="truncate font-mono text-[11px] text-gray-500">Status: {columnName}</p>
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
