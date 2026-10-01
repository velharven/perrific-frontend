import { Kanban, Calendar, RefreshCw, Bell } from 'lucide-react';

export default function SolutionSection() {
  return (
    <section id="fitur" className="bg-perrific-paper py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <span className="font-mono text-xs font-bold tracking-wider text-perrific-wood uppercase">
            Fitur Utama
          </span>
          <h2 className="mt-2 font-givonic text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] text-perrific-graphite sm:text-[36px]">
            Semua Yang Dibutuhkan, Tanpa Kerumitan.
          </h2>
          <p className="mx-auto mt-3.5 max-w-[50ch] font-givonic text-sm leading-relaxed text-perrific-graphite/70 sm:text-base">
            Empat pilar utama yang bekerja harmonis di belakang layar untuk memastikan ritme kerja tim tetap terukur dan santai.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-4 sm:grid-cols-2">
          {/* Feature 1: Board */}
          <div className="group rounded-2xl border border-perrific-line bg-white p-6 transition-all duration-200 hover:border-perrific-wood/40 hover:shadow-[0_4px_20px_rgba(26,26,30,0.05)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-perrific-paper text-perrific-graphite border border-perrific-line/60">
              <Kanban size={18} strokeWidth={1.6} />
            </div>
            <h3 className="mt-4 font-givonic text-base font-bold text-perrific-graphite">Kanban Board Tim</h3>
            <p className="mt-1.5 font-givonic text-xs leading-relaxed text-perrific-graphite/65">
              Kelola tugas proyek dalam alur kerja visual. Geser status secara instan tanpa jeda pemuatan halaman.
            </p>
          </div>

          {/* Feature 2: Harian */}
          <div className="group rounded-2xl border border-perrific-line bg-white p-6 transition-all duration-200 hover:border-perrific-wood/40 hover:shadow-[0_4px_20px_rgba(26,26,30,0.05)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-perrific-paper text-perrific-graphite border border-perrific-line/60">
              <Calendar size={18} strokeWidth={1.6} />
            </div>
            <h3 className="mt-4 font-givonic text-base font-bold text-perrific-graphite">Time-Blocking Harian</h3>
            <p className="mt-1.5 font-givonic text-xs leading-relaxed text-perrific-graphite/65">
              Checklist dan jadwal per jam yang otomatis terisi berdasarkan tugas tim yang ditugaskan ke Anda.
            </p>
          </div>

          {/* Feature 3: Sinkron Otomatis (Highlighted) */}
          <div className="group rounded-2xl bg-perrific-violet p-6 text-white shadow-[0_8px_24px_rgba(255,80,11,0.2)] transition-all duration-200 hover:shadow-[0_12px_28px_rgba(255,80,11,0.3)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
              <RefreshCw size={18} strokeWidth={1.7} />
            </div>
            <h3 className="mt-4 font-givonic text-base font-bold">Sinkronisasi Otomatis & Real-time</h3>
            <p className="mt-1.5 font-givonic text-xs leading-relaxed text-white/85">
              Tidak butuh webhook, Zapier, atau copy-paste manual. Delegasi dari board langsung muncul di kalender.
            </p>
          </div>

          {/* Feature 4: Google Calendar & Pengingat */}
          <div className="group rounded-2xl border border-perrific-line bg-white p-6 transition-all duration-200 hover:border-perrific-wood/40 hover:shadow-[0_4px_20px_rgba(26,26,30,0.05)]">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-perrific-paper text-perrific-graphite border border-perrific-line/60">
              <Bell size={18} strokeWidth={1.6} />
            </div>
            <h3 className="mt-4 font-givonic text-base font-bold text-perrific-graphite">Google Calendar & Notifikasi</h3>
            <p className="mt-1.5 font-givonic text-xs leading-relaxed text-perrific-graphite/65">
              Sinkronisasi 2-arah dengan Google Calendar dan pengingat deadline otomatis agar tidak ada target yang terlewat.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
