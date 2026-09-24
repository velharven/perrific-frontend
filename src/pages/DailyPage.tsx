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
import {
  ActivityIcon,
  CheckIcon,
  CopyIcon,
  DEFAULT_CATEGORY_OPTIONS,
  DEFAULT_STATUS_OPTIONS,
  PROPERTY_COLUMNS_LEFT,
  PROPERTY_COLUMNS_RIGHT,
  TAB_ICONS,
  TableColumnIcon,
  TrashIcon,
  getCategoryBadgeStyle,
  getStatusBadgeStyle,
} from '@/components/icons';
import { showToast } from '@/components/ui/Toast';
import PersonCell from '@/components/table/PersonCell';
import CalendarView from '@/components/daily/CalendarView';
import { UndoStackProvider, useUndo } from '@/hooks/useUndoStack';
import { useSocket } from '@/store/socket';
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
  isUnscheduled,
  children,
}: {
  id: string;
  selected?: boolean;
  checked: boolean;
  onToggleCheck: () => void;
  checkLabel: string;
  onAddBelow: () => void;
  isUnscheduled?: boolean;
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
      className={`group scroll-mt-24 transition ${
        selected
          ? 'bg-green-50/40'
          : isUnscheduled
            ? 'bg-amber-50/60 hover:bg-amber-100/50'
            : 'hover:bg-gray-50/70'
      }`}
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
  onClick,
  children,
}: {
  id: string;
  entry: string;
  onClick?: (e: React.MouseEvent) => void;
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
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      {children}
    </th>
  );
}

// Kolom bawaan (fixed) yang ikut bisa digeser. Entri urutan: `fix:<id>` atau id kolom kustom.
const FIXED_IDS = ['title', 'date', 'start', 'end', 'type', 'status'] as const;
type FixedId = (typeof FIXED_IDS)[number];
const fixKey = (id: FixedId) => `fix:${id}`;
const ORDER_KEY = 'daily-column-order-v2';
const FIXED_CONFIG_KEY = 'daily-fixed-columns-meta-v2';

interface FixedColumnMeta {
  name: string;
  type: DailyColumnType;
  icon?: string | null;
}

const DEFAULT_FIXED_CONFIG: Record<FixedId, FixedColumnMeta> = {
  title: { name: 'Kegiatan', type: 'TEXT', icon: null },
  date: { name: 'Tanggal', type: 'DATE', icon: 'calendar' },
  start: { name: 'Waktu Mulai', type: 'START_TIME', icon: 'clock' },
  end: { name: 'Waktu Selesai', type: 'END_TIME', icon: 'clock' },
  type: { name: 'Kategori', type: 'CATEGORY', icon: 'folder' },
  status: { name: 'Status', type: 'STATUS', icon: 'check' },
};

interface DisplayColumnItem {
  id: string;
  name: string;
  type: DailyColumnType;
  icon: string | null;
  isFixed: boolean;
  fixedId?: FixedId;
  options?: string[];
  rawColumn?: DailyColumn;
}

function mergeDisplayOrder(saved: string[], customs: DailyColumn[]): string[] {
  const fixedKeys = FIXED_IDS.map(fixKey);
  const customIds = customs.map((c) => c.id);
  const known = new Set([...fixedKeys, ...customIds]);
  const merged = saved.filter((id) => known.has(id));

  // Pastikan fix:date masuk setelah fix:title jika belum ada di saved
  if (!merged.includes(fixKey('date'))) {
    const titleIdx = merged.indexOf(fixKey('title'));
    if (titleIdx >= 0) {
      merged.splice(titleIdx + 1, 0, fixKey('date'));
    } else {
      merged.push(fixKey('date'));
    }
  }

  for (const id of [...fixedKeys, ...customIds]) {
    if (!merged.includes(id)) merged.push(id);
  }
  return merged;
}

const FIXED_TD_CLASS: Record<FixedId, string> = {
  title: 'border-b border-l border-gray-200 p-2',
  date: 'whitespace-nowrap border-b border-l border-gray-200 p-2 text-xs',
  start: 'whitespace-nowrap border-b border-l border-gray-200 p-2 text-xs',
  end: 'whitespace-nowrap border-b border-l border-gray-200 p-2 text-xs',
  type: 'border-b border-l border-gray-200 p-2',
  status: 'border-b border-l border-gray-200 p-2',
};

function PhoneCell({
  value,
  onCommit,
  ariaLabel,
}: {
  value: string | number | null | undefined;
  onCommit: (val: string | null) => void;
  ariaLabel: string;
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const rawStr = value != null ? String(value).trim() : '';
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
      onCommit(next === '' ? null : next);
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
            aria-label={ariaLabel}
            placeholder="Nomor telepon..."
            className="w-full min-w-0 rounded border border-violet-300 bg-white px-1.5 py-0.5 text-xs text-gray-800 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
            aria-label={ariaLabel}
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

  if (column.type === 'STATUS') {
    const rawVal = typeof raw === 'string' ? raw : '';
    const val = rawVal || 'Belum Mulai';
    const style = getStatusBadgeStyle(val);
    const opts = (Array.isArray(column.options) && column.options.length > 0) ? column.options : DEFAULT_STATUS_OPTIONS;
    return (
      <div className="relative inline-flex items-center">
        <select
          value={val}
          onChange={(e) => onCommit(activity, column, e.target.value)}
          aria-label={`${column.name} ${activity.title}`}
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

  if (column.type === 'CATEGORY') {
    const rawVal = typeof raw === 'string' ? raw : '';
    const style = getCategoryBadgeStyle(rawVal);
    const opts = (Array.isArray(column.options) && column.options.length > 0) ? column.options : DEFAULT_CATEGORY_OPTIONS;
    return (
      <div className="relative inline-flex items-center">
        <select
          value={rawVal}
          onChange={(e) => onCommit(activity, column, e.target.value === '' ? null : e.target.value)}
          aria-label={`${column.name} ${activity.title}`}
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

  if (column.type === 'START_TIME' || column.type === 'END_TIME') {
    const rawVal = typeof raw === 'string' ? raw : '';
    return (
      <div className="flex w-full items-center gap-1.5">
        <TableColumnIcon type={column.type} className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          type="time"
          defaultValue={rawVal}
          onBlur={(e) => {
            const v = e.target.value.trim();
            const cur = typeof raw === 'string' ? raw : null;
            if ((v === '' ? null : v) !== cur) onCommit(activity, column, v === '' ? null : v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label={`${column.name} ${activity.title}`}
          className="rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gray-700 hover:border-gray-200 focus:border-violet-300 focus:bg-white focus:outline-none"
        />
      </div>
    );
  }

  if (column.type === 'PERSON') {
    return (
      <PersonCell
        value={typeof raw === 'string' ? raw : raw != null ? String(raw) : null}
        onChange={(val) => onCommit(activity, column, val)}
        ariaLabel={`${column.name} ${activity.title}`}
      />
    );
  }

  if (column.type === 'FILES') {
    const strVal = typeof raw === 'string' ? raw : '';
    const isUrl = /^https?:\/\//i.test(strVal.trim());
    return (
      <div className="flex w-full items-center gap-1.5">
        <TableColumnIcon type="FILES" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          type="text"
          defaultValue={strVal}
          onBlur={(e) => {
            const v = e.target.value.trim();
            const cur = typeof raw === 'string' ? raw : null;
            if ((v === '' ? null : v) !== cur) onCommit(activity, column, v === '' ? null : v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label={`${column.name} ${activity.title}`}
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

  if (column.type === 'URL') {
    const rawStr = typeof raw === 'string' ? raw.trim() : '';
    const href = rawStr ? (/^https?:\/\//i.test(rawStr) ? rawStr : `https://${rawStr}`) : '';
    return (
      <div className="flex w-full items-center gap-1.5">
        <TableColumnIcon type="URL" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          type="url"
          defaultValue={rawStr}
          onBlur={(e) => {
            const v = e.target.value.trim();
            const cur = typeof raw === 'string' ? raw : null;
            if ((v === '' ? null : v) !== cur) onCommit(activity, column, v === '' ? null : v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label={`${column.name} ${activity.title}`}
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

  if (column.type === 'PHONE') {
    return (
      <PhoneCell
        value={raw != null ? String(raw) : null}
        onCommit={(val) => onCommit(activity, column, val)}
        ariaLabel={`${column.name} ${activity.title}`}
      />
    );
  }

  if (column.type === 'EMAIL') {
    const rawStr = typeof raw === 'string' ? raw.trim() : '';
    return (
      <div className="flex w-full items-center gap-1.5">
        <TableColumnIcon type="EMAIL" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <input
          type="email"
          defaultValue={rawStr}
          onBlur={(e) => {
            const v = e.target.value.trim();
            const cur = typeof raw === 'string' ? raw : null;
            if ((v === '' ? null : v) !== cur) onCommit(activity, column, v === '' ? null : v);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          aria-label={`${column.name} ${activity.title}`}
          placeholder="Email..."
          className="w-full min-w-0 bg-transparent text-xs text-gray-700 placeholder:text-gray-300 focus:outline-none"
        />
        {rawStr && (
          <a
            href={`mailto:${rawStr}`}
            title="Kirim email"
            className="shrink-0 text-xs text-gray-400 transition hover:text-perrific-violet"
          >
            ↗
          </a>
        )}
      </div>
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

// Menu pengaturan properti kustom gaya Notion (nama, ikon, jenis properti, opsi SELECT, hapus).
// Di-portal ke body dengan posisi fixed agar tak terpotong scroll tabel.
function ColumnMenu({
  item,
  x,
  y,
  onRename,
  onChangeIcon,
  onChangeType,
  onSaveOptions,
  onDelete,
  onClose,
}: {
  item: DisplayColumnItem;
  x: number;
  y: number;
  onRename: (name: string) => void;
  onChangeIcon?: (icon: string | null) => void;
  onChangeType?: (type: DailyColumnType) => void;
  onSaveOptions?: (options: string[]) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [iconOpen, setIconOpen] = useState(false);
  const [optionInput, setOptionInput] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const opts = Array.isArray(item.options) ? item.options : [];

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
  const W = 320;
  const H = 380;
  const left = Math.max(8, Math.min(x, window.innerWidth - W - 8));
  const top = y + H > window.innerHeight ? Math.max(8, y - H) : y;

  function commitName() {
    const next = name.trim();
    if (next && next !== item.name) {
      onRename(next);
    } else if (!next && item.isFixed && item.fixedId) {
      const defName = DEFAULT_FIXED_CONFIG[item.fixedId].name;
      onRename(defName);
      setName(defName);
    } else {
      setName(item.name);
    }
  }

  function addOption() {
    const next = optionInput.trim();
    if (!next || opts.includes(next) || !onSaveOptions) return;
    onSaveOptions([...opts, next]);
    setOptionInput('');
  }

  const customIcon = item.icon ?? null;

  return createPortal(
    <div
      ref={rootRef}
      role="menu"
      aria-label={`Atur properti ${item.name}`}
      className="fixed z-50 w-80 overflow-visible rounded-2xl border border-gray-200 bg-white py-1.5 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
      style={{ left, top }}
    >
      {/* Input Nama & Pemilih Ikon */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setIconOpen((v) => !v)}
            title="Ganti ikon"
            aria-label="Ganti ikon"
            aria-expanded={iconOpen}
            aria-haspopup="menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-perrific-graphite transition hover:bg-gray-100"
          >
            {customIcon ? <ActivityIcon name={customIcon} /> : <TableColumnIcon type={item.type} />}
          </button>
          {iconOpen && (
            <div
              role="menu"
              aria-label="Pilih ikon"
              className="absolute left-0 top-full z-10 mt-1 grid max-h-56 w-52 grid-cols-6 gap-1 overflow-y-auto rounded-xl border border-gray-200 bg-white p-2 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
            >
              <button
                type="button"
                onClick={() => {
                  onChangeIcon?.(null);
                  setIconOpen(false);
                }}
                title={item.isFixed ? 'Ikon bawaan' : 'Ikuti jenis'}
                aria-label={item.isFixed ? 'Ikon bawaan' : 'Ikuti jenis'}
                aria-pressed={customIcon === null}
                className={`flex h-8 items-center justify-center rounded-lg transition hover:bg-gray-100 ${
                  customIcon === null ? 'bg-perrific-violet/10 text-perrific-violet' : 'text-gray-500'
                }`}
              >
                <TableColumnIcon type={item.type} />
              </button>
              {TAB_ICONS.map((ic) => (
                <button
                  key={ic.key}
                  type="button"
                  onClick={() => {
                    onChangeIcon?.(ic.key);
                    setIconOpen(false);
                  }}
                  title={ic.label}
                  aria-label={ic.label}
                  aria-pressed={customIcon === ic.key}
                  className={`flex h-8 items-center justify-center rounded-lg transition hover:bg-gray-100 ${
                    customIcon === ic.key ? 'bg-perrific-violet/10 text-perrific-violet' : 'text-gray-500'
                  }`}
                >
                  <ActivityIcon name={ic.key} />
                </button>
              ))}
            </div>
          )}
        </div>
        <input
          ref={nameRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              commitName();
              onClose();
            }
            if (e.key === 'Escape') onClose();
          }}
          maxLength={80}
          aria-label="Nama properti"
          placeholder="Nama properti"
          className="min-w-0 flex-1 rounded-xl bg-gray-100/80 px-2.5 py-1.5 font-givonic text-sm font-semibold text-perrific-graphite focus:bg-gray-100 focus:outline-none"
        />
      </div>

      <div className="h-px bg-gray-100" />

      {/* Header: Pilih jenis */}
      <div className="flex items-center justify-between px-3 pb-1 pt-2">
        <p className="font-givonic text-xs font-semibold text-gray-500">
          Pilih jenis
        </p>
        {item.isFixed && (
          <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            Kolom Bawaan
          </span>
        )}
      </div>

      {/* Grid 2 Kolom ala Notion */}
      <div className="grid grid-cols-2 gap-x-2 px-2 py-1">
        {/* Kolom Kiri: Teks, Status, Orang, Telepon */}
        <div className="flex flex-col gap-0.5">
          {PROPERTY_COLUMNS_LEFT.map((typeItem) => {
            const isCurrent = item.type === typeItem.type;
            return (
              <button
                key={typeItem.type}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                disabled={item.isFixed}
                onClick={() => {
                  if (!item.isFixed && onChangeType) {
                    onChangeType(typeItem.type);
                  }
                }}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-givonic text-xs transition ${
                  item.isFixed
                    ? isCurrent
                      ? 'cursor-default bg-gray-50/70 font-semibold text-perrific-graphite'
                      : 'cursor-not-allowed opacity-35 text-gray-400'
                    : isCurrent
                    ? 'bg-perrific-violet/10 font-semibold text-perrific-violet'
                    : 'text-perrific-graphite hover:bg-gray-50'
                }`}
              >
                <TableColumnIcon
                  type={typeItem.type}
                  className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-perrific-violet' : 'text-gray-400'}`}
                />
                <span className="truncate text-left">{typeItem.label}</span>
                {isCurrent && (
                  <span aria-hidden="true" className="ml-auto shrink-0 font-bold text-perrific-violet">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Kolom Kanan: Angka, Tanggal, File & media, URL, Email */}
        <div className="flex flex-col gap-0.5">
          {PROPERTY_COLUMNS_RIGHT.map((typeItem) => {
            const isCurrent = item.type === typeItem.type;
            return (
              <button
                key={typeItem.type}
                type="button"
                role="menuitemradio"
                aria-checked={isCurrent}
                disabled={item.isFixed}
                onClick={() => {
                  if (!item.isFixed && onChangeType) {
                    onChangeType(typeItem.type);
                  }
                }}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 font-givonic text-xs transition ${
                  item.isFixed
                    ? isCurrent
                      ? 'cursor-default bg-gray-50/70 font-semibold text-perrific-graphite'
                      : 'cursor-not-allowed opacity-35 text-gray-400'
                    : isCurrent
                    ? 'bg-perrific-violet/10 font-semibold text-perrific-violet'
                    : 'text-perrific-graphite hover:bg-gray-50'
                }`}
              >
                <TableColumnIcon
                  type={typeItem.type}
                  className={`h-4 w-4 shrink-0 ${isCurrent ? 'text-perrific-violet' : 'text-gray-400'}`}
                />
                <span className="truncate text-left">{typeItem.label}</span>
                {isCurrent && (
                  <span aria-hidden="true" className="ml-auto shrink-0 font-bold text-perrific-violet">
                    ✓
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {item.isFixed && (
        <p className="px-3 py-1 text-[11px] text-gray-400">
          Jenis kolom bawaan tidak dapat diubah.
        </p>
      )}

      {/* Opsi khusus jika tipe SELECT dan bukan kolom bawaan */}
      {!item.isFixed && item.type === 'SELECT' && onSaveOptions && (
        <div className="border-t border-gray-100 px-3 py-2">
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

      {/* Hapus Properti: hanya untuk kolom kustom */}
      {!item.isFixed && onDelete && (
        <>
          <div className="h-px bg-gray-100" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onClose();
              onDelete();
            }}
            className="flex w-full items-center gap-2.5 px-3 py-2.5 font-givonic text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            Hapus properti
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

function DailyPageInner() {
  const [activeView, setActiveView] = useState<'table' | 'calendar'>('table');
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

  // Konfigurasi nama & ikon kustom untuk kolom bawaan (disimpan di localStorage).
  const [fixedMeta, setFixedMeta] = useState<Record<string, { name?: string; icon?: string | null }>>(() => {
    try {
      const raw = localStorage.getItem(FIXED_CONFIG_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const updateFixedMeta = (id: FixedId, patch: { name?: string; icon?: string | null }) => {
    setFixedMeta((prev) => {
      const current = prev[id] ?? {};
      const updated = { ...current };
      if ('name' in patch) {
        if (patch.name === undefined || patch.name.trim() === DEFAULT_FIXED_CONFIG[id].name) {
          delete updated.name;
        } else {
          updated.name = patch.name.trim();
        }
      }
      if ('icon' in patch) {
        if (patch.icon === undefined || patch.icon === null) {
          delete updated.icon;
        } else {
          updated.icon = patch.icon;
        }
      }
      const next = { ...prev, [id]: updated };
      try {
        localStorage.setItem(FIXED_CONFIG_KEY, JSON.stringify(next));
      } catch {
        /* storage error diabaikan */
      }
      return next;
    });
  };

  const getDisplayColumnItem = (entry: string): DisplayColumnItem | null => {
    if (entry.startsWith('fix:')) {
      const fid = entry.slice(4) as FixedId;
      const def = DEFAULT_FIXED_CONFIG[fid];
      if (!def) return null;
      const meta = fixedMeta[fid];
      return {
        id: entry,
        name: meta?.name?.trim() ? meta.name : def.name,
        type: def.type,
        icon: meta?.icon !== undefined ? meta.icon : (def.icon ?? null),
        isFixed: true,
        fixedId: fid,
      };
    }
    const c = columnById.get(entry);
    if (!c) return null;
    return {
      id: c.id,
      name: c.name,
      type: c.type,
      icon: c.icon ?? null,
      isFixed: false,
      options: Array.isArray(c.options) ? c.options : [],
      rawColumn: c,
    };
  };

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
    'fix:date': 140,
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
  }, [displayOrder, columns, fixedMeta]);

  const { socket } = useSocket();

  const fetchActivities = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await activityApi.listMine({ limit: 500 });
      setActivities(data);
    } catch {
      if (!silent) setActivities([]);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Seluruh kegiatan yang secara presisi berada pada 1 hari yang dipilih
  const tableActivities = useMemo(() => {
    return activities.filter((act) => {
      if (!act.date) return false;
      const d = new Date(act.date);
      return (
        d.getFullYear() === selectedDate.getFullYear() &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getDate() === selectedDate.getDate()
      );
    });
  }, [activities, selectedDate]);

  // Pembaruan real-time via WebSocket saat terjadi sinkronisasi atau perubahan aktivitas
  useEffect(() => {
    if (!socket) return;
    const handleSync = () => {
      void fetchActivities(true);
    };
    socket.on('calendar:synced', handleSync);
    return () => {
      socket.off('calendar:synced', handleSync);
    };
  }, [socket]);

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
  async function handleNewPage(targetDate?: Date, time?: { startTime?: string; endTime?: string }) {
    const d = targetDate ?? selectedDate;
    const iso = toISODate(d);
    const created = await activityApi.create({
      title: 'Tanpa judul',
      date: new Date(`${iso}T00:00:00`).toISOString(),
      startTime: time?.startTime,
      endTime: time?.endTime,
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
    const actDate = after.date ? new Date(after.date).toISOString() : new Date(`${dateISO}T00:00:00`).toISOString();
    const created = await activityApi.create({
      title: 'Tanpa judul',
      date: actDate,
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

  async function handleChangeColumnIcon(column: DailyColumn, icon: string | null) {
    const prev = columns;
    setColumns((cs) => cs.map((c) => (c.id === column.id ? { ...c, icon } : c)));
    try {
      const updated = await activityApi.updateColumn(column.id, { icon });
      setColumns((cs) => cs.map((c) => (c.id === column.id ? updated : c)));
    } catch {
      setColumns(prev);
      showToast('Gagal mengubah ikon properti.');
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

  // Hapus properti: snapshot kolom + isi nilai sel di semua aktivitas
  // didorong ke stack undo, bisa dikembalikan via shortcut Ctrl+Z atau toast Urungkan.
  function handleDeleteColumn(column: DailyColumn) {
    const colIndex = columns.findIndex((c) => c.id === column.id);
    const snapshotColumn = { ...column };
    const snapshotOrder = [...displayOrder];
    const snapshotWidth = widths[column.id];
    const cellValues = new Map(activities.map((a) => [a.id, a.customValues?.[column.id] ?? null]));

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

    // Hapus di server (background); jika gagal sinkron ulang
    void activityApi.deleteColumn(column.id).catch(() => fetchColumns());

    const undo = () => {
      // 1. Kembalikan kolom ke posisi semula
      setColumns((prev) => {
        if (prev.some((c) => c.id === snapshotColumn.id)) return prev;
        const next = [...prev];
        next.splice(Math.min(colIndex, next.length), 0, snapshotColumn);
        return next;
      });
      // 2. Kembalikan urutan tampilan
      persistOrder(snapshotOrder);
      // 3. Kembalikan lebar kolom jika ada
      if (snapshotWidth !== undefined) {
        setWidths((prev) => ({ ...prev, [snapshotColumn.id]: snapshotWidth }));
      }
      // 4. Kembalikan nilai sel di setiap aktivitas
      setActivities((prev) =>
        prev.map((a) => {
          const val = cellValues.get(a.id);
          if (val === undefined || val === null) return a;
          return {
            ...a,
            customValues: { ...(a.customValues ?? {}), [snapshotColumn.id]: val },
          };
        }),
      );
      // 5. Buat ulang kolom di server (dengan ID yang sama)
      void activityApi
        .createColumn({
          id: snapshotColumn.id,
          name: snapshotColumn.name,
          type: snapshotColumn.type,
          icon: snapshotColumn.icon ?? undefined,
          options: Array.isArray(snapshotColumn.options) ? snapshotColumn.options : undefined,
        })
        .then((created) => {
          const newId = created.id;
          if (newId !== snapshotColumn.id) {
            setColumns((prev) => prev.map((c) => (c.id === snapshotColumn.id ? created : c)));
            setOrder((prev) => prev.map((id) => (id === snapshotColumn.id ? newId : id)));
            setWidths((prev) => {
              if (!(snapshotColumn.id in prev)) return prev;
              const next = { ...prev, [newId]: prev[snapshotColumn.id] };
              delete next[snapshotColumn.id];
              return next;
            });
            setActivities((prev) =>
              prev.map((a) => {
                if (!a.customValues || !(snapshotColumn.id in a.customValues)) return a;
                const next = { ...a.customValues, [newId]: a.customValues[snapshotColumn.id] };
                delete next[snapshotColumn.id];
                return { ...a, customValues: next };
              }),
            );
          }
          // Kembalikan nilai sel di server
          const toRestore = Array.from(cellValues.entries()).filter(
            ([_, val]) => val !== undefined && val !== null,
          );
          void Promise.all(
            toRestore.map(([actId, val]) => activityApi.setCellValue(actId, newId, val)),
          );
          // Sinkronkan kembali urutan kolom kustom di server
          const customIds = snapshotOrder
            .filter((id) => !id.startsWith('fix:'))
            .map((id) => (id === snapshotColumn.id ? newId : id));
          void activityApi.reorderColumns(customIds);
        })
        .catch(() => {
          fetchColumns();
          fetchActivities();
        });
    };

    const entryId = push(`properti "${column.name}"`, undo);
    showToast(`Properti "${column.name}" dihapus`, {
      label: 'Urungkan',
      onAction: () => undoEntry(entryId),
    });
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
    setSelectedIds((prev) => {
      const allSelected = tableActivities.length > 0 && tableActivities.every((a) => prev.has(a.id));
      const next = new Set(prev);
      if (allSelected) {
        for (const a of tableActivities) next.delete(a.id);
      } else {
        for (const a of tableActivities) next.add(a.id);
      }
      return next;
    });
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
  function openColumnMenu(e: React.MouseEvent, item: DisplayColumnItem) {
    if (Date.now() - lastDragEndRef.current < 300) return;
    if (menu?.id === item.id && e.type === 'click') {
      setMenu(null);
      return;
    }
    const rect =
      (e.currentTarget.closest('th') as HTMLElement | null)?.getBoundingClientRect() ??
      e.currentTarget.getBoundingClientRect();
    setMenu({ id: item.id, x: rect.left, y: rect.bottom + 4 });
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
  function renderHeaderCell(entry: string) {
    const item = getDisplayColumnItem(entry);
    if (!item) return null;

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

    return (
      <DraggableTh
        key={entry}
        id={`${COL_PREFIX}${entry}`}
        entry={entry}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('[role="separator"]')) return;
          openColumnMenu(e, item);
        }}
      >
        <div className="relative flex min-w-0 items-center">
          <span
            ref={(el) => {
              if (el && pendingMenuId === item.id) {
                const th = (el as HTMLElement).closest('th');
                const rect = th?.getBoundingClientRect();
                if (rect) {
                  setPendingMenuId(null);
                  setMenu({ id: item.id, x: rect.left, y: rect.bottom + 4 });
                }
              }
            }}
            className="block min-w-0 flex-1"
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                openColumnMenu(e, item);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                openColumnMenu(e, item);
              }}
              title={`${item.name} — klik untuk mengatur`}
              aria-label={`Atur properti ${item.name}`}
              aria-haspopup="menu"
              className="flex w-full min-w-0 items-center gap-1.5 rounded-md px-1 py-0.5 text-left transition hover:bg-gray-50"
            >
              {item.icon ? (
                <ActivityIcon name={item.icon} className="h-4 w-4 shrink-0 text-gray-400" />
              ) : (
                <TableColumnIcon type={item.type} className="h-4 w-4 shrink-0 text-gray-400" />
              )}
              <span data-col-label className="min-w-0 flex-1 truncate">{item.name}</span>
            </button>
          </span>
          {resizeHit}
        </div>
      </DraggableTh>
    );
  }

  function renderBodyCell(entry: string, a: DailyActivity, isEditing: boolean) {
    if (entry === fixKey('title')) {
      const isUnscheduled = !a.startTime && !a.endTime;
      return (
        <td key={entry} className={FIXED_TD_CLASS.title}>
          <div className="flex min-w-0 items-center gap-1.5">
            {isUnscheduled ? (
              <span
                title="Belum ditambahkan ke kalender (jam mulai & selesai belum diisi)"
                className="flex h-4 w-4 shrink-0 items-center justify-center text-amber-500"
              >
                <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                  <path d="M7.938 2.016a.13.13 0 0 1 .125 0l6.857 11.856c.026.045.026.1 0 .145a.14.14 0 0 1-.125.073H1.205a.14.14 0 0 1-.125-.073.17.17 0 0 1 0-.145L7.938 2.016zm.854 4.484a.5.5 0 0 0-.992 0l-.3 3.5a.5.5 0 0 0 .992.08l.3-3.58zm-.496 5.5a.65.65 0 1 0 0 1.3.65.65 0 0 0 0-1.3z" />
                </svg>
              </span>
            ) : (
              <ActivityIcon name={a.icon} className="h-4 w-4 shrink-0 text-gray-400" />
            )}
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
    if (entry === fixKey('date')) {
      return (
        <td key={entry} className={FIXED_TD_CLASS.date}>
          <input
            type="date"
            value={a.date ? toISODate(new Date(a.date)) : ''}
            onChange={async (e) => {
              const val = e.target.value;
              if (!val) return;
              const newDate = new Date(`${val}T00:00:00`).toISOString();
              const updated = await activityApi.update(a.id, { date: newDate });
              setActivities((prev) => prev.map((item) => (item.id === a.id ? updated : item)));
            }}
            onClick={(e) => e.stopPropagation()}
            title="Klik untuk ubah tanggal"
            className="cursor-pointer rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-gray-700 hover:border-gray-300 hover:bg-white focus:border-violet-400 focus:bg-white focus:outline-none"
          />
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
        <td key={entry} className="p-2">
          <button
            onClick={() => void handleNewPage()}
            className="flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-gray-400 transition hover:bg-gray-50 hover:text-gray-600 focus-visible:opacity-100"
          >
            <span aria-hidden="true">+</span> Baru Item
          </button>
        </td>
      );
    }
    return <td key={entry} />;
  }

  // Lebar tabel deterministik: gutter (40px) + semua kolom + kolom `+` (48px).
  const totalTableWidth = useMemo(() => {
    const cols = displayOrder.reduce((sum, entry) => sum + widthOf(entry), 0);
    return 40 + cols + 48;
  }, [displayOrder, widths]);

  return (
    <div className="w-full space-y-4">
      {/* Judul database ala Notion & Navigasi Tanggal */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight text-gray-900">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="text-gray-900">
              <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="2" />
              <path d="M3 10h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            Jadwal Harian
          </h1>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-gray-200 bg-white p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  setSelectedDate((prev) => {
                    const next = new Date(prev);
                    next.setDate(next.getDate() - 1);
                    return next;
                  });
                }}
                title="Hari sebelumnya"
                aria-label="Hari sebelumnya"
                className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedDate((prev) => {
                    const next = new Date(prev);
                    next.setDate(next.getDate() + 1);
                    return next;
                  });
                }}
                title="Hari berikutnya"
                aria-label="Hari berikutnya"
                className="rounded p-1 text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSelectedDate(new Date())}
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 transition shadow-2xs"
            >
              Hari Ini
            </button>

            <span className="text-sm font-medium text-gray-700">
              {formatHumanDay(selectedDate)}
            </span>
          </div>
        </div>
      </div>

      {/* Toolbar: tab view + ikon + Baru */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1" role="tablist" aria-label="Tampilan database">
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'table'}
            onClick={() => setActiveView('table')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              activeView === 'table'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2" y="2.5" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M2 6h12M6 6v7.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            Semua Kegiatan
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeView === 'calendar'}
            onClick={() => setActiveView('calendar')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition ${
              activeView === 'calendar'
                ? 'bg-gray-900 text-white'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`}
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

      {/* Database tabel atau Kalender */}
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Memuat…</p>
      ) : activeView === 'calendar' ? (
        <CalendarView
          activities={activities}
          selectedDate={selectedDate}
          onSelectDate={(d) => {
            setSelectedDate(d);
          }}
          onCreateActivity={(d, time) => {
            setSelectedDate(d);
            void handleNewPage(d, time);
          }}
          onOpenActivity={(act) => {
            if (act.date) {
              setSelectedDate(new Date(act.date));
            }
            setEditingId(act.id);
            setEditingTitle(act.title);
            setActiveView('table');
            requestAnimationFrame(() => {
              document.getElementById(`activity-${act.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            });
          }}
          onRefreshActivities={() => void fetchActivities(true)}
          onDeleteActivity={(activityId) => {
            setActivities((prev) => prev.filter((a) => a.id !== activityId));
          }}
        />
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
                    checked={tableActivities.length > 0 && tableActivities.every((a) => selectedIds.has(a.id))}
                    ref={(el) => {
                      if (el) {
                        const count = tableActivities.filter((a) => selectedIds.has(a.id)).length;
                        el.indeterminate = count > 0 && count < tableActivities.length;
                      }
                    }}
                    onChange={toggleSelectAll}
                    title={
                      tableActivities.length > 0 && tableActivities.every((a) => selectedIds.has(a.id))
                        ? 'Batalkan semua pilihan'
                        : 'Pilih semua aktivitas'
                    }
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
            <SortableContext items={tableActivities.map((a) => `${ROW_PREFIX}${a.id}`)} strategy={verticalListSortingStrategy}>
            <tbody>
              {tableActivities.map((a) => {
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
                    isUnscheduled={!a.startTime && !a.endTime}
                  >
                    {displayOrder.map((entry) => renderBodyCell(entry, a, isEditing))}
                    <td aria-hidden="true" className="border-b border-gray-200" />
                  </SortableRow>
                );
              })}
              <tr className="group">
                <td className="w-10" />
                {displayOrder.map((entry) => renderPlaceholderCell(entry))}
                <td />
              </tr>
            </tbody>
            </SortableContext>
          </table>
          </div>
        </DndContext>
        {menu && (() => {
          const item = getDisplayColumnItem(menu.id);
          if (!item) return null;
          return (
            <ColumnMenu
              item={item}
              x={menu.x}
              y={menu.y}
              onRename={(name) => {
                if (item.isFixed && item.fixedId) {
                  updateFixedMeta(item.fixedId, { name });
                } else if (item.rawColumn) {
                  void handleRenameColumn(item.rawColumn, name);
                }
              }}
              onChangeIcon={(icon) => {
                if (item.isFixed && item.fixedId) {
                  updateFixedMeta(item.fixedId, { icon });
                } else if (item.rawColumn) {
                  void handleChangeColumnIcon(item.rawColumn, icon);
                }
              }}
              onChangeType={(type) => {
                if (!item.isFixed && item.rawColumn) {
                  void handleChangeColumnType(item.rawColumn, type);
                }
              }}
              onSaveOptions={(options) => {
                if (!item.isFixed && item.rawColumn) {
                  void handleSaveOptions(item.rawColumn, options);
                }
              }}
              onDelete={() => {
                if (!item.isFixed && item.rawColumn) {
                  void handleDeleteColumn(item.rawColumn);
                }
              }}
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
