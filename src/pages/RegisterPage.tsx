import { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { isGoogleConfigured } from '@/lib/google';
import { useUsernameAvailability } from '@/hooks/useUsernameAvailability';
import { Check, Eye, EyeOff, ChevronRight } from 'lucide-react';

interface PasswordStrength {
  score: number;
  length: boolean;
  cases: boolean;
  digit: boolean;
  symbol: boolean;
}

function getPasswordStrength(pw: string): PasswordStrength {
  const length = pw.length >= 8;
  const cases = /[a-z]/.test(pw) && /[A-Z]/.test(pw);
  const digit = /\d/.test(pw);
  const symbol = /[^A-Za-z0-9]/.test(pw);
  let score = [length, cases, digit, symbol].filter(Boolean).length;
  if (pw.length === 0) score = 0;
  else if (!length) score = Math.min(score, 1);
  return { score, length, cases, digit, symbol };
}

function strengthLevel(score: number) {
  if (score >= 4) return { label: 'Sangat Kuat', bar: 'bg-green-600', text: 'text-green-700' };
  if (score === 3) return { label: 'Kuat', bar: 'bg-perrific-violet', text: 'text-perrific-red' };
  if (score === 2) return { label: 'Cukup', bar: 'bg-amber-400', text: 'text-amber-700' };
  return { label: 'Lemah', bar: 'bg-red-500', text: 'text-red-600' };
}

export default function RegisterPage() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const strength = getPasswordStrength(password);
  const level = strengthLevel(strength.score);
  const passwordTooWeak = password.length > 0 && strength.score < 2;
  const { norm: usernameNorm, formatOk: usernameFormatOk, checking: usernameChecking, available: usernameAvailable } =
    useUsernameAvailability(username);
  const usernameInvalid = usernameNorm !== '' && !usernameFormatOk;
  const usernameTaken = usernameAvailable === false;
  const usernameReady =
    usernameNorm !== '' && usernameFormatOk && !usernameTaken && !usernameChecking;

  if (user) return <Navigate to="/notes" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!usernameReady || !name.trim() || !email.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      await register({ name: name.trim(), email: email.trim(), username: usernameNorm, password });
      navigate('/notes');
    } catch (err) {
      const message =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        'Registrasi gagal. Periksa kembali data — pastikan email valid dan password minimal 8 karakter.';
      setError(message);
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
          <span className="font-gendy text-[18px] font-extrabold tracking-[-0.02em]">Purrific</span>
        </Link>

        <div>
          <h2 className="max-w-[14ch] font-givonic text-[32px] font-extrabold leading-[0.95] tracking-[-0.02em]">
            Board tim yang langsung jadi harimu.
          </h2>
          <ul className="mt-6 space-y-3">
            {['Kanban ringan untuk tim 3–6 orang', 'Otomatis jadi time-block di Harian', 'Tanpa setup 2 jam — langsung pakai'].map((t) => (
              <li key={t} className="flex gap-2.5 font-givonic text-sm leading-snug text-white/85">
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
            <span className="font-gendy text-[17px] font-extrabold tracking-[-0.03em] text-perrific-graphite">Purrific</span>
          </Link>

          <div className="rounded-[16px] border border-perrific-line bg-white p-6 shadow-[0_4px_20px_rgba(26,26,30,0.08),0_1px_2px_rgba(26,26,30,0.06)] sm:p-7">
            <div className="mb-6">
              <h1 className="font-givonic text-[22px] font-extrabold tracking-[-0.02em] text-perrific-graphite">Daftar</h1>
              <p className="mt-1 font-givonic text-sm leading-relaxed text-perrific-graphite/60">Buat akun — gratis untuk tim kecil, tanpa kartu kredit.</p>
            </div>

            {error && (
              <div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                <p className="font-givonic text-sm leading-snug text-red-700">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
                  Nama
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  placeholder="Nama lengkap"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  placeholder="kamu@kampus.ac.id"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
                />
              </div>

              <div>
                <label htmlFor="username" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
                  Username
                </label>
                <div className="flex items-center rounded-[10px] border border-perrific-line bg-white px-3 focus-within:border-perrific-violet focus-within:ring-2 focus-within:ring-perrific-violet/20">
                  <span className="select-none font-givonic text-sm text-perrific-graphite/40">@</span>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    maxLength={30}
                    placeholder="namapengguna"
                    autoComplete="username"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    aria-describedby="username-status"
                    className="w-full bg-transparent px-1.5 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:outline-none"
                  />
                </div>
                <div id="username-status" aria-live="polite" className="mt-1.5 min-h-[1rem]">
                  {usernameInvalid ? (
                    <p className="font-givonic text-xs text-red-600">
                      3–30 karakter: huruf kecil, angka, titik, underscore.
                    </p>
                  ) : usernameChecking ? (
                    <p className="font-givonic text-xs text-perrific-graphite/50">Memeriksa ketersediaan…</p>
                  ) : usernameTaken ? (
                    <p className="font-givonic text-xs font-medium text-red-600">Username sudah dipakai.</p>
                  ) : usernameAvailable === true ? (
                    <p className="font-givonic text-xs font-medium text-green-700">Username tersedia.</p>
                  ) : null}
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="password" className="block font-givonic text-xs font-medium text-perrific-graphite">
                    Password
                  </label>
                  {password.length > 0 && (
                    <span aria-live="polite" className={`font-givonic text-xs font-semibold ${level.text}`}>
                      {level.label}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPw ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    placeholder="Minimal 8 karakter"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-describedby="password-strength"
                    className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 pr-10 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
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
                <div id="password-strength" className="mt-2.5">
                    <div className="flex gap-1" role="img" aria-label={`Kekuatan password: ${level.label}`}>
                      {[0, 1, 2, 3].map((i) => (
                        <span
                          key={i}
                          className={`h-1.5 flex-1 rounded-full ${i < strength.score ? level.bar : 'bg-perrific-graphite/10'}`}
                        />
                      ))}
                    </div>
                    <ul className="mt-2.5 space-y-1.5">
                      {[
                        { ok: strength.length, text: 'Minimal 8 karakter' },
                        { ok: strength.cases, text: 'Huruf besar & kecil' },
                        { ok: strength.digit, text: 'Mengandung angka' },
                        { ok: strength.symbol, text: 'Mengandung simbol (!@#…)' },
                      ].map((rule) => (
                        <li key={rule.text} className="flex items-center gap-1.5 font-givonic text-xs">
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${
                              rule.ok ? 'bg-green-600 text-white' : 'bg-perrific-graphite/10 text-perrific-graphite/40'
                            }`}
                          >
                            {rule.ok && (
                              <Check size={9} strokeWidth={2.5} aria-hidden="true" />
                            )}
                          </span>
                          <span className={rule.ok ? 'text-perrific-graphite' : 'text-perrific-graphite/50'}>{rule.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
              </div>

              <button
                type="submit"
                disabled={submitting || passwordTooWeak || !usernameReady || !name.trim() || !email.trim()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-perrific-violet px-6 py-3 font-givonic text-sm font-semibold text-white hover:bg-[#E64D0A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perrific-violet focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting ? 'Memuat…' : 'Daftar'}
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
                <GoogleAuthButton label="Daftar dengan Google" onError={setError} />
              </>
            )}

            <p className="mt-5 text-center font-givonic text-sm text-perrific-graphite/60">
              Sudah punya akun?{' '}
              <Link to="/login" className="font-semibold text-perrific-violet hover:underline">
                Masuk
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
