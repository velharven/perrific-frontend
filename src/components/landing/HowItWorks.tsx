import { useState } from 'react';
import { PanelLeft, Archive, Calendar, FileText, Users, Zap, CheckCircle2, Lightbulb } from 'lucide-react';

export default function HowItWorks() {
  const [activeStep, setActiveStep] = useState<number>(1);

  const steps = [
    {
      num: 1,
      tag: '01',
      tabLabel: '01. Buat Ruang Kerja & Tim',
      title: 'Buat Ruang Kerja & Undang Tim',
      desc: 'Siapkan ruang kerja tim dalam hitungan detik. Cukup beri nama tim dan bagikan kode undangan 8 digit agar rekan kerja langsung bergabung.',
      badge: 'Setup < 2 menit tanpa konfigurasi database',
      path: 'purrific.app / workspace / setup-tim',
    },
    {
      num: 2,
      tag: '02',
      tabLabel: '02. Tugaskan di Kanban Board',
      title: 'Tugaskan Pekerjaan di Kanban Board',
      desc: 'Kelola alur tugas tim di board visual (To Do, Doing, Done). Tentukan tenggat waktu, prioritas, dan delegasikan langsung ke anggota tim.',
      badge: 'Drag-and-drop responsif & delegasi tugas langsung',
      path: 'purrific.app / workspace / board-kanban',
    },
    {
      num: 3,
      tag: '03',
      tabLabel: '03. Otomatis Masuk Jadwal Harian',
      title: 'Otomatis Masuk ke Jadwal Harian',
      desc: 'Tugas yang didelegasikan otomatis tertata sebagai time-block di menu Harian anggota dan tersinkronisasi dua arah dengan Google Calendar.',
      badge: 'Sinkronisasi Google Calendar 2-arah real-time',
      path: 'purrific.app / workspace / kalender-harian',
    },
  ];

  const currentStep = steps[activeStep - 1];

  return (
    <section id="cara-kerja" className="relative bg-white py-16 sm:py-24 overflow-hidden">
      <div className="mx-auto w-full max-w-[1140px] px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center max-w-2xl mx-auto mb-8 sm:mb-10">
          <span className="font-mono text-xs font-bold tracking-widest text-perrific-violet uppercase">
            Cara Kerja
          </span>
          <h2 className="mt-2 font-givonic text-2xl sm:text-3xl lg:text-[36px] font-extrabold leading-[1.15] tracking-[-0.03em] text-perrific-graphite">
            Hanya Dalam 3 Langkah Sederhana
          </h2>
          <p className="mt-3 font-givonic text-sm sm:text-base text-perrific-graphite/70 leading-relaxed">
            Hubungkan pembentukan tim, penugasan di board, hingga jadwal harian anggota tanpa perlu atur ulang manual.
          </p>

          {/* Horizontal Step Tabs Switcher (Valley SaaS Style) */}
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 rounded-2xl border border-gray-200/90 bg-gray-50/80 p-1.5 shadow-2xs backdrop-blur">
            {steps.map((s) => (
              <button
                key={s.num}
                type="button"
                onClick={() => setActiveStep(s.num)}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 font-givonic text-xs font-bold transition-all duration-200 ${
                  activeStep === s.num
                    ? 'bg-white text-perrific-graphite shadow-xs border border-gray-200/80 scale-[1.01]'
                    : 'text-perrific-graphite/60 hover:text-perrific-graphite hover:bg-white/60'
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-mono ${
                    activeStep === s.num
                      ? 'bg-perrific-violet text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {s.num}
                </span>
                <span>{s.tabLabel}</span>
              </button>
            ))}
          </div>

          {/* Current Step Narrative Highlight */}
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-center gap-2 text-xs font-givonic text-perrific-graphite/70">
            <span className="font-semibold text-perrific-graphite">{currentStep.title}:</span>
            <span>{currentStep.desc}</span>
          </div>
        </div>

        {/* Mockup Window Container with Soft Pastel Atmospheric Aura Glow */}
        <div className="relative text-left">
          {/* Dreamy Pastel Mesh Aura Glow Behind Window */}
          <div className="pointer-events-none absolute -inset-4 sm:-inset-8 rounded-[40px] bg-gradient-to-tr from-amber-200/30 via-rose-100/25 to-orange-200/30 blur-3xl opacity-80 -z-10" />

          {/* Main App Window Container */}
          <div className="relative mx-auto max-w-[1040px] rounded-2xl border border-gray-200/90 bg-white shadow-[0_24px_60px_rgba(26,26,30,0.08),0_1px_3px_rgba(26,26,30,0.04)] overflow-hidden">
            {/* Window Titlebar */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-[#FAFAFA] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/50" />
                <span className="h-3 w-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/50" />
                <span className="h-3 w-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/50" />
                <span className="ml-3 hidden text-[11px] font-mono text-perrific-graphite/50 sm:inline">
                  {currentStep.path}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Sync Aktif
                </span>
              </div>
            </div>

            {/* App Layout: Left Authentic Purrific Sidebar + Right Step Content */}
            <div className="grid grid-cols-1 md:grid-cols-12 min-h-[420px] bg-white divide-y md:divide-y-0 md:divide-x divide-gray-100">
              {/* Left Column: Authentic Purrific Sidebar (Identical to Dashboard) */}
              <div className="md:col-span-4 lg:col-span-3 bg-[#FBFBFB] p-3.5 flex flex-col justify-between">
                <div>
                  {/* Sidebar Top: Collapse Panel Toggle & Archive Icon */}
                  <div className="flex items-center justify-between pb-3 border-b border-gray-100/80">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 shadow-2xs">
                        <PanelLeft size={13} strokeWidth={1.5} aria-hidden="true" />
                      </div>
                      <span className="font-givonic text-xs font-bold text-perrific-graphite">
                        Purrific Workspace
                      </span>
                    </div>
                    <span className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400">
                      <Archive size={13} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  </div>

                  {/* Section 1: PRIVAT */}
                  <div className="mt-3.5">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <p className="font-mono text-[10px] font-bold tracking-widest text-perrific-wood uppercase">
                        PRIVAT
                      </p>
                      <span className="text-[10px] text-gray-400">▾</span>
                    </div>
                    <div className="space-y-0.5">
                      {/* Harian is active in Step 3 */}
                      <div
                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 font-givonic text-xs transition-colors ${
                          activeStep === 3
                            ? 'bg-white font-bold text-perrific-graphite border border-gray-200/80 shadow-2xs'
                            : 'font-medium text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <Calendar size={13} strokeWidth={1.5} aria-hidden="true" className={`shrink-0 ${activeStep === 3 ? 'text-perrific-violet' : 'text-gray-400'}`} />
                          <span>Harian</span>
                        </span>
                        {activeStep === 3 && (
                          <span className="h-1.5 w-1.5 rounded-full bg-perrific-violet" />
                        )}
                      </div>
                      <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-givonic text-xs font-medium text-gray-600 hover:bg-gray-100">
                        <FileText size={13} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-gray-400" />
                        <span>Catatan Sprint</span>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: TIM SAYA */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between px-1 mb-1">
                      <p className="font-mono text-[10px] font-bold tracking-widest text-perrific-wood uppercase">
                        TIM SAYA
                      </p>
                      <span className="text-[10px] text-gray-400">▾</span>
                    </div>

                    <div className="space-y-0.5">
                      {/* Team Header - Highlighted in Step 1 */}
                      <div
                        className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 font-givonic text-xs transition-colors ${
                          activeStep === 1
                            ? 'bg-white font-bold text-perrific-graphite border border-gray-200/80 shadow-2xs'
                            : 'font-bold text-perrific-graphite bg-gray-100/90'
                        }`}
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-perrific-violet/10 font-mono text-[10px] font-bold text-perrific-violet">
                            TP
                          </span>
                          <span className="truncate">Tim Produk &amp; Eng</span>
                        </span>
                        {activeStep === 1 && (
                          <span className="rounded bg-perrific-violet/10 px-1 font-mono text-[9px] font-bold text-perrific-violet">
                            Baru
                          </span>
                        )}
                      </div>

                      {/* Sub-item: Board Kanban - Highlighted in Step 2 */}
                      <div
                        className={`ml-4 flex items-center justify-between rounded-lg px-2.5 py-1.5 font-givonic text-xs transition-colors ${
                          activeStep === 2
                            ? 'bg-white font-bold text-perrific-graphite border border-gray-200/80 shadow-2xs'
                            : 'font-medium text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {activeStep === 2 && (
                            <span className="h-1.5 w-1.5 rounded-full bg-perrific-violet" />
                          )}
                          <span>Board Kanban</span>
                        </span>
                        <span className="rounded bg-gray-100 px-1 font-mono text-[9px] text-gray-600">
                          Sprint 4
                        </span>
                      </div>

                      <div className="ml-4 flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-givonic text-[11px] text-gray-500">
                        <Users size={12} strokeWidth={1.4} aria-hidden="true" className="shrink-0 text-gray-400" />
                        <span>4 Anggota</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Sidebar Bottom: User Profile Info */}
                <div className="pt-3 border-t border-gray-100/80">
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

              {/* Right Column: Step Focused Content Area */}
              <div className="md:col-span-8 lg:col-span-9 p-5 sm:p-6 flex flex-col justify-between bg-white">
                {/* VIEW FOR STEP 1: Buat Tim & Undang Anggota */}
                {activeStep === 1 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-perrific-wood uppercase tracking-wider">
                          LANGKAH 01 · SETUP TIM
                        </span>
                        <h3 className="mt-0.5 font-givonic text-lg font-bold text-perrific-graphite">
                          Ruang Kerja: Tim Produk &amp; Engineering
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                        <span>Siap Dipakai</span>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Invite Code Box */}
                      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                        <span className="font-mono text-[10px] font-bold text-perrific-wood uppercase tracking-wider">
                          Kode Undangan Anggota
                        </span>
                        <div className="mt-2 flex items-center gap-2.5">
                          <span className="font-mono text-xl font-extrabold tracking-wider text-perrific-graphite bg-white px-3.5 py-1.5 rounded-lg border border-gray-200 shadow-2xs">
                            PURR-2026
                          </span>
                          <span className="rounded-md bg-perrific-violet/10 text-perrific-violet px-2.5 py-1.5 font-givonic text-xs font-bold">
                            Aktif
                          </span>
                        </div>
                        <p className="mt-2 text-[11px] text-perrific-graphite/60 font-givonic">
                          Bagikan kode ini ke rekan kerjamu untuk langsung bergabung tanpa menunggu konfirmasi manual.
                        </p>
                      </div>

                      {/* Team Members List */}
                      <div className="rounded-xl border border-gray-200 bg-gray-50/60 p-4">
                        <span className="font-mono text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                          Anggota Bergabung (4)
                        </span>
                        <div className="mt-2.5 space-y-2">
                          {[
                            { name: 'VelHarven', role: 'Ketua Tim / Admin', avatar: 'VH' },
                            { name: 'Sarah Amanda', role: 'Frontend Engineer', avatar: 'SA' },
                            { name: 'Budi Santoso', role: 'Backend Engineer', avatar: 'BS' },
                          ].map((m, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs font-givonic">
                              <div className="flex items-center gap-2">
                                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-perrific-violet text-[9px] font-bold text-white">
                                  {m.avatar}
                                </span>
                                <span className="font-semibold text-perrific-graphite">{m.name}</span>
                              </div>
                              <span className="text-[10px] text-gray-500">{m.role}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW FOR STEP 2: Tugaskan di Kanban Board */}
                {activeStep === 2 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-perrific-wood uppercase tracking-wider">
                          LANGKAH 02 · KANBAN BOARD
                        </span>
                        <h3 className="mt-0.5 font-givonic text-lg font-bold text-perrific-graphite">
                          Board Kolaborasi: Sprint Peluncuran
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-perrific-violet">
                        <Zap size={12} className="shrink-0" />
                        Auto-Sync ke Kalender
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {/* Doing Column with Highlight Task */}
                      <div className="rounded-xl bg-gray-50/70 p-3 border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-givonic text-xs font-bold text-perrific-graphite flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-amber-400" />
                            Sedang Dikerjakan
                          </span>
                          <span className="font-mono text-[10px] font-bold text-gray-500 bg-white px-1.5 rounded border border-gray-200">
                            1
                          </span>
                        </div>

                        {/* Task Card */}
                        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
                          <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                            <span className="rounded bg-rose-50 text-rose-700 px-1.5 py-0.5 text-[10px] font-bold">
                              Prioritas Tinggi
                            </span>
                            <span className="text-[10px] font-bold text-rose-600 font-mono">
                              Hari Ini, 15:00
                            </span>
                          </div>
                          <h4 className="mt-2 font-givonic text-xs font-bold text-perrific-graphite leading-snug">
                            Integrasi Google Calendar &amp; Real-time Socket
                          </h4>
                          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-gray-100 text-[10px] text-gray-500 font-givonic">
                            <span>PJ: VelHarven</span>
                            <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold">
                              <span>Tersinkronisasi</span>
                              <Zap size={11} className="shrink-0" />
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Done Column */}
                      <div className="rounded-xl bg-gray-50/70 p-3 border border-gray-200 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-givonic text-xs font-bold text-perrific-graphite flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                            Selesai
                          </span>
                          <span className="font-mono text-[10px] font-bold text-gray-500 bg-white px-1.5 rounded border border-gray-200">
                            2
                          </span>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-2.5 opacity-80 space-y-1">
                          <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[9px] font-semibold">
                            Backend
                          </span>
                          <p className="font-givonic text-xs font-medium text-perrific-graphite line-through opacity-70">
                            Inisialisasi Skema Database Prisma
                          </p>
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-2.5 opacity-80 space-y-1">
                          <span className="rounded bg-slate-100 text-slate-700 px-1.5 py-0.2 text-[9px] font-semibold">
                            Desain
                          </span>
                          <p className="font-givonic text-xs font-medium text-perrific-graphite line-through opacity-70">
                            Penyelarasan Warna &amp; Typography
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* VIEW FOR STEP 3: Otomatis Masuk Jadwal Harian */}
                {activeStep === 3 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div>
                        <span className="font-mono text-[10px] font-bold text-perrific-wood uppercase tracking-wider">
                          LANGKAH 03 · JADWAL HARIAN SAYA
                        </span>
                        <h3 className="mt-0.5 font-givonic text-lg font-bold text-perrific-graphite">
                          Agenda Harian: 28 September
                        </h3>
                      </div>
                      <span className="inline-flex items-center gap-1 font-semibold text-blue-600 text-xs">
                        <CheckCircle2 size={12} className="shrink-0" />
                        Google Calendar 2-Way Sync
                      </span>
                    </div>

                    <div className="space-y-2.5">
                      {/* Daily Slot 1: Standup */}
                      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs">
                        <span className="font-mono text-xs font-bold text-gray-400 pt-0.5">09:00</span>
                        <div className="flex-1">
                          <p className="font-givonic font-semibold text-perrific-graphite">
                            Daily Standup Team
                          </p>
                          <span className="text-[10px] text-blue-600">Google Meet</span>
                        </div>
                      </div>

                      {/* Daily Slot 2: Synchronized Task from Board */}
                      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-xs">
                        <span className="font-mono text-xs font-extrabold text-perrific-violet pt-0.5">10:00 - 12:00</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <h4 className="font-givonic text-xs font-bold text-perrific-graphite">
                              Integrasi Google Calendar &amp; Real-time Socket
                            </h4>
                            <span className="rounded bg-perrific-violet/10 text-perrific-violet text-[9px] font-bold px-2 py-0.5">
                              Dari Board Tim
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-perrific-graphite/60 font-givonic">
                            Slot Waktu Fokus · Otomatis terjadwal dari penugasan board sprint
                          </p>
                        </div>
                      </div>

                      {/* Daily Slot 3: Afternoon Focus */}
                      <div className="flex items-start gap-3 rounded-xl border border-gray-200 bg-gray-50/50 p-2.5 text-xs">
                        <span className="font-mono text-xs font-bold text-gray-400 pt-0.5">13:30</span>
                        <div className="flex-1">
                          <p className="font-givonic font-semibold text-perrific-graphite">
                            Deep Focus: Review PR &amp; Deploy
                          </p>
                          <span className="text-[10px] text-amber-700">1.5 Jam</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Bottom Callout in Preview */}
                <div className="mt-4 rounded-xl bg-gray-50 p-2.5 border border-gray-200 text-center">
                  <p className="flex items-center justify-center gap-1.5 font-givonic text-xs text-perrific-graphite/70">
                    <Lightbulb size={14} strokeWidth={1.5} aria-hidden="true" className="shrink-0 text-amber-500" />
                    <span>
                      <strong className="text-perrific-graphite">Hasil:</strong> {currentStep.badge}
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
