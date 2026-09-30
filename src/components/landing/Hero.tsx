import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-perrific-paper pt-8 pb-16 lg:pt-14 lg:pb-24">
      {/* Background Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.24]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(26,26,30,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(26,26,30,0.05) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      {/* Subtle Warm Glow Behind Hero */}
      <div className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 h-72 w-[600px] max-w-full rounded-full bg-gradient-to-tr from-perrific-violet/12 to-amber-200/25 blur-3xl" />

      <div className="relative mx-auto max-w-[1180px] px-4 text-center sm:px-6 lg:px-8">
        {/* Hero Title */}
        <h1 className="mx-auto max-w-[20ch] font-givonic text-[36px] font-extrabold leading-[1.08] tracking-[-0.035em] text-perrific-graphite sm:text-[50px] lg:text-[62px]">
          Atur Timmu dan keseharianmu{' '}
          <span className="bg-gradient-to-r from-perrific-violet via-[#FF6826] to-perrific-amber bg-clip-text text-transparent">
            dalam 1 waktu
          </span>
        </h1>

        {/* Subtitle */}
        <p className="mx-auto mt-6 max-w-[48ch] font-givonic text-[15px] leading-relaxed text-perrific-graphite/70 sm:text-[18px]">
          Purrific menghubungkan board kolaborasi tim dengan jadwal harianmu — tugas yang ditugaskan otomatis tersinkronisasi menjadi time-block di Harian. Ringan, terarah, dan tanpa atur ulang.
        </p>

        {/* CTA Buttons */}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-perrific-violet px-7 py-3.5 font-givonic text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,80,11,0.25)] hover:bg-[#E64D0A] hover:shadow-[0_6px_20px_rgba(255,80,11,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perrific-violet focus-visible:ring-offset-2 focus-visible:ring-offset-perrific-paper active:scale-[0.98] transition-all"
          >
            Mulai Gratis
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            >
              <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <a
            href="#cara-kerja"
            className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-6 py-3.5 font-givonic text-sm font-medium text-perrific-graphite shadow-sm hover:bg-gray-50 hover:border-gray-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perrific-violet focus-visible:ring-offset-2 focus-visible:ring-offset-perrific-paper active:scale-[0.98] transition-all"
          >
            Lihat Cara Kerja
          </a>
        </div>


        {/* Interactive UI Mockup Window with Pastel Atmospheric Aura Glow */}
        <div className="relative mt-12 text-left">
          {/* Dreamy Pastel Mesh Aura Glow Behind Window (Valley Style) */}
          <div className="pointer-events-none absolute -inset-4 sm:-inset-8 rounded-[40px] bg-gradient-to-tr from-amber-200/35 via-rose-100/30 to-orange-200/35 blur-3xl opacity-80 -z-10" />

          {/* Main App Window Container */}
          <div className="relative mx-auto max-w-[1060px] rounded-2xl border border-gray-200/90 bg-white shadow-[0_24px_60px_rgba(26,26,30,0.08),0_1px_3px_rgba(26,26,30,0.04)] overflow-hidden">
            {/* Window Titlebar */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-[#FAFAFA] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50" />
                <span className="h-3 w-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50" />
                <span className="h-3 w-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50" />
                <span className="ml-3 hidden text-[11px] font-mono text-perrific-graphite/50 sm:inline">
                  purrific.app / workspace / sprint-peluncuran
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Aktif
                </span>
              </div>
            </div>

            {/* App Layout: Left Authentic Purrific Sidebar + Right Main Workspace */}
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[440px] bg-white divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {/* Left Column: Authentic Purrific Sidebar (Matches AppLayout.tsx) */}
              <div className="md:col-span-4 lg:col-span-3 bg-[#FBFBFB] p-3.5 flex flex-col justify-between">
                <div>
                  {/* Sidebar Top: Collapse Panel Toggle & Archive Icon */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100/80">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-2xs">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                          <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M6.5 2.5v11" stroke="currentColor" strokeWidth="1.5" />
                        </svg>
                      </div>
                      <span className="font-givonic text-xs font-bold text-perrific-graphite">
                        Purrific Workspace
                      </span>
                    </div>
                    <span className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 hover:text-gray-600">
                      <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                        <path d="M2.5 3.5h11L11 6.5H5L2.5 3.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        <path d="M3.2 6.5v5.2a1 1 0 0 0 1 1h7.6a1 1 0 0 0 1-1V6.5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        <path d="M6 10h4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                      </svg>
                    </span>
                  </div>

                  {/* Section 1: PRIVAT (Exact Match with Dashboard) */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <p className="font-mono text-[10px] font-bold tracking-widest text-perrific-wood uppercase">
                        PRIVAT
                      </p>
                      <span className="text-[10px] text-gray-400">▾</span>
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-givonic text-xs font-medium text-gray-600 hover:bg-gray-100">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-gray-400">
                          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                          <path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                        <span>Harian</span>
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-givonic text-xs font-medium text-gray-600 hover:bg-gray-100">
                        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-gray-400">
                          <path d="M4 2.5h5.5L12.5 5.5V13.5H4V2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                          <path d="M9.5 2.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
                        </svg>
                        <span>Catatan Sprint</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: TIM SAYA (Exact Match with Dashboard) */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <p className="font-mono text-[10px] font-bold tracking-widest text-perrific-wood uppercase">
                        TIM SAYA
                      </p>
                      <span className="text-[10px] text-gray-400">▾</span>
                    </div>

                    {/* Team Item */}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 rounded-lg bg-gray-100/90 px-2.5 py-1.5 font-givonic text-xs font-bold text-perrific-graphite">
                        <span className="flex h-5 w-5 items-center justify-center rounded bg-perrific-violet/10 font-mono text-[10px] font-bold text-perrific-violet">
                          TP
                        </span>
                        <span className="truncate">Tim Produk &amp; Eng</span>
                      </div>

                      {/* Sub-item: Board Kanban (Active in Mockup) */}
                      <div className="ml-4 flex items-center justify-between rounded-lg bg-white border border-gray-200/80 px-2.5 py-1.5 font-givonic text-xs font-semibold text-perrific-graphite shadow-2xs">
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-perrific-violet" />
                          <span>Board Kanban</span>
                        </span>
                        <span className="rounded bg-gray-100 px-1 font-mono text-[9px] text-gray-600">
                          Sprint 4
                        </span>
                      </div>
                      <div className="ml-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-givonic text-[11px] text-gray-500 hover:bg-gray-100">
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-gray-400">
                          <circle cx="6" cy="5.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
                          <path d="M2 13.5c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                          <circle cx="11.5" cy="6" r="1.7" stroke="currentColor" strokeWidth="1.3" />
                          <path d="M11 9.9c1.7.2 3 1.5 3 3.1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                        </svg>
                        <span>4 Anggota</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar Bottom: User Profile Info */}
                <div className="pt-3 border-t border-gray-100/80">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-perrific-violet font-mono text-[10px] font-bold text-white shadow-2xs">
                        VH
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-givonic text-xs font-bold text-perrific-graphite leading-tight">
                          VelHarven
                        </p>
                        <p className="flex items-center gap-1 text-[10px] text-emerald-600 font-medium leading-none">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>Online</span>
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Main Workspace Area (Clean Realistic UI) */}
              <div className="md:col-span-8 lg:col-span-9 p-4 sm:p-5 flex flex-col justify-between bg-white">
                <div>
                  {/* Top Workspace Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3.5 border-b border-gray-100">
                    <div>
                      <h3 className="font-givonic text-base font-bold text-perrific-graphite">
                        Sprint Peluncuran Purrific
                      </h3>
                      <p className="text-xs text-perrific-graphite/50 font-givonic">
                        Board Kanban Tim · Sinkron otomatis ke kalender harian
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-md bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-600 border border-gray-200">
                        12 Selesai · 2 Dikerjakan
                      </span>
                    </div>
                  </div>

                  {/* Dual Panel: Left Kanban Columns & Right Today's Schedule */}
                  <div className="mt-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3.5">
                    {/* Left: Kanban Column (Sedang Dikerjakan) */}
                    <div className="lg:col-span-7 space-y-2.5">
                      <div className="flex items-center justify-between px-1">
                        <span className="font-givonic text-xs font-bold text-perrific-graphite flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          Sedang Dikerjakan
                        </span>
                        <span className="font-mono text-[10px] font-bold text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded-full">
                          2
                        </span>
                      </div>

                      {/* Prominent Task Card */}
                      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
                        <div className="flex items-center justify-between gap-1 mb-1.5">
                          <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-700">
                            Prioritas Tinggi
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] text-perrific-violet font-semibold">
                            <span className="h-1.5 w-1.5 rounded-full bg-perrific-violet animate-pulse" />
                            Auto-Sync
                          </span>
                        </div>
                        <h4 className="font-givonic text-xs font-bold text-perrific-graphite">
                          Integrasi Google Calendar &amp; Real-time Sync
                        </h4>
                        <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-500">
                          <span className="text-rose-600 font-medium">
                            Hari Ini, 15:00
                          </span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-gray-400">PJ:</span>
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-perrific-violet text-[8px] font-bold text-white">
                              VH
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Secondary Task Card */}
                      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-2xs">
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                          Desain UI
                        </span>
                        <h4 className="mt-1 font-givonic text-xs font-medium text-perrific-graphite">
                          Update hero layout &amp; tab modern
                        </h4>
                      </div>
                    </div>

                    {/* Right: Personal Today's Time-Blocking */}
                    <div className="lg:col-span-5 rounded-xl bg-gray-50/70 p-3 border border-gray-200">
                      <div className="flex items-center justify-between pb-2 border-b border-gray-200/70">
                        <span className="font-mono text-[10px] font-bold text-gray-600 uppercase">
                          Harian Saya
                        </span>
                        <span className="text-[10px] font-semibold text-blue-600 flex items-center gap-1">
                          <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.4 6.3l-4 4a1 1 0 01-1.4 0l-2-2a1 1 0 011.4-1.4L7 8.3l3.3-3.3a1 1 0 011.4 1.4z" />
                          </svg>
                          Sync G-Cal
                        </span>
                      </div>

                      {/* Time Slots */}
                      <div className="mt-2.5 space-y-2">
                        {/* Standup */}
                        <div className="flex items-start gap-2 text-xs">
                          <span className="font-mono text-[10px] text-gray-400 pt-0.5">09:00</span>
                          <div className="flex-1 rounded-lg bg-blue-50/80 border border-blue-100 p-1.5">
                            <p className="font-givonic text-[11px] font-semibold text-blue-900 leading-tight">
                              Daily Standup Team
                            </p>
                          </div>
                        </div>

                        {/* Synchronized block from board */}
                        <div className="flex items-start gap-2 text-xs">
                          <span className="font-mono text-[10px] text-perrific-violet font-bold pt-0.5">10:00</span>
                          <div className="flex-1 rounded-lg bg-white border border-gray-200 p-2 shadow-2xs">
                            <div className="flex items-center justify-between">
                              <span className="font-givonic text-[11px] font-bold text-perrific-graphite leading-tight">
                                Integrasi Google Calendar
                              </span>
                            </div>
                            <span className="mt-1 inline-block rounded bg-perrific-violet/10 px-1 font-mono text-[9px] font-bold text-perrific-violet">
                              Dari Board Tim
                            </span>
                          </div>
                        </div>

                        {/* Focus */}
                        <div className="flex items-start gap-2 text-xs">
                          <span className="font-mono text-[10px] text-gray-400 pt-0.5">13:30</span>
                          <div className="flex-1 rounded-lg bg-amber-50/60 border border-amber-100 p-1.5">
                            <p className="font-givonic text-[11px] font-medium text-amber-900 leading-tight">
                              Deep Focus: Coding
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Callout in Preview */}
                <div className="mt-3.5 rounded-xl bg-gray-50 p-2.5 border border-gray-200 text-center">
                  <p className="flex items-center justify-center gap-1.5 font-givonic text-xs text-perrific-graphite/70">
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-amber-500">
                      <path d="M8 1.5a4.5 4.5 0 0 0-4.5 4.5c0 1.8 1.1 3.2 2 4.2V12a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1.8c.9-1 2-2.4 2-4.2A4.5 4.5 0 0 0 8 1.5zM6.5 14.5h3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span>
                      <strong className="text-perrific-graphite">Otomatis &amp; Real-time:</strong> Begitu tugas ditugaskan di Kanban board tim, jadwal harian anggota langsung tertata rapi.
                    </span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
