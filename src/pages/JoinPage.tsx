import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { teamApi } from '@/api/teams';
import { PurrificBrandLoader } from '@/components/ui/loading';

function apiMessage(e: unknown, fallback: string): string {
  if (typeof e === 'object' && e !== null && 'response' in e) {
    const r = (e as { response?: { data?: { message?: unknown } } }).response;
    if (typeof r?.data?.message === 'string' && r.data.message) return r.data.message;
  }
  return fallback;
}

// Dibuka dari link invite /join/:code (butuh login; ProtectedRoute + ?next=
// mengantar balik ke sini otomatis). Mengirim permintaan bergabung;
// admin menyetujui dari tab Persetujuan.
export default function JoinPage() {
  const { code } = useParams<{ code: string }>();
  const [error, setError] = useState<string | null>(null);
  const [pendingTeam, setPendingTeam] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setError('Kode invite tidak valid.');
      return;
    }
    teamApi
      .joinTeam(code)
      .then((req) => setPendingTeam(req.team?.name ?? 'tim'))
      .catch((e: unknown) => {
        setError(apiMessage(e, 'Gagal bergabung ke tim. Coba lagi.'));
      });
  }, [code]);

  if (pendingTeam) {
    return (
      <div className="mx-auto flex min-h-[50vh] w-full max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="font-givonic text-base font-bold text-perrific-graphite">Permintaan terkirim</p>
        <p className="font-givonic text-sm text-gray-500">
          Menunggu persetujuan admin untuk bergabung ke {pendingTeam}.
        </p>
        <Link
          to="/notes"
          className="rounded-full bg-perrific-graphite px-5 py-2 font-givonic text-xs font-semibold text-white transition hover:brightness-110"
        >
          Ke catatan
        </Link>
      </div>
    );
  }

  if (!error) {
    return <PurrificBrandLoader message="Bergabung ke tim..." />;
  }

  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-sm flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="font-givonic text-base font-bold text-perrific-graphite">Tidak bisa bergabung</p>
      <p className="font-givonic text-sm text-gray-500">{error}</p>
      <Link
        to="/notes"
        className="rounded-full bg-perrific-graphite px-5 py-2 font-givonic text-xs font-semibold text-white transition hover:brightness-110"
      >
        Ke catatan
      </Link>
    </div>
  );
}
