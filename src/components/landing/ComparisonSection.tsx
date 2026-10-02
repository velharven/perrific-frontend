import { Check, Minus, X, Columns3, Calendar, RefreshCw, Clock, Zap, FileText } from 'lucide-react';

function StatusBadge({ type }: { type: 'supported' | 'partial' | 'unsupported' }) {
  if (type === 'supported') {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Check size={11} strokeWidth={2.5} />
      </div>
    );
  }
  if (type === 'partial') {
    return (
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-perrific-paper text-perrific-graphite/40">
        <Minus size={10} strokeWidth={2.5} />
      </div>
    );
  }
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-perrific-paper text-perrific-graphite/35">
      <X size={10} strokeWidth={2.5} />
    </div>
  );
}

export default function ComparisonSection() {
  const rows = [
    {
      icon: <Columns3 size={18} strokeWidth={1.6} className="text-perrific-violet" />,
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
      icon: <Calendar size={18} strokeWidth={1.6} className="text-perrific-amber" />,
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
      icon: <RefreshCw size={18} strokeWidth={1.7} className="text-emerald-500" />,
      feature: 'Penjadwalan Tugas Tim ke Kalender',
      purrificText: 'Drag & Drop + Sidebar Terpadu',
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
      icon: <Clock size={18} strokeWidth={1.6} className="text-blue-500" />,
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
      icon: <Zap size={18} strokeWidth={1.6} className="text-amber-500" />,
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
      icon: <FileText size={18} strokeWidth={1.6} className="text-rose-500" />,
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
          <h2 className="font-manrope text-[28px] font-extrabold tracking-[-0.03em] text-perrific-graphite sm:text-[40px] lg:text-[46px]">
            Purrific vs. Notion & Taiga
          </h2>
          <p className="mt-3 font-manrope text-sm text-perrific-graphite/60 sm:text-base">
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
                    <span className="font-manrope text-[14px] sm:text-[15px] font-bold text-perrific-graphite leading-snug">
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
                    <span className="font-manrope text-xs sm:text-[13px] font-bold text-white pr-2 leading-tight">
                      {row.purrificText}
                    </span>
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-perrific-violet">
                      <Check size={13} strokeWidth={2.5} />
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
                    <span className="font-manrope text-xs text-perrific-graphite/70 pr-2 leading-relaxed">
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
                    <span className="font-manrope text-xs text-perrific-graphite/70 pr-2 leading-relaxed">
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
