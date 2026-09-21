import { Link } from 'react-router-dom';

export default function CTASection() {
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[720px] px-4 py-14 text-center sm:px-6 lg:py-20">
        <h2 className="mx-auto max-w-[14ch] font-givonic text-[26px] font-extrabold leading-[0.95] tracking-[-0.03em] text-perrific-graphite sm:text-[32px]">
            Mulai Dari Satu Board.
        </h2>
        <p className="mx-auto mt-3 max-w-[42ch] font-givonic text-sm leading-relaxed text-perrific-graphite/60">
          Gratis untuk tim kecil — tanpa kartu kredit. Harimu langsung rapi.
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/register"
            className="inline-flex items-center gap-2 rounded-full bg-perrific-violet px-7 py-3 font-givonic text-sm font-semibold text-white hover:bg-[#E64D0A] transition"
          >
            Coba Gratis
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-full border border-perrific-line bg-perrific-paper px-6 py-3 font-givonic text-sm font-medium text-perrific-graphite hover:bg-white transition"
          >
            Sudah Punya Akun?
          </Link>
        </div>

        <p className="mt-4 font-mono text-xs text-perrific-graphite/45">Tanpa kartu kredit · Batal kapan saja</p>
      </div>
    </section>
  );
}
