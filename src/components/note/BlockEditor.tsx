import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDndContext,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import DropIndicator from '@/components/layout/DropIndicator';
import EmbeddedTable from '@/components/table/EmbeddedTable';
import { TABLE_ADD_EVENT } from '@/components/table/TableGrid';
import type { BlockFocus, DropHint, NoteBlock, NoteBlockType } from './noteBlocks';
import { getBlock, getDropHint } from './noteBlocks';

export interface BlockFocusReq extends BlockFocus {
  nonce: number;
}

// Target pointer subhalaman yang masih bisa dibuka. null = sembunyikan
// barisnya (terhapus/terarsip/tersampah) tapi datanya dipertahankan.
export interface PageTarget {
  title: string;
  to: string;
  table: boolean;
}

interface RowHandlers {
  onText: (id: string, text: string) => void;
  onSplit: (id: string, offset: number) => void;
  onIndent: (id: string, offset: number) => void;
  onOutdent: (id: string, offset: number) => void;
  onBackspace: (id: string, offset: number) => void;
  onMoveUp: (id: string, offset: number) => void;
  onMoveDown: (id: string, offset: number) => void;
  onToggleCheck: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onInsertAfter: (id: string, type: NoteBlockType) => void;
  onRemovePointer: (id: string) => void;
  onRemoveBlock: (id: string) => void;
  onSlash: (id: string) => void;
}

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

function PageIcon({ table, className }: { table: boolean; className?: string }) {
  return table ? (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className ?? 'shrink-0 text-gray-400'}>
      <rect x="2.5" y="3.5" width="11" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 6.5h11M7 6.5v6" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className ?? 'shrink-0 text-gray-400'}>
      <path d="M4 2.5h5.5L12.5 5.5V13.5H4V2.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M9.5 2.5v3h3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function HoverCluster({
  onPlus,
  activator,
}: {
  onPlus: () => void;
  activator: { setActivatorNodeRef: (el: HTMLElement | null) => void; attributes: object; listeners: object | undefined };
}) {
  return (
    <span className="flex shrink-0 items-center gap-0.5 pt-0.5 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100 max-sm:opacity-100">
      <button
        type="button"
        onClick={onPlus}
        title="Tambah blok teks di bawah"
        aria-label="Tambah blok teks di bawah"
        className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>
      <button
        type="button"
        ref={activator.setActivatorNodeRef}
        {...activator.attributes}
        {...activator.listeners}
        title="Seret untuk memindahkan"
        aria-label="Seret untuk memindahkan blok"
        className="flex h-6 w-6 cursor-grab items-center justify-center rounded-md text-gray-300 transition hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
      >
        <svg width="10" height="14" viewBox="0 0 10 14" fill="none" aria-hidden="true">
          <circle cx="3" cy="2.5" r="1.2" fill="currentColor" />
          <circle cx="7" cy="2.5" r="1.2" fill="currentColor" />
          <circle cx="3" cy="7" r="1.2" fill="currentColor" />
          <circle cx="7" cy="7" r="1.2" fill="currentColor" />
          <circle cx="3" cy="11.5" r="1.2" fill="currentColor" />
          <circle cx="7" cy="11.5" r="1.2" fill="currentColor" />
        </svg>
      </button>
    </span>
  );
}

function BlockRow({
  block,
  register,
  pageOf,
  hint,
  h,
}: {
  block: NoteBlock;
  register: (id: string, el: HTMLTextAreaElement | null) => void;
  pageOf: (pageId: string) => PageTarget | null;
  hint: DropHint | null;
  h: RowHandlers;
}) {
  // Baris sengaja TIDAK memakai transform dnd-kit: selama seret semua diam
  // di tempat (indikator garis/tint yang bicara). Kloningan ikut kursor
  // dirender sekali di DragOverlay.
  const { setNodeRef, setActivatorNodeRef, attributes, listeners, isDragging } =
    useSortable({ id: block.id });
  const activator = { setActivatorNodeRef, attributes, listeners };
  const mine = hint?.id === block.id;
  const nestTint = mine && hint.pos === 'nest' ? ' rounded-lg bg-perrific-violet/10' : '';
  const lineBefore = mine && hint.pos === 'before' ? <DropIndicator /> : null;
  const lineAfter = mine && hint.pos === 'after' ? <DropIndicator /> : null;
  // Lipat/buka embed tabel (session-local, tak disimpan).
  const [tableOpen, setTableOpen] = useState(true);

  if (block.type === 'page' && block.pageId) {
    const target = pageOf(block.pageId);
    const pageId = block.pageId;
    return (
      <>
        {lineBefore}
      <div
        ref={setNodeRef}
        style={{ opacity: isDragging ? 0.4 : undefined }}
        className={`group${nestTint}`}
      >
        <div className="flex items-center gap-0.5">
          {target?.table ? (
            <button
              type="button"
              onClick={() => setTableOpen((v) => !v)}
              title={tableOpen ? 'Lipat tabel' : 'Buka tabel'}
              aria-label={tableOpen ? 'Lipat tabel' : 'Buka tabel'}
              aria-expanded={tableOpen}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className={`transition-transform duration-150 ${tableOpen ? '' : '-rotate-90'}`}
              >
                <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <span className="w-6 shrink-0" aria-hidden="true" />
          )}
          <HoverCluster onPlus={() => h.onInsertAfter(block.id, 'text')} activator={activator} />
          {target ? (
            <Link
              to={target.to}
              title={target.title}
              onKeyDown={(e) => {
                if (e.key === 'Backspace') {
                  e.preventDefault();
                  h.onRemovePointer(block.id);
                }
              }}
              className="group/link flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-[3px] focus:outline-none"
            >
              <PageIcon table={target.table} />
              <span className="min-w-0 truncate font-givonic text-[15px] text-perrific-graphite group-hover/link:underline">
                {target.title}
              </span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="shrink-0 text-perrific-violet opacity-0 transition group-hover:opacity-100 group-hover/link:opacity-100">
                <path d="M4.5 11.5L11.5 4.5M7 4.5h4.5V9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          ) : (
            <span className="flex min-w-0 flex-1 items-center gap-1.5 px-1 py-[3px]" title="Halaman tidak tersedia">
              <PageIcon table={false} className="shrink-0 text-gray-300" />
              <span className="min-w-0 flex-1 truncate font-givonic text-[15px] text-gray-300">
                {block.text || 'Halaman tidak tersedia'}
              </span>
            </span>
          )}
          {target?.table && (
            <>
              <button
                type="button"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent<{ tableId: string }>(TABLE_ADD_EVENT, {
                      detail: { tableId: block.pageId as string },
                    }),
                  )
                }
                className="shrink-0 rounded-lg bg-perrific-violet px-2.5 py-1 font-givonic text-[11px] font-semibold text-white transition hover:brightness-110"
              >
                Baru
              </button>
              <Link
                to={target.to}
                title="Buka penuh"
                aria-label="Buka penuh"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => h.onRemovePointer(block.id)}
            title={target?.table ? 'Hapus tabel ke Sampah (bisa diurungkan)' : 'Lepas subhalaman dari sini (halamannya tetap ada)'}
            aria-label={target?.table ? 'Hapus tabel ke Sampah' : 'Lepas subhalaman dari sini'}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 opacity-0 transition hover:bg-gray-100 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
          >
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {target?.table && tableOpen && (
          <div className="mb-1 mt-1.5">
            <EmbeddedTable noteId={pageId} />
          </div>
        )}
        {lineAfter}
      </div>
    </>
    );
  }

  if (block.type === 'divider') {
    return (
      <>
        {lineBefore}
        <div ref={setNodeRef} style={{ opacity: isDragging ? 0.4 : undefined }} className={`group${nestTint}`}>
          <div className="flex items-center gap-0.5">
            <HoverCluster onPlus={() => h.onInsertAfter(block.id, 'text')} activator={activator} />
            <div
              role="separator"
              aria-label="Pembatas"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' || e.key === 'Delete') {
                  e.preventDefault();
                  h.onBackspace(block.id, 0);
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  h.onInsertAfter(block.id, 'text');
                }
              }}
              className="flex min-w-0 flex-1 cursor-default items-center rounded-md px-1 py-2.5 focus:bg-gray-50 focus:outline-none"
            >
              <span aria-hidden="true" className="h-px w-full bg-gray-200" />
            </div>
            <button
              type="button"
              onClick={() => h.onRemoveBlock(block.id)}
              title="Hapus pembatas"
              aria-label="Hapus pembatas"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-300 opacity-0 transition hover:bg-gray-100 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
            >
              <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          {lineAfter}
        </div>
      </>
    );
  }

  return (
    <>
      {lineBefore}
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : undefined }}
      className={`group${nestTint}`}
    >
      <div className="flex items-start gap-0.5">
        <HoverCluster onPlus={() => h.onInsertAfter(block.id, 'text')} activator={activator} />
        <span className="flex h-7 w-6 shrink-0 items-center justify-center">
          {block.type === 'toggle' ? (
            <button
              type="button"
              onClick={() => h.onToggleCollapse(block.id)}
              title={block.collapsed ? 'Buka' : 'Lipat'}
              aria-label={block.collapsed ? 'Buka blok' : 'Lipat blok'}
              aria-expanded={!block.collapsed}
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 16 16"
                fill="none"
                aria-hidden="true"
                className={`transition-transform duration-150 ${block.collapsed ? '-rotate-90' : ''}`}
              >
                <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : block.type === 'todo' ? (
            <button
              type="button"
              role="checkbox"
              aria-checked={!!block.checked}
              aria-label={block.checked ? 'Tandai belum selesai' : 'Tandai selesai'}
              onClick={() => h.onToggleCheck(block.id)}
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] border transition ${
                block.checked
                  ? 'border-perrific-violet bg-perrific-violet text-white'
                  : 'border-gray-300 bg-white hover:border-perrific-violet'
              }`}
            >
              {block.checked && (
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M4 8l2.5 2.5L12 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ) : block.type === 'bullet' ? (
            <span aria-hidden="true" className="font-givonic text-[15px] leading-none text-perrific-graphite">
              •
            </span>
          ) : block.type === 'number' ? (
            <span aria-hidden="true" className="note-num font-givonic text-[15px] text-perrific-graphite" />
          ) : null}
        </span>
        <textarea
          ref={(el) => {
            register(block.id, el);
            autoGrow(el);
          }}
          value={block.text}
          rows={1}
          data-block-id={block.id}
          aria-label={
            block.type === 'todo'
              ? 'Isi to-do'
              : block.type === 'toggle'
                ? 'Judul toggle'
                : block.type === 'h1'
                  ? 'Judul 1'
                  : block.type === 'h2'
                    ? 'Judul 2'
                    : block.type === 'h3'
                      ? 'Judul 3'
                      : block.type === 'bullet'
                        ? 'Butir daftar'
                        : block.type === 'number'
                          ? 'Butir bernomor'
                          : 'Isi blok'
          }
          placeholder={
            block.type === 'todo'
              ? 'To-do…'
              : block.type === 'toggle'
                ? 'Toggle…'
                : block.type === 'h1'
                  ? 'Judul 1…'
                  : block.type === 'h2'
                    ? 'Judul 2…'
                    : block.type === 'h3'
                      ? 'Judul 3…'
                      : block.type === 'bullet'
                        ? 'Daftar…'
                        : block.type === 'number'
                          ? 'Daftar bernomor…'
                          : "Tekan '/' untuk perintah"
          }
          onChange={(e) => {
            h.onText(block.id, e.target.value);
            autoGrow(e.target);
          }}
          onKeyDown={(e) => {
            const el = e.currentTarget;
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              h.onSplit(block.id, el.selectionStart);
            } else if (e.key === 'Tab') {
              e.preventDefault();
              if (e.shiftKey) h.onOutdent(block.id, el.selectionStart);
              else h.onIndent(block.id, el.selectionStart);
            } else if (e.key === 'Backspace' && el.selectionStart === 0 && el.selectionEnd === 0) {
              e.preventDefault();
              h.onBackspace(block.id, 0);
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
              // Blok normalnya satu baris; teks multiline (hasil paste) tetap
              // memakai navigasi native kecuali di batas atas/bawah teks.
              const value = el.value;
              const pos = el.selectionStart;
              const firstBreak = value.indexOf('\n');
              const lastBreak = value.lastIndexOf('\n');
              const atTop = firstBreak === -1 || pos <= firstBreak;
              const atBottom = lastBreak === -1 || pos > lastBreak;
              if ((e.key === 'ArrowUp' && atTop) || (e.key === 'ArrowDown' && atBottom)) {
                e.preventDefault();
                if (e.key === 'ArrowUp') h.onMoveUp(block.id, pos);
                else h.onMoveDown(block.id, pos);
              }
            } else if (e.key === '/') {
              const start = el.selectionStart;
              const lineStart = block.text.lastIndexOf('\n', start - 1) + 1;
              if (block.text.slice(lineStart, start).trim() === '') {
                // Biarkan '/' masuk teks (tetap terlihat), buka menu se-tick
                // agar DOM + kursor sudah mutakhir saat posisi diukur.
                const id = block.id;
                window.setTimeout(() => h.onSlash(id), 0);
              }
            }
          }}
          className={`note-block-input min-w-0 flex-1 resize-none overflow-hidden bg-transparent py-[3px] font-givonic leading-relaxed focus:outline-none ${
            block.type === 'todo' && block.checked
              ? 'text-[15px] text-perrific-graphite/40 line-through'
              : block.type === 'toggle'
                ? 'text-[15px] font-medium text-perrific-graphite'
                : block.type === 'h1'
                  ? 'text-2xl font-extrabold tracking-tight text-perrific-graphite'
                  : block.type === 'h2'
                    ? 'text-xl font-bold tracking-tight text-perrific-graphite'
                    : block.type === 'h3'
                      ? 'text-[17px] font-semibold text-perrific-graphite'
                      : 'text-[15px] text-perrific-graphite'
          } placeholder:text-perrific-graphite/30`}
        />
        <button
          type="button"
          onClick={() => h.onRemoveBlock(block.id)}
          title="Hapus blok"
          aria-label="Hapus blok"
          className="flex h-6 w-6 shrink-0 items-center justify-center self-start rounded-md text-gray-300 opacity-0 transition hover:bg-gray-100 hover:text-red-500 focus:opacity-100 group-hover:opacity-100 max-sm:opacity-100"
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      {lineAfter}
    </div>
    </>
  );
}

// Baris di-memo: selama seret dnd, hanya baris yang berubah yang render ulang.
const MemoBlockRow = memo(BlockRow);

// Baris petunjuk toggle kosong ala Notion: diklik → anak pertama,
// diseret blok ke atasnya → anak baru. Zona drop id `inner:<parentId>`.
function EmptyToggleHint({
  parentId,
  onAppendChild,
}: {
  parentId: string;
  onAppendChild: (parentId: string) => void;
}) {
  const { setNodeRef } = useDroppable({ id: `inner:${parentId}` });
  const { over } = useDndContext();
  const isOver = over?.id === `inner:${parentId}`;
  return (
    <div className="pl-6">
      <div
        ref={setNodeRef}
        className={`rounded-md transition ${isOver ? 'bg-perrific-violet/10' : ''}`}
      >
        <button
          type="button"
          onClick={() => onAppendChild(parentId)}
          // Sejajar teks judul toggle di atas: 84px (gagang 52 + gap 8 + slot 24)
          // dikurangi indent anak pl-6 (24px) = 60px.
          className="w-full rounded-md py-1.5 pl-[60px] pr-2 text-left font-givonic text-[13px] text-gray-400 transition hover:bg-gray-50 hover:text-gray-500"
        >
          Tombol kosong. Klik atau letakkan blok di dalamnya.
        </button>
      </div>
    </div>
  );
}

function LevelList({
  blocks,
  register,
  pageOf,
  hint,
  h,
  onAppendChild,
}: {
  blocks: NoteBlock[];
  register: (id: string, el: HTMLTextAreaElement | null) => void;
  pageOf: (pageId: string) => PageTarget | null;
  hint: DropHint | null;
  h: RowHandlers;
  onAppendChild: (parentId: string) => void;
}) {
  return (
    <SortableContext items={blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
      <div className="note-level space-y-0.5">
        {blocks.map((b) => (
          <div key={b.id}>
            <MemoBlockRow block={b} register={register} pageOf={pageOf} hint={hint} h={h} />
            {(b.type !== 'toggle' || !b.collapsed) &&
              (b.children.length > 0 ? (
                <div className="pl-6">
                  <LevelList
                    blocks={b.children}
                    register={register}
                    pageOf={pageOf}
                    hint={hint}
                    h={h}
                    onAppendChild={onAppendChild}
                  />
                </div>
              ) : (
                b.type === 'toggle' && <EmptyToggleHint parentId={b.id} onAppendChild={onAppendChild} />
              ))}
          </div>
        ))}
      </div>
    </SortableContext>
  );
}

export default function NoteBlocks({
  blocks,
  focusReq,
  onDrop,
  onMoveCross,
  onAppend,
  onAppendChild,
  pageOf,
  h,
}: {
  blocks: NoteBlock[];
  focusReq: BlockFocusReq | null;
  onDrop: (activeId: string, overId: string, frac: number | null) => void;
  onMoveCross: (activeId: string, newParentId: string) => void;
  onAppend: () => void;
  onAppendChild: (parentId: string) => void;
  pageOf: (pageId: string) => PageTarget | null;
  h: RowHandlers;
}) {
  const inputRefs = useRef(new Map<string, HTMLTextAreaElement>());
  // Status seret untuk indikator drop (garis selip / tint sarang).
  // rect = kotak baris target saat hover; py = posisi pointer terakhir.
  const [drag, setDrag] = useState<{
    activeId: string;
    overId: string | null;
    rect: { top: number; height: number } | null;
    py: number | null;
  } | null>(null);
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Lacak posisi pointer selama seret (penentu zona atas/tengah/bawah).
  // Hanya set state bila berubah agar tak banjir render.
  useEffect(() => {
    if (!drag) return;
    function onMove(e: PointerEvent) {
      pointerRef.current = { x: e.clientX, y: e.clientY };
      setDrag((prev) => (prev && prev.py !== e.clientY ? { ...prev, py: e.clientY } : prev));
    }
    window.addEventListener('pointermove', onMove);
    return () => window.removeEventListener('pointermove', onMove);
  }, [!!drag]);

  // Stabil agar MemoBlockRow tak render ulang tanpa perlu.
  const register = useCallback((id: string, el: HTMLTextAreaElement | null) => {
    if (el) inputRefs.current.set(id, el);
    else inputRefs.current.delete(id);
  }, []);

  useEffect(() => {
    if (!focusReq) return;
    const el = inputRefs.current.get(focusReq.id);
    if (!el) return;
    el.focus();
    const at = Math.max(0, Math.min(focusReq.offset, el.value.length));
    el.setSelectionRange(at, at);
    autoGrow(el);
  }, [focusReq]);

  // Fraksi pointer 0–1 dalam tinggi baris target; null = tak diketahui.
  function fracOf(rect: { top: number; height: number } | undefined, py: number | null): number | null {
    if (!rect || rect.height <= 0 || py === null) return null;
    return (py - rect.top) / rect.height;
  }

  function handleDragStart(event: DragStartEvent) {
    setDrag({ activeId: String(event.active.id), overId: null, rect: null, py: null });
  }

  function handleDragOver(event: DragOverEvent) {
    const id = event.over ? String(event.over.id) : null;
    const rect = event.over ? { top: event.over.rect.top, height: event.over.rect.height } : null;
    setDrag((prev) => {
      if (!prev) return prev;
      if (
        prev.overId === id &&
        prev.rect?.top === rect?.top &&
        prev.rect?.height === rect?.height
      ) {
        return prev;
      }
      return { ...prev, overId: id, rect };
    });
  }

  function handleDragCancel() {
    pointerRef.current = null;
    setDrag(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const py = pointerRef.current?.y ?? null;
    pointerRef.current = null;
    setDrag(null);
    if (!over || active.id === over.id) return;
    const overId = String(over.id);
    // Zona `inner:*` = masukkan jadi anak; baris biasa = via onDrop + frac.
    if (overId.startsWith('inner:')) onMoveCross(String(active.id), overId.slice(6));
    else onDrop(String(active.id), overId, fracOf(over.rect, py));
  }

  const hint =
    drag && drag.overId && !drag.overId.startsWith('inner:')
      ? getDropHint(blocks, drag.activeId, drag.overId, fracOf(drag.rect ?? undefined, drag.py))
      : null;
  const dragBlock = drag ? getBlock(blocks, drag.activeId) : null;
  const dragTarget = dragBlock?.type === 'page' && dragBlock.pageId ? pageOf(dragBlock.pageId) : null;
  const dragLabel =
    dragTarget?.title ||
    dragBlock?.text ||
    (dragBlock?.type === 'divider'
      ? 'Pembatas'
      : dragBlock?.type === 'h1' || dragBlock?.type === 'h2' || dragBlock?.type === 'h3'
        ? 'Judul'
        : dragBlock?.type === 'bullet'
          ? 'Daftar'
          : dragBlock?.type === 'number'
            ? 'Daftar bernomor'
            : dragBlock?.type === 'toggle'
              ? 'Toggle'
              : dragBlock?.type === 'todo'
                ? 'To-do'
                : 'Blok kosong');

  if (blocks.length === 0) {
    return (
      <button
        type="button"
        onClick={onAppend}
        className="w-full rounded-lg border border-dashed border-gray-300 px-4 py-10 text-center font-givonic text-sm text-gray-400 transition hover:border-perrific-violet hover:text-perrific-violet"
      >
        Mulai menulis… (Enter = blok baru, Tab = masuk ke dalam)
      </button>
    );
  }

  return (
    <div
      onClick={(e) => {
        // Klik area kosong di sela blok → tambah blok baru di bawah.
        if (e.target === e.currentTarget) onAppend();
      }}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <LevelList blocks={blocks} register={register} pageOf={pageOf} hint={hint} h={h} onAppendChild={onAppendChild} />
        <DragOverlay adjustScale={false} dropAnimation={null}>
          {dragBlock ? (
            <div className="pointer-events-none max-w-xs truncate rounded-lg border border-gray-200 bg-white/95 px-3 py-2 font-givonic text-sm text-gray-600 shadow-[0_8px_24px_rgba(26,26,30,0.18)] backdrop-blur">
              {dragLabel}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
      {/* Ruang kosong di bawah isi: diklik → lanjut mengetik di blok baru. */}
      <div className="min-h-[30vh] cursor-text" onClick={onAppend} aria-hidden="true" />
    </div>
  );
}
