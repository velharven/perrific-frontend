import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '@/store/auth';
import { useNextPath } from '@/lib/next';

function GoogleGLogo() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

export default function GoogleAuthButton({
  label,
  onError,
}: {
  label: string;
  onError: (message: string) => void;
}) {
  const { loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const next = useNextPath();
  const [busy, setBusy] = useState(false);

  const startGoogle = useGoogleLogin({
    flow: 'implicit',
    onSuccess: async (tokenResponse) => {
      try {
        const accessToken = (tokenResponse as { access_token?: string }).access_token;
        if (!accessToken) throw new Error('no-token');
        await loginWithGoogle(accessToken);
        navigate(next);
      } catch (err) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Login Google gagal, coba lagi.';
        onError(message);
      } finally {
        setBusy(false);
      }
    },
    onError: () => {
      setBusy(false);
      onError('Login Google dibatalkan atau gagal.');
    },
  });

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        startGoogle();
      }}
      className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-perrific-line bg-white px-6 py-3 font-manrope text-sm font-semibold text-perrific-graphite shadow-sm hover:bg-perrific-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-perrific-violet focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed transition"
    >
      <GoogleGLogo />
      {busy ? 'Menghubungkan…' : label}
    </button>
  );
}
