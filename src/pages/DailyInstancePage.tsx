import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { noteApi } from '@/api/notes';
import type { Note } from '@/types';
import DailyPage from './DailyPage';

// Kamar aktivitas berkunci: URL /daily/:id, isi sama persis
// seperti /daily. Judul tab dari note, rename via sidebar.
export default function DailyInstancePage() {
  const { dailyId } = useParams<{ dailyId: string }>();
  const navigate = useNavigate();
  const [note, setNote] = useState<Note | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!dailyId) return;
    let cancelled = false;
    noteApi
      .get(dailyId)
      .then((n) => {
        if (cancelled) return;
        const kind = n.kind ?? 'NOTE';
        if (kind === 'TABLE') navigate(`/tables/${n.id}`, { replace: true });
        else if (kind === 'NOTE') navigate(`/notes/${n.id}`, { replace: true });
        else setNote(n);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dailyId, navigate]);

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="font-givonic text-sm text-perrific-graphite/60">Aktivitas tidak ditemukan atau sudah dihapus.</p>
      </div>
    );
  }
  if (!note) return <p className="text-gray-500">Memuat…</p>;

  return (
    <div className="space-y-3">
      <p className="mx-auto max-w-4xl font-mono text-[11px] tracking-widest text-perrific-wood" title={note.title}>
        HARIAN · {note.title || 'Tanpa judul'}
      </p>
      <DailyPage />
    </div>
  );
}
