import type { ReactNode } from 'react';

// Blok section ala PeakPlanner: label kiri, konten kanan.
// Dipakai halaman settings project, dashboard, dan tim agar konsisten.
export function SettingsBlock({ title, desc, children }: { title: string; desc: string; children: ReactNode }) {
  return (
    <section className="grid gap-1 border-b border-gray-100 pb-5 last:border-0 sm:grid-cols-[180px_1fr] sm:gap-4">
      <div>
        <h3 className="font-givonic text-sm font-bold text-perrific-graphite">{title}</h3>
        <p className="mt-0.5 font-givonic text-xs text-perrific-graphite/50">{desc}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
