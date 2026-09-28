import { Link } from 'react-router-dom';

export default function CTASection() {
  return (
    <section className="bg-white py-16 sm:py-20 lg:py-24">
      <div className="mx-auto max-w-[1040px] px-4 sm:px-6 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl border border-perrific-line/90 bg-gradient-to-b from-perrific-paper via-white to-perrific-paper p-8 text-center sm:p-12 lg:p-16 shadow-[0_12px_40px_rgba(255,80,11,0.06)]">
          {/* Subtle Warm Background Glow */}
          <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 h-60 w-96 rounded-full bg-perrific-violet/10 blur-3xl" />

          <span className="font-mono text-xs font-bold tracking-wider text-perrific-wood uppercase">
            Mulai Sekarang
          </span>

          <h2 className="mx-auto mt-2 max-w-[18ch] font-givonic text-[28px] font-extrabold leading-[1.05] tracking-[-0.03em] text-perrific-graphite sm:text-[38px]">
            Siap Menghubungkan Tim & Harimu?
          </h2>
          <p className="mx-auto mt-3.5 max-w-[46ch] font-givonic text-sm leading-relaxed text-perrific-graphite/70 sm:text-base">
            Mulai dari satu board tim gratis tanpa kartu kredit. Buat pekerjaan tim lebih terkoordinasi dan jadwal harianmu selalu rapi.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              to="/register"
              className="group inline-flex items-center gap-2 rounded-full bg-perrific-violet px-8 py-3.5 font-givonic text-sm font-semibold text-white shadow-[0_4px_16px_rgba(255,80,11,0.25)] hover:bg-[#E64D0A] hover:shadow-[0_6px_20px_rgba(255,80,11,0.35)] active:scale-[0.98] transition-all"
            >
              Coba Gratis Sekarang
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="none"
                className="transition-transform group-hover:translate-x-0.5"
              >
                <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-full border border-perrific-line bg-white px-7 py-3.5 font-givonic text-sm font-medium text-perrific-graphite shadow-xs hover:bg-perrific-paper hover:border-perrific-wood/40 active:scale-[0.98] transition-all"
            >
              Sudah Punya Akun? Masuk
            </Link>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-perrific-graphite/60">
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-emerald-500">
                <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Tanpa kartu kredit
            </span>
            <span className="text-perrific-graphite/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-emerald-500">
                <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Siap dalam 2 menit
            </span>
            <span className="text-perrific-graphite/30">·</span>
            <span className="inline-flex items-center gap-1.5">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" className="text-emerald-500">
                <path d="M13.3 4.3L6 11.6 2.7 8.3" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Batal kapan saja
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
