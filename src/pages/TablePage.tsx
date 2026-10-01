import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { noteApi } from '@/api/notes';
import { useTableData } from '@/components/table/useTableData';
import TableGrid from '@/components/table/TableGrid';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { showToast } from '@/components/ui/Toast';
import { notifyNotesChanged } from '@/pages/NotePage';
import { notifyTeamsChanged, useTrash } from '@/hooks/useNavLabels';
import { useAuth } from '@/store/auth';
import { UndoStackProvider, useUndo } from '@/hooks/useUndoStack';
import { MoreVertical } from 'lucide-react';

function TablePageInner() {
  const { tableId } = useParams<{ tableId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trash, restore, items: trashItems } = useTrash(user?.id);
  const { push, undoEntry } = useUndo();
  const t = useTableData(tableId);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isTrashed = tableId
    ? trashItems.some((x) => x.kind === 'note' && x.id === tableId)
    : false;

  useEffect(() => {
    if (!t.loading && t.loadError) navigate('/notes', { replace: true });
  }, [t.loading, t.loadError, navigate]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  async function confirmDelete() {
    if (!tableId || deleting) return;
    setDeleting(true);
    const title = t.title || 'Tanpa judul';
    try {
      // Soft-delete: pindahkan satu cabang (tabel + halaman baris +
      // keturunannya) ke Sampah. Data server utuh sampai di-purge.
      let ids = [tableId, ...t.rows.map((r) => r.noteId).filter((v): v is string => !!v)];
      const titles = new Map<string, string>([[tableId, title]]);
      try {
        const list = await noteApi.listMine();
        const childrenOf = new Map<string, string[]>();
        for (const n of list) {
          if (n.parentId) childrenOf.set(n.parentId, [...(childrenOf.get(n.parentId) ?? []), n.id]);
          titles.set(n.id, n.title || titles.get(n.id) || 'Tanpa judul');
        }
        const seen = new Set(ids);
        const stack = [...ids];
        while (stack.length > 0) {
          const cur = stack.pop() as string;
          for (const c of childrenOf.get(cur) ?? []) {
            if (!seen.has(c)) {
              seen.add(c);
              stack.push(c);
            }
          }
        }
        ids = [...seen];
      } catch {
        // daftar tak termuat — tetap buang id langsung yang sudah dikumpulkan
      }
      const snapshot = [...ids];
      for (const id of snapshot) trash({ kind: 'note', id, title: titles.get(id) ?? 'Tanpa judul' });
      notifyNotesChanged();
      notifyTeamsChanged();
      const entryId = push(`tabel:${title}`, () => {
        for (const id of snapshot) restore('note', id);
        notifyNotesChanged();
        notifyTeamsChanged();
      });
      setConfirmOpen(false);
      showToast(`Tabel "${title}" dipindahkan ke Sampah`, {
        label: 'Urungkan',
        onAction: () => undoEntry(entryId),
      });
      navigate('/notes');
    } catch {
      showToast('Gagal menghapus tabel. Coba lagi.');
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  // Kembalikan dari banner Sampah (mis. dibuka via tautan Sampah setelah reload).
  // restore idempoten: aman walau entri undo-nya masih di stack.
  function handleRestoreFromTrash() {
    if (!tableId) return;
    restore('note', tableId);
    for (const r of t.rows) {
      if (r.noteId) restore('note', r.noteId);
    }
    notifyNotesChanged();
    notifyTeamsChanged();
  }

  if (t.loading) return <p className="text-gray-500">Memuat...</p>;

  if (isTrashed) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="font-givonic text-sm font-semibold text-perrific-graphite">
          Tabel &quot;{t.title || 'Tanpa judul'}&quot; ada di Sampah
        </p>
        <p className="mt-1 font-givonic text-xs text-perrific-graphite/60">
          Baris dan halaman tertaut ikut tersembunyi sampai dikembalikan.
        </p>
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={handleRestoreFromTrash}
            className="rounded-full bg-perrific-violet px-4 py-2 font-givonic text-xs font-semibold text-white transition hover:brightness-110"
          >
            Kembalikan (Ctrl+Z)
          </button>
          <button
            type="button"
            onClick={() => navigate('/notes')}
            className="rounded-full px-4 py-2 font-givonic text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const linkedPages = t.rows.filter((r) => r.noteId).length;

  return (
    <div className="mx-auto max-w-6xl">
      <TableGrid
        t={t}
        titleNode={
          <div className="flex min-w-0 flex-1 items-start gap-1">
            <input
              value={t.title}
              onChange={(e) => t.setTitle(e.target.value)}
              aria-label="Judul tabel"
              placeholder="Tanpa judul"
              className="min-w-0 flex-1 bg-transparent font-givonic text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-perrific-graphite placeholder:text-perrific-graphite/30 focus:outline-none sm:text-[32px]"
            />
            <div className="relative shrink-0 pt-1" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
                aria-haspopup="menu"
                aria-label="Menu tabel"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-perrific-graphite/50 transition hover:bg-gray-100 hover:text-perrific-graphite cursor-pointer"
              >
                <MoreVertical size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
              {menuOpen && (
                <div
                  role="menu"
                  aria-label="Menu tabel"
                  className="absolute right-0 top-full z-30 mt-1 min-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
                >
                  <div className="px-3 py-2">
                    <p className="font-mono text-[11px] text-perrific-graphite/40">
                      {t.rows.length} baris · {linkedPages} halaman tertaut
                    </p>
                  </div>
                  <div className="h-px bg-gray-100" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setConfirmOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 font-givonic text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    Hapus tabel
                  </button>
                </div>
              )}
            </div>
          </div>
        }
      />
      <ConfirmModal
        open={confirmOpen}
        title={`Pindahkan tabel "${t.title || 'Tanpa judul'}" ke Sampah?`}
        message={
          t.rows.length === 0
            ? 'Bisa dikembalikan lagi dari Sampah via Urungkan atau Ctrl+Z.'
            : `Berisi ${t.rows.length} baris dan ${linkedPages} halaman tertaut — semuanya ikut ke Sampah dan bisa dikembalikan via Urungkan atau Ctrl+Z.`
        }
        confirmLabel="Pindahkan"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setConfirmOpen(false);
        }}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

export default function TablePage() {
  return (
    <UndoStackProvider>
      <TablePageInner />
    </UndoStackProvider>
  );
}
