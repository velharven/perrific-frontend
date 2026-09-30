import { useCallback, useEffect, useState, type ReactNode } from 'react';
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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { projectApi } from '@/api/projects';
import { SettingsBlock } from '@/components/ui/SettingsShell';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ModalShell from '@/components/ui/ModalShell';
import { showToast } from '@/components/ui/Toast';
import type { BoardColumn } from '@/types';

// Editor kolom kanban ala Taiga: tambah, rename, susun ulang, hapus.
// Hapus kolom berisi task membuka popup pilihan kolom tujuan.
function SortableColumnItem({ id, children }: { id: string; children: ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : undefined,
        zIndex: isDragging ? 10 : undefined,
        position: isDragging ? 'relative' : undefined,
      }}
      className="flex items-center gap-2 bg-white px-3 py-2"
    >
      <span
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        role="button"
        tabIndex={0}
        title="Seret untuk menyusun ulang kolom"
        aria-label="Seret untuk menyusun ulang kolom"
        className="flex shrink-0 cursor-grab touch-none items-center px-1 py-2 text-gray-300 transition hover:text-gray-500 active:cursor-grabbing"
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
          <circle cx="3" cy="2.5" r="1.3" fill="currentColor" />
          <circle cx="7" cy="2.5" r="1.3" fill="currentColor" />
          <circle cx="3" cy="7" r="1.3" fill="currentColor" />
          <circle cx="7" cy="7" r="1.3" fill="currentColor" />
          <circle cx="3" cy="11.5" r="1.3" fill="currentColor" />
          <circle cx="7" cy="11.5" r="1.3" fill="currentColor" />
        </svg>
      </span>
      {children}
    </li>
  );
}

export default function BoardColumnEditor({
  projectId,
  onColumnsChange,
  onTasksMoved,
}: {
  projectId: string;
  onColumnsChange?: (columns: BoardColumn[]) => void;
  onTasksMoved?: () => void;
}) {
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState<BoardColumn | null>(null);
  const [moveTarget, setMoveTarget] = useState<BoardColumn | null>(null);
  const [targetId, setTargetId] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [cols, tasks] = await Promise.all([
        projectApi.listColumns(projectId),
        projectApi.listTasks(projectId),
      ]);
      setColumns(cols);
      onColumnsChange?.(cols);
      const by: Record<string, number> = {};
      for (const t of tasks) by[t.columnId] = (by[t.columnId] ?? 0) + 1;
      setCounts(by);
    } catch {
      showToast('Gagal memuat kolom board.');
    } finally {
      setLoading(false);
    }
  }, [projectId, onColumnsChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function persistOrder(next: BoardColumn[]) {
    setColumns(next);
    onColumnsChange?.(next);
    try {
      await projectApi.reorderColumns(projectId, next.map((c) => c.id));
    } catch {
      showToast('Gagal menyimpan urutan kolom.');
      void reload();
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = columns.findIndex((c) => c.id === String(active.id));
    const to = columns.findIndex((c) => c.id === String(over.id));
    if (from < 0 || to < 0) return;
    void persistOrder(arrayMove(columns, from, to));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await projectApi.createColumn(projectId, { name });
      const next = [...columns, created];
      setColumns(next);
      onColumnsChange?.(next);
      setNewName('');
    } catch {
      showToast('Gagal menambah kolom.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(col: BoardColumn) {
    const name = editDraft.trim();
    if (!name || name === col.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      const updated = await projectApi.updateColumn(projectId, col.id, { name });
      const next = columns.map((c) => (c.id === col.id ? updated : c));
      setColumns(next);
      onColumnsChange?.(next);
      setEditingId(null);
    } catch {
      showToast('Gagal mengubah nama kolom.');
    } finally {
      setBusy(false);
    }
  }

  async function handleColor(col: BoardColumn, color: string) {
    if (color.toLowerCase() === col.color.toLowerCase()) return;
    const prev = columns;
    const optimistic = columns.map((c) => (c.id === col.id ? { ...c, color } : c));
    setColumns(optimistic);
    onColumnsChange?.(optimistic);
    try {
      const updated = await projectApi.updateColumn(projectId, col.id, { color });
      const next = columns.map((c) => (c.id === col.id ? updated : c));
      setColumns(next);
      onColumnsChange?.(next);
    } catch {
      setColumns(prev);
      onColumnsChange?.(prev);
      showToast('Gagal menyimpan warna kolom.');
    }
  }

  function askDelete(col: BoardColumn) {
    if ((counts[col.id] ?? 0) > 0) {
      const others = columns.filter((c) => c.id !== col.id);
      setTargetId(others[0]?.id ?? '');
      setMoveTarget(col);
    } else {
      setConfirmEmpty(col);
    }
  }

  async function confirmDeleteEmpty() {
    if (!confirmEmpty) return;
    setBusy(true);
    try {
      await projectApi.deleteColumn(projectId, confirmEmpty.id);
      const next = columns.filter((c) => c.id !== confirmEmpty.id);
      setColumns(next);
      onColumnsChange?.(next);
      setConfirmEmpty(null);
    } catch {
      showToast('Gagal menghapus kolom.');
    } finally {
      setBusy(false);
    }
  }

  async function confirmDeleteMove() {
    if (!moveTarget || !targetId) return;
    setBusy(true);
    try {
      const res = await projectApi.deleteColumn(projectId, moveTarget.id, targetId);
      const next = columns.filter((c) => c.id !== moveTarget.id);
      setColumns(next);
      onColumnsChange?.(next);
      setCounts((prev) => ({ ...prev, [targetId]: (prev[targetId] ?? 0) + res.movedCount }));
      onTasksMoved?.();
      setMoveTarget(null);
      showToast(`${res.movedCount} task dipindahkan.`);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Gagal menghapus kolom.';
      showToast(msg);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p className="font-givonic text-sm text-gray-500">Memuat kolom…</p>;

  return (
    <div className="space-y-5">
      <SettingsBlock title="Kolom board" desc="Tambah, ubah nama, seret untuk menyusun ulang, hapus">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={columns.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            <ul className="divide-y divide-gray-100 overflow-hidden rounded-[10px] border border-perrific-line">
              {columns.map((c) => (
                <SortableColumnItem key={c.id} id={c.id}>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <label
                    title={`Warna ${c.name}`}
                    className="h-4 w-4 shrink-0 cursor-pointer overflow-hidden rounded-[4px]"
                    style={{ backgroundColor: c.color }}
                  >
                    <span className="sr-only">Warna {c.name}</span>
                    <input
                      type="color"
                      value={/^#[0-9a-fA-F]{6}$/.test(c.color) ? c.color : '#8A8F98'}
                      onChange={(e) => void handleColor(c, e.target.value)}
                      aria-label={`Warna ${c.name}`}
                      className="sr-only"
                    />
                  </label>
                {editingId === c.id ? (
                  <input
                    autoFocus
                    value={editDraft}
                    onChange={(e) => setEditDraft(e.target.value)}
                    onBlur={() => void handleRename(c)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void handleRename(c);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    maxLength={30}
                    aria-label="Nama kolom"
                    className="w-full rounded-md border border-perrific-violet/40 px-2 py-1 font-givonic text-sm focus:outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(c.id);
                      setEditDraft(c.name);
                    }}
                    title="Ubah nama"
                    className="block w-full truncate text-left font-givonic text-sm font-semibold text-perrific-graphite hover:underline"
                  >
                    {c.name}
                  </button>
                )}
                </div>
                <p className="font-givonic text-xs text-gray-400">{counts[c.id] ?? 0} task</p>
              </div>
              <button
                type="button"
                disabled={columns.length <= 1}
                onClick={() => askDelete(c)}
                aria-label={`Hapus kolom ${c.name}`}
                title={columns.length <= 1 ? 'Minimal 1 kolom' : `Hapus kolom ${c.name}`}
                className="shrink-0 rounded-lg px-2 py-1 font-givonic text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-30"
              >
                Hapus
              </button>
                </SortableColumnItem>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
        <form onSubmit={handleCreate} className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama kolom baru"
            maxLength={30}
            className="min-w-0 flex-1 rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="shrink-0 rounded-full bg-perrific-violet px-5 py-2.5 font-givonic text-sm font-semibold text-white transition hover:bg-[#E64D0A] disabled:opacity-50"
          >
            {creating ? 'Menambah…' : 'Tambah'}
          </button>
        </form>
      </SettingsBlock>
      <ConfirmModal
        open={confirmEmpty !== null}
        title="Hapus kolom?"
        message={`"${confirmEmpty?.name}" kosong dan akan dihapus permanen.`}
        confirmLabel="Hapus"
        busy={busy}
        onCancel={() => !busy && setConfirmEmpty(null)}
        onConfirm={() => void confirmDeleteEmpty()}
      />
      {moveTarget && (
        <ModalShell label="Pindahkan isi kolom" onClose={() => !busy && setMoveTarget(null)}>
          <div className="p-6">
            <h2 className="font-givonic text-base font-extrabold text-perrific-graphite">Kolom berisi task</h2>
            <p className="mt-1 font-givonic text-sm leading-relaxed text-perrific-graphite/60">
              “{moveTarget.name}” berisi {counts[moveTarget.id] ?? 0} task. Pilih kolom tujuan sebelum menghapus.
            </p>
            <label htmlFor="move-target" className="mt-4 block font-givonic text-xs font-semibold text-perrific-graphite">
              Pindahkan ke
            </label>
            <select
              id="move-target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="mt-1.5 w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm focus:border-perrific-violet focus:outline-none"
            >
              {columns
                .filter((c) => c.id !== moveTarget.id)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({counts[c.id] ?? 0} task)
                  </option>
                ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveTarget(null)}
                disabled={busy}
                className="rounded-full px-4 py-2 font-givonic text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteMove()}
                disabled={busy || !targetId}
                className="rounded-full bg-red-600 px-4 py-2 font-givonic text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Memindahkan…' : 'Pindahkan & hapus'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
