export default function PersonaSection() {
  return (
    <section id="persona" className="bg-perrific-paper py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl text-center">
          <span className="font-mono text-xs font-bold tracking-wider text-perrific-wood uppercase">
            Solusi Nyata
          </span>
          <h2 className="mt-2 font-manrope text-[28px] font-extrabold tracking-[-0.03em] text-perrific-graphite sm:text-[34px]">
            Didesain Untuk Tim Yang Ingin Gerak Cepat
          </h2>
          <p className="mt-3 font-manrope text-sm text-perrific-graphite/65 sm:text-base">
            Memberikan kenyamanan kerja bagi setiap peran dalam organisasi.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl gap-5 sm:grid-cols-3">
          {/* Persona 1: Ketua */}
          <div className="group rounded-2xl border border-perrific-line bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-perrific-wood/40 hover:shadow-md">
            <span className="inline-block rounded-md bg-perrific-paper px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-perrific-wood border border-perrific-line">
              KETUA TIM / PM
            </span>
            <h3 className="mt-4 font-manrope text-base font-bold text-perrific-graphite">
              Tidak Perlu Lagi Menagih Manual
            </h3>
            <p className="mt-2 font-manrope text-xs leading-relaxed text-perrific-graphite/65">
              Progres pekerjaan dan timeline terlihat jelas secara real-time tanpa perlu kirim pesan tanya status setiap jam.
            </p>
          </div>

          {/* Persona 2: Anggota */}
          <div className="group rounded-2xl bg-perrific-graphite p-6 text-white shadow-[0_10px_25px_rgba(26,26,30,0.18)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_30px_rgba(26,26,30,0.28)]">
            <span className="inline-block rounded-md bg-white/10 px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-white/80">
              ANGGOTA TIM
            </span>
            <h3 className="mt-4 font-manrope text-base font-bold text-white">
              Buka Laptop, Rencanakan Hari dengan Mudah
            </h3>
            <p className="mt-2 font-manrope text-xs leading-relaxed text-white/75">
              Tugas tim langsung siap dijadwalkan ke linimasa kalender harian lewat drag &amp; drop yang fleksibel dan sinkron ke Google Calendar.
            </p>
          </div>

          {/* Persona 3: Tim Kecil */}
          <div className="group rounded-2xl border border-perrific-line bg-white p-6 transition-all duration-200 hover:-translate-y-1 hover:border-perrific-wood/40 hover:shadow-md">
            <span className="inline-block rounded-md bg-perrific-paper px-2.5 py-1 font-mono text-[11px] font-bold tracking-wider text-perrific-wood border border-perrific-line">
              TIM 3–6 ORANG
            </span>
            <h3 className="mt-4 font-manrope text-base font-bold text-perrific-graphite">
              Tanpa Setup Berjam-jam
            </h3>
            <p className="mt-2 font-manrope text-xs leading-relaxed text-perrific-graphite/65">
              Sangat pas untuk tim mahasiswa, startup awal, atau tim proyek kecil yang butuh koordinasi cepat dan rapi.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
