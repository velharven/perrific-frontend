import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CheckSquare, ChevronRight, Minus, List, FileText, Table } from 'lucide-react';

export type SlashCommandId =
  | 'text'
  | 'todo'
  | 'toggle'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'number'
  | 'divider'
  | 'subpage-note'
  | 'subpage-table';

interface SlashItem {
  id: SlashCommandId;
  label: string;
  desc: string;
  keywords: string;
  icon: JSX.Element;
}

const GROUPS: { title: string; items: SlashItem[] }[] = [
  {
    title: 'Blok',
    items: [
      {
        id: 'text',
        label: 'Teks',
        desc: 'Tulisan biasa',
        keywords: 'teks text tulisan paragraf',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 font-givonic text-base font-bold text-gray-500">
            T
          </span>
        ),
      },
      {
        id: 'todo',
        label: 'To-do',
        desc: 'Daftar centang',
        keywords: 'todo to-do checklist centang tugas task',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200">
            <CheckSquare size={16} strokeWidth={1.6} className="text-gray-400" />
          </span>
        ),
      },
      {
        id: 'toggle',
        label: 'Toggle',
        desc: 'Bisa dilipat',
        keywords: 'toggle lipat buka tutup fold collapsible',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200">
            <ChevronRight size={16} strokeWidth={1.6} className="text-gray-400" />
          </span>
        ),
      },
      {
        id: 'h1',
        label: 'Judul 1',
        desc: 'Judul besar',
        keywords: 'judul heading h1 besar hash pagar',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 font-givonic text-base font-extrabold text-gray-500">
            H1
          </span>
        ),
      },
      {
        id: 'h2',
        label: 'Judul 2',
        desc: 'Judul sedang',
        keywords: 'judul heading h2 sedang hash pagar',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 font-givonic text-sm font-extrabold text-gray-500">
            H2
          </span>
        ),
      },
      {
        id: 'h3',
        label: 'Judul 3',
        desc: 'Judul kecil',
        keywords: 'judul heading h3 kecil hash pagar',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 font-givonic text-xs font-bold text-gray-500">
            H3
          </span>
        ),
      },
      {
        id: 'divider',
        label: 'Pembatas',
        desc: 'Garis horizontal',
        keywords: 'pembatas divider garis horizontal strip pemisah minus',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200">
            <Minus size={16} strokeWidth={1.8} className="text-gray-400" />
          </span>
        ),
      },
    ],
  },
  {
    title: 'Daftar',
    items: [
      {
        id: 'bullet',
        label: 'Daftar titik',
        desc: 'Poin-poin bullet',
        keywords: 'daftar bullet titik poin list minus strip',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200">
            <List size={16} strokeWidth={1.6} className="text-gray-400" />
          </span>
        ),
      },
      {
        id: 'number',
        label: 'Daftar nomor',
        desc: 'Bernomor otomatis',
        keywords: 'daftar nomor angka number ordered list numbering',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 font-givonic text-sm font-bold text-gray-500">
            1.
          </span>
        ),
      },
    ],
  },
  {
    title: 'Subhalaman',
    items: [
      {
        id: 'subpage-note',
        label: 'Note',
        desc: 'Halaman kosong',
        keywords: 'note subhalaman halaman kosong page baru',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200">
            <FileText size={16} strokeWidth={1.6} className="text-gray-400" />
          </span>
        ),
      },
      {
        id: 'subpage-table',
        label: 'Tabel',
        desc: 'Database fleksibel',
        keywords: 'tabel table database spreadsheet data',
        icon: (
          <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200">
            <Table size={16} strokeWidth={1.6} className="text-gray-400" />
          </span>
        ),
      },
    ],
  },
];

// Koordinat karet (viewport) via mirror-div tersembunyi.
export function getCaretViewportPos(textarea: HTMLTextAreaElement): { x: number; y: number; lineHeight: number } {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement('div');
  const props = [
    'fontFamily', 'fontSize', 'fontWeight', 'letterSpacing', 'lineHeight',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'boxSizing', 'width', 'wordWrap', 'overflowWrap',
  ] as const;
  for (const p of props) mirror.style[p] = style[p];
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  const start = textarea.selectionStart;
  mirror.textContent = textarea.value.slice(0, start);
  const marker = document.createElement('span');
  marker.textContent = '​';
  mirror.appendChild(marker);
  document.body.appendChild(mirror);
  const rect = textarea.getBoundingClientRect();
  const x = rect.left + marker.offsetLeft - textarea.scrollLeft;
  const y = rect.top + marker.offsetTop - textarea.scrollTop;
  const lineHeight = parseFloat(style.lineHeight) || 20;
  document.body.removeChild(mirror);
  return { x, y, lineHeight };
}

export default function SlashMenu({
  anchor,
  busy,
  onSelect,
  onClose,
}: {
  anchor: { x: number; y: number; lineHeight: number };
  busy?: boolean;
  onSelect: (id: SlashCommandId) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      items: g.items.filter((i) => `${i.label} ${i.desc} ${i.keywords}`.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const safeActive = flat.length === 0 ? -1 : Math.min(active, flat.length - 1);

  // Posisikan dari ukuran asli: bawah kursor dulu, flip ke atas bila sempit.
  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const margin = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.max(margin, Math.min(anchor.x, window.innerWidth - w - margin));
    const below = anchor.y + anchor.lineHeight + 4;
    const y =
      below + h + margin <= window.innerHeight
        ? below
        : Math.max(margin, anchor.y - h - 4);
    setPos((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
  }, [anchor, flat.length]);

  // Tutup saat klik di luar. Scroll halaman DIKUNCI selama menu terbuka
  // (hanya daftar menu yang boleh scroll) sehingga jangkar kursor tak basi.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    function lockScroll(e: WheelEvent | TouchEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        e.preventDefault();
      }
    }
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const lockOpts: AddEventListenerOptions = { passive: false, capture: true };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('wheel', lockScroll, lockOpts);
    document.addEventListener('touchmove', lockScroll, lockOpts);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('wheel', lockScroll, lockOpts);
      document.removeEventListener('touchmove', lockScroll, lockOpts);
    };
  }, [onClose]);

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Perintah"
      className="fixed z-50 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_16px_48px_rgba(26,26,30,0.2)]"
      style={{
        left: pos?.x ?? Math.max(8, anchor.x),
        top: pos?.y ?? anchor.y + anchor.lineHeight + 4,
        maxHeight: 'min(340px, calc(100vh - 16px))',
      }}
    >
      <div className="nice-scroll max-h-[260px] overflow-y-auto p-1.5">
        {flat.length === 0 ? (
          <p className="px-2.5 py-4 text-center font-givonic text-xs text-perrific-graphite/50">
            Tidak ada perintah yang cocok.
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.title}>
              <p className="px-2.5 pb-0.5 pt-1.5 font-mono text-[10px] tracking-widest text-perrific-graphite/40">
                {g.title.toUpperCase()}
              </p>
              {g.items.map((item) => {
                const idx = flat.indexOf(item);
                const isActive = idx === safeActive;
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={busy && item.id.startsWith('subpage')}
                    onClick={() => onSelect(item.id)}
                    onMouseMove={() => setActive(idx)}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition disabled:opacity-50 ${
                      isActive ? 'bg-gray-100' : ''
                    }`}
                  >
                    {item.icon}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-givonic text-sm font-medium text-perrific-graphite">
                        {item.label}
                      </span>
                      <span className="block truncate font-givonic text-xs text-perrific-graphite/50">
                        {item.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </div>
      <div className="border-t border-gray-100 p-1.5">
        <input
          ref={inputRef}
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (flat.length === 0 ? 0 : (a + 1) % flat.length));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (flat.length === 0 ? 0 : (a - 1 + flat.length) % flat.length));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (safeActive >= 0) onSelect(flat[safeActive].id);
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onClose();
            } else if (e.key === 'PageUp' || e.key === 'PageDown') {
              // Jangan sampai menggerakkan scroll halaman yang sedang dikunci.
              e.preventDefault();
            }
          }}
          placeholder="Ketik untuk mencari"
          aria-label="Cari perintah"
          className="w-full rounded-lg bg-gray-50 px-2.5 py-2 font-givonic text-sm text-perrific-graphite placeholder:text-gray-400 focus:outline-none"
        />
      </div>
    </div>
  );
}
