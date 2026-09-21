import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Modifier,
} from '@dnd-kit/core';
import { SortableContext, horizontalListSortingStrategy, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { TableDataState } from './useTableData';
import SortableTh from './SortableTh';
import SortableRow from './SortableRow';
import ColumnMenu from './ColumnMenu';
import { ActivityIcon, TableColumnIcon, TrashIcon } from '@/components/icons';

// Event minta tambah baris ke tabel tertentu (tombol Baru di baris pointer).
// Pola event jendela yang sudah dipakai app (notes/teams/toast).
export const TABLE_ADD_EVENT = 'purrific:table-add';

// Kunci sumbu drag per jenis item: baris (`row:*`) vertikal saja,
// header properti horizontal saja. Drop silang keduanya diabaikan.
const ROW_PREFIX = 'row:';
const lockDragAxis: Modifier = ({ active, transform }) =>
  String(active?.id ?? '').startsWith(ROW_PREFIX) ? { ...transform, x: 0 } : { ...transform, y: 0 };

// Jepit gerakan vertikal baris agar tak keluar dari badan tabel.
// Batas dihitung dari tinggi tbody aktual sehingga otomatis
// menyesuaikan banyaknya baris (bukan angka tetap).
function clampRowToTbody(
  tbody: HTMLTableSectionElement | null,
  activeNodeRect: { top: number; bottom: number; height: number } | null,
  transform: { x: number; y: number; scaleX: number; scaleY: number },
) {
  if (!tbody || !activeNodeRect) return transform;
  const body = tbody.getBoundingClientRect();
  const minY = body.top - activeNodeRect.top;
  const maxY = body.bottom - activeNodeRect.bottom;
  return { ...transform, y: Math.min(maxY, Math.max(minY, transform.y)) };
}

// Guard khusus hotkey seleksi: lebih sempit dari isUndoEditableTarget.
// Checkbox/radio/tombol bukan area ketikan (di-toggle pakai Spasi),
// jadi Delete/Escape tetap jalan saat fokus di sana.
function isHotkeyTextField(el: HTMLElement | null) {
  if (!el) return false;
  if (el.isContentEditable) return true;
  const tag = el.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return type !== 'checkbox' && type !== 'radio' && type !== 'button';
}

// Grid gaya database Notion: judul-kiri/toolbar-kanan + header properti +
// baris halaman + footer Halaman baru. Tanpa blok kartu putih.
// Dipakai identik di halaman penuh (dengan judul) dan embed (tanpa judul).
export default function TableGrid({
  t,
  titleNode,
  onOpenFull,
  tableId,
  hideToolbar,
}: {
  t: TableDataState;
  titleNode?: ReactNode;
  onOpenFull?: () => void;
  tableId?: string;
  hideToolbar?: boolean;
}) {
  const { columns, rows } = t;
  const [focusRowId, setFocusRowId] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLTableRowElement>());
  const tbodyRef = useRef<HTMLTableSectionElement | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // Klik sintetis tepat setelah drop harus diabaikan agar menu tak terbuka sendiri.
  const lastDragEndRef = useRef(0);

  function handleDragStart() {
    setMenu(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    lastDragEndRef.current = Date.now();
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);
    if (a.startsWith(ROW_PREFIX)) {
      if (!o.startsWith(ROW_PREFIX)) return;
      t.moveRowTo(a.slice(ROW_PREFIX.length), o.slice(ROW_PREFIX.length));
      return;
    }
    if (o.startsWith(ROW_PREFIX)) return;
    t.reorderColumns(a, o);
  }

  function openMenu(e: React.MouseEvent, colId: string) {
    if (Date.now() - lastDragEndRef.current < 300) return;
    const el = e.currentTarget as HTMLElement;
    const rect = el.closest('th')?.getBoundingClientRect() ?? el.getBoundingClientRect();
    setMenu({ id: colId, x: rect.left, y: rect.bottom + 4 });
  }

  useEffect(() => {
    if (!focusRowId) return;
    // Lewati gutter (checkbox seleksi): fokus sel data pertama.
    rowRefs.current
      .get(focusRowId)
      ?.querySelector<HTMLElement>('td:not(:first-child) input, td:not(:first-child) select')
      ?.focus();
    setFocusRowId(null);
  }, [focusRowId, rows.length]);

  // Checkbox utama: nyala bila semua baris ditandai.
  const selCount = t.selectedIds.length;
  const allSelected = rows.length > 0 && selCount >= rows.length;

  // Delete/Escape untuk seleksi via ref agar listener cukup dipasang sekali.
  const selKeyRef = useRef({ count: 0, menuOpen: false, remove: () => {}, clear: () => {} });
  selKeyRef.current = { count: selCount, menuOpen: menu !== null, remove: () => t.removeSelected(), clear: () => t.clearSelection() };
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const s = selKeyRef.current;
      if (s.count === 0 || s.menuOpen) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isHotkeyTextField(e.target as HTMLElement | null)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        s.remove();
        // Fokus bisa nyangkut di checkbox header (tak ikut terhapus) →
        // ring orange + Ctrl+Z ke-skip guard. Kembalikan ke body.
        const ae = document.activeElement;
        if (ae instanceof HTMLElement && rootRef.current?.contains(ae)) ae.blur();
      } else if (e.key === 'Escape') {
        s.clear();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  async function handleAddInline() {
    const id = await t.addInlineRow();
    if (id) setFocusRowId(id);
  }

  // Dengarkan tombol Baru dari baris pointer (embed): tambah + fokus di sini.
  const addRef = useRef<() => void>(() => {});
  addRef.current = () => {
    void handleAddInline();
  };
  useEffect(() => {
    if (!tableId) return;
    const fn = (e: Event) => {
      if ((e as CustomEvent<{ tableId: string }>).detail?.tableId === tableId) addRef.current();
    };
    window.addEventListener(TABLE_ADD_EVENT, fn);
    return () => window.removeEventListener(TABLE_ADD_EVENT, fn);
  }, [tableId]);

  return (
    <div ref={rootRef} className="relative space-y-2">
      {selCount > 0 && (
        <div
          role="status"
          aria-live="polite"
          className={`absolute left-0 z-30 flex items-center gap-1 rounded-lg border border-gray-200 bg-white py-1 pl-3 pr-1 font-givonic text-xs font-semibold text-perrific-graphite shadow-[0_8px_24px_rgba(26,26,30,0.14)] ${hideToolbar ? '-top-9' : 'top-0'}`}
        >
          <span>{selCount} dipilih</span>
          <span aria-hidden="true" className="mx-1 h-4 w-px bg-gray-200" />
          <button
            type="button"
            onClick={() => t.removeSelected()}
            title={`Hapus ${selCount} baris`}
            aria-label={`Hapus ${selCount} baris`}
            className="flex h-7 w-7 items-center justify-center rounded-md text-perrific-violet transition hover:bg-gray-100"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => t.clearSelection()}
            title="Opsi pilihan"
            aria-label="Batalkan pilihan"
            className="flex h-7 w-7 items-center justify-center rounded-md font-bold tracking-widest transition hover:bg-gray-100"
          >
            <span aria-hidden="true">...</span>
          </button>
        </div>
      )}
      {!hideToolbar && (
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">{titleNode}</div>
        {t.saving && (
          <span aria-live="polite" className="shrink-0 font-mono text-[11px] text-perrific-graphite/40">
            Menyimpan…
          </span>
        )}
        {onOpenFull && (
          <button
            type="button"
            onClick={onOpenFull}
            title="Buka penuh"
            aria-label="Buka penuh"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M9.5 2.5h4v4M13.5 2.5L9 7M6.5 13.5h-4v-4M2.5 13.5L7 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={handleAddInline}
          className="shrink-0 rounded-lg bg-perrific-violet px-3 py-1.5 font-givonic text-xs font-semibold text-white transition hover:brightness-110"
        >
          Baru
        </button>
      </div>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[lockDragAxis, ({ active, activeNodeRect, transform }) => (String(active?.id ?? '').startsWith(ROW_PREFIX) ? clampRowToTbody(tbodyRef.current, activeNodeRect, transform) : transform)]} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="overflow-x-auto">
        <table className="ml-10 min-w-[calc(100%_-_2.5rem)] border-collapse text-sm">
          <thead>
            <SortableContext items={columns.map((c) => c.id)} strategy={horizontalListSortingStrategy}>
            <tr className="group/row">
              <th className="w-10 border-b border-gray-200 p-1 text-center">
                <input
                  ref={(el) => {
                    if (el) el.indeterminate = selCount > 0 && !allSelected;
                  }}
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => t.toggleAll()}
                  title={allSelected ? 'Batalkan semua pilihan' : 'Pilih semua baris'}
                  aria-label={allSelected ? 'Batalkan semua pilihan' : 'Pilih semua baris'}
                  className={`h-3.5 w-3.5 accent-perrific-violet transition ${selCount > 0 ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 max-sm:opacity-100'}`}
                />
              </th>
              {columns.map((col) => (
                <SortableTh key={col.id} id={col.id}>
                    <button
                      type="button"
                      onClick={(e) => openMenu(e, col.id)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        openMenu(e, col.id);
                      }}
                      title={`${col.name} — klik untuk mengatur`}
                      aria-label={`Atur properti ${col.name}`}
                      aria-haspopup="menu"
                      className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-gray-50"
                    >
                      <span className="flex shrink-0 items-center">
                        {col.icon ? (
                          <ActivityIcon name={col.icon} className="h-4 w-4 text-gray-400" />
                        ) : (
                          <TableColumnIcon type={col.type} className="h-4 w-4 text-gray-400" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-givonic font-semibold text-perrific-graphite">
                        {col.name}
                      </span>
                    </button>
                </SortableTh>
              ))}
              <th className="w-12 border-b border-l border-gray-200 text-center">
                <button type="button" onClick={() => t.addColumn()} title="Tambah properti" aria-label="Tambah properti" className="px-1 text-lg leading-none text-gray-400 transition hover:text-perrific-violet">+</button>
              </th>
            </tr>
            </SortableContext>
          </thead>
          <tbody ref={tbodyRef}>
            <SortableContext items={rows.map((r) => `${ROW_PREFIX}${r.id}`)} strategy={verticalListSortingStrategy}>
            {rows.map((row) => (
              <SortableRow
                key={row.id}
                id={`${ROW_PREFIX}${row.id}`}
                ref={(el) => {
                  if (el) rowRefs.current.set(row.id, el);
                  else rowRefs.current.delete(row.id);
                }}
                className={t.selectedIds.includes(row.id) ? 'group/row bg-perrific-violet/[0.08] hover:bg-perrific-violet/[0.12]' : 'group/row hover:bg-gray-50/70'}
                beforeGrip={
                  <button
                    type="button"
                    onClick={() => t.addRowBelow(row.id)}
                    title="Tambah baris di bawah"
                    aria-label="Tambah baris di bawah"
                    className="absolute left-[-38px] top-1/2 -translate-y-1/2 shrink-0 px-0.5 text-base leading-none text-gray-300 opacity-0 transition hover:text-perrific-violet focus:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 max-sm:opacity-100"
                  >
                    +
                  </button>
                }
                gutter={
                  <input
                    type="checkbox"
                    checked={t.selectedIds.includes(row.id)}
                    onChange={() => t.toggleRow(row.id)}
                    aria-label="Pilih baris"
                    className={`h-3.5 w-3.5 shrink-0 accent-perrific-violet transition ${t.selectedIds.includes(row.id) ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover/row:opacity-100 group-focus-within/row:opacity-100 max-sm:opacity-100'}`}
                  />
                }
              >
                {columns.map((col) => (
                  <td key={col.id} className="min-w-[170px] border-b border-l border-gray-200 p-1.5">{col.type === 'SELECT' ? <select value={String(row.values[col.id] ?? '')} onChange={(e) => t.changeCell(row.id, col, e.target.value)} className="w-full bg-transparent focus:outline-none"><option value="" />{col.options.map((opt) => <option key={opt}>{opt}</option>)}</select> : col.type === 'CHECKBOX' ? <input type="checkbox" checked={Boolean(row.values[col.id])} onChange={(e) => t.changeCell(row.id, col, e.target.checked)} /> : <input type={col.type === 'NUMBER' ? 'number' : col.type === 'DATE' ? 'date' : 'text'} value={String(row.values[col.id] ?? '')} onChange={(e) => t.changeCell(row.id, col, e.target.value)} className="w-full bg-transparent focus:outline-none" />}</td>
                ))}
                <td aria-hidden="true" className="border-b border-gray-200" />
              </SortableRow>
            ))}
            </SortableContext>
            <tr>
              <td colSpan={columns.length + 2} className="p-0">
                <button
                  type="button"
                  onClick={handleAddInline}
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left font-givonic text-sm text-gray-400 transition hover:bg-gray-50 hover:text-perrific-violet"
                >
                  <span aria-hidden="true">+</span> Halaman baru
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </DndContext>
      {menu && (
        <ColumnMenu t={t} columnId={menu.id} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />
      )}
    </div>
  );
}
