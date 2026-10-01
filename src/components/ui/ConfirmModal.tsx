import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle } from 'lucide-react';

type ConfirmModalProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/**
 * Modal peringatan untuk aksi destruktif (hapus tim, hapus tab).
 * Pengganti confirm() bawaan browser agar gaya konsisten dengan app.
 */
export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Hapus',
  cancelLabel = 'Batal',
  busy = false,
  onCancel,
  onConfirm,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancel();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  // Di-portal ke body agar tidak terjebak stacking context leluhur
  // (mis. drawer mobile z-40) dan selalu di atas popup lain seperti Sampah.
  return createPortal(
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
      aria-describedby="confirm-modal-message"
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_16px_48px_rgba(26,26,30,0.2)]">
        <div className="flex items-start gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600"
          >
            <AlertTriangle size={20} strokeWidth={1.8} />
          </span>
          <div className="min-w-0">
            <h2
              id="confirm-modal-title"
              className="font-givonic text-base font-extrabold text-perrific-graphite"
            >
              {title}
            </h2>
            <p
              id="confirm-modal-message"
              className="mt-1 font-givonic text-sm leading-relaxed text-perrific-graphite/60"
            >
              {message}
            </p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-full px-4 py-2 font-givonic text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-full bg-red-600 px-4 py-2 font-givonic text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Menghapus…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
