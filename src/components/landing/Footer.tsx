export default function Footer() {
  return (
    <footer className="border-t border-perrific-line bg-white">
      <div className="h-1 w-full bg-perrific-wood" />
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[1.35fr_0.75fr_0.75fr_0.75fr]">
          <div>
            <div className="flex items-center gap-3">
              <img src="/Purrific.svg" alt="Purrific" width="32" height="32" className="h-8 w-8 shrink-0" />
              <span className="font-gendy text-[18px] font-extrabold tracking-[-0.03em] text-perrific-graphite">Purrific</span>
            </div>
            <p className="mt-3 max-w-[34ch] font-givonic text-sm leading-relaxed text-perrific-graphite/60">
              Board tim yang langsung jadi harimu.
              <br />
              Ringan, tanpa setup 2 jam — untuk tim 3–6 orang.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <a
                href="/register"
                className="inline-flex items-center gap-1.5 rounded-full bg-perrific-violet px-4 py-2 font-givonic text-xs font-semibold text-white hover:bg-[#E64D0A] transition"
              >
                Coba Gratis
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <path d="M5 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </a>
              <a
                href="#fitur"
                className="inline-flex items-center rounded-full border border-perrific-line bg-perrific-paper px-4 py-2 font-givonic text-xs font-medium text-perrific-graphite hover:bg-white transition"
              >
                Lihat Fitur
              </a>
            </div>
          </div>

          <div>
            <p className="font-mono text-[11px] tracking-widest text-perrific-wood">PRODUK</p>
            <ul className="mt-4 space-y-2.5 font-givonic text-sm">
              <li>
                <a href="#fitur" className="text-perrific-graphite/70 hover:text-perrific-violet transition">
                  Fitur
                </a>
              </li>
              <li>
                <a href="#cara-kerja" className="text-perrific-graphite/70 hover:text-perrific-violet transition">
                  Cara kerja
                </a>
              </li>
              <li>
                <a href="#persona" className="text-perrific-graphite/70 hover:text-perrific-violet transition">
                  Untuk siapa
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-[11px] tracking-widest text-perrific-wood">AKSES</p>
            <ul className="mt-4 space-y-2.5 font-givonic text-sm">
              <li>
                <a href="/register" className="text-perrific-graphite/70 hover:text-perrific-violet transition">
                  Daftar
                </a>
              </li>
              <li>
                <a href="/login" className="text-perrific-graphite/70 hover:text-perrific-violet transition">
                  Masuk
                </a>
              </li>
              <li>
                <a href="/dashboard" className="text-perrific-graphite/70 hover:text-perrific-violet transition">
                  Dashboard
                </a>
              </li>
            </ul>
          </div>

          <div>
            <p className="font-mono text-[11px] tracking-widest text-perrific-wood">INFO</p>
            <ul className="mt-4 space-y-2.5 font-givonic text-sm">
              <li className="text-perrific-graphite/40">PRD v1.0 — 3 Agu 2026</li>
              <li className="font-mono text-xs text-perrific-graphite/40">© 2026 Purrific</li>
            </ul>
          </div>
        </div>


      </div>
    </footer>
  );
}
