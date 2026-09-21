import { Link } from 'react-router-dom';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-perrific-paper">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.28]"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(26,26,30,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(26,26,30,0.04) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative mx-auto max-w-[880px] px-4 py-16 text-center sm:px-6 lg:py-24">
        <h1 className="mx-auto max-w-[18ch] font-givonic text-[34px] font-extrabold leading-[0.92] tracking-[-0.04em] text-perrific-graphite sm:text-[48px] lg:text-[56px]">
          Kerja Tim Tidak
          <br />
          Berantakan,
          <br />
          <span>Harimu Tetap Rapi.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-[44ch] font-givonic text-[15px] leading-relaxed text-perrific-graphite/70 sm:text-[17px]">
          Purrific menghubungkan board tim dan jadwal harianmu — tugas yang ditugaskan otomatis jadi time-block di Harian. Ringan,
          tanpa atur ulang.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-perrific-violet px-7 py-3.5 font-givonic text-sm font-semibold text-white shadow-[0_2px_8px_rgba(255,80,11,0.18),0_1px_2px_rgba(26,26,30,0.08)] hover:bg-[#E64D0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perrific-violet focus-visible:ring-offset-2 focus-visible:ring-offset-perrific-paper active:scale-[0.98] transition"
          >
            Coba Gratis
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <a
            href="#fitur"
            className="inline-flex items-center gap-2 rounded-full border border-perrific-line bg-white px-6 py-3.5 font-givonic text-sm font-medium text-perrific-graphite shadow-sm hover:bg-perrific-paper hover:border-perrific-wood/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perrific-violet focus-visible:ring-offset-2 focus-visible:ring-offset-perrific-paper active:scale-[0.98] transition"
          >
            Lihat Cara Kerja
          </a>
        </div>


      </div>
    </section>
  );
}
