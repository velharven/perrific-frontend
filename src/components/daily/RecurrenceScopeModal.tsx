import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { RecurrenceConfig, RecurrenceEditScope } from '@/types';
import { formatFollowingScopeLabel, toLocalMidnight } from '@/lib/recurrence';
import { Trash2, Repeat } from 'lucide-react';

export interface RecurrenceScopeModalProps {
  isOpen: boolean;
  actionType: 'move' | 'time' | 'rename' | 'color' | 'delete' | 'edit';
  targetDate: Date | string;
  recurrence?: RecurrenceConfig | null;
  activityTitle?: string;
  busy?: boolean;
  error?: string | null;
  onSelect: (scope: RecurrenceEditScope) => void;
  onClose: () => void;
}

function formatHumanDate(dateInput: Date | string): string {
  const d = toLocalMidnight(dateInput);
  return d.toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

export default function RecurrenceScopeModal({
  isOpen,
  actionType,
  targetDate,
  recurrence,
  activityTitle,
  busy = false,
  error,
  onSelect,
  onClose,
}: RecurrenceScopeModalProps) {
  const [selectedScope, setSelectedScope] = useState<RecurrenceEditScope>('THIS_EVENT');

  useEffect(() => {
    if (isOpen) {
      setSelectedScope('THIS_EVENT');
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, busy]);

  if (!isOpen) return null;

  const dateLabel = formatHumanDate(targetDate);
  const followingLabel = formatFollowingScopeLabel(targetDate, recurrence);
  const isDelete = actionType === 'delete';

  let title = 'Ubah Kegiatan Berulang';
  let subtitle = 'Pilih cakupan kegiatan yang ingin diterapkan:';
  if (actionType === 'move') {
    title = 'Pindahkan Kegiatan Berulang';
    subtitle = 'Pilih cakupan kegiatan yang ingin dipindahkan ke jadwal baru:';
  } else if (actionType === 'time') {
    title = 'Ubah Jam Kegiatan Berulang';
    subtitle = 'Pilih cakupan kegiatan yang durasi/jamnya ingin diubah:';
  } else if (actionType === 'rename') {
    title = 'Ganti Nama Kegiatan Berulang';
    subtitle = 'Pilih cakupan kegiatan yang ingin diperbarui namanya:';
  } else if (actionType === 'color') {
    title = 'Ubah Warna Kegiatan Berulang';
    subtitle = 'Pilih cakupan kegiatan yang ingin diubah warnanya:';
  } else if (actionType === 'delete') {
    title = 'Hapus Kegiatan Berulang';
    subtitle = 'Pilih cakupan kegiatan yang ingin dihapus:';
  }

  return createPortal(
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4 backdrop-blur-[1px] animate-in fade-in duration-150 font-givonic">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        aria-busy={busy}
        className="w-full max-w-sm rounded-2xl border border-gray-100 bg-white p-5 shadow-2xl animate-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-gray-100 pb-3">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
              isDelete ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600'
            }`}
          >
            {isDelete ? (
              <Trash2 size={18} strokeWidth={1.6} />
            ) : (
              <Repeat size={18} strokeWidth={1.6} />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-bold text-gray-900 leading-snug truncate">
              {title}
            </h3>
            {activityTitle && (
              <p className="text-[11px] font-medium text-gray-700 truncate" title={activityTitle}>
                &ldquo;{activityTitle}&rdquo;
              </p>
            )}
            <p className="text-[11px] text-gray-500 leading-tight mt-0.5">
              {subtitle}
            </p>
          </div>
        </div>

        {/* Radio Cards */}
        <div className="my-4 space-y-2.5">
          {/* 1. Event ini */}
          <label
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
              selectedScope === 'THIS_EVENT'
                ? isDelete
                  ? 'border-red-500 bg-red-50/50 text-red-950'
                  : 'border-blue-500 bg-blue-50/50 text-blue-950'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
            }`}
          >
            <input
              type="radio"
              name="recurrence-scope"
              value="THIS_EVENT"
              disabled={busy}
              checked={selectedScope === 'THIS_EVENT'}
              onChange={() => setSelectedScope('THIS_EVENT')}
              className={`mt-0.5 cursor-pointer ${isDelete ? 'text-red-600 focus:ring-red-500' : 'text-blue-600 focus:ring-blue-500'}`}
            />
            <div className="text-xs">
              <div className="font-semibold text-gray-900">Event ini</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {isDelete
                  ? `Hanya menghapus kegiatan pada tanggal ${dateLabel}.`
                  : `Hanya menerapkan perubahan pada tanggal ${dateLabel}.`}
              </div>
            </div>
          </label>

          {/* 2. Event ini dan (hari) seterusnya */}
          <label
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
              selectedScope === 'THIS_AND_FOLLOWING'
                ? isDelete
                  ? 'border-red-500 bg-red-50/50 text-red-950'
                  : 'border-blue-500 bg-blue-50/50 text-blue-950'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
            }`}
          >
            <input
              type="radio"
              name="recurrence-scope"
              value="THIS_AND_FOLLOWING"
              disabled={busy}
              checked={selectedScope === 'THIS_AND_FOLLOWING'}
              onChange={() => setSelectedScope('THIS_AND_FOLLOWING')}
              className={`mt-0.5 cursor-pointer ${isDelete ? 'text-red-600 focus:ring-red-500' : 'text-blue-600 focus:ring-blue-500'}`}
            />
            <div className="text-xs">
              <div className="font-semibold text-gray-900">{followingLabel}</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {isDelete
                  ? `Menghapus kegiatan pada tanggal ${dateLabel} dan seluruh jadwal setelahnya.`
                  : `Menerapkan perubahan mulai tanggal ${dateLabel} dan seluruh jadwal berikutnya.`}
              </div>
            </div>
          </label>

          {/* 3. Semua event */}
          <label
            className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition select-none ${
              selectedScope === 'ALL_EVENTS'
                ? isDelete
                  ? 'border-red-500 bg-red-50/50 text-red-950'
                  : 'border-blue-500 bg-blue-50/50 text-blue-950'
                : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-800'
            }`}
          >
            <input
              type="radio"
              name="recurrence-scope"
              value="ALL_EVENTS"
              disabled={busy}
              checked={selectedScope === 'ALL_EVENTS'}
              onChange={() => setSelectedScope('ALL_EVENTS')}
              className={`mt-0.5 cursor-pointer ${isDelete ? 'text-red-600 focus:ring-red-500' : 'text-blue-600 focus:ring-blue-500'}`}
            />
            <div className="text-xs">
              <div className="font-semibold text-gray-900">Semua event</div>
              <div className="text-[11px] text-gray-500 mt-0.5">
                {isDelete
                  ? 'Menghapus seluruh rangkaian kegiatan dalam pengulangan ini.'
                  : 'Menerapkan perubahan ke seluruh kegiatan dalam rangkaian berulang ini.'}
              </div>
            </div>
          </label>
        </div>

        {/* Footer Buttons */}
        {error && <p role="alert" className="mb-3 text-xs text-red-600">{error}</p>}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onSelect(selectedScope)}
            disabled={busy}
            className={`rounded-xl px-4 py-1.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer ${
              isDelete
                ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800'
            }`}
          >
            {busy ? 'Menyimpan...' : isDelete ? 'Hapus' : 'Terapkan'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
