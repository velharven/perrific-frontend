import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Cangkang popup: overlay di-portal ke document.body agar lepas total dari
// leluhur halaman (stacking context/transform/filter apa pun di dalam
// halaman tidak bisa bikin backdrop bolong). Tutup via X/backdrop/Esc.
export default function ModalShell({
  label,
  onClose,
  children,
  // Lapisan tumpuk: default 60 (sejajar popup lain). Isi 40 untuk popup yang
  // harus tetap di bawah dialog konfirmasi (mis. popup Sampah vs konfirmasi
  // hapus permanen) namun di atas drawer mobile (40, menang urutan DOM).
  zClass = 'z-[60]',
  // wide: dialog 2 kolom (mis. form buat task), default sempit.
  wide = false,
  maxWidthClass,
}: {
  label: string;
  onClose: () => void;
  children: ReactNode;
  zClass?: string;
  wide?: boolean;
  maxWidthClass?: string;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        // Dropdown custom (role="menu", biasanya di-portal ke body agar tidak
        // terpotong scroll popup) menangani Esc-nya sendiri. Jangan ikut
        // menutup modal saat fokus masih di dalam menu.
        const t = e.target as HTMLElement | null;
        if (t && typeof t.closest === 'function' && t.closest('[role="menu"]')) return;
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      className={`fixed inset-0 ${zClass} flex items-center justify-center bg-black/40 p-4`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`nice-scroll max-h-[82vh] w-full overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_48px_rgba(26,26,30,0.2)] ${
          maxWidthClass ?? (wide ? 'max-w-2xl' : 'max-w-sm')
        }`}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}
