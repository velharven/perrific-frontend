import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useLocation } from 'react-router-dom';
import { activityApi } from '@/api/activities';
import { ActivityIcon, TableColumnIcon, TrashIcon } from '@/components/icons';
import { showToast } from '@/components/ui/Toast';
import { UndoStackProvider, useUndo } from '@/hooks/useUndoStack';
import type { DailyActivity, DailyColumn, DailyColumnType } from '@/types';

// Helpers
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function formatHumanDay(d: Date): string {
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function combineDateAndTime(dateStr: string, timeStr: string): string | null {
  if (!timeStr) return null;
  const d = new Date(`${dateStr}T${timeStr}:00`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}
function toHHMM(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Pill properti gaya Notion
const TYPE_META: Record<DailyActivity['type'], { label: string; className: string }> = {
  TASK: { label: 'Task tim', className: 'bg-violet-100 text-violet-700' },
  BREAKDOWN: { label: 'Breakdown', className: 'bg-blue-100 text-blue-700' },
  CUSTOM: { label: 'Pribadi', className: 'bg-gray-100 text-gray-500' },
};

const STATUS_OPTIONS: { value: DailyActivity['status']; label: string; className: string }[] = [
  { value: 'PENDING', label: 'Belum Mulai', className: 'bg-amber-100 text-amber-700' },
  { value: 'COMPLETED', label: 'Selesai', className: 'bg-green-100 text-green-700' },
  { value: 'SKIPPED', label: 'Dilewati', className: 'bg-gray-100 text-gray-500' },
];

// Prefix id drag: baris (`row:`) hanya vertikal, header kolom (`col:`) hanya horizontal.
const ROW_PREFIX = 'row:';
const COL_PREFIX = 'col:';
const lockDragAxis: Modifier = ({ active, transform }) =>
  String(active?.id ?? '').startsWith(COL_PREFIX) ? { ...transform, y: 0 } : { ...transform, x: 0 };

// Baris tabel yang bisa diseret via handle titik-titik di LUAR tabel (id aktivitas).
// Grip + tombol + berada absolut di gutter kiri (pola TableGrid); checkbox di gutter hover-reveal.
function SortableRow({
  id,
  selected,
  checked,
  onToggleCheck,
  checkLabel,
  onAddBelow,
  children,
}: {
  id: string;
  selected?: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  checkLabel: string;
  onAddBelow: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  const anchorId = id.startsWith(ROW_PREFIX) ? id.slice(ROW_PREFIX.length) : id;
  return (
    <tr
      ref={setNodeRef}
      id={`activity-${anchorId}`}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
      }}
      className={`group scroll-mt-24 transition hover:bg-gray-50/70 ${selected ? 'bg-green-50/40' : ''}`}
    >
      <td className="relative w-10 whitespace-nowrap border-b border-gray-200 p-1">
        <span className="flex items-center justify-center">
          <button
            type="button"
            onClick={onAddBelow}
            title="Tambah baris di bawah"
            aria-label="Tambah baris di bawah"
            className="absolute left-[-38px] top-1/2 -translate-y-1/2 shrink-0 px-0.5 text-base leading-none text-gray-300 opacity-0 transition hover:text-violet-600 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100"
          >
            +
          </button>
          <span
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            role="button"
            tabIndex={0}
            title="Seret untuk memindahkan baris"
            aria-label="Seret untuk memindahkan baris"
            className="absolute left-[-20px] top-1/2 -translate-y-1/2 cursor-grab touch-none px-0.5 text-gray-300 opacity-0 transition hover:text-gray-500 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 active:cursor-grabbing max-sm:opacity-100"
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
          <input
            type="checkbox"
            checked={checked}
            onChange={onToggleCheck}
            aria-label={checkLabel}
            className={`h-3.5 w-3.5 shrink-0 rounded border-gray-300 text-violet-600 transition ${checked ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100'}`}
          />
        </span>
      </td>
      {children}
    </tr>
  );
}

// Header kolom yang bisa diseret horizontal (seluruh th jadi handle).
// Lebar dikendalikan colgroup (terukur/simpanan); tanpa width = auto.
function DraggableTh({
  id,
  entry,
  children,
}: {
  id: string;
  entry: string;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <th
      ref={setNodeRef}
      data-entry={entry}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
      }}
      title="Klik untuk mengatur • Seret untuk memindahkan"
      className="group cursor-grab whitespace-nowrap border-b border-l border-gray-200 p-2 text-left font-medium active:cursor-grabbing"
      {...attributes}
      {...listeners}
    >
      {children}
    </th>
  );
}

// Ikon + label tipe properti kustom
const COLUMN_TYPE_META: Record<DailyColumnType, { label: string }> = {
  TEXT: { label: 'Teks' },
  NUMBER: { label: 'Angka' },
  DATE: { label: 'Tanggal' },
  SELECT: { label: 'Pilihan' },
  CHECKBOX: { label: 'Centang' },
};

// Kolom bawaan (fixed) yang ikut bisa digeser. Entri urutan: `fix:<id>` atau id kolom kustom.
const FIXED_IDS = ['title', 'start', 'end', 'type', 'status'] as const;
type FixedId = (typeof FIXED_IDS)[number];
const fixKey = (id: FixedId) => `fix:${id}`;
const ORDER_KEY = 'daily-column-order-v1';

function mergeDisplayOrder(saved: string[], customs: DailyColumn[]): string[] {
  const fixedKeys = FIXED_IDS.map(fixKey);
  const customIds = customs.map((c) => c.id);
  const known = new Set([...fixedKeys, ...customIds]);
  const merged = saved.filter((id) => known.has(id));
  for (const id of [...fixedKeys, ...customIds]) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

const FIXED_TD_CLASS: Record<FixedId, string> = {
  title: 'border-b border-l border-gray-200 p-2',
  start: 'whitespace-nowrap border-b border-l border-gray-200 p-2 text-xs',
  end: 'whitespace-nowrap border-b border-l border-gray-200 p-2 text-xs',
  type: 'border-b border-l border-gray-200 p-2',
  status: 'border-b border-l border-gray-200 p-2',
};

// Sel nilai properti kustom: edit inline sesuai tipe kolom.
function CustomCell({
  activity,
  column,
  onCommit,
}: {
  activity: DailyActivity;
  column: DailyColumn;
  onCommit: (activity: DailyActivity, column: DailyColumn, value: string | number | boolean | null) => void;
}) {
  const raw = activity.customValues?.[column.id] ?? null;
  if (column.type === 'CHECKBOX') {
    return (
      <input
        type="checkbox"
        checked={raw === true}
        onChange={(e) => onCommit(activity, column, e.target.checked)}
        aria-label={`${column.name} ${activity.title}`}
        className="h-3.5 w-3.5 rounded border-gray-300 text-violet-600"
      />
    );
  }
  if (column.type === 'SELECT') {
    const opts = Array.isArray(column.options) ? column.options : [];
    return (
      <select
        value={typeof raw === 'string' ? raw : ''}
        onChange={(e) => onCommit(activity, column, e.target.value === '' ? null : e.target.value)}
        aria-label={`${column.name} ${activity.title}`}
        className="w-full min-w-0 max-w-full cursor-pointer truncate bg-transparent text-xs text-gray-700 focus:outline-none"
      >
        <option value="">—</option>
        {opts.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }
  if (column.type === 'DATE') {
    return (
      <input
        type="date"
        defaultValue={typeof raw === 'string' ? raw : ''}
        onBlur={(e) => {
          const v = e.target.value === '' ? null : e.target.value;
          const cur = typeof raw === 'string' ? raw : null;
          if (v !== cur) onCommit(activity, column, v);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
        }}
        aria-label={`${column.name} ${activity.title}`}
        className="w-full min-w-0 bg-transparent text-xs text-gray-700 focus:outline-none"
      />
    );
  }
  return (
    <input
      type={column.type === 'NUMBER' ? 'number' : 'text'}
      defaultValue={raw === null || typeof raw === 'boolean' ? '' : String(raw)}
      onBlur={(e) => {
        const text = e.target.value.trim();
        if (column.type === 'NUMBER') {
          if (text === '') {
            if (raw !== null) onCommit(activity, column, null);
            return;
          }
          const num = Number(text);
          if (!Number.isFinite(num) || num !== raw) {
            if (Number.isFinite(num)) onCommit(activity, column, num);
            else e.target.value = typeof raw === 'number' ? String(raw) : '';
          }
          return;
        }
        const next = text === '' ? null : text;
        const cur = typeof raw === 'string' ? raw : null;
        if (next !== cur) onCommit(activity, column, next);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
      }}
      aria-label={`${column.name} ${activity.title}`}
      placeholder="—"
      className="w-full min-w-0 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
    />
  );
}

// Menu pengaturan properti kustom (nama, tipe, opsi SELECT, pindah, hapus).
// Di-portal ke body dengan posisi fixed agar tak terpotong scroll tabel.
function ColumnMenu({
  column,
  x,
  y,
  isFirst,
  isLast,
  onRename,
  onChangeType,
  onSaveOptions,
  onMove,
  onDelete,
  onClose,
}: {
  column: DailyColumn;
  x: number;
  y: number;
  isFirst: boolean;
  isLast: boolean;
  onRename: (name: string) => void;
  onChangeType: (type: DailyColumnType) => void;
  onSaveOptions: (options: string[]) => void;
  onMove: (dir: -1 | 1) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(column.name);
  const [optionInput, setOptionInput] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const opts = Array.isArray(column.options) ? column.options : [];

  useEffect(() => {
    nameRef.current?.focus();
    nameRef.current?.select();
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) onClose();
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    function onScroll(e: Event) {
      if (rootRef.current && rootRef.current.contains(e.target as Node)) return;
      onClose();
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
    };
  }, [onClose]);

  // Jepit ke viewport agar tak keluar layar.
  const W = 240;
  const H = 420;
  const left = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  const top = y + H > window.innerHeight ? Math.max(8, y - H) : y;

  function commitName() {
    const next = name.trim();
    if (next && next !== column.name) onRename(next);
    else setName(column.name);
  }

  function addOption() {
    const next = optionInput.trim();
    if (!next || opts.includes(next)) return;
    onSaveOptions([...opts, next]);
    setOptionInput('');
  }

  return createPortal(
    <div
      ref={rootRef}
      role="menu"
      aria-label={`Atur properti ${column.name}`}
      className="fixed z-50 w-60 rounded-xl border border-gray-200 bg-white p-3 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
      style={{ left, top }}
    >
      <label className="mb-1 block text-[11px] font-medium text-gray-500">Nama properti</label>
      <input
        ref={nameRef}
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={commitName}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') onClose();
        }}
        className="mb-2 w-full rounded-md border border-gray-200 px-2 py-1.5 text-sm focus:border-violet-300 focus:outline-none"
      />
      <label className="mb-1 block text-[11px] font-medium text-gray-500">Tipe</label>
      <select
        value={column.type}
        onChange={(e) => onChangeType(e.target.value as DailyColumnType)}
        className="mb-2 w-full cursor-pointer rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm focus:outline-none"
      >
        {(Object.keys(COLUMN_TYPE_META) as DailyColumnType[]).map((t) => (
          <option key={t} value={t}>
            {COLUMN_TYPE_META[t].label}
          </option>
        ))}
      </select>
      {column.type === 'SELECT' && (
        <div className="mb-2">
          <p className="mb-1 text-[11px] font-medium text-gray-500">Pilihan</p>
          <div className="mb-1.5 flex flex-wrap gap-1">
            {opts.map((opt) => (
              <span key={opt} className="flex items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-700">
                {opt}
                <button
                  type="button"
                  onClick={() => onSaveOptions(opts.filter((o) => o !== opt))}
                  aria-label={`Hapus pilihan ${opt}`}
                  className="text-gray-400 hover:text-red-500"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-1.5">
            <input
              value={optionInput}
              onChange={(e) => setOptionInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addOption();
                }
              }}
              placeholder="Tambah pilihan…"
              className="min-w-0 flex-1 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs placeholder:text-gray-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={addOption}
              className="rounded-md bg-gray-900 px-2 py-1 text-xs text-white hover:bg-black"
            >
              +
            </button>
          </div>
        </div>
      )}
      <div className="mb-2 flex gap-1.5">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => onMove(-1)}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
        >
          ← Kiri
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => onMove(1)}
          className="flex-1 rounded-md border border-gray-200 px-2 py-1 text-xs hover:bg-gray-100 disabled:opacity-40"
        >
          Kanan →
        </button>
      </div>
      <button
        type="button"
        onClick={onDelete}
        className="w-full rounded-md border border-red-200 px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
      >
        Hapus properti
      </button>
    </div>,
    document.body,
  );
}

function DailyPageInner() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const dateISO = useMemo(() => toISODate(selectedDate), [selectedDate]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingTime, setEditingTime] = useState<{ id: string; field: 'start' | 'end' } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const location = useLocation();
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const { push, undoEntry } = useUndo();
  const [columns, setColumns] = useState<DailyColumn[]>([]);
  // Urutan tampil semua kolom (`fix:<id>` + id kustom). Sumber kebenaran urutan;
  // data kolom tetap di `columns` (lookup), server hanya simpan urutan kustom.
  const [order, setOrder] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem(ORDER_KEY);
      const arr: unknown = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const persistOrder = (next: string[]) => {
    setOrder(next);
    try {
      localStorage.setItem(ORDER_KEY, JSON.stringify(next));
    } catch {
      /* penyimpanan lokal penuh/diblokir — urutan sesi ini tetap jalan */
    }
  };
  const columnById = useMemo(() => new Map(columns.map((c) => [c.id, c])), [columns]);
  const displayOrder = useMemo(() => mergeDisplayOrder(order, columns), [order, columns]);
  const displayCustomIds = useMemo(() => displayOrder.filter((id) => !id.startsWith('fix:')), [displayOrder]);

  // Lebar kolom lokal-only (tidak disinkron): kunci entri `fix:<id>` / id kustom.
  const WIDTHS_KEY = 'daily-column-widths-v1';
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(WIDTHS_KEY);
      const obj: unknown = raw ? JSON.parse(raw) : {};
      if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
        const clean: Record<string, number> = {};
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (typeof v === 'number' && Number.isFinite(v) && v >= 40 && v <= 1200) clean[k] = Math.round(v);
        }
        return clean;
      }
      return {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(WIDTHS_KEY, JSON.stringify(widths));
    } catch {
      /* penyimpanan lokal penuh/diblokir — lebar sesi ini tetap jalan */
    }
  }, [widths]);
  const DEFAULT_COL_WIDTHS: Record<string, number> = {
    'fix:title': 280,
    'fix:start': 120,
    'fix:end': 120,
    'fix:type': 130,
    'fix:status': 140,
  };
  const DEFAULT_CUSTOM_WIDTH = 160;

  const widthOf = (entry: string) => widths[entry] ?? DEFAULT_COL_WIDTHS[entry] ?? DEFAULT_CUSTOM_WIDTH;
  function applyColumnWidth(entry: string, w: number) {
    setWidths((prev) => (prev[entry] === w ? prev : { ...prev, [entry]: w }));
  }
  // Seret tepi kanan header untuk ubah lebar; minimum = lebar teks header terukur.
  // Selama gestur, scroll dikunci (kiri dijamin diam, hanya kanan yang tumbuh).
  function beginColumnResize(e: React.PointerEvent, entry: string) {
    e.preventDefault();
    e.stopPropagation();
    const th = (e.currentTarget as HTMLElement).closest('th');
    const label = th?.querySelector('[data-col-label]') as HTMLElement | null;
    const liveW = label ? Math.ceil(label.scrollWidth) + 24 : 80;
    const minW = Math.max(48, measured[entry] ?? liveW);
    const startX = e.clientX;
    const startW = widthOf(entry) ?? measured[entry] ?? th?.getBoundingClientRect().width ?? minW;
    // Jepit semua scroller vertikal/horizontal di atas wrapper agar browser
    // (scroll-anchoring) tak ikut menggeser saat tabel tumbuh/menyusut.
    const wrap = tableWrapRef.current;
    const startWrapScroll = wrap?.scrollLeft ?? 0;
    const scrollers: { el: HTMLElement; left: number }[] = [];
    let p: HTMLElement | null = wrap?.parentElement ?? null;
    while (p) {
      if (p.scrollWidth > p.clientWidth + 1) scrollers.push({ el: p, left: p.scrollLeft });
      p = p.parentElement;
    }
    const pin = () => {
      if (wrap && wrap.scrollLeft !== startWrapScroll) wrap.scrollLeft = startWrapScroll;
      for (const s of scrollers) {
        if (s.el.scrollLeft !== s.left) s.el.scrollLeft = s.left;
      }
    };
    const move = (ev: PointerEvent) => {
      applyColumnWidth(entry, Math.max(minW, Math.round(startW + (ev.clientX - startX))));
      requestAnimationFrame(pin);
    };
    const up = (ev: PointerEvent) => {
      applyColumnWidth(entry, Math.max(minW, Math.round(startW + (ev.clientX - startX))));
      requestAnimationFrame(pin);
      cleanup();
    };
    const cleanup = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', cleanup);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    // Pointer dilepas di luar jendela: pointerup tak datang, bersihkan via blur.
    window.addEventListener('blur', cleanup);
  }
  // Menu pengaturan properti: posisi viewport (portal fixed) agar tak terpotong scroll tabel.
  const [menu, setMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  // Kolom yang menunya harus dibuka setelah header-nya ter-render (habis tambah properti).
  const [pendingMenuId, setPendingMenuId] = useState<string | null>(null);

  // Sensor drag-and-drop antar baris.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const tableWrapRef = useRef<HTMLDivElement>(null);
  const tableRef = useRef<HTMLTableElement>(null);
  // Lebar header terukur (teks label + padding) per entri kolom.
  const [measured, setMeasured] = useState<Record<string, number>>({});
  // Ukur ulang label header setiap urutan/kolom berubah (dan setelah font siap)
  // agar colgroup selalu pas selebar teks header.
  useEffect(() => {
    const measure = () => {
      const table = tableRef.current;
      if (!table) return;
      const next: Record<string, number> = {};
      table.querySelectorAll('thead th[data-entry]').forEach((th) => {
        const entry = (th as HTMLElement).dataset.entry;
        if (!entry) return;
        const label = th.querySelector('[data-col-label]') as HTMLElement | null;
        if (label) next[entry] = Math.ceil(label.scrollWidth) + 24;
      });
      setMeasured((prev) => {
        const keys = Object.keys(next);
        if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === next[k])) return prev;
        return next;
      });
    };
    const timer = window.setTimeout(measure, 0);
    const raf = requestAnimationFrame(measure);
    if (document.fonts) {
      document.fonts.ready.then(measure).catch(() => undefined);
    }
    window.addEventListener('resize', measure);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', measure);
    };
  }, [displayOrder, columns]);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const data = await activityApi.listMine({ date: dateISO });
      setActivities(data);
    } catch {
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateISO]);

  // Properti kustom milik user (lintas tanggal, seperti kolom Notion).
  const fetchColumns = async () => {
    try {
      setColumns(await activityApi.listColumns());
    } catch {
      setColumns([]);
    }
  };

  useEffect(() => {
    fetchColumns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep-link dari tombol "+" sidebar: buat aktivitas baru lalu fokus edit ala Notion.
  useEffect(() => {
    const state = location.state as { focusId?: string; date?: string } | null;
    if (!state?.focusId) return;
    if (state.date) {
      const d = new Date(`${state.date}T00:00:00`);
      if (!isNaN(d.getTime())) setSelectedDate(d);
    }
    setPendingFocusId(state.focusId);
    // Fetch paksa: daftar lokal bisa jadi basi (mis. klik "+" saat sudah di /daily),
    // sehingga aktivitas yang baru dibuat belum ada di state.
    fetchActivities();
    window.history.replaceState({}, '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  useEffect(() => {
    if (!pendingFocusId) return;
    const target = activities.find((a) => a.id === pendingFocusId);
    if (!target) return;
    setEditingId(target.id);
    setEditingTitle(target.title);
    setPendingFocusId(null);
    requestAnimationFrame(() => {
      document.getElementById(`activity-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [activities, pendingFocusId]);

  // ---- actions ----
  // Halaman baru ala Notion: langsung jadi baris lalu fokus edit judulnya.
  async function handleNewPage() {
    const created = await activityApi.create({
      title: 'Tanpa judul',
      date: new Date(`${dateISO}T00:00:00`).toISOString(),
      icon: 'note',
    });
    setActivities((prev) => [...prev, created].sort((a, b) => a.order - b.order));
    setEditingId(created.id);
    setEditingTitle(created.title);
    requestAnimationFrame(() => {
      document.getElementById(`activity-${created.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // Tambah baris tepat di bawah baris acuan (tombol + di gutter).
  async function handleAddBelow(after: DailyActivity) {
    const created = await activityApi.create({
      title: 'Tanpa judul',
      date: new Date(`${dateISO}T00:00:00`).toISOString(),
      icon: 'note',
      order: after.order + 0.5,
    });
    setActivities((prev) => [...prev, created].sort((a, b) => a.order - b.order));
    setEditingId(created.id);
    setEditingTitle(created.title);
    requestAnimationFrame(() => {
      document.getElementById(`activity-${created.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  // ---- properti kustom ----
  async function handleAddColumn() {
    try {
      const created = await activityApi.createColumn({
        name: `Properti ${columns.length + 1}`,
        type: 'TEXT',
      });
      setColumns((prev) => [...prev, created]);
      persistOrder([...displayOrder, created.id]);
      setPendingMenuId(created.id);
    } catch {
      showToast('Gagal menambah properti. Coba lagi.');
    }
  }

  async function handleRenameColumn(column: DailyColumn, name: string) {
    const prev = columns;
    setColumns((cs) => cs.map((c) => (c.id === column.id ? { ...c, name } : c)));
    try {
      const updated = await activityApi.updateColumn(column.id, { name });
      setColumns((cs) => cs.map((c) => (c.id === column.id ? updated : c)));
    } catch {
      setColumns(prev);
      showToast('Gagal mengganti nama properti.');
    }
  }

  async function handleChangeColumnType(column: DailyColumn, type: DailyColumnType) {
    if (type === column.type) return;
    const prev = columns;
    const prevActivities = activities;
    setColumns((cs) => cs.map((c) => (c.id === column.id ? { ...c, type, options: type === 'SELECT' ? (c.options ?? []) : null } : c)));
    // Nilai lama yang tak cocok tipe baru dibersihkan lokal agar tampilan konsisten.
    if (type !== 'SELECT') {
      setActivities((as) =>
        as.map((a) => {
          if (!a.customValues || !(column.id in a.customValues)) return a;
          const next = { ...a.customValues };
          delete next[column.id];
          return { ...a, customValues: next };
        }),
      );
    }
    try {
      const updated = await activityApi.updateColumn(column.id, {
        type,
        options: type === 'SELECT' ? (column.options ?? []) : undefined,
      });
      setColumns((cs) => cs.map((c) => (c.id === column.id ? updated : c)));
    } catch {
      setColumns(prev);
      setActivities(prevActivities);
      showToast('Gagal mengubah tipe properti.');
    }
  }

  async function handleSaveOptions(column: DailyColumn, options: string[]) {
    const prev = columns;
    setColumns((cs) => cs.map((c) => (c.id === column.id ? { ...c, options } : c)));
    try {
      const updated = await activityApi.updateColumn(column.id, { options });
      setColumns((cs) => cs.map((c) => (c.id === column.id ? updated : c)));
    } catch {
      setColumns(prev);
      showToast('Gagal menyimpan pilihan.');
    }
  }

  async function handleMoveColumn(column: DailyColumn, dir: -1 | 1) {
    // Geser dalam urutan tampil (tetangga bisa kolom fixed).
    const idx = displayOrder.indexOf(column.id);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= displayOrder.length) return;
    const prevOrder = displayOrder;
    const next = [...displayOrder];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    persistOrder(next);
    const nextCustom = next.filter((id) => !id.startsWith('fix:'));
    try {
      await activityApi.reorderColumns(nextCustom);
    } catch {
      persistOrder(prevOrder);
      showToast('Gagal memindahkan properti.');
    }
  }

  async function handleDeleteColumn(column: DailyColumn) {
    if (!confirm(`Hapus properti "${column.name}"? Nilainya di semua baris ikut terhapus.`)) return;
    const prev = columns;
    const prevActivities = activities;
    const prevOrder = displayOrder;
    setMenu(null);
    setColumns((cs) => cs.filter((c) => c.id !== column.id));
    persistOrder(displayOrder.filter((id) => id !== column.id));
    setWidths((prev) => {
      if (!(column.id in prev)) return prev;
      const next = { ...prev };
      delete next[column.id];
      return next;
    });
    setActivities((as) =>
      as.map((a) => {
        if (!a.customValues || !(column.id in a.customValues)) return a;
        const next = { ...a.customValues };
        delete next[column.id];
        return { ...a, customValues: next };
      }),
    );
    try {
      await activityApi.deleteColumn(column.id);
    } catch {
      setColumns(prev);
      setActivities(prevActivities);
      persistOrder(prevOrder);
      showToast('Gagal menghapus properti.');
    }
  }

  // Tulis nilai sel properti (optimis + rollback).
  async function handleCellCommit(
    activity: DailyActivity,
    column: DailyColumn,
    value: string | number | boolean | null,
  ) {
    const prev = activity.customValues ?? null;
    const optimistic = { ...(prev ?? {}) };
    if (value === null) delete optimistic[column.id];
    else optimistic[column.id] = value;
    setActivities((as) => as.map((a) => (a.id === activity.id ? { ...a, customValues: optimistic } : a)));
    try {
      const updated = await activityApi.setCellValue(activity.id, column.id, value);
      setActivities((as) => as.map((a) => (a.id === activity.id ? updated : a)));
    } catch {
      setActivities((as) => as.map((a) => (a.id === activity.id ? { ...a, customValues: prev } : a)));
      showToast('Gagal menyimpan nilai. Coba lagi.');
    }
  }
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === activities.length ? new Set() : new Set(activities.map((a) => a.id)),
    );
  }

  // Hapus massal ala note/tabel: langsung hilang tanpa confirm,
  // bisa dikembalikan via toast Urungkan atau Ctrl+Z (1 entri undo).
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    const ids = new Set(selectedIds);
    const doomed = activities
      .map((activity, index) => ({ activity, index }))
      .filter(({ activity }) => ids.has(activity.id));
    if (doomed.length === 0) return;
    setActivities((prev) => prev.filter((a) => !ids.has(a.id)));
    setSelectedIds(new Set());
    // Hapus di server (background); gagal total -> sinkron ulang.
    void Promise.all(doomed.map(({ activity }) => activityApi.remove(activity.id))).catch(() =>
      fetchActivities(),
    );
    const undo = () => {
      // Kembalikan snapshot di posisi semula (id lama sebagai placeholder).
      setActivities((prev) => {
        const have = new Set(prev.map((a) => a.id));
        const reinsert = doomed
          .filter(({ activity }) => !have.has(activity.id))
          .sort((x, y) => x.index - y.index);
        if (reinsert.length === 0) return prev;
        const next = [...prev];
        for (const { activity, index } of reinsert) {
          next.splice(Math.min(index, next.length), 0, activity);
        }
        return next;
      });
      // Buat ulang di server (id baru); ganti placeholder dengan data server.
      void Promise.all(
        doomed.map(({ activity }) =>
          activityApi
            .create({
              title: activity.title,
              date: activity.date,
              startTime: activity.startTime ?? null,
              endTime: activity.endTime ?? null,
              type: activity.type,
              status: activity.status,
              icon: activity.icon ?? undefined,
              description: activity.description ?? undefined,
              customValues: activity.customValues ?? undefined,
            })
            .then((created) => {
              setActivities((prev) => prev.map((a) => (a.id === activity.id ? created : a)));
            })
            .catch(() => undefined),
        ),
      ).catch(() => fetchActivities());
    };
    const entryId = push('aktivitas', undo);
    showToast(`${doomed.length} aktivitas dihapus`, {
      label: 'Urungkan',
      onAction: () => undoEntry(entryId),
    });
  }

  // Hapus massal via tombol Delete/Backspace saat ada baris terpilih.
  // Diabaikan saat fokus di input teks/jam, select, textarea agar tidak ganggu edit.
  // Pengecualian: fokus di checkbox tetap diizinkan (habis klik checkbox fokus nempel di situ).
  useEffect(() => {
    if (selectedIds.size === 0) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target as HTMLElement | null;
      const isCheckbox =
        !!target && target.tagName === 'INPUT' && (target as HTMLInputElement).type === 'checkbox';
      if (!isCheckbox && target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      e.preventDefault();
      (document.activeElement as HTMLElement | null)?.blur?.();
      void handleBulkDelete();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedIds]);

  async function handleStatusChange(activity: DailyActivity, status: DailyActivity['status']) {
    if (status === activity.status) return;
    setBusyId(activity.id);
    try {
      const updated = await activityApi.update(activity.id, { status });
      setActivities((prev) => prev.map((a) => (a.id === activity.id ? updated : a)));
    } finally {
      setBusyId(null);
    }
  }

  async function handleUpdateTitle(activity: DailyActivity) {
    if (!editingTitle.trim() || editingTitle === activity.title) {
      setEditingId(null);
      return;
    }
    const updated = await activityApi.update(activity.id, { title: editingTitle.trim() });
    setActivities((prev) => prev.map((a) => (a.id === activity.id ? updated : a)));
    setEditingId(null);
  }

  // Klik sintetis tepat setelah drop diabaikan agar menu kolom tak terbuka sendiri.
  const lastDragEndRef = useRef(0);

  function handleDragEnd(event: DragEndEvent) {
    lastDragEndRef.current = Date.now();
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = String(active.id);
    const o = String(over.id);
    // Drop silang baris <-> kolom diabaikan.
    if (a.startsWith(ROW_PREFIX)) {
      if (!o.startsWith(ROW_PREFIX)) return;
      const fromId = a.slice(ROW_PREFIX.length);
      const toId = o.slice(ROW_PREFIX.length);
      const from = activities.findIndex((x) => x.id === fromId);
      const to = activities.findIndex((x) => x.id === toId);
      if (from < 0 || to < 0) return;
      const next = arrayMove(activities, from, to);
      setActivities(next);
      activityApi.reorder(next.map((x) => x.id)).catch(() => fetchActivities());
      return;
    }
    if (a.startsWith(COL_PREFIX)) {
      if (!o.startsWith(COL_PREFIX)) return;
      const fromEntry = a.slice(COL_PREFIX.length);
      const toEntry = o.slice(COL_PREFIX.length);
      const from = displayOrder.indexOf(fromEntry);
      const to = displayOrder.indexOf(toEntry);
      if (from < 0 || to < 0) return;
      const prevOrder = displayOrder;
      const next = arrayMove(displayOrder, from, to);
      persistOrder(next);
      // Urutan kustom (relatif) disimpan ke server; fixed hanya lokal.
      const prevCustom = prevOrder.filter((id) => !id.startsWith('fix:'));
      const nextCustom = next.filter((id) => !id.startsWith('fix:'));
      if (prevCustom.join('|') !== nextCustom.join('|')) {
        activityApi.reorderColumns(nextCustom).catch(() => {
          persistOrder(prevOrder);
          showToast('Gagal memindahkan properti.');
        });
      }
    }
  }

  // Buka menu kolom dari header (klik/klik-kanan); abaikan klik lahir dari drag.
  function openColumnMenu(e: React.MouseEvent, column: DailyColumn) {
    if (Date.now() - lastDragEndRef.current < 300) return;
    if (menu?.id === column.id && e.type === 'click') {
      setMenu(null);
      return;
    }
    const rect =
      (e.currentTarget.closest('th') as HTMLElement | null)?.getBoundingClientRect() ??
      e.currentTarget.getBoundingClientRect();
    setMenu({ id: column.id, x: rect.left, y: rect.bottom + 4 });
  }

  async function handleTimeChange(activity: DailyActivity, start: string, end: string) {
    const payload: Record<string, unknown> = {};
    const s = combineDateAndTime(dateISO, start);
    const e = combineDateAndTime(dateISO, end);
    payload.startTime = s ?? null;
    payload.endTime = e ?? null;
    const updated = await activityApi.update(activity.id, payload);
    setActivities((prev) => prev.map((a) => (a.id === activity.id ? updated : a)));
  }

  function commitTimeEdit(activity: DailyActivity, field: 'start' | 'end', value: string) {
    setEditingTime(null);
    const current = field === 'start' ? toHHMM(activity.startTime) : toHHMM(activity.endTime);
    if (value === current) return;
    const start = field === 'start' ? value : toHHMM(activity.startTime);
    const end = field === 'end' ? value : toHHMM(activity.endTime);
    void handleTimeChange(activity, start, end);
  }

  function timeCell(activity: DailyActivity, field: 'start' | 'end') {
    const iso = field === 'start' ? activity.startTime : activity.endTime;
    const editing = editingTime?.id === activity.id && editingTime.field === field;
    if (editing) {
      return (
        <input
          type="time"
          autoFocus
          defaultValue={toHHMM(iso)}
          onBlur={(e) => commitTimeEdit(activity, field, e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') setEditingTime(null);
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={field === 'start' ? 'Waktu mulai' : 'Waktu selesai'}
          className="rounded border border-violet-300 bg-white px-1 py-0.5 text-xs"
        />
      );
    }
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setEditingTime({ id: activity.id, field });
        }}
        title="Klik untuk ubah jam"
        className={`rounded px-1 ${iso ? 'text-gray-700 hover:bg-gray-100' : 'text-gray-300 hover:bg-gray-100 hover:text-gray-500'}`}
      >
        {iso ? formatTime(iso) : 'Atur jam'}
      </button>
    );
  }

  // ---- render sel/header mengikuti urutan tampil (fixed + kustom campur) ----
  function fixedHeaderContent(id: FixedId) {
    switch (id) {
      case 'title':
        return (
          <span data-col-label className="flex items-center gap-1.5">
            <span aria-hidden="true" className="font-serif text-sm font-bold">Aa</span> Kegiatan
          </span>
        );
      case 'start':
      case 'end':
        return (
          <span data-col-label className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            {id === 'start' ? 'Waktu Mulai' : 'Waktu Selesai'}
          </span>
        );
      case 'type':
        return (
          <span data-col-label className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="4.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 4.5h12M6 2.5h4v2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Kategori
          </span>
        );
      case 'status':
        return (
          <span data-col-label className="flex items-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M4 5.5l4 4 4-4M4 9.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Status
          </span>
        );
    }
  }

  function renderHeaderCell(entry: string) {
    const resizeHit = (
      <span
        role="separator"
        aria-orientation="vertical"
        title="Seret untuk ubah lebar kolom"
        // Capture: harus memutus gestur sebelum listener drag-reorder dnd-kit di `th`
        // (bubble) sempat bangun — kalau tidak, "melebarkan" berubah jadi geser kolom.
        onPointerDownCapture={(e) => beginColumnResize(e, entry)}
        className="absolute -right-2.5 top-1/2 z-10 h-6 w-2 -translate-y-1/2 cursor-col-resize touch-none rounded opacity-0 transition hover:bg-violet-300 group-hover:opacity-100"
      />
    );
    if (entry.startsWith('fix:')) {
      const id = entry.slice(4) as FixedId;
      return (
        <DraggableTh key={entry} id={`${COL_PREFIX}${entry}`} entry={entry}>
          <div className="relative flex min-w-0 items-center">
            {fixedHeaderContent(id)}
            {resizeHit}
          </div>
        </DraggableTh>
      );
    }
    const c = columnById.get(entry);
    if (!c) return null;
    return (
      <DraggableTh key={c.id} id={`${COL_PREFIX}${c.id}`} entry={entry}>
        <div className="relative flex min-w-0 items-center">
          <span
            ref={(el) => {
              if (el && pendingMenuId === c.id) {
                const th = (el as HTMLElement).closest('th');
                const rect = th?.getBoundingClientRect();
                if (rect) {
                  setPendingMenuId(null);
                  setMenu({ id: c.id, x: rect.left, y: rect.bottom + 4 });
                }
              }
            }}
            className="block min-w-0 flex-1"
          >
            <button
              type="button"
              onClick={(e) => openColumnMenu(e, c)}
              onContextMenu={(e) => {
                e.preventDefault();
                openColumnMenu(e, c);
              }}
              title={`${c.name} — klik untuk mengatur`}
              aria-label={`Atur properti ${c.name}`}
              aria-haspopup="menu"
              className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-gray-50"
            >
              <TableColumnIcon type={c.type} className="h-4 w-4 shrink-0 text-gray-400" />
              <span data-col-label className="min-w-0 flex-1 truncate">{c.name}</span>
            </button>
          </span>
          {resizeHit}
        </div>
      </DraggableTh>
    );
  }

  function renderBodyCell(entry: string, a: DailyActivity, isEditing: boolean) {
    if (entry === fixKey('title')) {
      return (
        <td key={entry} className={FIXED_TD_CLASS.title}>
          <div className="flex min-w-0 items-center gap-1.5">
            <ActivityIcon name={a.icon} className="h-4 w-4 shrink-0 text-gray-400" />
            {isEditing ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={() => handleUpdateTitle(a)}
                onKeyDown={(e) => e.key === 'Enter' && handleUpdateTitle(a)}
                onClick={(e) => e.stopPropagation()}
                className="w-full min-w-0 rounded border border-violet-300 bg-white px-1.5 py-0.5 text-sm"
              />
            ) : (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingId(a.id);
                  setEditingTitle(a.title);
                }}
                title="Klik untuk ubah judul"
                className={`min-w-0 flex-1 truncate rounded px-0.5 text-left hover:bg-gray-100 ${a.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-800'}`}
              >
                {a.title}
              </button>
            )}
          </div>
          {a.description && <p className="mt-0.5 truncate pl-6 text-xs text-gray-400">{a.description}</p>}
        </td>
      );
    }
    if (entry === fixKey('start')) {
      return (
        <td key={entry} className={FIXED_TD_CLASS.start}>
          {timeCell(a, 'start')}
        </td>
      );
    }
    if (entry === fixKey('end')) {
      return (
        <td key={entry} className={FIXED_TD_CLASS.end}>
          {timeCell(a, 'end')}
        </td>
      );
    }
    if (entry === fixKey('type')) {
      const typeMeta = TYPE_META[a.type] ?? TYPE_META.CUSTOM;
      return (
        <td key={entry} className={FIXED_TD_CLASS.type}>
          <span className={`block truncate rounded px-1.5 py-0.5 text-xs ${typeMeta.className}`}>{typeMeta.label}</span>
        </td>
      );
    }
    if (entry === fixKey('status')) {
      const statusClass = STATUS_OPTIONS.find((o) => o.value === a.status)?.className ?? '';
      return (
        <td key={entry} className={FIXED_TD_CLASS.status}>
          <select
            value={a.status}
            disabled={busyId === a.id}
            onChange={(e) => void handleStatusChange(a, e.target.value as DailyActivity['status'])}
            onClick={(e) => e.stopPropagation()}
            aria-label={`Status ${a.title}`}
            className={`w-full max-w-full cursor-pointer truncate rounded px-1.5 py-0.5 text-xs focus:outline-none disabled:opacity-60 ${statusClass}`}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </td>
      );
    }
    const c = columnById.get(entry);
    if (!c) return null;
    return (
      <td key={entry} className="border-b border-l border-gray-200 p-1.5">
        <CustomCell activity={a} column={c} onCommit={handleCellCommit} />
      </td>
    );
  }

  function renderPlaceholderCell(entry: string) {
    if (entry === fixKey('title')) {
      return (
        <td key={entry} className="border-b border-l border-gray-200 p-2">
          <button
            onClick={() => void handleNewPage()}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-gray-50 hover:text-gray-600 focus-visible:opacity-100 max-sm:opacity-100"
          >
            <span aria-hidden="true">+</span> Baru item
          </button>
        </td>
      );
    }
    return <td key={entry} className="border-b border-l border-gray-200" />;
  }

  // Lebar tabel deterministik: gutter (40px) + semua kolom + kolom `+` (48px).
  const totalTableWidth = useMemo(() => {
    const cols = displayOrder.reduce((sum, entry) => sum + widthOf(entry), 0);
    return 40 + cols + 48;
  }, [displayOrder, widths]);

  return (
    <div className="w-full space-y-4">
      {/* Judul database ala Notion */}
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-gray-900">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-gray-900">
            <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
            <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Jadwal Harian
        </h1>
        <p className="mt-1 text-sm text-gray-500">{formatHumanDay(selectedDate)}</p>
      </div>

      {/* Toolbar: tab view + ikon + Baru */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Tampilan database">
          <span
            role="tab"
            aria-selected="true"
            className="flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 6h12M6 6v7.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Semua Kegiatan
          </span>
          <button
            type="button"
            disabled
            title="Segera hadir"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-400"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Kalender
          </button>
          <button
            type="button"
            disabled
            title="Segera hadir"
            className="flex cursor-not-allowed items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-gray-400"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 3.5h5M2 8h9M2 12.5h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="11" cy="3.5" r="1.6" fill="currentColor" />
              <circle cx="13.5" cy="8" r="1.6" fill="currentColor" />
              <circle cx="11" cy="12.5" r="1.6" fill="currentColor" />
            </svg>
            Timeline
          </button>
        </div>
        <span className="ml-auto flex items-center gap-0.5">
          <button
            type="button"
            disabled
            title="Segera hadir"
            aria-label="Filter"
            className="cursor-not-allowed rounded-md p-2 text-gray-400"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 4h11L9.5 8.5V13l-3 1.5V8.5L2.5 4z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            disabled
            title="Segera hadir"
            aria-label="Urutkan"
            className="cursor-not-allowed rounded-md p-2 text-gray-400"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M5.5 2.5v11M5.5 2.5L3 5M5.5 2.5L8 5M10.5 13.5v-11M10.5 13.5L8 11M10.5 13.5l2.5-2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            disabled
            title="Segera hadir"
            aria-label="Cari"
            className="cursor-not-allowed rounded-md p-2 text-gray-400"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </button>
          <button
            onClick={() => void handleNewPage()}
            className="ml-1 rounded-lg bg-blue-500 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-blue-600"
          >
            Baru ▾
          </button>
        </span>
      </div>

      {/* Database tabel */}
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Memuat…</p>
      ) : (
        <div className="relative">
          {selectedIds.size > 0 && (
            <div className="absolute -top-2 left-9 z-50 flex -translate-y-full items-center gap-3 whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-sm shadow-md">
              <span className="font-medium text-gray-800">{selectedIds.size} dipilih</span>
              <button
                onClick={() => void handleBulkDelete()}
                className="flex items-center gap-1 text-xs font-medium text-red-600 transition hover:text-red-700"
              >
                <TrashIcon className="h-3.5 w-3.5" /> Hapus
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-gray-500 transition hover:text-gray-700"
              >
                Batal
              </button>
            </div>
          )}
          <DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[lockDragAxis]} onDragEnd={handleDragEnd}>
          <div ref={tableWrapRef} className="min-h-[240px] [overflow-anchor:none]">
          <table
            ref={tableRef}
            className="ml-10 table-fixed border-collapse text-left text-sm"
            style={{ width: `${totalTableWidth}px` }}
          >
            <colgroup>
              <col style={{ width: 40 }} />
              {displayOrder.map((entry) => (
                <col key={entry} style={{ width: widthOf(entry) }} />
              ))}
              <col style={{ width: 48 }} />
            </colgroup>
            <thead>
              <tr className="group text-xs text-gray-500">
                <th className="w-10 border-b border-gray-200 p-1 text-center font-medium">
                  <input
                    type="checkbox"
                    checked={activities.length > 0 && selectedIds.size >= activities.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < activities.length;
                    }}
                    onChange={toggleSelectAll}
                    title={selectedIds.size > 0 ? 'Batalkan semua pilihan' : 'Pilih semua aktivitas'}
                    aria-label="Pilih semua aktivitas"
                    className={`h-3.5 w-3.5 rounded border-gray-300 text-violet-600 transition ${selectedIds.size > 0 ? 'opacity-100' : 'opacity-0 focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100 max-sm:opacity-100'}`}
                  />
                </th>
                <SortableContext items={displayOrder.map((id) => `${COL_PREFIX}${id}`)} strategy={horizontalListSortingStrategy}>
                  {displayOrder.map((entry) => renderHeaderCell(entry))}
                </SortableContext>
                <th className="w-12 border-b border-l border-gray-200 text-center font-medium">
                  <button
                    type="button"
                    onClick={() => void handleAddColumn()}
                    title="Tambah properti"
                    aria-label="Tambah properti"
                    className="px-1 text-lg leading-none text-gray-400 transition hover:text-violet-600"
                  >
                    +
                  </button>
                </th>
              </tr>
            </thead>
            <SortableContext items={activities.map((a) => `${ROW_PREFIX}${a.id}`)} strategy={verticalListSortingStrategy}>
            <tbody>
              {activities.length === 0 && (
                <>
                  {Array.from({ length: 4 }, (_, i) => (
                    <tr key={`empty-${i}`} className="group">
                      <td className="h-10 w-10 border-b border-gray-200" />
                      {displayOrder.map((entry) => renderPlaceholderCell(entry))}
                      <td className="border-b border-gray-200" />
                    </tr>
                  ))}
                </>
              )}
              {activities.map((a) => {
                const isEditing = editingId === a.id;
                return (
                  <SortableRow
                    key={a.id}
                    id={`${ROW_PREFIX}${a.id}`}
                    selected={a.status === 'COMPLETED'}
                    checked={selectedIds.has(a.id)}
                    onToggleCheck={() => toggleSelect(a.id)}
                    checkLabel={`Pilih ${a.title}`}
                    onAddBelow={() => void handleAddBelow(a)}
                  >
                    {displayOrder.map((entry) => renderBodyCell(entry, a, isEditing))}
                    <td aria-hidden="true" className="border-b border-gray-200" />
                  </SortableRow>
                );
              })}
              <tr className="group">
                <td className="w-10 border-b border-gray-200" />
                {displayOrder.map((entry) => renderPlaceholderCell(entry))}
                <td className="border-b border-gray-200" />
              </tr>
            </tbody>
            </SortableContext>
          </table>
          </div>
        </DndContext>
        {menu && (() => {
          const column = columns.find((c) => c.id === menu.id);
          if (!column) return null;
          return (
            <ColumnMenu
              column={column}
              x={menu.x}
              y={menu.y}
              isFirst={displayCustomIds[0] === column.id}
              isLast={displayCustomIds[displayCustomIds.length - 1] === column.id}
              onRename={(name) => void handleRenameColumn(column, name)}
              onChangeType={(type) => void handleChangeColumnType(column, type)}
              onSaveOptions={(options) => void handleSaveOptions(column, options)}
              onMove={(dir) => void handleMoveColumn(column, dir)}
              onDelete={() => void handleDeleteColumn(column)}
              onClose={() => setMenu(null)}
            />
          );
        })()}
        </div>
      )}

    </div>
  );
}

export default function DailyPage() {
  return (
    <UndoStackProvider>
      <DailyPageInner />
    </UndoStackProvider>
  );
}
