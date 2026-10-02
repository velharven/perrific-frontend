import { useState } from 'react';
import type { HeadingItem } from './noteBlocks';

// Daftar isi di sisi kolom catatan: strip ramping berisi batang level
// selalu terlihat; hover/fokus mengembang panel daftar judul tanpa card.
// Dirender di dalam <aside> NotePage. Kosong → null.
const BAR_W: Record<HeadingItem['type'], string> = {
  h1: 'w-5',
  h2: 'w-3.5',
  h3: 'w-2.5',
};

export default function HeadingOutline({
  items,
  onJump,
}: {
  items: HeadingItem[];
  onJump: (id: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  if (items.length === 0) return null;
  return (
    <div className="group fixed right-3 top-1/2 z-30 hidden -translate-y-1/2 lg:block">
      <div className="relative">
        {/* Strip pemicu (selalu terlihat) */}
        <button
          type="button"
          aria-label="Tampilkan daftar isi"
          className="flex flex-col items-center gap-1.5 rounded-full px-2 py-3 transition hover:bg-gray-100 focus-visible:bg-gray-100"
        >
          {items.map((it) => (
            <span
              key={it.id}
              aria-hidden="true"
              className={`h-[3px] rounded-full ${BAR_W[it.type]} ${it.id === activeId ? 'bg-perrific-violet' : 'bg-gray-300'}`}
            />
          ))}
        </button>
        {/* Panel daftar (hover/fokus) — rapat tanpa gap agar tak flicker */}
        <nav
          aria-label="Daftar isi"
          className="absolute right-0 top-1/2 hidden w-52 -translate-y-1/2 rounded-lg bg-perrific-paper/95 backdrop-blur group-hover:block group-focus-within:block"
        >
          <p className="px-2.5 pb-1 pt-1.5 font-mono text-[10px] tracking-widest text-perrific-graphite/40">
            DAFTAR ISI
          </p>
          <div className="nice-scroll max-h-[50vh] overflow-y-auto pb-1">
            {items.map((it) => {
              const empty = it.text.trim() === '';
              const label = empty ? 'Tanpa judul' : it.text.trim();
              const active = it.id === activeId;
              return (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => {
                    setActiveId(it.id);
                    onJump(it.id);
                  }}
                  title={label}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-gray-100"
                >
                  <span
                    aria-hidden="true"
                    className={`h-[3px] shrink-0 rounded-full ${BAR_W[it.type]} ${active ? 'bg-perrific-violet' : 'bg-gray-300'}`}
                  />
                  <span
                    className={`min-w-0 flex-1 truncate font-manrope text-sm ${
                      active ? 'font-semibold text-perrific-violet' : empty ? 'italic text-gray-400' : 'text-perrific-graphite'
                    }`}
                  >
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}
