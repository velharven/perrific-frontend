export default function ProblemSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1280px] px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-givonic text-[26px] font-extrabold leading-[0.95] tracking-[-0.03em] text-perrific-graphite sm:text-[32px]">
            Kenapa Pindah Ke <span className="font-gendy">Purrific</span>?
          </h2>
          <p className="mx-auto mt-3 max-w-[52ch] font-givonic text-sm leading-relaxed text-perrific-graphite/60">
            Trello enak untuk tim, Notion rapi untuk harian. <span className="font-gendy">Purrific</span> bikin keduanya nyambung — tanpa kerja dua kali.
          </p>
        </div>

        <div className="mx-auto mt-10 grid max-w-4xl gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-perrific-line bg-perrific-paper p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="#1A1A1E" strokeWidth="1.3" />
                <path d="M6 3v10M10 3v10M3 6h10M3 10h10" stroke="#1A1A1E" strokeWidth="1" opacity="0.2" />
              </svg>
            </div>
            <h3 className="mt-4 font-givonic text-sm font-bold text-perrific-graphite">Ringan</h3>
            <p className="mt-1.5 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Kanban 3 kolom yang langsung paham. Selesai dalam 2 menit.</p>
          </div>

          <div className="rounded-2xl border border-perrific-line bg-perrific-violet p-6 text-white">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-perrific-violet">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 3v8M3 8h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M5 12l3 2 3-2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 font-givonic text-sm font-bold">Otomatis</h3>
            <p className="mt-1.5 font-givonic text-xs leading-relaxed text-white/75">Tugas langsung jadi jadwal di Harian. Tanpa copy-paste.</p>
          </div>

          <div className="rounded-2xl border border-perrific-line bg-perrific-paper p-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="3" width="10" height="10" rx="2" stroke="#1A1A1E" strokeWidth="1.3" />
                <path d="M5 8.2l2 2 4-4" stroke="#1A1A1E" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 font-givonic text-sm font-bold text-perrific-graphite">Rapi Harian</h3>
            <p className="mt-1.5 font-givonic text-xs leading-relaxed text-perrific-graphite/60">Time-blocking & checklist ala Notion, sudah terisi.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
