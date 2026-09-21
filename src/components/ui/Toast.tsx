import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const TOAST_EVENT = 'purrific:toast';
const DURATION_MS = 4000;

export interface ToastAction {
  label: string;
  onAction: () => void;
}

interface ToastDetail {
  message: string;
  action?: ToastAction;
}

// Snackbar bawah-tengah: "Tab x dipindahkan ke Sampah" + Urungkan,
// hilang sendiri dalam beberapa detik. Event bus ala NOTES_CHANGED_EVENT
// agar bisa dipanggil dari mana saja (AppLayout, NotePage) tanpa drilling.
export function showToast(message: string, action?: ToastAction) {
  window.dispatchEvent(new CustomEvent<ToastDetail>(TOAST_EVENT, { detail: { message, action } }));
}

interface ToastState extends ToastDetail {
  key: number;
}

export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [leaving, setLeaving] = useState(false);
  const timer = useRef<number | null>(null);
  const keyRef = useRef(0);

  const dismiss = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    setToast(null);
    setLeaving(false);
  }, []);

  useEffect(() => {
    function onToast(e: Event) {
      const detail = (e as CustomEvent<ToastDetail>).detail;
      if (!detail) return;
      if (timer.current !== null) window.clearTimeout(timer.current);
      keyRef.current += 1;
      setLeaving(false);
      setToast({ ...detail, key: keyRef.current });
      timer.current = window.setTimeout(() => {
        // Animasi keluar dulu, lalu lepas dari DOM.
        setLeaving(true);
        timer.current = window.setTimeout(() => {
          setToast(null);
          setLeaving(false);
        }, 200);
      }, DURATION_MS);
    }
    window.addEventListener(TOAST_EVENT, onToast);
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!toast) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className={`fixed inset-x-0 bottom-6 z-[70] flex justify-center px-4 transition-all duration-200 ${
        leaving ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'
      }`}
    >
      <div
        key={toast.key}
        className="flex max-w-md items-center gap-3 rounded-xl bg-perrific-graphite py-2.5 pl-4 pr-2.5 shadow-[0_8px_24px_rgba(26,26,30,0.3)]"
      >
        <p className="min-w-0 flex-1 truncate font-givonic text-sm text-white" title={toast.message}>
          {toast.message}
        </p>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onAction();
              dismiss();
            }}
            className="shrink-0 rounded-lg bg-white/15 px-3 py-1.5 font-givonic text-xs font-semibold text-white transition hover:bg-white/25"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>,
    document.body,
  );
}
