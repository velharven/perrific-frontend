import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { noteApi } from '@/api/notes';
import { useTrash } from '@/hooks/useNavLabels';
import { useAuth } from '@/store/auth';
import type { NoteKind } from '@/types';

const pathFor = (kind: NoteKind, id: string) =>
  kind === 'DASHBOARD' ? `/dashboard/${id}` : kind === 'DAILY' ? `/daily/${id}` : `/notes/${id}`;

// Pintu depan: /dashboard dan /daily polos langsung antar ke kamar
// berkunci pertama milik user. Backend otomatis buatkan 1 dashboard +
// 1 daily untuk user baru, jadi daftar kosong praktis tidak terjadi.
// Kamar yang masuk Sampah dilewati.
export default function PrivatRedirect({ kind }: { kind: NoteKind }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items: trashItems } = useTrash(user?.id);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const trashedIds = new Set(trashItems.filter((t) => t.kind === 'note').map((t) => t.id));
    noteApi
      .listMine()
      .then((notes) => {
        if (cancelled) return;
        const first = notes.find((n) => (n.kind ?? 'NOTE') === kind && !trashedIds.has(n.id));
        if (first) {
          navigate(pathFor(kind, first.id), { replace: true });
        } else {
          noteApi
            .create({ kind })
            .then((created) => {
              if (!cancelled) navigate(pathFor(kind, created.id), { replace: true });
            })
            .catch(() => {
              if (!cancelled) setError(true);
            });
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, navigate]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="font-givonic text-sm text-perrific-graphite/60">Gagal membuka. Coba muat ulang.</p>
      </div>
    );
  }
  return <p className="text-gray-500">Memuat…</p>;
}
