import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { getToken } from '@/lib/api';

import { PurrificBrandLoader } from '@/components/ui/loading';

const MAX_AUTO_RETRY = 6;
const RETRY_INTERVAL_MS = 15000;

export default function ProtectedRoute() {
  const { user, loading, bootFailed, retry } = useAuth();
  const location = useLocation();
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!getToken() || !bootFailed || user || tries >= MAX_AUTO_RETRY) return;
    const t = window.setTimeout(() => {
      setTries((n) => n + 1);
      void retry();
    }, RETRY_INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [bootFailed, retry, user, tries]);

  if (loading) {
    return <PurrificBrandLoader fullscreen message="Menyiapkan sesi..." />;
  }

  if (!user) {
    // Sesi tersimpan tapi server tak terjangkau: tampilkan pemulihan,
    // bukan lempar ke login (token tidak dibuang).
    if (getToken() && bootFailed) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-3 bg-perrific-paper px-4 text-center">
          <p className="font-manrope text-base font-bold text-perrific-graphite">Koneksi ke server terputus</p>
          <p className="max-w-xs font-manrope text-sm text-gray-500">
            Sesi kamu masih tersimpan. Menyambungkan ulang otomatis…
          </p>
          <button
            type="button"
            onClick={() => void retry()}
            className="rounded-full bg-perrific-graphite px-5 py-2 font-manrope text-xs font-semibold text-white transition hover:brightness-110"
          >
            Coba lagi sekarang
          </button>
        </div>
      );
    }
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  }
  return <Outlet />;
}
