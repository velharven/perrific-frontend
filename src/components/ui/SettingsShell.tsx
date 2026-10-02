import type { ReactNode } from 'react';

// Blok section full-width: label di atas, konten penuh di bawah.
export function SettingsBlock({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="border-b border-gray-100 pb-5 last:border-0">
      <div>
        <h3 className="font-manrope text-sm font-bold text-perrific-graphite">{title}</h3>
        <p className="mt-0.5 font-manrope text-xs text-perrific-graphite/50">{desc}</p>
      </div>
      <div className="mt-3 min-w-0">{children}</div>
    </section>
  );
}
