export default function ProblemSection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1280px] px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-givonic text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] text-perrific-graphite sm:text-[36px]">
            Kenapa Beralih Ke <span className="font-gendy text-perrific-violet">Purrific</span>?
          </h2>
          <p className="mx-auto mt-3.5 max-w-[54ch] font-givonic text-sm leading-relaxed text-perrific-graphite/70 sm:text-base">
            Trello mudah untuk tim, Notion rapi untuk produktivitas pribadi. <span className="font-semibold text-perrific-graphite">Purrific</span> menyatukan keduanya tanpa perlu bolak-balik aplikasi.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-3">
          <div className="group rounded-2xl border border-perrific-line bg-perrific-paper p-6 transition-all duration-200 hover:-translate-y-1 hover:border-perrific-wood/40 hover:shadow-[0_8px_24px_rgba(26,26,30,0.06)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-xs border border-perrific-line/50 transition-colors group-hover:border-perrific-violet/40">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="3" width="10" height="10" rx="1.5" stroke="#1A1A1E" strokeWidth="1.4" />
                <path d="M6 3v10M10 3v10M3 6h10M3 10h10" stroke="#1A1A1E" strokeWidth="1" opacity="0.25" />
              </svg>
            </div>
            <h3 className="mt-4 font-givonic text-base font-bold text-perrific-graphite">Ringan & Intuitif</h3>
            <p className="mt-2 font-givonic text-xs leading-relaxed text-perrific-graphite/65">
              Kanban 3 kolom yang langsung dipahami seluruh tim tanpa perlu tutorial berjam-jam. Mulai dalam 2 menit.
            </p>
          </div>

          <div className="group rounded-2xl border border-perrific-violet/30 bg-perrific-violet p-6 text-white shadow-[0_10px_25px_rgba(255,80,11,0.22)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(255,80,11,0.32)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-perrific-violet shadow-xs">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <path d="M8 2.5v9M3.5 7.5l4.5 4.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 font-givonic text-base font-bold">Sinkronisasi Otomatis</h3>
            <p className="mt-2 font-givonic text-xs leading-relaxed text-white/85">
              Setiap tugas yang didelegasikan otomatis menjadi time-block di menu Harian pengguna. Tanpa copy-paste.
            </p>
          </div>

          <div className="group rounded-2xl border border-perrific-line bg-perrific-paper p-6 transition-all duration-200 hover:-translate-y-1 hover:border-perrific-wood/40 hover:shadow-[0_8px_24px_rgba(26,26,30,0.06)]">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-xs border border-perrific-line/50 transition-colors group-hover:border-perrific-violet/40">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <rect x="3" y="3" width="10" height="10" rx="2" stroke="#1A1A1E" strokeWidth="1.4" />
                <path d="M5 8.2l2 2 4-4" stroke="#1A1A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h3 className="mt-4 font-givonic text-base font-bold text-perrific-graphite">Hari Lebih Tertata</h3>
            <p className="mt-2 font-givonic text-xs leading-relaxed text-perrific-graphite/65">
              Time-blocking harian & checklist ala Notion yang sudah terisi otomatis dari board tim, siap langsung dikerjakan.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
