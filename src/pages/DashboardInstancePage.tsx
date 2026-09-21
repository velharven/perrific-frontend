import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { noteApi } from '@/api/notes';
import type { Note } from '@/types';
import AddBlockModal from '@/components/dashboard/AddBlockModal';
import DashboardBlockView from '@/components/dashboard/DashboardBlockView';
import DashboardSkeleton from '@/components/dashboard/DashboardSkeleton';
import SortableBlock from '@/components/dashboard/SortableBlock';
import {
  BLOCK_LABELS,
  defaultLayout,
  layoutFromTypes,
  newBlockId,
  parseLayout,
  serializeLayout,
  type DashboardBlockDef,
  type DashboardBlockType,
} from '@/components/dashboard/layout';
import { useDashboardData } from '@/components/dashboard/useDashboardData';

// Kamar dashboard berkunci: URL /dashboard/:id, isi blok-blok yang bisa
// disusun ulang seperti Notion. Denah tersimpan di Note.content (JSON).
// Judul tab dari note, rename via sidebar.
export default function DashboardInstancePage() {
  const { dashboardId } = useParams<{ dashboardId: string }>();
  const navigate = useNavigate();
  const data = useDashboardData();
  const [note, setNote] = useState<Note | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [blocks, setBlocks] = useState<DashboardBlockDef[]>(() => defaultLayout());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Simpan otomatis hanya setelah user mengubah denah (bukan saat buka),
  // agar teks lama yang bukan JSON tidak tertimpa sebelum waktunya.
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!dashboardId) return;
    let cancelled = false;
    setPickerOpen(false);
    noteApi
      .get(dashboardId)
      .then((n) => {
        if (cancelled) return;
        const kind = n.kind ?? 'NOTE';
        if (kind === 'DAILY') navigate(`/daily/${n.id}`, { replace: true });
        else if (kind === 'TABLE') navigate(`/tables/${n.id}`, { replace: true });
        else if (kind === 'NOTE') navigate(`/notes/${n.id}`, { replace: true });
        else {
          dirtyRef.current = false;
          setBlocks(parseLayout(n.content));
          setNote(n);
        }
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [dashboardId, navigate]);

  useEffect(() => {
    if (!dirtyRef.current || !note || note.id !== dashboardId) return;
    setSaving(true);
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(() => {
      noteApi
        .update(note.id, { content: serializeLayout(blocks) })
        .then((updated) => {
          dirtyRef.current = false;
          setNote(updated);
          setSaved(true);
        })
        .catch(() => {
          // diam — coba lagi saat perubahan berikutnya
        })
        .finally(() => setSaving(false));
    }, 800);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [blocks, note, dashboardId]);

  function updateBlocks(next: DashboardBlockDef[] | ((prev: DashboardBlockDef[]) => DashboardBlockDef[])) {
    dirtyRef.current = true;
    setBlocks(next);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    updateBlocks((prev) => {
      const from = prev.findIndex((b) => b.id === String(active.id));
      const to = prev.findIndex((b) => b.id === String(over.id));
      if (from < 0 || to < 0) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function addBlock(type: DashboardBlockType) {
    updateBlocks((prev) => [...prev, { id: newBlockId(), type }]);
  }

  function applyPreset(types: DashboardBlockType[]) {
    updateBlocks(layoutFromTypes(types));
  }

  if (notFound) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="font-givonic text-sm text-perrific-graphite/60">Dashboard tidak ditemukan atau sudah dihapus.</p>
      </div>
    );
  }
  if (!note || data.loading) return <DashboardSkeleton />;

  const visible = blocks.filter((b) => !b.hidden);
  const hidden = blocks.filter((b) => b.hidden);

  const list = (
    <div className="space-y-5">
      {visible.map((b) => (
        <SortableBlock
          key={b.id}
          block={b}
          onHide={() => updateBlocks((prev) => prev.map((x) => (x.id === b.id ? { ...x, hidden: true } : x)))}
          onRemove={() => updateBlocks((prev) => prev.filter((x) => x.id !== b.id))}
        >
          <DashboardBlockView type={b.type} data={data} />
        </SortableBlock>
      ))}
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <p
          className="min-w-0 flex-1 truncate font-mono text-[11px] tracking-widest text-perrific-wood"
          title={note.title}
        >
          DASHBOARD · {note.title || 'Tanpa judul'}
        </p>
        {(saving || saved) && (
          <span aria-live="polite" className="shrink-0 font-mono text-[11px] text-perrific-graphite/40">
            {saving ? 'Menyimpan…' : 'Tersimpan otomatis'}
          </span>
        )}
      </div>

      <div className="mx-auto max-w-3xl">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map((b) => b.id)} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      </div>

      <div className="mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          aria-haspopup="dialog"
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 bg-white px-3 py-2.5 font-givonic text-sm font-semibold text-perrific-graphite/60 transition hover:border-perrific-violet hover:text-perrific-violet"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          Tambah blok
        </button>
      </div>

      {pickerOpen && (
        <AddBlockModal
          onAdd={(t) => addBlock(t)}
          onPreset={(types) => applyPreset(types)}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {hidden.length > 0 && (
        <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 bg-gray-50 p-3">
          <p className="px-1 pb-2 font-mono text-[10px] tracking-widest text-perrific-graphite/40">
            TERSEMBUNYI · {hidden.length}
          </p>
          <div className="space-y-1.5">
            {hidden.map((b) => (
              <div key={b.id} className="flex items-center gap-2 rounded-lg bg-white px-3 py-2">
                <span className="min-w-0 flex-1 truncate font-givonic text-sm text-gray-500">
                  {BLOCK_LABELS[b.type]}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateBlocks((prev) => prev.map((x) => (x.id === b.id ? { ...x, hidden: false } : x)))
                  }
                  className="shrink-0 font-givonic text-xs font-semibold text-perrific-violet hover:underline"
                >
                  Tampilkan
                </button>
                <button
                  type="button"
                  onClick={() => updateBlocks((prev) => prev.filter((x) => x.id !== b.id))}
                  className="shrink-0 font-givonic text-xs font-semibold text-red-500 hover:underline"
                >
                  Hapus
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
