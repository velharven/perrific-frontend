import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
import { useLocation } from 'react-router-dom';
import { activityApi } from '@/api/activities';
import { ActivityIcon, TrashIcon } from '@/components/icons';
import type { DailyActivity, ChecklistItem } from '@/types';

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

// Baris tabel yang bisa diseret via handle titik-titik (id aktivitas).
// Drag hanya dari grip agar klik baris, edit judul, dan dropdown tetap aman.
function SortableRow({
  id,
  selected,
  onToggle,
  children,
}: {
  id: string;
  selected?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      id={`activity-${id}`}
      onClick={onToggle}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : undefined,
        position: isDragging ? 'relative' : undefined,
        zIndex: isDragging ? 10 : undefined,
      }}
      className={`group scroll-mt-24 cursor-pointer transition hover:bg-amber-50/40 ${selected ? 'bg-green-50/40' : ''}`}
    >
      <td className="w-9 border border-gray-200 px-1 py-2 text-center">
        <span
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          role="button"
          tabIndex={0}
          title="Seret untuk menyusun ulang"
          aria-label="Seret untuk menyusun ulang"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex cursor-grab touch-none items-center p-1 text-gray-300 opacity-0 transition hover:text-gray-500 group-hover:opacity-100 focus-visible:opacity-100 active:cursor-grabbing max-sm:opacity-100"
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
      </td>
      {children}
    </tr>
  );
}

export default function DailyPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const dateISO = useMemo(() => toISODate(selectedDate), [selectedDate]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingTime, setEditingTime] = useState<{ id: string; field: 'start' | 'end' } | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [newChecklistInputs, setNewChecklistInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const location = useLocation();
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  // Klik yang lahir dari drag diabaikan agar panel detail tak ikut terbuka.
  const suppressClick = useRef(false);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Hapus ${selectedIds.size} aktivitas yang dipilih?`)) return;
    const ids = [...selectedIds];
    setSelectedIds(new Set());
    try {
      await Promise.all(ids.map((id) => activityApi.remove(id)));
      setActivities((prev) => prev.filter((a) => !ids.includes(a.id)));
    } catch {
      fetchActivities();
    }
  }

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

  async function handleDelete(id: string) {
    if (!confirm('Hapus aktivitas ini?')) return;
    await activityApi.remove(id);
    setActivities((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleDuplicate(id: string) {
    const dup = await activityApi.duplicate(id);
    setActivities((prev) => [...prev, dup].sort((a, b) => a.order - b.order));
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = activities.findIndex((a) => a.id === String(active.id));
    const to = activities.findIndex((a) => a.id === String(over.id));
    if (from < 0 || to < 0) return;
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const next = arrayMove(activities, from, to);
    setActivities(next);
    activityApi.reorder(next.map((a) => a.id)).catch(() => fetchActivities());
  }

  // checklist actions
  async function handleAddChecklist(activityId: string) {
    const text = (newChecklistInputs[activityId] ?? '').trim();
    if (!text) return;
    const item = await activityApi.addChecklist(activityId, text);
    setActivities((prev) =>
      prev.map((a) => (a.id === activityId ? { ...a, checklistItems: [...a.checklistItems, item] } : a)),
    );
    setNewChecklistInputs((prev) => ({ ...prev, [activityId]: '' }));
  }

  async function handleToggleChecklist(item: ChecklistItem) {
    const updated = await activityApi.updateChecklist(item.id, { completed: !item.completed });
    setActivities((prev) =>
      prev.map((a) =>
        a.id === item.activityId
          ? { ...a, checklistItems: a.checklistItems.map((c) => (c.id === item.id ? updated : c)) }
          : a,
      ),
    );
  }

  async function handleRemoveChecklist(item: ChecklistItem) {
    await activityApi.removeChecklist(item.id);
    setActivities((prev) =>
      prev.map((a) =>
        a.id === item.activityId
          ? { ...a, checklistItems: a.checklistItems.filter((c) => c.id !== item.id) }
          : a,
      ),
    );
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

  return (
    <div className="mx-auto max-w-6xl space-y-4">
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
        <div className={`relative ${selectedIds.size > 0 ? 'pt-9' : ''}`}>
          {selectedIds.size > 0 && (
            <div className="absolute left-9 top-0 z-50 flex items-center gap-3 whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-sm shadow-md">
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse border border-gray-200 text-left text-sm">
            <thead>
              <tr className="text-xs text-gray-500">
                <th className="w-9 border border-gray-200 px-1 py-2 font-medium">
                  <span className="sr-only">Susun</span>
                </th>
                <th className="w-14 border border-gray-200 px-2 py-2 text-center font-medium">
                  <input
                    type="checkbox"
                    checked={activities.length > 0 && selectedIds.size === activities.length}
                    ref={(el) => {
                      if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < activities.length;
                    }}
                    onChange={toggleSelectAll}
                    aria-label="Pilih semua aktivitas"
                    className="h-4 w-4 rounded border-gray-300 text-violet-600"
                  />
                </th>
                <th className="border border-gray-200 px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span aria-hidden="true" className="font-serif text-sm font-bold">Aa</span> Kegiatan
                  </span>
                </th>
                <th className="w-32 border border-gray-200 px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Waktu Mulai
                  </span>
                </th>
                <th className="w-32 border border-gray-200 px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M8 5v3l2 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    Waktu Selesai
                  </span>
                </th>
                <th className="w-32 border border-gray-200 px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <rect x="2" y="4.5" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1.5" />
                      <path d="M2 4.5h12M6 2.5h4v2" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    Kategori
                  </span>
                </th>
                <th className="w-36 border border-gray-200 px-3 py-2 font-medium">
                  <span className="flex items-center gap-1.5">
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M4 5.5l4 4 4-4M4 9.5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Status
                  </span>
                </th>
              </tr>
            </thead>
            <SortableContext items={activities.map((a) => a.id)} strategy={verticalListSortingStrategy}>
            <tbody>
              {activities.length === 0 && (
                <>
                  {Array.from({ length: 4 }, (_, i) => (
                    <tr key={`empty-${i}`} aria-hidden="true">
                      <td className="h-10 border border-gray-200" />
                      <td className="border border-gray-200" />
                      <td className="border border-gray-200" />
                      <td className="border border-gray-200" />
                      <td className="border border-gray-200" />
                      <td className="border border-gray-200" />
                      <td className="border border-gray-200" />
                    </tr>
                  ))}
                </>
              )}
              {activities.map((a) => {
                const expanded = expandedId === a.id;
                const isEditing = editingId === a.id;
                const typeMeta = TYPE_META[a.type] ?? TYPE_META.CUSTOM;
                const statusClass = STATUS_OPTIONS.find((o) => o.value === a.status)?.className ?? '';
                return (
                  <Fragment key={a.id}>
                    <SortableRow
                      id={a.id}
                      selected={a.status === 'COMPLETED'}
                      onToggle={() => {
                        if (suppressClick.current) return;
                        setExpandedId(expanded ? null : a.id);
                      }}
                    >
                      <td className="w-14 border border-gray-200 px-2 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Pilih ${a.title}`}
                          className="h-4 w-4 rounded border-gray-300 text-violet-600"
                        />
                      </td>
                      <td className="max-w-[280px] border border-gray-200 px-3 py-2">
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
                      <td className="whitespace-nowrap border border-gray-200 px-3 py-2 text-xs">{timeCell(a, 'start')}</td>
                      <td className="whitespace-nowrap border border-gray-200 px-3 py-2 text-xs">{timeCell(a, 'end')}</td>
                      <td className="border border-gray-200 px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-xs ${typeMeta.className}`}>{typeMeta.label}</span>
                      </td>
                      <td className="border border-gray-200 px-3 py-2">
                        <select
                          value={a.status}
                          disabled={busyId === a.id}
                          onChange={(e) => void handleStatusChange(a, e.target.value as DailyActivity['status'])}
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`Status ${a.title}`}
                          className={`cursor-pointer rounded px-1.5 py-0.5 text-xs focus:outline-none disabled:opacity-60 ${statusClass}`}
                        >
                          {STATUS_OPTIONS.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                    </SortableRow>
                    {expanded && (
                      <tr key={`${a.id}-detail`} className="bg-gray-50/70">
                        <td colSpan={7} className="border border-gray-200 px-3 py-3">
                          {a.task && (
                            <p className="mb-2 text-xs text-gray-500">
                              Dari task tim: <span className="font-semibold text-violet-700">{a.task.title}</span>
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-gray-500">
                              {a.checklistItems.filter((c) => c.completed).length}/{a.checklistItems.length} sub-todo selesai
                            </span>
                            <span className="ml-auto flex gap-1.5">
                              <button onClick={() => handleDuplicate(a.id)} className="rounded-md border border-gray-200 bg-white px-2 py-1 hover:bg-gray-100" title="Duplikat">
                                ⧉ Duplikat
                              </button>
                              <button onClick={() => handleDelete(a.id)} className="flex items-center gap-1 rounded-md border border-red-200 bg-white px-2 py-1 text-red-500 hover:bg-red-50" title="Hapus">
                                <TrashIcon className="h-3.5 w-3.5" /> Hapus
                              </button>
                            </span>
                          </div>
                          <div className="mt-2.5 max-w-xl space-y-1.5">
                            {a.checklistItems.length > 0 && (
                              <ul className="space-y-1">
                                {a.checklistItems.map((c) => (
                                  <li key={c.id} className="flex items-center gap-2 rounded-md bg-white px-2 py-1.5 shadow-sm">
                                    <input type="checkbox" checked={c.completed} onChange={() => handleToggleChecklist(c)} className="h-3.5 w-3.5" />
                                    <span className={`flex-1 text-xs ${c.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{c.text}</span>
                                    <button onClick={() => handleRemoveChecklist(c)} className="text-[11px] text-gray-400 hover:text-red-500">
                                      ✕
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                            <div className="flex gap-1.5">
                              <input
                                value={newChecklistInputs[a.id] ?? ''}
                                onChange={(e) => setNewChecklistInputs((p) => ({ ...p, [a.id]: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddChecklist(a.id))}
                                placeholder="Tambah sub-todo dan Enter…"
                                className="flex-1 rounded-md border border-dashed border-gray-300 bg-white px-2 py-1.5 text-xs placeholder:text-gray-400"
                              />
                              <button onClick={() => handleAddChecklist(a.id)} className="rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white hover:bg-black">
                                +
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              <tr>
                <td className="border border-gray-200" />
                <td className="border border-gray-200" />
                <td className="border border-gray-200 px-3 py-2">
                  <button
                    onClick={() => void handleNewPage()}
                    className="flex items-center gap-1.5 rounded px-1 py-0.5 text-sm text-gray-400 transition hover:bg-gray-50 hover:text-gray-600"
                  >
                    <span aria-hidden="true">+</span> Baru item
                  </button>
                </td>
                <td className="border border-gray-200" />
                <td className="border border-gray-200" />
                <td className="border border-gray-200" />
                <td className="border border-gray-200" />
              </tr>
            </tbody>
            </SortableContext>
          </table>
          </div>
        </DndContext>
        </div>
      )}

    </div>
  );
}
