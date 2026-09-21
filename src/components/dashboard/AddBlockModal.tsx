import ModalShell from '@/components/ui/ModalShell';
import { BLOCK_DESCS, BLOCK_LABELS, BLOCK_ORDER, PRESETS, type DashboardBlockType } from './layout';

// Popup tambah blok ala Notion: grup template sekali klik + semua jenis blok
// (boleh ganda, tiap blok ber-ID sendiri). Tetap terbuka setelah tambah
// agar bisa tambah berkali-kali; tutup via X, backdrop, atau Esc.
export default function AddBlockModal({
  onAdd,
  onPreset,
  onClose,
}: {
  onAdd: (type: DashboardBlockType) => void;
  onPreset: (types: DashboardBlockType[]) => void;
  onClose: () => void;
}) {
  return (
    <ModalShell label="Tambah blok" onClose={onClose}>
      <div className="mb-1 flex items-center justify-between px-1">
        <p className="font-givonic text-sm font-bold text-perrific-graphite">Tambah blok</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup"
          autoFocus
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-perrific-graphite"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <p className="px-1 pb-2 font-givonic text-xs text-perrific-graphite/50">
        Blok langsung nempel di bawah. Popup tetap buka biar bisa tambah lagi.
      </p>
      <p className="px-2 pb-1 font-mono text-[10px] tracking-widest text-perrific-graphite/40">TEMPLATE</p>
      <div className="flex flex-wrap items-center gap-1.5 px-1 pb-3">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            title={p.desc}
            onClick={() => onPreset(p.types)}
            className="rounded-full border border-gray-200 bg-white px-3 py-1 font-givonic text-xs font-semibold text-gray-600 transition hover:border-perrific-violet hover:text-perrific-violet"
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          title="Kembalikan susunan awal"
          onClick={() => onPreset(['greeting', 'focus', 'progress', 'today', 'teams'])}
          className="rounded-full px-2 py-1 font-givonic text-xs text-perrific-graphite/50 transition hover:text-perrific-graphite hover:underline"
        >
          Bawaan
        </button>
      </div>
      <p className="px-2 pb-1 font-mono text-[10px] tracking-widest text-perrific-graphite/40">BLOK</p>
      <div className="space-y-1">
        {BLOCK_ORDER.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onAdd(t)}
            className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition hover:border-perrific-violet hover:bg-perrific-violet/5"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-perrific-violet/10 font-givonic text-sm font-bold text-perrific-violet">
              +
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-givonic text-sm font-semibold text-perrific-graphite">
                {BLOCK_LABELS[t]}
              </span>
              <span className="block truncate font-givonic text-xs text-perrific-graphite/50">
                {BLOCK_DESCS[t]}
              </span>
            </span>
          </button>
        ))}
      </div>
    </ModalShell>
  );
}
