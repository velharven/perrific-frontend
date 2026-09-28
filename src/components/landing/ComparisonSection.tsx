function StatusBadge({ type }: { type: 'supported' | 'partial' | 'unsupported' }) {
  if (type === 'supported') {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    );
  }
  if (type === 'partial') {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-perrific-paper text-perrific-graphite/40">
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path d="M3.5 8h9" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      </div>
    );
  }
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-perrific-paper text-perrific-graphite/35">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
        <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function ComparisonSection() {
  const rows = [
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-perrific-violet">
          <rect x="2" y="2" width="5" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <rect x="9" y="2" width="5" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      ),
      feature: 'Manajemen Kanban Tim',
      purrificText: 'Bawaan & Real-time',
      notion: {
        text: 'Perlu setup database manual',
        type: 'partial' as const,
      },
      taiga: {
        text: 'Mendukung sprint developer',
        type: 'supported' as const,
      },
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-perrific-amber">
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
      feature: 'Time-Blocking Harian Pribadi',
      purrificText: 'Terintegrasi Penuh',
      notion: {
        text: 'Input manual via template',
        type: 'partial' as const,
      },
      taiga: {
        text: 'Hanya level sprint tim',
        type: 'unsupported' as const,
      },
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-emerald-500">
          <path d="M2.5 8a5.5 5.5 0 019.4-3.9M13.5 8a5.5 5.5 0 01-9.4 3.9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M12 2v2.5H9.5M4 14v-2.5h2.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      feature: 'Auto-Sync Tugas Tim ke Jadwal Harian',
      purrificText: 'Otomatis & Real-time',
      notion: {
        text: 'Tidak ada (copy-paste manual)',
        type: 'unsupported' as const,
      },
      taiga: {
        text: 'Tidak ada kalender personal',
        type: 'unsupported' as const,
      },
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-blue-500">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.5v3.8l2.5 1.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
      feature: 'Integrasi Google Calendar 2-Arah',
      purrificText: 'Tersedia Langsung',
      notion: {
        text: 'Perlu addon / Notion Calendar',
        type: 'partial' as const,
      },
      taiga: {
        text: 'Tidak tersedia integrasi',
        type: 'unsupported' as const,
      },
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-amber-500">
          <path d="M9 2L3 9.5h5L7 14l6-7.5H8L9 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ),
      feature: 'Setup Cepat Tanpa Rumus (< 2 Menit)',
      purrificText: '< 2 Menit Siap Pakai',
      notion: {
        text: '1 – 2 jam menyusun struktur',
        type: 'partial' as const,
      },
      taiga: {
        text: 'Konfigurasi scrum cukup rumit',
        type: 'partial' as const,
      },
    },
    {
      icon: (
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" className="text-rose-500">
          <rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
          <path d="M6 5.5h4M6 8.5h4M6 11.5h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      ),
      feature: 'Catatan & Dokumen Terpadu',
      purrificText: 'Block Editor & Tabel',
      notion: {
        text: 'Dukungan blok sangat kaya',
        type: 'supported' as const,
      },
      taiga: {
        text: 'Hanya modul wiki proyek',
        type: 'partial' as const,
      },
    },
  ];

  return (
    <section id="perbandingan" className="bg-white py-16 sm:py-24">
      <div className="mx-auto max-w-[1140px] px-4 sm:px-6 lg:px-8">
        {/* Header - Clean, Bold, Minimalist */}
        <div className="text-center mb-12 sm:mb-16">
          <h2 className="font-givonic text-[28px] font-extrabold tracking-[-0.03em] text-perrific-graphite sm:text-[40px] lg:text-[46px]">
            Purrific vs. Notion & Taiga
          </h2>
          <p className="mt-3 font-givonic text-sm text-perrific-graphite/60 sm:text-base">
            Perbandingan fitur utama untuk mengelola kolaborasi tim dan aktivitas harianmu.
          </p>
        </div>

        {/* Comparison Table with Proper Horizontal Gap */}
        <div className="overflow-x-auto pb-6">
          <div className="min-w-[880px] grid grid-cols-[1.3fr_1.35fr_1fr_1fr] gap-x-5 sm:gap-x-7 items-start">
            {/* Column 1: Feature */}
            <div>
              <div className="h-10 flex items-center pl-2 font-mono text-[11px] font-bold tracking-widest text-perrific-graphite/40 uppercase">
                FEATURE
              </div>
              <div className="divide-y divide-perrific-line/50">
                {rows.map((row, idx) => (
                  <div key={idx} className="h-[72px] flex items-center gap-3 pl-2 pr-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-perrific-paper border border-perrific-line/60">
                      {row.icon}
                    </div>
                    <span className="font-givonic text-[14px] sm:text-[15px] font-bold text-perrific-graphite leading-snug">
                      {row.feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 2: Purrific Pillar with Gap & Text + Checkmark */}
            <div>
              <div className="h-10 flex items-center justify-center font-mono text-[11px] font-extrabold tracking-widest text-perrific-violet uppercase">
                PURRIFIC
              </div>
              <div className="rounded-2xl sm:rounded-3xl bg-perrific-violet divide-y divide-white/15">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="h-[72px] flex items-center justify-between px-4 sm:px-5"
                  >
                    <span className="font-givonic text-xs sm:text-[13px] font-bold text-white pr-2 leading-tight">
                      {row.purrificText}
                    </span>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-perrific-violet">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                        <path
                          d="M13.3 4.3L6 11.6 2.7 8.3"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Column 3: Notion */}
            <div>
              <div className="h-10 flex items-center pl-2 font-mono text-[11px] font-bold tracking-widest text-perrific-graphite/40 uppercase">
                NOTION
              </div>
              <div className="divide-y divide-perrific-line/50">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="h-[72px] flex items-center justify-between pl-2 pr-2"
                  >
                    <span className="font-givonic text-xs text-perrific-graphite/70 pr-2 leading-relaxed">
                      {row.notion.text}
                    </span>
                    <StatusBadge type={row.notion.type} />
                  </div>
                ))}
              </div>
            </div>

            {/* Column 4: Taiga */}
            <div>
              <div className="h-10 flex items-center pl-2 font-mono text-[11px] font-bold tracking-widest text-perrific-graphite/40 uppercase">
                TAIGA
              </div>
              <div className="divide-y divide-perrific-line/50">
                {rows.map((row, idx) => (
                  <div
                    key={idx}
                    className="h-[72px] flex items-center justify-between pl-2 pr-2"
                  >
                    <span className="font-givonic text-xs text-perrific-graphite/70 pr-2 leading-relaxed">
                      {row.taiga.text}
                    </span>
                    <StatusBadge type={row.taiga.type} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
