import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useNextPath } from '@/lib/next';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { isGoogleConfigured } from '@/lib/google';
import { Check, Eye, EyeOff, ChevronRight } from 'lucide-react';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const next = useNextPath();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={next} replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(identifier.trim(), password);
      navigate(next);
    } catch {
      setError('Email/username atau password salah. Periksa kembali.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-perrific-paper">
      {/* Kiri — kotak oren */}
      <div className="hidden w-[44%] flex-col justify-between bg-perrific-violet p-8 text-white lg:flex lg:p-10">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white">
            <img src="/Purrific.svg" alt="Purrific" width="22" height="22" className="h-[22px] w-[22px]" />
          </span>
          <span className="font-space-grotesk text-[18px] font-extrabold tracking-[-0.02em]">Purrific</span>
        </Link>

        <div>
          <h2 className="max-w-[14ch] font-manrope text-[32px] font-extrabold leading-[0.95] tracking-[-0.02em]">
            Board tim yang langsung jadi harimu.
          </h2>
          <ul className="mt-6 space-y-3">
            {['Kanban ringan untuk tim 3–6 orang', 'Otomatis jadi time-block di Harian', 'Tanpa setup 2 jam — langsung pakai'].map((t) => (
              <li key={t} className="flex gap-2.5 font-manrope text-sm leading-snug text-white/85">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-perrific-violet">
                  <Check size={10} strokeWidth={2.5} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <p className="font-mono text-xs text-white/60">Purrific · 2026</p>
      </div>

      {/* Kanan — form */}
      <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="w-full max-w-[400px]">
          <Link to="/" className="mb-6 flex items-center justify-center gap-2 lg:hidden">
            <img src="/Purrific.svg" alt="Purrific" width="28" height="28" className="h-7 w-7" />
            <span className="font-space-grotesk text-[17px] font-extrabold tracking-[-0.03em] text-perrific-graphite">Purrific</span>
          </Link>

          <div className="rounded-[16px] border border-perrific-line bg-white p-6 shadow-[0_4px_20px_rgba(26,26,30,0.08),0_1px_2px_rgba(26,26,30,0.06)] sm:p-7">
            <div className="mb-6">
              <h1 className="font-manrope text-[22px] font-extrabold tracking-[-0.02em] text-perrific-graphite">Masuk</h1>
              <p className="mt-1 font-manrope text-sm leading-relaxed text-perrific-graphite/60">Lanjutkan ke board & Harian-mu.</p>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="font-manrope text-sm leading-snug text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="identifier" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
                  Email / Username
                </label>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  placeholder="kamu@example.com / namapengguna"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 pr-10 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Sembunyikan password' : 'Tampilkan password'}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-perrific-graphite/50 hover:text-perrific-graphite"
                  >
                    {showPw ? (
                      <Eye size={16} strokeWidth={1.6} aria-hidden="true" />
                    ) : (
                      <EyeOff size={16} strokeWidth={1.6} aria-hidden="true" />
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-perrific-violet px-6 py-3 font-manrope text-sm font-semibold text-white hover:bg-[#E64D0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perrific-violet focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Memuat…' : 'Masuk'}
                {!submitting && (
                  <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
                )}
              </button>
            </form>

            {isGoogleConfigured() && (
              <>
                <div className="my-5 flex items-center gap-3" aria-hidden="true">
                  <span className="h-px flex-1 bg-perrific-line" />
                  <span className="font-mono text-[11px] text-perrific-graphite/40">atau</span>
                  <span className="h-px flex-1 bg-perrific-line" />
                </div>
                <GoogleAuthButton label="Masuk dengan Google" onError={setError} />
              </>
            )}

            <p className="mt-5 text-center font-manrope text-sm text-perrific-graphite/60">
              Belum punya akun?{' '}
              <Link to="/register" className="font-semibold text-perrific-violet hover:underline">
                Daftar
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center">
            <Link to="/" className="font-mono text-[11px] text-perrific-graphite/40 hover:text-perrific-graphite">
              ← Kembali ke beranda
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
