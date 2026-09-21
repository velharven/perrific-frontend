import { useLayoutEffect, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

// Menu dropdown yang di-portal ke document.body agar tidak terpotong oleh
// scroll container popup (ModalShell memakai overflow-y-auto). Posisi fixed
// mengikuti elemen jangkar, flip ke atas bila ruang bawah tidak cukup, dan
// mengikuti saat window di-scroll/di-resize.
export default function MenuPortal({
  anchorRef,
  onClose,
  label,
  width,
  estimatedHeight = 220,
  placement = 'auto',
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  label: string;
  width?: number;
  estimatedHeight?: number;
  // 'above': tepi bawah menu menempel ke atas jangkar (tanpa tebakan tinggi).
  placement?: 'auto' | 'above';
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number; width: number } | null>(null);

  useLayoutEffect(() => {
    function update() {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const w = width ?? r.width;
      const left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
      if (placement === 'above') {
        setPos({ bottom: Math.max(8, window.innerHeight - r.top + 4), left, width: w });
        return;
      }
      let top = r.bottom + 4;
      if (top + estimatedHeight > window.innerHeight - 8) {
        top = Math.max(8, r.top - estimatedHeight - 4);
      }
      setPos({ top, left, width: w });
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchorRef, width, estimatedHeight, placement]);

  if (!pos) return null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[70]" onClick={onClose} aria-hidden="true" />
      <div
        role="menu"
        aria-label={label}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        className="fixed z-[71] rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
        style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
