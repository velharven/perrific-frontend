import { useEffect, useRef, useState } from 'react';
import { noteApi, tableApi } from '@/api/notes';
import { arrayMove } from '@dnd-kit/sortable';
import { notifyNotesChanged } from '@/pages/NotePage';
import { useTrash } from '@/hooks/useNavLabels';
import { isUndoEditableTarget, useUndoStack } from '@/hooks/useUndoStack';
import { useAuth } from '@/store/auth';
import { showToast } from '@/components/ui/Toast';
import type { TableColumn, TableRow } from '@/types';

const newId = () => crypto.randomUUID();

// Seluruh state + autosave tabel (pindahan utuh dari TablePage).
// Dipakai halaman penuh dan embed inline. Baris = halaman: tiap baris
// menaut ke note anak (dibuat otomatis / on-demand), judul = kolom pertama.
export function useTableData(tableId: string | undefined) {
  const [title, setTitle] = useState('');
  const [columns, setColumns] = useState<TableColumn[]>([]);
  const [rows, setRows] = useState<TableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  // Seleksi baris (session-local, tak disimpan): untuk hapus massal.
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const baseline = useRef('');
  const timer = useRef<number | undefined>(undefined);
  const busyRows = useRef(new Set<string>());
  const liveRef = useRef({ title, columns, rows });
  liveRef.current = { title, columns, rows };
  const { user } = useAuth();
  const { trash, restore } = useTrash(user?.id);
  // Undo berbagi stack halaman bila ada provider (TablePage/NotePage);
  // fallback lokal + shortcut sendiri bila dipakai mandiri.
  const undoCtx = useUndoStack();
  const localStack = useRef<{ id: number; undo: () => void }[]>([]);
  const localId = useRef(1);

  useEffect(() => {
    if (undoCtx) return; // shortcut dipegang provider
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey) return;
      if (e.key !== 'z' && e.key !== 'Z') return;
      if (isUndoEditableTarget(e.target as HTMLElement | null)) return;
      const entry = localStack.current.pop();
      if (!entry) return;
      e.preventDefault();
      entry.undo();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [undoCtx]);

  // Dorong undo ke stack; kembalikan pembatal spesifik (tombol Urungkan).
  function pushUndo(label: string, undo: () => void): () => void {
    if (undoCtx) {
      const id = undoCtx.push(label, undo);
      return () => {
        undoCtx.undoEntry(id);
      };
    }
    const id = localId.current++;
    localStack.current.push({ id, undo });
    if (localStack.current.length > 30) {
      localStack.current.splice(0, localStack.current.length - 30);
    }
    return () => {
      const i = localStack.current.findIndex((e) => e.id === id);
      if (i < 0) return;
      const [entry] = localStack.current.splice(i, 1);
      entry.undo();
    };
  }

  useEffect(() => {
    if (!tableId) return;
    tableApi.get(tableId).then((data) => {
      setTitle(data.note.title); setColumns(data.columns); setRows(data.rows);
      setSelectedIds([]);
      baseline.current = JSON.stringify({ title: data.note.title, columns: data.columns, rows: data.rows });
    }).catch(() => setLoadError(true)).finally(() => setLoading(false));
  }, [tableId]);

  // Judul halaman di balik baris = nilai kolom pertama (pola ensureRowPage).
  function rowTitle(row: TableRow) {
    const firstColId = columns[0]?.id;
    return (firstColId ? String(row.values[firstColId] ?? '').trim() : '') || 'Tanpa judul';
  }

  // Tulis satu snapshot penuh ke server. Gagal diam-diam kecuali loud
  // (aksi hapus) agar tak spam toast saat mengetik.
  async function saveSnapshot(nextTitle: string, nextColumns: TableColumn[], nextRows: TableRow[], loud = false) {
    if (!tableId) return;
    setSaving(true);
    try {
      const [data, note] = await Promise.all([
        tableApi.save(tableId, { columns: nextColumns.map((c, order) => ({ ...c, order })), rows: nextRows.map((r, order) => ({ ...r, order })) }),
        noteApi.update(tableId, { title: nextTitle.trim() || 'Tabel tanpa judul' }),
      ]);
      // Sinkron judul halaman baris yang kolom pertamanya berubah.
      const firstColId = nextColumns[0]?.id;
      if (firstColId) {
        let oldFirst: Record<string, unknown> = {};
        try {
          const b = JSON.parse(baseline.current) as { rows?: TableRow[] };
          oldFirst = Object.fromEntries((b.rows ?? []).map((r) => [r.id, r.values?.[firstColId]]));
        } catch {
          // baseline rusak → anggap semua berubah, PATCH yang gagal diabaikan
        }
        await Promise.all(
          data.rows
            .filter(
              (r) =>
                r.noteId &&
                String(r.values[firstColId] ?? '') !== String(oldFirst[r.id] ?? ''),
            )
            .map((r) =>
              noteApi
                .update(r.noteId as string, {
                  title: String(r.values[firstColId] ?? '').trim() || 'Tanpa judul',
                })
                .catch((e: unknown) => {
                  // Halaman sudah tak ada → putuskan tautan agar baris bisa dibuatkan lagi.
                  if ((e as { response?: { status?: number } })?.response?.status === 404) {
                    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, noteId: null } : x)));
                  }
                }),
            ),
        );
      }
      setColumns(data.columns); setRows(data.rows); setTitle(note.title);
      baseline.current = JSON.stringify({ title: note.title, columns: data.columns, rows: data.rows });
      notifyNotesChanged();
    } catch {
      if (loud) showToast('Gagal menyimpan tabel. Coba lagi.');
    } finally { setSaving(false); }
  }

  // Hapus/undo menandai Mendesak agar tersimpan seketika (delay 0),
  // menutup balapan refresh-cepat. Ketikan biasa tetap debounce 700ms.
  const urgentRef = useRef(false);

  // Tandai simpan berikutnya sebagai Mendesak. Dipakai aksi diskrit dari
  // menu kolom (ikon/jenis/nama) agar tak kalah debounce.
  function markUrgent() {
    urgentRef.current = true;
  }

  // Simpan seketika memakai state render terakhir. Dipakai aksi diskrit
  // menu kolom (ikon/jenis) agar bertahan walau langsung refresh.
  function flushNow() {
    const cur = liveRef.current;
    if (JSON.stringify({ title: cur.title, columns: cur.columns, rows: cur.rows }) === baseline.current) return;
    window.clearTimeout(timer.current);
    urgentRef.current = false;
    void saveSnapshot(cur.title, cur.columns, cur.rows, true);
  }

  useEffect(() => {
    if (!tableId || loading || loadError) return;
    const current = JSON.stringify({ title, columns, rows });
    if (current === baseline.current) return;
    window.clearTimeout(timer.current);
    const loud = urgentRef.current;
    urgentRef.current = false;
    timer.current = window.setTimeout(() => {
      void saveSnapshot(title, columns, rows, loud);
    }, loud ? 0 : 700);
    return () => window.clearTimeout(timer.current);
  }, [title, columns, rows, tableId, loading, loadError]);

  function changeColumn(index: number, patch: Partial<TableColumn>) { setColumns((p) => p.map((c, i) => i === index ? { ...c, ...patch } : c)); }
  // Susun ulang kolom via drag-and-drop header (id stabil, bukan index).
  function reorderColumns(activeId: string, overId: string) {
    const from = columns.findIndex((c) => c.id === activeId);
    const to = columns.findIndex((c) => c.id === overId);
    if (from < 0 || to < 0 || from === to) return;
    const prevOrder = columns.map((c) => c.id);
    setColumns(arrayMove(columns, from, to));
    urgentRef.current = true;
    const undo = () => {
      setColumns((cur) => {
        const rank = new Map(prevOrder.map((id, i) => [id, i]));
        return [...cur].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
      });
      urgentRef.current = true;
    };
    // Tanpa toast (ramai saat drag); kembalikan via Ctrl+Z.
    pushUndo('susunan kolom', undo);
  }
  // Hapus properti langsung (tanpa confirm): snapshot kolom + isi sel
  // didorong ke stack undo, toast Urungkan + Ctrl+Z mengembalikan.
  function removeColumn(columnId: string) {
    const at = columns.findIndex((c) => c.id === columnId);
    if (at < 0) return;
    const snapshot = columns[at];
    const cellValues = new Map(rows.map((r) => [r.id, r.values[columnId]]));
    setColumns((p) => p.filter((c) => c.id !== columnId));
    setRows((p) =>
      p.map((r) => {
        if (!(columnId in r.values)) return r;
        const values = { ...r.values };
        delete values[columnId];
        return { ...r, values };
      }),
    );
    urgentRef.current = true;
    const undo = () => {
      setColumns((prev) =>
        prev.some((c) => c.id === columnId)
          ? prev
          : [...prev.slice(0, Math.min(at, prev.length)), snapshot, ...prev.slice(Math.min(at, prev.length))],
      );
      setRows((prev) =>
        prev.map((r) =>
          cellValues.has(r.id) && !(columnId in r.values)
            ? { ...r, values: { ...r.values, [columnId]: cellValues.get(r.id) } }
            : r,
        ),
      );
      urgentRef.current = true;
    };
    const cancel = pushUndo('kolom', undo);
    showToast(`Properti "${snapshot.name}" dihapus`, { label: 'Urungkan', onAction: cancel });
  }
  function addColumn() { setColumns((p) => [...p, { id: newId(), name: 'Properti', type: 'TEXT', options: [], order: p.length }]); }
  function changeCell(rowId: string, col: TableColumn, value: unknown) { setRows((p) => p.map((r) => r.id === rowId ? { ...r, values: { ...r.values, [col.id]: value } } : r)); }

  // Susun ulang baris via drag-and-drop (id stabil, bukan index).
  function moveRowTo(activeId: string, overId: string) {
    const from = rows.findIndex((r) => r.id === activeId);
    const to = rows.findIndex((r) => r.id === overId);
    if (from < 0 || to < 0 || from === to) return;
    const prevOrder = rows.map((r) => r.id);
    setRows(arrayMove(rows, from, to));
    urgentRef.current = true;
    const undo = () => {
      setRows((cur) => {
        const rank = new Map(prevOrder.map((id, i) => [id, i]));
        return [...cur].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
      });
      urgentRef.current = true;
    };
    // Tanpa toast (ramai saat drag); kembalikan via Ctrl+Z.
    pushUndo('susunan baris', undo);
  }

  function toggleRow(rowId: string) {
    setSelectedIds((prev) => (prev.includes(rowId) ? prev.filter((id) => id !== rowId) : [...prev, rowId]));
  }

  // Standar: semua nyala → matikan; selain itu → nyalakan semua.
  function toggleAll() {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      const all = rows.length > 0 && rows.every((r) => set.has(r.id));
      return all ? [] : rows.map((r) => r.id);
    });
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  // Hapus massal baris terpilih: 1 entri undo, 1 toast.
  // Halaman-baris ikut ke Sampah seperti hapus satuan.
  function removeSelected() {
    const ids = selectedIds.filter((id) => rows.some((r) => r.id === id));
    if (ids.length === 0) return;
    const doomed = rows
      .map((row, index) => ({ row, index }))
      .filter(({ row }) => ids.includes(row.id));
    const trashed = doomed.filter(({ row }) => row.noteId);
    setRows((prev) => prev.filter((r) => !ids.includes(r.id)));
    setSelectedIds([]);
    urgentRef.current = true;
    for (const { row } of trashed) {
      trash({ kind: 'note', id: row.noteId as string, title: rowTitle(row) });
    }
    if (trashed.length > 0) notifyNotesChanged();
    const undo = () => {
      for (const { row } of trashed) restore('note', row.noteId as string);
      setRows((prev) => {
        const have = new Set(prev.map((r) => r.id));
        const reinsert = doomed
          .filter(({ row }) => !have.has(row.id))
          .sort((a, b) => a.index - b.index);
        if (reinsert.length === 0) return prev;
        const next = [...prev];
        for (const { row, index } of reinsert) {
          next.splice(Math.min(index, next.length), 0, row);
        }
        return next;
      });
      urgentRef.current = true;
      if (trashed.length > 0) notifyNotesChanged();
    };
    const cancel = pushUndo('baris', undo);
    showToast(
      trashed.length > 0 ? `${trashed.length} baris dipindahkan ke Sampah` : `${doomed.length} baris dihapus`,
      { label: 'Urungkan', onAction: cancel },
    );
  }
  // Buang baris ke Sampah (soft-delete lokal): baris lepas dari tabel via
  // autosave, halaman di baliknya tetap di server sampai di-purge dari Sampah.
  function removeRow(rowId: string) {
    const at = rows.findIndex((r) => r.id === rowId);
    if (at < 0) return;
    const row = rows[at];
    const snapshot = row;
    setRows((prev) => prev.filter((r) => r.id !== rowId));
    setSelectedIds((prev) => prev.filter((id) => id !== rowId));
    urgentRef.current = true;
    if (!row.noteId) {
      // Baris tanpa halaman: tak ada yang masuk Sampah, tapi tetap bisa diurungkan.
      const undoPlain = () => {
        setRows((prev) =>
          prev.some((r) => r.id === rowId) ? prev : [...prev.slice(0, at), snapshot, ...prev.slice(at)],
        );
        urgentRef.current = true;
      };
      const cancelPlain = pushUndo('baris', undoPlain);
      showToast('Baris dihapus', { label: 'Urungkan', onAction: cancelPlain });
      return;
    }
    const noteId = row.noteId;
    const firstColId = columns[0]?.id;
    const title = (firstColId ? String(row.values[firstColId] ?? '').trim() : '') || 'Tanpa judul';
    trash({ kind: 'note', id: noteId, title });
    notifyNotesChanged();
    const undo = () => {
      restore('note', noteId);
      setRows((prev) =>
        prev.some((r) => r.id === rowId) ? prev : [...prev.slice(0, at), snapshot, ...prev.slice(at)],
      );
      urgentRef.current = true;
      notifyNotesChanged();
    };
    const cancel = pushUndo('baris', undo);
    showToast('Baris dipindahkan ke Sampah', { label: 'Urungkan', onAction: cancel });
  }
  const addingPage = useRef(false);
  // Buatkan halaman di balik baris di belakang (tetap di tempat).
  // Gagal → baris polos tetap ada (bisa via ↗ nanti) + toast.
  async function linkRowPage(parentId: string, row: TableRow) {
    try {
      const note = await noteApi.create({ title: 'Tanpa judul', parentId });
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, noteId: note.id } : r)));
      notifyNotesChanged();
    } catch {
      showToast('Baris ditambahkan tanpa halaman. Coba lagi via ↗.');
    }
  }
  // Tambah baris inline + buatkan halamannya di belakang (tetap di tempat).
  // Kembalikan id baris baru atau null bila diblokir.
  async function addInlineRow(): Promise<string | null> {
    if (!tableId || addingPage.current) return null;
    addingPage.current = true;
    const row: TableRow = { id: newId(), noteId: null, values: {}, order: rows.length };
    setRows((prev) => [...prev, row]);
    try {
      await linkRowPage(tableId, row);
    } finally {
      addingPage.current = false;
    }
    return row.id;
  }
  // Sisip baris baru tepat di bawah baris acuan + buatkan halamannya.
  async function addRowBelow(rowId: string): Promise<string | null> {
    if (!tableId || addingPage.current) return null;
    const at = rows.findIndex((r) => r.id === rowId);
    if (at < 0) return addInlineRow();
    addingPage.current = true;
    const row: TableRow = { id: newId(), noteId: null, values: {}, order: at + 1 };
    setRows((prev) => [...prev.slice(0, at + 1), row, ...prev.slice(at + 1)]);
    try {
      await linkRowPage(tableId, row);
    } finally {
      addingPage.current = false;
    }
    return row.id;
  }

  // Pastikan baris punya halaman (buat on-demand bila belum ada).
  // Kembalikan noteId atau null bila gagal.
  async function ensureRowPage(rowId: string): Promise<string | null> {
    if (!tableId || busyRows.current.has(rowId)) return null;
    const row = rows.find((r) => r.id === rowId);
    if (!row) return null;
    if (row.noteId) return row.noteId;
    busyRows.current.add(rowId);
    try {
      const firstColId = columns[0]?.id;
      const title = (firstColId ? String(row.values[firstColId] ?? '').trim() : '') || 'Tanpa judul';
      const note = await noteApi.create({ title, parentId: tableId });
      setRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, noteId: note.id } : r)));
      notifyNotesChanged();
      return note.id;
    } catch {
      return null;
    } finally {
      busyRows.current.delete(rowId);
    }
  }

  return {
    title, setTitle, columns, rows, loading, saving, loadError,
    changeColumn, reorderColumns, removeColumn, addColumn, markUrgent, flushNow,
    changeCell, removeRow, removeSelected, ensureRowPage, addInlineRow, addRowBelow,
    moveRowTo, selectedIds, toggleRow, toggleAll, clearSelection,
  };
}

export type TableDataState = ReturnType<typeof useTableData>;
