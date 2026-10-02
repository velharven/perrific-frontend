import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { noteApi } from '@/api/notes';
import { notifyTeamsChanged, readTrashIds, useHiddenNav, useTrash } from '@/hooks/useNavLabels';
import { UndoStackProvider, useUndo } from '@/hooks/useUndoStack';
import { useAuth } from '@/store/auth';
import { Image as ImageIcon, X, Upload, MoreVertical } from 'lucide-react';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ModalShell from '@/components/ui/ModalShell';
import CropEditorModal from '@/components/note/CropEditorModal';
import {
  COVER_ALIGN,
  COVER_PRESETS,
  fileToDownscaledDataUrl,
  makeImageCover,
  parseCover,
  withCoverPos,
  type CoverPos,
} from '@/components/note/cover';
import { showToast } from '@/components/ui/Toast';
import NoteBlocks, { type BlockFocusReq } from '@/components/note/BlockEditor';
import HeadingOutline from '@/components/note/HeadingOutline';
import SlashMenu, { getCaretViewportPos, type SlashCommandId } from '@/components/note/SlashMenu';
import { DocumentSkeleton } from '@/components/ui/loading';
import {
  appendBlock,
  countBlockWords,
  applyDrop,
  dedupePagePointers,
  deleteEmptyBlock,
  ensurePagePointers,
  getBlock,
  appendChild,
  headingOutline,
  indentBlock,
  insertAfter,
  mergeUp,
  moveBlockCross,
  outdentBlock,
  parseNoteBlocks,
  prunePagePointers,
  removeBlock,
  serializeNoteBlocks,
  setBlockPage,
  setBlockType,
  splitBlock,
  toggleBlockChecked,
  toggleBlockCollapsed,
  updateBlockText,
  visibleBlockOrder,
  type NoteBlock,
  type NoteBlockType,
} from '@/components/note/noteBlocks';
import type { Note } from '@/types';

export const NOTES_CHANGED_EVENT = 'purrific:notes-changed';

export function notifyNotesChanged() {
  window.dispatchEvent(new Event(NOTES_CHANGED_EVENT));
}

// Path halaman menurut jenisnya (cermin privatPathOf di sidebar).
function notePathFor(n: Note): string {
  const kind = n.kind ?? 'NOTE';
  if (kind === 'DAILY') return `/daily/${n.id}`;
  if (kind === 'TABLE') return `/tables/${n.id}`;
  return `/notes/${n.id}`;
}

function formatUpdated(dateStr?: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}



function NotePageInner() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { trash, restore, items: trashItems } = useTrash(user?.id);
  const { push, undoEntry } = useUndo();
  const { hidden: hiddenNav } = useHiddenNav(user?.id);
  const [note, setNote] = useState<Note | null>(null);
  const [allNotes, setAllNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState('');
  const [blocks, setBlocks] = useState<NoteBlock[]>([]);
  const [focusReq, setFocusReq] = useState<BlockFocusReq | null>(null);
  const focusSeq = useRef(0);
  const dirtyRef = useRef(false);
  // NoteId yang sudah disisipi blok awal otomatis (sekali per buka note).
  const seededFor = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [slash, setSlash] = useState<{
    blockId: string;
    // Posisi karet TEPAT SETELAH '/' yang diketik (slash-nya di offset - 1).
    offset: number;
    anchor: { x: number; y: number; lineHeight: number };
  } | null>(null);
  const [creatingChild, setCreatingChild] = useState(false);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  const [cover, setCover] = useState<string | null>(null);
  const [coverOpen, setCoverOpen] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<number | null>(null);
  const stateRef = useRef({ title: '', serialized: '', cover: null as string | null });
  stateRef.current = { title, serialized: serializeNoteBlocks(blocks), cover };


  useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    dirtyRef.current = false;
    Promise.all([noteApi.get(noteId), noteApi.listMine()])
      .then(([n, list]) => {
        if (cancelled) return;
        setNote(n);
        setAllNotes(list);
        setTitle(n.title);
        const parsed = parseNoteBlocks(n.content);
        // Bersihkan dulu (duplikat + pointer sampah warisan), baru migrasi.
        // Anak yang sedang di Sampah dilewati agar tak jadi ghost abu-abu.
        const deduped = dedupePagePointers(parsed);
        const migrated = ensurePagePointers(
          deduped.blocks,
          list.filter((c) => c.parentId === noteId).map((c) => c.id),
          readTrashIds(user?.id),
        );
        // Note kosong (baru dibuat) langsung dapat satu blok teks kosong
        // agar tampil baris "+ ⋮⋮ Tekan '/' untuk perintah", bukan tombol dashed.
        // Sekali per buka note: hapus-semua-blok oleh user tidak di-seed ulang.
        if (migrated.blocks.length === 0 && seededFor.current !== noteId) {
          seededFor.current = noteId;
          const r = appendBlock([]);
          setBlocks(r.blocks);
          focusSeq.current += 1;
          setFocusReq({ id: r.focus.id, offset: r.focus.offset, nonce: focusSeq.current });
          dirtyRef.current = true;
        } else {
          setBlocks(migrated.blocks);
        }
        if (deduped.changed || migrated.changed) dirtyRef.current = true;
        setCover(n.coverUrl ?? null);
      })
      .catch(() => {
        if (!cancelled) setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [noteId]);

  // Segarkan daftar anak saat tab lain berubah (buat/pindah/hapus subhalaman).
  useEffect(() => {
    if (!noteId) return;
    let cancelled = false;
    const refresh = () => {
      noteApi
        .listMine()
        .then((list) => {
          if (!cancelled) setAllNotes(list);
        })
        .catch(() => {
          // diam — daftar lama tetap tampil
        });
    };
    window.addEventListener(NOTES_CHANGED_EVENT, refresh);
    return () => window.removeEventListener(NOTES_CHANGED_EVENT, refresh);
  }, [noteId]);

  // Repair: cabut pointer ke isi Sampah (ghost warisan, trash dari sidebar,
  // atau migrasi yang jalan sebelum trash termuat) + simpan segera.
  // Diam bila bersih sehingga tak ada loop.
  useEffect(() => {
    if (!noteId || !note || loading) return;
    if (trashItems.length === 0) return;
    const ids = new Set(trashItems.filter((t) => t.kind === 'note').map((t) => t.id));
    const pruned = prunePagePointers(blocks, ids);
    if (pruned.removed === 0) return;
    setBlocks(pruned.blocks);
    saveNow(pruned.blocks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trashItems, noteId, loading]);

  function commit(next: NoteBlock[], focus?: { id: string; offset: number }) {
    setBlocks(next);
    dirtyRef.current = true;
    if (focus) {
      focusSeq.current += 1;
      setFocusReq({ ...focus, nonce: focusSeq.current });
    }
  }

  // Pindah kursor antar blok (panah atas/bawah). Tanpa commit agar
  // tidak menandai dirty dan tidak memicu autosave.
  function moveFocus(id: string, offset: number, dir: -1 | 1) {
    const order = visibleBlockOrder(blocks);
    const idx = order.indexOf(id);
    const target = idx >= 0 ? order[idx + dir] : undefined;
    if (!target) return;
    const text = getBlock(blocks, target)?.text ?? '';
    const at = Math.max(0, Math.min(offset, text.length));
    focusSeq.current += 1;
    setFocusReq({ id: target, offset: at, nonce: focusSeq.current });
  }

  // Simpan detik itu juga (tanpa tunggu debounce) agar refresh kilat tak
  // mengembalikan perubahan. Gagal → toast + tandai dirty agar dicoba lagi
  // saat perubahan berikutnya.
  function saveNow(nextBlocks: NoteBlock[]) {
    if (!noteId || !note) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const serialized = serializeNoteBlocks(nextBlocks);
    const body: { title?: string; content?: string; coverUrl?: string | null } = {};
    if (title.trim() && title !== note.title) body.title = title.trim();
    if (serialized !== note.content) body.content = serialized;
    if ((cover ?? null) !== (note.coverUrl ?? null)) body.coverUrl = cover;
    if (Object.keys(body).length === 0) {
      dirtyRef.current = false;
      return;
    }
    setSaving(true);
    noteApi
      .update(noteId, body)
      .then((updated) => {
        dirtyRef.current = false;
        setNote(updated);
        notifyNotesChanged();
      })
      .catch(() => {
        dirtyRef.current = true;
        showToast('Gagal menyimpan. Akan dicoba lagi otomatis.');
      })
      .finally(() => setSaving(false));
  }

  // Lepas pointer subhalaman. Target tabel ikut dibuang ke Sampah se-cabang
  // (bisa Urungkan/Ctrl+Z); target note biasa hanya dilepas. SEMUA pointer
  // ke target dicabut (klik + duplikat/ghost) agar tak tersisa abu-abu.
  function handleRemovePointer(blockId: string) {
    if (!noteId || !note) return;
    const target = getBlock(blocks, blockId);
    if (!target || target.type !== 'page' || !target.pageId) return;
    const pageId = target.pageId;
    const resolved = pageOf(pageId);
    // State tak pernah dimutasi langsung (prune mengklon), jadi referensi
    // lama aman sebagai snapshot undo.
    const snapshot = blocks;

    const trashedIds: string[] = [];
    let toastMsg: string | null = null;
    if (resolved?.table) {
      const childrenOf = new Map<string, string[]>();
      const titles = new Map<string, string>();
      for (const n of allNotes) {
        if (n.parentId) childrenOf.set(n.parentId, [...(childrenOf.get(n.parentId) ?? []), n.id]);
        titles.set(n.id, n.title || 'Tanpa judul');
      }
      const seen = new Set<string>([pageId]);
      const stack = [pageId];
      while (stack.length > 0) {
        const cur = stack.pop() as string;
        for (const c of childrenOf.get(cur) ?? []) {
          if (!seen.has(c)) {
            seen.add(c);
            stack.push(c);
          }
        }
      }
      for (const id of seen) {
        trash({ kind: 'note', id, title: titles.get(id) ?? resolved.title });
        trashedIds.push(id);
      }
      notifyNotesChanged();
      notifyTeamsChanged();
      toastMsg = `Tabel "${resolved.title}" dipindahkan ke Sampah`;
    }
    const pruned = prunePagePointers(blocks, trashedIds.length > 0 ? new Set(trashedIds) : new Set([pageId]));
    if (pruned.removed === 0) return;
    const next = pruned.blocks;
    setBlocks(next);
    saveNow(next);
    const undo = () => {
      for (const id of trashedIds) restore('note', id);
      if (trashedIds.length > 0) {
        notifyNotesChanged();
        notifyTeamsChanged();
      }
      setBlocks(snapshot);
      saveNow(snapshot);
    };
    const entryId = push(toastMsg ? 'tabel' : 'pointer', undo);
    showToast(toastMsg ?? 'Subhalaman dilepas (halamannya tetap ada)', {
      label: 'Urungkan',
      onAction: () => undoEntry(entryId),
    });
  }

  // Hapus satu blok biasa (tombol ×). Anak yang tersisa naik ke atas
  // (semantik removeBlock, konsisten Backspace). Bisa Urungkan/Ctrl+Z.
  function handleRemoveBlock(blockId: string) {
    if (!noteId || !note) return;
    const snapshot = blocks;
    const r = removeBlock(blocks, blockId);
    if (!r) return;
    const next = r.blocks;
    setBlocks(next);
    saveNow(next);
    const undo = () => {
      setBlocks(snapshot);
      saveNow(snapshot);
    };
    const entryId = push('blok', undo);
    showToast('Blok dihapus', {
      label: 'Urungkan',
      onAction: () => undoEntry(entryId),
    });
  }

  // Simpan otomatis (debounce) saat judul/blok berubah oleh user.
  // dirtyRef mencegah tulis ulang saat buka (mis. migrasi teks lama).
  useEffect(() => {
    if (!noteId || !note || !dirtyRef.current) return;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaving(true);
    saveTimer.current = window.setTimeout(() => {
      const { title: t, serialized: c, cover: cv } = stateRef.current;
      const body: { title?: string; content?: string; coverUrl?: string | null } = {};
      if (t.trim() && t !== note.title) body.title = t.trim();
      if (c !== note.content) body.content = c;
      if ((cv ?? null) !== (note.coverUrl ?? null)) body.coverUrl = cv;
      if (Object.keys(body).length === 0) {
        dirtyRef.current = false;
        setSaving(false);
        return;
      }
      noteApi
        .update(noteId, body)
        .then((updated) => {
          dirtyRef.current = false;
          setNote(updated);
          notifyNotesChanged();
        })
        .catch(() => {
          // diam — coba lagi saat perubahan berikutnya
        })
        .finally(() => setSaving(false));
    }, 800);
    return () => {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, title, cover, noteId]);

  function pickCover(css: string) {
    setCover(css);
    dirtyRef.current = true;
    setCoverOpen(false);
  }

  function removeCover() {
    setCover(null);
    dirtyRef.current = true;
  }

  function alignCover(pos: CoverPos) {
    const next = withCoverPos(cover, pos);
    if (next === cover) return;
    setCover(next);
    dirtyRef.current = true;
  }

  async function handleCoverFile(file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await fileToDownscaledDataUrl(file);
      setCropSrc(dataUrl);
    } catch (e) {
      showToast(e instanceof Error ? e.message : 'Gagal membaca gambar.');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // Tutup menu ••• saat klik di luar / Esc.
  useEffect(() => {
    if (!pageMenuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) {
        setPageMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPageMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [pageMenuOpen]);

  async function handleDelete() {
    if (!noteId || deleting) return;
    setPageMenuOpen(false);
    setConfirmOpen(true);
  }

  async function confirmDelete() {
    if (!noteId || !note || deleting) return;
    setDeleting(true);
    try {
      // Soft-delete: pindahkan ke Sampah, API dipanggil saat hapus permanen.
      const title = note.title || 'Tanpa judul';
      trash({ kind: 'note', id: noteId, title });
      notifyNotesChanged();
      notifyTeamsChanged();
      navigate('/notes');
      showToast(`Tab "${title}" dipindahkan ke Sampah`, {
        label: 'Urungkan',
        onAction: () => restore('note', noteId),
      });
    } catch {
      setDeleting(false);
      setConfirmOpen(false);
    }
  }

  // Buat subhalaman + ubah blok pemicu '/' jadi pointer inline di posisinya.
  // Flush sinkron sebelum navigasi agar pointer tak hilang saat unmount.
  async function createChildPage(kind: 'NOTE' | 'TABLE', blockId: string, offset: number) {
    if (!noteId || creatingChild) return;
    setCreatingChild(true);
    try {
      const child = await noteApi.create({ kind, parentId: noteId });
      let next = blocks;
      const b = getBlock(next, blockId);
      if (b) {
        const cut = offset - 1;
        const stripped =
          cut >= 0 && b.text[cut] === '/' ? b.text.slice(0, cut) + b.text.slice(offset) : b.text;
        next = updateBlockText(next, blockId, stripped);
        next = setBlockPage(next, blockId, child.id, child.title || 'Tanpa judul');
      }
      const serialized = serializeNoteBlocks(next);
      const updated = await noteApi.update(noteId, { content: serialized });
      setBlocks(next);
      setNote(updated);
      setAllNotes((prev) => [...prev, child]);
      dirtyRef.current = false;
      notifyNotesChanged();
      // Tetap di halaman induk; pointer inline barunya jadi umpan balik.
    } catch {
      showToast('Gagal membuat subhalaman. Coba lagi.');
    } finally {
      setCreatingChild(false);
      setSlash(null);
    }
  }

  function openSlash(blockId: string) {
    const el = document.querySelector<HTMLTextAreaElement>(`[data-block-id="${blockId}"]`);
    if (!el) return;
    setSlash({ blockId, offset: el.selectionStart, anchor: getCaretViewportPos(el) });
  }

  function closeSlash(focusBack = true) {
    // '/' yang diketik dibiarkan sebagai teks biasa.
    if (focusBack && slash) {
      focusSeq.current += 1;
      setFocusReq({ id: slash.blockId, offset: slash.offset, nonce: focusSeq.current });
    }
    setSlash(null);
  }

  // Lompat ke heading dari outline navigator: scroll halus + fokus karet di ujung.
  function jumpToHeading(id: string) {
    const el = document.querySelector<HTMLTextAreaElement>(`[data-block-id="${id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
    const at = el.value.length;
    el.setSelectionRange(at, at);
  }

  // Buang '/' pemicu (bila masih ada), kembalikan pohon + posisi kursor.
  // Hanya untuk ganti tipe (tetap di halaman): subpage langsung navigasi
  // pergi sehingga strip-nya tak sempat tersimpan — '/' dibiarkan apa adanya.
  // Resolver pointer → anak yang masih bisa dibuka. null = sembunyikan
  // baris (terhapus/terarsip/tersampah) tapi datanya dipertahankan.
  function pageOf(pageId: string): { title: string; to: string; table: boolean } | null {
    const child = allNotes.find((n) => n.id === pageId);
    if (!child) return null;
    if (trashItems.some((t) => t.kind === 'note' && t.id === pageId)) return null;
    if (hiddenNav.includes(notePathFor(child))) return null;
    return {
      title: child.title || 'Tanpa judul',
      to: notePathFor(child),
      table: (child.kind ?? 'NOTE') === 'TABLE',
    };
  }

  function selectSlashCommand(id: SlashCommandId) {
    if (!slash) return;
    if (id === 'subpage-note') {
      createChildPage('NOTE', slash.blockId, slash.offset);
      return;
    }
    if (id === 'subpage-table') {
      createChildPage('TABLE', slash.blockId, slash.offset);
      return;
    }
    let next = blocks;
    let at = slash.offset;
    const b = getBlock(next, slash.blockId);
    if (b) {
      const cut = slash.offset - 1;
      if (cut >= 0 && b.text[cut] === '/') {
        next = updateBlockText(next, slash.blockId, b.text.slice(0, cut) + b.text.slice(slash.offset));
        at = cut;
      } else {
        at = Math.min(slash.offset, b.text.length);
      }
      next = setBlockType(next, slash.blockId, id);
    }
    setBlocks(next);
    dirtyRef.current = true;
    focusSeq.current += 1;
    setFocusReq({ id: slash.blockId, offset: at, nonce: focusSeq.current });
    setSlash(null);
  }

  if (loading) {
    return <DocumentSkeleton />;
  }

  if (notFound || !note) {
    return (
      <div className="mx-auto max-w-3xl rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
        <p className="font-givonic text-sm text-perrific-graphite/60">Catatan tidak ditemukan atau sudah dihapus.</p>
      </div>
    );
  }

  const words = countBlockWords(blocks);
  const outline = headingOutline(blocks);
  const parsedCover = parseCover(cover);
  const parent = note.parentId ? (allNotes.find((n) => n.id === note.parentId) ?? null) : null;

  return (
    <div className="mx-auto max-w-3xl">
      {parent && (
        <nav aria-label="Breadcrumb" className="mb-2 flex min-w-0 items-center gap-1.5 font-givonic text-xs text-perrific-graphite/50">
          <Link to={notePathFor(parent)} className="truncate hover:text-perrific-violet hover:underline">
            {parent.title || 'Tanpa judul'}
          </Link>
          <span aria-hidden="true" className="shrink-0">›</span>
          <span className="truncate font-semibold text-perrific-graphite">{note.title || 'Tanpa judul'}</span>
        </nav>
      )}
      <div className="group relative mb-1">
        {parsedCover.kind !== 'none' ? (
          <div className="relative overflow-hidden rounded-xl">
            {parsedCover.kind === 'image' ? (
              <img
                src={parsedCover.src}
                alt="Sampul catatan"
                className="h-36 w-full object-cover sm:h-44"
                style={{ objectPosition: parsedCover.pos }}
              />
            ) : (
              <div className="h-36 sm:h-44" style={{ background: parsedCover.css }} />
            )}
            <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
              {parsedCover.kind === 'image' && (
                <span className="flex overflow-hidden rounded-lg bg-white/90 shadow-sm backdrop-blur" role="group" aria-label="Perataan sampul">
                  {COVER_ALIGN.map((a) => (
                    <button
                      key={a.pos}
                      type="button"
                      title={a.label}
                      aria-label={a.label}
                      aria-pressed={parsedCover.pos === a.pos}
                      onClick={() => alignCover(a.pos)}
                      className={`px-2 py-1 font-givonic text-[11px] font-semibold transition ${
                        parsedCover.pos === a.pos
                          ? 'bg-perrific-violet/15 text-perrific-violet'
                          : 'text-perrific-graphite/60 hover:bg-white'
                      }`}
                    >
                      {a.label.replace('Rata ', '')}
                    </button>
                  ))}
                </span>
              )}
              <button
                type="button"
                onClick={() => setCoverOpen(true)}
                className="rounded-lg bg-white/90 px-2.5 py-1 font-givonic text-xs font-semibold text-perrific-graphite shadow-sm backdrop-blur transition hover:bg-white"
              >
                Ubah
              </button>
              <button
                type="button"
                onClick={removeCover}
                className="rounded-lg bg-white/90 px-2.5 py-1 font-givonic text-xs font-semibold text-red-600 shadow-sm backdrop-blur transition hover:bg-white"
              >
                Hapus
              </button>
            </div>
          </div>
        ) : (
          <div className="flex h-7 items-center opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
            <button
              type="button"
              onClick={() => setCoverOpen(true)}
              aria-haspopup="dialog"
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 font-givonic text-xs font-medium text-perrific-graphite/45 transition hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <ImageIcon size={14} strokeWidth={1.6} aria-hidden="true" />
              Tambahkan sampul
            </button>
          </div>
        )}
      </div>
      {coverOpen && (
        <ModalShell label="Pilih sampul" onClose={() => setCoverOpen(false)}>
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="font-givonic text-sm font-bold text-perrific-graphite">Pilih sampul</p>
            <button
              type="button"
              onClick={() => setCoverOpen(false)}
              aria-label="Tutup"
              autoFocus
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-perrific-graphite cursor-pointer"
            >
              <X size={14} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 px-3 py-2.5 font-givonic text-sm font-semibold text-perrific-graphite/60 transition hover:border-perrific-violet hover:text-perrific-violet cursor-pointer"
          >
            <Upload size={14} strokeWidth={1.6} aria-hidden="true" />
            Upload gambar
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            aria-label="Pilih gambar sampul"
            className="hidden"
            onChange={(e) => handleCoverFile(e.target.files?.[0])}
          />
          <div className="grid grid-cols-3 gap-2">
            {COVER_PRESETS.map((c) => (
              <button
                key={c.id}
                type="button"
                title={c.label}
                aria-label={`Sampul ${c.label}`}
                aria-pressed={cover === c.css}
                onClick={() => pickCover(c.css)}
                className={`h-16 rounded-xl transition outline-none ${
                  cover === c.css
                    ? 'ring-2 ring-perrific-violet ring-offset-2'
                    : 'hover:ring-2 hover:ring-gray-300 hover:ring-offset-2'
                }`}
                style={{ background: c.css }}
              />
            ))}
          </div>
          {cover && (
            <button
              type="button"
              onClick={() => {
                removeCover();
                setCoverOpen(false);
              }}
              className="mt-2 w-full rounded-lg px-2 py-1.5 font-givonic text-xs font-semibold text-red-600 transition hover:bg-red-50"
            >
              Hapus sampul
            </button>
          )}
        </ModalShell>
      )}
      {cropSrc && (
        <CropEditorModal
          src={cropSrc}
          onClose={() => setCropSrc(null)}
          onDone={(dataUrl) => {
            const next = makeImageCover(dataUrl, '50% 50%');
            setCover(next);
            dirtyRef.current = true;
            setCropSrc(null);
            setCoverOpen(false);
          }}
        />
      )}
      <div className="flex items-start gap-2">
        <input
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            dirtyRef.current = true;
          }}
          placeholder="Tanpa judul"
          maxLength={120}
          aria-label="Judul catatan"
          className="min-w-0 flex-1 bg-transparent font-givonic text-[28px] font-extrabold leading-tight tracking-[-0.02em] text-perrific-graphite placeholder:text-perrific-graphite/30 focus:outline-none sm:text-[32px]"
        />
        <div className="relative shrink-0 pt-1" ref={pageMenuRef}>
          {saving && (
            <span aria-live="polite" className="absolute right-10 top-1/2 -translate-y-1/2 whitespace-nowrap font-mono text-[11px] text-perrific-graphite/40">
              Menyimpan…
            </span>
          )}
          <button
            type="button"
            onClick={() => setPageMenuOpen((v) => !v)}
            aria-expanded={pageMenuOpen}
            aria-haspopup="menu"
            aria-label="Menu halaman"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-perrific-graphite/50 transition hover:bg-gray-100 hover:text-perrific-graphite"
          >
            <MoreVertical size={16} strokeWidth={1.6} aria-hidden="true" />
          </button>
          {pageMenuOpen && (
            <div
              role="menu"
              aria-label="Menu halaman"
              className="absolute right-0 top-full z-30 mt-1 min-w-[220px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
            >
              <div className="px-3 py-2">
                <p className="font-mono text-[11px] text-perrific-graphite/40">
                  Terakhir diubah {formatUpdated(note.updatedAt)}
                </p>
                <p className="font-mono text-[11px] text-perrific-graphite/40">{words} kata</p>
              </div>
              <div className="h-px bg-gray-100" />
              <button
                type="button"
                role="menuitem"
                onClick={handleDelete}
                disabled={deleting}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 font-givonic text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? 'Menghapus…' : 'Hapus catatan'}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1">
        <NoteBlocks
          blocks={blocks}
          focusReq={focusReq}
          pageOf={pageOf}
          onDrop={(activeId, overId, frac) => {
            // Satu pintu applyDrop: indikator dan hasil dijamin sama.
            const next = applyDrop(blocks, activeId, overId, frac);
            if (next !== blocks) commit(next);
          }}
          onMoveCross={(activeId, newParentId) => {
            const next = moveBlockCross(blocks, activeId, newParentId);
            if (next !== blocks) commit(next);
          }}
          onAppendChild={(parentId) => {
            const r = appendChild(blocks, parentId);
            if (r) commit(r.blocks, r.focus);
          }}
          onAppend={() => {
            const last = blocks[blocks.length - 1];
            if (last && last.text === '') {
              focusSeq.current += 1;
              setFocusReq({ id: last.id, offset: 0, nonce: focusSeq.current });
              return;
            }
            const r = appendBlock(blocks);
            commit(r.blocks, r.focus);
          }}
          h={{
            onText: (id, text) => {
              // Shortcut markdown ala Notion: "- ", "1. ", "#/##/### ", "--- "
              // + Spasi di awal blok kosong → ubah tipe otomatis.
              const md = text.match(/^(-|#{1,3}|\d+\.|---) $/);
              if (md) {
                const marker = md[1];
                const type: NoteBlockType =
                  marker === '-'
                    ? 'bullet'
                    : marker === '#'
                      ? 'h1'
                      : marker === '##'
                        ? 'h2'
                        : marker === '###'
                          ? 'h3'
                          : marker === '---'
                            ? 'divider'
                            : 'number';
                let next = updateBlockText(blocks, id, '');
                next = setBlockType(next, id, type);
                if (type === 'divider') {
                  // Divider tanpa textarea: langsung sediakan blok teks di bawahnya.
                  const r = insertAfter(next, id, 'text');
                  if (r) commit(r.blocks, r.focus);
                  else commit(next);
                } else {
                  commit(next, { id, offset: 0 });
                }
                return;
              }
              setBlocks(updateBlockText(blocks, id, text));
              dirtyRef.current = true;
            },
            onSplit: (id, offset) => {
              const r = splitBlock(blocks, id, offset);
              if (r) commit(r.blocks, r.focus);
            },
            onIndent: (id, offset) => {
              const r = indentBlock(blocks, id, offset);
              if (r) commit(r.blocks, r.focus);
            },
            onOutdent: (id, offset) => {
              const r = outdentBlock(blocks, id, offset);
              if (r) commit(r.blocks, r.focus);
            },
            onBackspace: (id) => {
              const b = getBlock(blocks, id);
              if (!b) return;
              if (b.text === '') {
                const r = deleteEmptyBlock(blocks, id);
                if (r) commit(r.blocks, r.focus ?? undefined);
              } else {
                const r = mergeUp(blocks, id);
                if (r) commit(r.blocks, r.focus);
              }
            },
            onMoveUp: (id, offset) => {
              moveFocus(id, offset, -1);
            },
            onMoveDown: (id, offset) => {
              moveFocus(id, offset, 1);
            },
            onToggleCheck: (id) => {
              setBlocks(toggleBlockChecked(blocks, id));
              dirtyRef.current = true;
            },
            onToggleCollapse: (id) => {
              setBlocks(toggleBlockCollapsed(blocks, id));
              dirtyRef.current = true;
            },
            onInsertAfter: (id, type: NoteBlockType) => {
              const r = insertAfter(blocks, id, type);
              if (r) commit(r.blocks, r.focus);
            },
            onRemovePointer: (id) => handleRemovePointer(id),
            onRemoveBlock: (id) => handleRemoveBlock(id),
            onSlash: (id) => openSlash(id),
          }}
        />
        {slash && (
          <SlashMenu
            anchor={slash.anchor}
            busy={creatingChild}
            onSelect={selectSlashCommand}
            onClose={() => closeSlash(true)}
          />
        )}
      </div>
      <HeadingOutline items={outline} onJump={jumpToHeading} />
      <ConfirmModal
        open={confirmOpen}
        title={`Pindahkan tab "${note.title}" ke Sampah?`}
        message="Bisa dikembalikan lagi dari Sampah."
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

export default function NotePage() {
  return (
    <UndoStackProvider>
      <NotePageInner />
    </UndoStackProvider>
  );
}
