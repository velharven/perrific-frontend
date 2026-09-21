import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { activityApi } from '@/api/activities';
import { ACTIVITY_ICONS, ActivityIcon, TrashIcon, type ActivityIconName } from '@/components/icons';
import type { DailyActivity, ChecklistItem } from '@/types';

type ViewMode = 'list' | 'time';

// Helpers
function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
function addDays(d: Date, delta: number): Date {
  const n = new Date(d);
  n.setDate(n.getDate() + delta);
  return n;
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
function minutesSinceMidnight(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return d.getHours() * 60 + d.getMinutes();
}

export default function DailyPage() {
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const dateISO = useMemo(() => toISODate(selectedDate), [selectedDate]);
  const [activities, setActivities] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [newTitle, setNewTitle] = useState('');
  const [newIcon, setNewIcon] = useState<ActivityIconName>('note');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const iconPickerRef = useRef<HTMLDivElement>(null);
  const [newStart, setNewStart] = useState('');
  const [newEnd, setNewEnd] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [newChecklistInputs, setNewChecklistInputs] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const location = useLocation();
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const data = await activityApi.listMine({
        date: dateISO,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
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
    setView('list');
    setSearch('');
    setStatusFilter('');
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

  useEffect(() => {
    if (!iconPickerOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (iconPickerRef.current && !iconPickerRef.current.contains(e.target as Node)) {
        setIconPickerOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setIconPickerOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [iconPickerOpen]);

  // debounce search/status
  useEffect(() => {
    const t = setTimeout(fetchActivities, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter]);

  const stats = useMemo(() => {
    const total = activities.length;
    const completed = activities.filter((a) => a.status === 'COMPLETED').length;
    const pending = activities.filter((a) => a.status === 'PENDING').length;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending, progress };
  }, [activities]);

  // ---- actions ----
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const payload: Record<string, unknown> = {
      title: newTitle.trim(),
      description: newDesc.trim() || undefined,
      date: new Date(`${dateISO}T00:00:00`).toISOString(),
      icon: newIcon,
      startTime: combineDateAndTime(dateISO, newStart) ?? undefined,
      endTime: combineDateAndTime(dateISO, newEnd) ?? undefined,
    };
    const created = await activityApi.create(payload);
    setActivities((prev) => [...prev, created].sort((a, b) => a.order - b.order));
    setNewTitle('');
    setNewDesc('');
    setNewStart('');
    setNewEnd('');
  }

  async function toggleComplete(activity: DailyActivity) {
    setBusyId(activity.id);
    try {
      const next = activity.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
      const updated = await activityApi.update(activity.id, { status: next });
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

  async function handleMove(id: string, dir: -1 | 1) {
    const idx = activities.findIndex((a) => a.id === id);
    const target = idx + dir;
    if (target < 0 || target >= activities.length) return;
    const next = [...activities];
    const [moved] = next.splice(idx, 1);
    next.splice(target, 0, moved);
    const orderedIds = next.map((a) => a.id);
    setActivities(next);
    try {
      await activityApi.reorder(orderedIds);
    } catch {
      // rollback on fail
      fetchActivities();
    }
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

  // ---- derived for time view ----
  const { scheduled, unscheduled } = useMemo(() => {
    const s: DailyActivity[] = [];
    const u: DailyActivity[] = [];
    for (const a of activities) {
      if (a.startTime) s.push(a);
      else u.push(a);
    }
    return { scheduled: s.sort((a, b) => (a.startTime! > b.startTime! ? 1 : -1)), unscheduled: u };
  }, [activities]);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Notion-style header */}
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Harian</h1>
            <p className="mt-1 text-sm text-gray-500">{formatHumanDay(selectedDate)}</p>
            <div className="mt-3 flex items-center gap-2">
              <div className="h-2 w-32 overflow-hidden rounded-full bg-gray-100">
                <div className="h-full bg-violet-600 transition-all" style={{ width: `${stats.progress}%` }} />
              </div>
              <span className="text-xs text-gray-500">
                {stats.completed}/{stats.total} selesai · {stats.progress}%
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, -1))}
                className="rounded-md px-2 py-1 text-sm hover:bg-white"
              >
                ‹
              </button>
              <input
                type="date"
                value={dateISO}
                onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
                className="rounded-md border-0 bg-transparent px-2 py-1 text-sm focus:ring-0"
              />
              <button
                onClick={() => setSelectedDate(addDays(selectedDate, 1))}
                className="rounded-md px-2 py-1 text-sm hover:bg-white"
              >
                ›
              </button>
            </div>
            <button
              onClick={() => setSelectedDate(new Date())}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm hover:bg-gray-50"
            >
              Hari ini
            </button>
          </div>
        </div>

        {/* toolbar ala Notion */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari aktivitas…"
            className="min-w-[200px] flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm placeholder:text-gray-400 focus:border-violet-300 focus:bg-white focus:outline-none"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
          >
            <option value="">Semua status</option>
            <option value="PENDING">Pending</option>
            <option value="COMPLETED">Selesai</option>
            <option value="SKIPPED">Lewati</option>
          </select>
          <div className="ml-auto flex rounded-lg border border-gray-200 p-1">
            <button
              onClick={() => setView('list')}
              className={`rounded-md px-3 py-1.5 text-sm ${view === 'list' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              List
            </button>
            <button
              onClick={() => setView('time')}
              className={`rounded-md px-3 py-1.5 text-sm ${view === 'time' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'}`}
            >
              Time-blocking
            </button>
          </div>
        </div>
      </div>

      {/* Quick add — Notion block */}
      <form
        onSubmit={handleCreate}
        className="rounded-xl border border-dashed border-gray-300 bg-white p-4 shadow-sm hover:border-violet-300"
      >
        <div className="flex items-start gap-2">
          <div className="relative" ref={iconPickerRef}>
            <button
              type="button"
              onClick={() => setIconPickerOpen((v) => !v)}
              title="Pilih ikon"
              aria-haspopup="listbox"
              aria-expanded={iconPickerOpen}
              className="rounded-lg border border-gray-200 bg-gray-50 p-2 text-gray-700 hover:bg-gray-100"
            >
              <ActivityIcon name={newIcon} className="h-5 w-5" />
            </button>
            {iconPickerOpen && (
              <div
                role="listbox"
                aria-label="Pilih ikon aktivitas"
                className="absolute left-0 top-full z-20 mt-2 grid grid-cols-6 gap-1 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
              >
                {ACTIVITY_ICONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    role="option"
                    aria-selected={newIcon === key}
                    title={label}
                    aria-label={label}
                    onClick={() => {
                      setNewIcon(key);
                      setIconPickerOpen(false);
                    }}
                    className={`rounded-lg p-2 ${
                      newIcon === key ? 'bg-violet-100 text-violet-700' : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <ActivityIcon name={key} className="h-5 w-5" />
                  </button>
                ))}
              </div>
            )}
          </div>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ketik judul aktivitas dan tekan Enter… (Notion-style block)"
            className="flex-1 rounded-lg border-0 bg-transparent px-2 py-2 text-sm placeholder:text-gray-400 focus:outline-none"
          />
          <button className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700">
            Tambah
          </button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Mulai
            <input
              type="time"
              value={newStart}
              onChange={(e) => setNewStart(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-gray-500">
            Selesai
            <input
              type="time"
              value={newEnd}
              onChange={(e) => setNewEnd(e.target.value)}
              className="rounded-md border border-gray-200 bg-white px-2 py-1"
            />
          </label>
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Catatan singkat (opsional)"
            className="min-w-[200px] flex-1 rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs"
          />
        </div>
        <p className="mt-2 text-[11px] text-gray-400">
          Tip: kosongkan jam jika aktivitas tanpa time-blocking. {newTitle.trim() ? 'Tekan Enter untuk menambah.' : ''}
        </p>
      </form>

      {/* List / Time views */}
      {loading ? (
        <p className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">Memuat…</p>
      ) : activities.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-sm text-gray-500">Belum ada aktivitas pada {formatHumanDay(selectedDate)}.</p>
          <p className="mt-1 text-xs text-gray-400">Tambah block di atas seperti di Notion — tiap hari adalah halaman kosong.</p>
        </div>
      ) : view === 'time' ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          {unscheduled.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-400">
                Tanpa jam · {unscheduled.length}
              </h3>
              <div className="grid gap-2">
                {unscheduled.map((a) => (
                  <ActivityCard
                    key={a.id}
                    activity={a}
                    busyId={busyId}
                    editingId={editingId}
                    editingTitle={editingTitle}
                    setEditingId={setEditingId}
                    setEditingTitle={setEditingTitle}
                    onToggle={() => toggleComplete(a)}
                    onSaveTitle={() => handleUpdateTitle(a)}
                    onDelete={() => handleDelete(a.id)}
                    onDuplicate={() => handleDuplicate(a.id)}
                    onMoveUp={() => handleMove(a.id, -1)}
                    onMoveDown={() => handleMove(a.id, 1)}
                    onTimeChange={handleTimeChange}
                    checklistInput={newChecklistInputs[a.id] ?? ''}
                    onChecklistInput={(v) => setNewChecklistInputs((p) => ({ ...p, [a.id]: v }))}
                    onAddChecklist={() => handleAddChecklist(a.id)}
                    onToggleCheck={handleToggleChecklist}
                    onRemoveCheck={handleRemoveChecklist}
                  />
                ))}
              </div>
            </div>
          )}

          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-400">Time-blocking (06:00–22:00)</h3>
          <div className="relative overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {/* hourly grid */}
            <div className="absolute inset-0">
              {Array.from({ length: 17 }, (_, i) => {
                const hour = 6 + i;
                return (
                  <div key={hour} className="absolute w-full border-t border-dashed border-gray-200" style={{ top: `${(i * 60 * 2) / 1}px` }}>
                    <span className="absolute -top-2 left-2 bg-gray-50 px-1 text-[10px] text-gray-400">
                      {String(hour).padStart(2, '0')}:00
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="relative min-h-[960px] py-4 pl-16 pr-3">
              {scheduled.map((a) => {
                const startMin = minutesSinceMidnight(a.startTime);
                const endMin = minutesSinceMidnight(a.endTime);
                if (startMin === null) return null;
                const top = (startMin - 360) * 1; // scale 1px per minute, 6am base
                const duration = endMin !== null ? Math.max(30, endMin - startMin) : 60;
                const height = duration * 1;
                const clampedTop = Math.max(0, top);
                return (
                  <div
                    key={a.id}
                    className={`absolute left-16 right-3 overflow-hidden rounded-lg border bg-white p-2 shadow-sm ${
                      a.status === 'COMPLETED' ? 'border-green-200 bg-green-50' : 'border-violet-200'
                    }`}
                    style={{ top: clampedTop, height }}
                  >
                    <div className="flex items-start gap-2">
                      <input type="checkbox" checked={a.status === 'COMPLETED'} onChange={() => toggleComplete(a)} className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className={`flex items-center gap-1 truncate text-xs font-medium ${a.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                          <ActivityIcon name={a.icon} className="h-3.5 w-3.5 shrink-0 text-gray-500" />
                          <span className="truncate">{a.title}</span>
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {a.startTime ? formatTime(a.startTime) : ''} {a.endTime ? `– ${formatTime(a.endTime)}` : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {scheduled.length === 0 && <p className="relative text-sm text-gray-400">Tidak ada aktivitas terjadwal untuk hari ini.</p>}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {activities.map((a) => (
            <ActivityCard
              key={a.id}
              activity={a}
              busyId={busyId}
              editingId={editingId}
              editingTitle={editingTitle}
              setEditingId={setEditingId}
              setEditingTitle={setEditingTitle}
              onToggle={() => toggleComplete(a)}
              onSaveTitle={() => handleUpdateTitle(a)}
              onDelete={() => handleDelete(a.id)}
              onDuplicate={() => handleDuplicate(a.id)}
              onMoveUp={() => handleMove(a.id, -1)}
              onMoveDown={() => handleMove(a.id, 1)}
              onTimeChange={handleTimeChange}
              checklistInput={newChecklistInputs[a.id] ?? ''}
              onChecklistInput={(v) => setNewChecklistInputs((p) => ({ ...p, [a.id]: v }))}
              onAddChecklist={() => handleAddChecklist(a.id)}
              onToggleCheck={handleToggleChecklist}
              onRemoveCheck={handleRemoveChecklist}
            />
          ))}
        </div>
      )}

      <p className="text-center text-xs text-gray-400">
        Halaman harian — tiap tanggal adalah database view terpisah seperti di Notion.
      </p>
    </div>
  );
}

function ActivityCard({
  activity,
  busyId,
  editingId,
  editingTitle,
  setEditingId,
  setEditingTitle,
  onToggle,
  onSaveTitle,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onTimeChange,
  checklistInput,
  onChecklistInput,
  onAddChecklist,
  onToggleCheck,
  onRemoveCheck,
}: {
  activity: DailyActivity;
  busyId: string | null;
  editingId: string | null;
  editingTitle: string;
  setEditingId: (v: string | null) => void;
  setEditingTitle: (v: string) => void;
  onToggle: () => void;
  onSaveTitle: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onTimeChange: (a: DailyActivity, start: string, end: string) => void;
  checklistInput: string;
  onChecklistInput: (v: string) => void;
  onAddChecklist: () => void;
  onToggleCheck: (item: ChecklistItem) => void;
  onRemoveCheck: (item: ChecklistItem) => void;
}) {
  const a = activity;
  const isEditing = editingId === a.id;
  const toHHMM = (iso: string | null | undefined) => {
    if (!iso) return '';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };
  const startVal = toHHMM(a.startTime);
  const endVal = toHHMM(a.endTime);

  return (
    <div id={`activity-${a.id}`} className="group scroll-mt-24 rounded-xl border border-gray-200 bg-white p-3 shadow-sm hover:border-gray-300">
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={a.status === 'COMPLETED'}
          onChange={onToggle}
          disabled={busyId === a.id}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-violet-600"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ActivityIcon name={a.icon} className="h-4 w-4 shrink-0 text-gray-500" />
            {isEditing ? (
              <input
                autoFocus
                value={editingTitle}
                onChange={(e) => setEditingTitle(e.target.value)}
                onBlur={onSaveTitle}
                onKeyDown={(e) => e.key === 'Enter' && onSaveTitle()}
                className="flex-1 rounded-md border border-violet-300 bg-white px-2 py-1 text-sm"
              />
            ) : (
              <button
                onClick={() => {
                  setEditingId(a.id);
                  setEditingTitle(a.title);
                }}
                className={`flex-1 text-left text-sm font-medium hover:bg-gray-50 rounded px-1 ${a.status === 'COMPLETED' ? 'line-through text-gray-400' : 'text-gray-800'}`}
              >
                {a.title}
              </button>
            )}
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${a.status === 'COMPLETED' ? 'bg-green-100 text-green-700' : a.status === 'SKIPPED' ? 'bg-gray-100 text-gray-500' : 'bg-amber-100 text-amber-700'}`}>
              {a.status}
            </span>
          </div>

          {a.description && <p className="mt-1 text-xs text-gray-500">{a.description}</p>}

          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-md bg-gray-50 px-2 py-1 text-gray-500">
              {a.startTime ? formatTime(a.startTime) : 'Tanpa jam'}
              {a.endTime ? ` → ${formatTime(a.endTime)}` : ''}
            </span>
            <span className="text-gray-300">·</span>
            <label className="flex items-center gap-1 text-gray-500">
              <input
                type="time"
                defaultValue={startVal}
                onBlur={(e) => onTimeChange(a, e.target.value, endVal)}
                className="rounded-md border border-gray-200 px-1.5 py-0.5"
              />
              –
              <input
                type="time"
                defaultValue={endVal}
                onBlur={(e) => onTimeChange(a, startVal, e.target.value)}
                className="rounded-md border border-gray-200 px-1.5 py-0.5"
              />
            </label>
          </div>

          {/* Checklist blocks */}
          <div className="mt-3 space-y-1.5">
            {a.checklistItems.length > 0 && (
              <ul className="space-y-1">
                {a.checklistItems.map((c) => (
                  <li key={c.id} className="flex items-center gap-2 rounded-md bg-gray-50 px-2 py-1.5">
                    <input type="checkbox" checked={c.completed} onChange={() => onToggleCheck(c)} className="h-3.5 w-3.5" />
                    <span className={`flex-1 text-xs ${c.completed ? 'line-through text-gray-400' : 'text-gray-700'}`}>{c.text}</span>
                    <button onClick={() => onRemoveCheck(c)} className="text-[11px] text-gray-400 hover:text-red-500">
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-1.5">
              <input
                value={checklistInput}
                onChange={(e) => onChecklistInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), onAddChecklist())}
                placeholder="Tambah sub-todo dan Enter…"
                className="flex-1 rounded-md border border-dashed border-gray-300 bg-white px-2 py-1.5 text-xs placeholder:text-gray-400"
              />
              <button onClick={onAddChecklist} className="rounded-md bg-gray-900 px-2.5 py-1 text-xs text-white hover:bg-black">
                +
              </button>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-1 opacity-0 transition group-hover:opacity-100">
          <button onClick={onMoveUp} className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs hover:bg-gray-50" title="Naik">
            ↑
          </button>
          <button onClick={onMoveDown} className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs hover:bg-gray-50" title="Turun">
            ↓
          </button>
          <button onClick={onDuplicate} className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 text-xs hover:bg-gray-50" title="Duplicate">
            ⧉
          </button>
          <button onClick={onDelete} className="flex items-center justify-center rounded-md border border-red-200 bg-white px-1.5 py-1 text-red-500 hover:bg-red-50" title="Hapus" aria-label="Hapus aktivitas">
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
