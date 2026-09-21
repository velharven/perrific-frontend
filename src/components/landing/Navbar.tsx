import { Link } from 'react-router-dom';
import { useAuth } from '@/store/auth';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-perrific-line bg-perrific-paper/90 backdrop-blur supports-[backdrop-filter]:bg-perrific-paper/80">
      <div className="h-1 w-full bg-perrific-wood" />
      <div className="relative mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-3">
          <img src="/Purrific.svg" alt="Purrific" width="36" height="36" className="h-9 w-9 shrink-0" />
          <span className="font-gendy text-[17px] font-extrabold tracking-[-0.03em] text-perrific-graphite">Purrific</span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 font-givonic text-[14px] font-medium text-perrific-graphite/70 lg:flex">
          <a href="#fitur" className="rounded-full px-3 py-1.5 hover:bg-perrific-graphite hover:text-white transition-colors">
            Fitur
          </a>
          <a href="#cara-kerja" className="rounded-full px-3 py-1.5 hover:bg-perrific-graphite hover:text-white transition-colors">
            Cara kerja
          </a>
          <a href="#persona" className="rounded-full px-3 py-1.5 hover:bg-perrific-graphite hover:text-white transition-colors">
            Untuk siapa
          </a>
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <Link
              to="/dashboard"
              className="inline-flex items-center gap-2 rounded-full bg-perrific-graphite px-5 py-2.5 font-givonic text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,26,30,0.18)] hover:bg-black transition-colors"
            >
              Buka Dashboard
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="opacity-80">
                <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-full border border-perrific-line bg-white px-5 py-2.5 font-givonic text-sm font-medium text-perrific-graphite hover:bg-perrific-paper sm:inline-flex"
              >
                Masuk
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-perrific-violet px-5 py-2.5 font-givonic text-sm font-semibold text-white hover:bg-[#E64D0A] transition-colors"
              >
                Coba Gratis
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M4 8h8M8 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
