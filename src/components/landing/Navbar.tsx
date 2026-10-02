import { Link } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { ChevronRight, ArrowRight } from 'lucide-react';

export default function Navbar() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-perrific-line bg-perrific-paper/90 backdrop-blur supports-[backdrop-filter]:bg-perrific-paper/80">
      <div className="h-1 w-full bg-perrific-wood" />
      <div className="relative mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link to="/" className="group flex items-center gap-3">
          <img src="/Purrific.svg" alt="Purrific" width="36" height="36" className="h-9 w-9 shrink-0" />
          <span className="font-space-grotesk text-[17px] font-extrabold tracking-[-0.03em] text-perrific-graphite">Purrific</span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-1 font-manrope text-[14px] font-medium text-perrific-graphite/70 lg:flex">
          <a href="#fitur" className="rounded-full px-3 py-1.5 hover:bg-perrific-graphite hover:text-white transition-colors">
            Fitur
          </a>
          <a href="#perbandingan" className="rounded-full px-3 py-1.5 hover:bg-perrific-graphite hover:text-white transition-colors">
            Perbandingan
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
              to="/notes"
              className="inline-flex items-center gap-2 rounded-full bg-perrific-graphite px-5 py-2.5 font-manrope text-sm font-semibold text-white shadow-[0_2px_10px_rgba(26,26,30,0.18)] hover:bg-black transition-colors"
            >
              Buka Ruang Kerja
              <ChevronRight size={14} strokeWidth={1.8} className="opacity-80" />
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="hidden rounded-full border border-perrific-line bg-white px-5 py-2.5 font-manrope text-sm font-medium text-perrific-graphite hover:bg-perrific-paper sm:inline-flex"
              >
                Masuk
              </Link>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 rounded-full bg-perrific-violet px-5 py-2.5 font-manrope text-sm font-semibold text-white hover:bg-[#E64D0A] transition-colors"
              >
                Coba Gratis
                <ArrowRight size={14} strokeWidth={1.8} />
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
