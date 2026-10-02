import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { noteApi } from '@/api/notes';
import { useTrash } from '@/hooks/useNavLabels';
import { useAuth } from '@/store/auth';
import { PurrificBrandLoader } from '@/components/ui/loading';
import type { NoteKind } from '@/types';

const pathFor = (kind: NoteKind, id: string) =>
  kind === 'DAILY' ? `/daily/${id}` : `/notes/${id}`;

// Pintu depan: /notes dan /daily polos langsung antar ke kamar
// berkunci pertama milik user. Backend otomatis buatkan 1 catatan
// "Selamat Datang" + 1 daily untuk user baru.
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
        const candidates = notes.filter((n) => (n.kind ?? 'NOTE') === kind && !trashedIds.has(n.id));
        const welcome =
          kind === 'NOTE'
            ? candidates.find((n) => n.title === 'Selamat Datang' && !n.parentId) ??
              candidates.find((n) => !n.parentId)
            : undefined;
        const first = welcome ?? candidates[0];
        if (first) {
          navigate(pathFor(kind, first.id), { replace: true });
        } else {
          noteApi
            .create({
              kind,
              ...(kind === 'NOTE' ? { title: 'Selamat Datang' } : {}),
            })
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
  return <PurrificBrandLoader fullscreen message="Membuka kamar kerja..." />;
}
