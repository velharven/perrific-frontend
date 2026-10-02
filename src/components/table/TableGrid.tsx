import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Maximize2 } from 'lucide-react';
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
import type { TableColumn, TableRow } from '@/types';
import type { TableDataState } from './useTableData';
import SortableTh from './SortableTh';
import SortableRow from './SortableRow';
import ColumnMenu from './ColumnMenu';
import PersonCell from './PersonCell';
import {
  ActivityIcon,
  CheckIcon,
  CopyIcon,
  DEFAULT_CATEGORY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
  TableColumnIcon,
  TrashIcon,
  getCategoryBadgeStyle,
  getStatusBadgeStyle,
} from '@/components/icons';
import { showToast } from '@/components/ui/Toast';

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

function TableGridPhoneCell({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const rawStr = value.trim();
  const [draft, setDraft] = useState(rawStr);

  useEffect(() => {
    setDraft(rawStr);
  }, [rawStr]);

  function handleCopy(e: React.MouseEvent) {
    e.stopPropagation();
    if (!rawStr) return;
    void navigator.clipboard.writeText(rawStr).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
      showToast('Nomor telepon disalin');
    });
  }

  function handleBlur() {
    setIsEditing(false);
    const next = draft.trim();
    if (next !== rawStr) {
      onChange(next);
    }
  }

  return (
    <div className="group/phone relative flex w-full min-w-0 items-center justify-between gap-1">
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <TableColumnIcon type="PHONE" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        {isEditing ? (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleBlur}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleBlur();
              if (e.key === 'Escape') {
                setDraft(rawStr);
                setIsEditing(false);
              }
            }}
            onClick={(e) => e.stopPropagation()}
            placeholder="Nomor telepon..."
            className="w-full min-w-0 rounded border border-orange-300 bg-white px-1.5 py-0.5 text-xs text-gray-800 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            title={rawStr ? `${rawStr} — klik untuk ubah` : 'Klik untuk isi telepon'}
            className={`min-w-0 flex-1 truncate rounded px-1 py-0.5 text-left text-xs transition hover:bg-gray-100 ${
              rawStr ? 'text-gray-800' : 'text-gray-300'
            }`}
          >
            {rawStr || '—'}
          </button>
        )}
      </div>
      {rawStr && !isEditing && (
        <button
          type="button"
          onClick={handleCopy}
          title={copied ? 'Tersalin!' : 'Salin nomor telepon'}
          aria-label="Salin nomor telepon"
          className="shrink-0 rounded p-1 text-gray-400 opacity-0 transition hover:bg-gray-200/80 hover:text-gray-700 focus:opacity-100 group-hover/phone:opacity-100"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <CopyIcon className="h-3.5 w-3.5" />
          )}
        </button>
      )}
    </div>
  );
}

function TableGridCell({
  row,
  col,
  t,
}: {
  row: TableRow;
  col: TableColumn;
  t: TableDataState;
}) {
  const val = row.values[col.id];
  const strVal = val === null || val === undefined ? '' : String(val);

  if (col.type === 'CHECKBOX') {
    return (
      <input
        type="checkbox"
        checked={Boolean(val)}
        onChange={(e) => t.changeCell(row.id, col, e.target.checked)}
        className="h-3.5 w-3.5 rounded border-gray-300 text-orange-600"
      />
    );
  }

  if (col.type === 'SELECT') {
    return (
      <select
        value={strVal}
        onChange={(e) => t.changeCell(row.id, col, e.target.value)}
        className="w-full bg-transparent text-xs text-gray-700 focus:outline-none"
      >
        <option value="">—</option>
        {col.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (col.type === 'STATUS') {
    const current = strVal || 'Belum Mulai';
    const style = getStatusBadgeStyle(current);
    const opts = col.options && col.options.length > 0 ? col.options : DEFAULT_STATUS_OPTIONS;
    return (
      <div className="relative inline-flex items-center">
        <select
          value={current}
          onChange={(e) => t.changeCell(row.id, col, e.target.value)}
          className={`appearance-none rounded-md px-2 py-0.5 pr-5 text-xs font-medium cursor-pointer transition focus:outline-none ${style.bg} ${style.text}`}
        >
          {opts.map((opt) => (
            <option key={opt} value={opt} className="bg-white text-gray-800">
              {opt}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-1.5 text-[9px] opacity-60">▾</span>
      </div>
    );
  }

  if (col.type === 'CATEGORY') {
    const current = strVal || '';
    const style = getCategoryBadgeStyle(current);
    const opts = col.options && col.options.length > 0 ? col.options : DEFAULT_CATEGORY_OPTIONS;
    return (
      <div className="relative inline-flex items-center">
        <select
          value={current}
          onChange={(e) => t.changeCell(row.id, col, e.target.value)}
          className={`appearance-none rounded-md px-2 py-0.5 pr-5 text-xs font-medium cursor-pointer transition focus:outline-none ${style.bg} ${style.text}`}
        >
          <option value="" className="bg-white text-gray-500">—</option>
          {opts.map((opt) => (
            <option key={opt} value={opt} className="bg-white text-gray-800">
              {opt}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-1.5 text-[9px] opacity-60">▾</span>
      </div>
    );
  }

  if (col.type === 'START_TIME' || col.type === 'END_TIME') {
    return (
      <div className="flex w-full items-center gap-1.5">
        <TableColumnIcon type={col.type} className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          type="time"
          value={strVal}
          onChange={(e) => t.changeCell(row.id, col, e.target.value)}
          className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gray-700 hover:border-gray-200 focus:border-orange-300 focus:bg-white focus:outline-none"
        />
      </div>
    );
  }

  if (col.type === 'PERSON') {
    return (
      <PersonCell
        value={strVal || null}
        onChange={(val) => t.changeCell(row.id, col, val ?? '')}
      />
    );
  }

  if (col.type === 'FILES') {
    const isUrl = /^https?:\/\//i.test(strVal.trim());
    return (
      <div className="flex w-full items-center gap-1.5">
        <TableColumnIcon type="FILES" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          type="text"
          value={strVal}
          onChange={(e) => t.changeCell(row.id, col, e.target.value)}
          placeholder="File / tautan..."
          className="w-full min-w-0 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
        />
        {isUrl && (
          <a
            href={strVal.trim()}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka tautan file"
            className="shrink-0 text-xs text-gray-400 transition hover:text-perrific-violet"
          >
            ↗
          </a>
        )}
      </div>
    );
  }

  if (col.type === 'URL') {
    const href = strVal ? (/^https?:\/\//i.test(strVal) ? strVal : `https://${strVal}`) : '';
    return (
      <div className="flex w-full items-center gap-1.5">
        <TableColumnIcon type="URL" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          type="url"
          value={strVal}
          onChange={(e) => t.changeCell(row.id, col, e.target.value)}
          placeholder="https://..."
          className="w-full min-w-0 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
        />
        {href && (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            title="Buka tautan"
            className="shrink-0 text-xs text-gray-400 transition hover:text-perrific-violet"
          >
            ↗
          </a>
        )}
      </div>
    );
  }

  if (col.type === 'PHONE') {
    return (
      <TableGridPhoneCell
        value={strVal}
        onChange={(val) => t.changeCell(row.id, col, val)}
      />
    );
  }

  if (col.type === 'EMAIL') {
    return (
      <div className="flex w-full items-center gap-1.5">
        <TableColumnIcon type="EMAIL" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          type="email"
          value={strVal}
          onChange={(e) => t.changeCell(row.id, col, e.target.value)}
          placeholder="Email..."
          className="w-full min-w-0 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
        />
        {strVal && (
          <a
            href={`mailto:${strVal}`}
            title="Kirim email"
            className="shrink-0 text-xs text-gray-400 transition hover:text-perrific-violet"
          >
            ↗
          </a>
        )}
      </div>
    );
  }

  if (col.type === 'NUMBER') {
    return (
      <input
        type="number"
        value={strVal}
        onChange={(e) => t.changeCell(row.id, col, e.target.value)}
        placeholder="—"
        className="w-full min-w-0 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
      />
    );
  }

  if (col.type === 'DATE') {
    return (
      <input
        type="date"
        value={strVal}
        onChange={(e) => t.changeCell(row.id, col, e.target.value)}
        className="w-full min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none"
      />
    );
  }

  // TEXT
  return (
    <input
      type="text"
      value={strVal}
      onChange={(e) => t.changeCell(row.id, col, e.target.value)}
      placeholder="—"
      className="w-full min-w-0 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
    />
  );
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
          className={`absolute left-0 z-30 flex items-center gap-1 rounded-lg border border-gray-200 bg-white py-1 pl-3 pr-1 font-manrope text-xs font-semibold text-perrific-graphite shadow-[0_8px_24px_rgba(26,26,30,0.14)] ${hideToolbar ? '-top-9' : 'top-0'}`}
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
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite cursor-pointer"
          >
            <Maximize2 size={14} strokeWidth={1.6} aria-hidden="true" />
          </button>
        )}
        <button
          type="button"
          onClick={handleAddInline}
          className="shrink-0 rounded-lg bg-perrific-violet px-3 py-1.5 font-manrope text-xs font-semibold text-white transition hover:brightness-110"
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
                      <span className="min-w-0 flex-1 truncate font-manrope font-semibold text-perrific-graphite">
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
                  <td key={col.id} className="min-w-[170px] border-b border-l border-gray-200 p-1.5">
                    <TableGridCell row={row} col={col} t={t} />
                  </td>
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
                  className="flex w-full items-center gap-1.5 px-3 py-2 text-left font-manrope text-sm text-gray-400 transition hover:bg-gray-50 hover:text-perrific-violet"
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
