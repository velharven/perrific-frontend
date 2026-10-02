import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { taskApi } from '@/api/tasks';
import { projectApi } from '@/api/projects';
import Avatar from '@/components/ui/Avatar';
import { PencilIcon, TrashIcon } from '@/components/icons';
import { Pencil, Trash2 } from 'lucide-react';
import MenuPortal from '@/components/ui/MenuPortal';
import { showToast } from '@/components/ui/Toast';
import { decodeDataUrlText, fileExtLabel, previewKind } from '@/lib/preview';
import { TaskDetailSkeleton } from '@/components/ui/loading';
import type { Attachment, BoardColumn, Comment, Project, Task, TaskActivity, Team } from '@/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatFull(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDayTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const date = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${date} ${time}`;
}

const PRIORITY_OPTS = [
  { v: 'LOW', label: 'LOW' },
  { v: 'MEDIUM', label: 'MEDIUM' },
  { v: 'HIGH', label: 'HIGH' },
  { v: 'URGENT', label: 'URGENT' },
] as const;

// Baris aktivitas upload: "mengunggah X" + thumbnail pratinjau bila file masih ada.
function UploadActivityText({
  activity,
  attachments,
  onPreview,
}: {
  activity: TaskActivity;
  attachments: Attachment[];
  onPreview: (attachmentId: string) => void;
}) {
  const filename = activity.meta?.filename ?? 'file';
  const live = activity.meta?.attachmentId
    ? (attachments.find((x) => x.id === activity.meta?.attachmentId) ?? null)
    : null;
  const kind = live ? previewKind(live) : null;
  return (
    <>
      mengunggah{' '}
      <span className="font-semibold">{filename}</span>
      {live && kind && (
        <button
          type="button"
          onClick={() => onPreview(live.id)}
          title={`Pratinjau ${filename}`}
          aria-label={`Pratinjau ${filename}`}
          className="ml-1.5 inline-block shrink-0 overflow-hidden rounded border border-gray-200 align-middle transition hover:border-perrific-violet"
        >
          {kind === 'image' ? (
            <img src={live.dataUrl} alt="" aria-hidden="true" loading="lazy" draggable={false} className="h-6 w-6 object-cover" />
          ) : (
            <span
              className={`flex h-6 w-6 items-center justify-center font-manrope text-[8px] font-bold ${
                kind === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {kind === 'pdf' ? 'PDF' : fileExtLabel(filename)}
            </span>
          )}
        </button>
      )}
    </>
  );
}

export default function TaskDetailView({
  taskId,
  project,
  team,
  currentUserId,
  isAdmin,
  onClose,
  onUpdated,
  onDeleted,
  onTaskLoaded,
}: {
  taskId: string;
  project: Project | null;
  team: Team | null;
  currentUserId?: string;
  isAdmin: boolean;
  onClose: () => void;
  onUpdated: (task: Task) => void;
  onDeleted: (taskId: string) => void;
  onTaskLoaded?: (task: Task) => void;
}) {
  const [task, setTask] = useState<Task | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [activities, setActivities] = useState<TaskActivity[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [tab, setTab] = useState<'comments' | 'activities'>('comments');

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [assignQuery, setAssignQuery] = useState('');
  const [watcherMenuOpen, setWatcherMenuOpen] = useState(false);
  const [watcherQuery, setWatcherQuery] = useState('');
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const assignWrapRef = useRef<HTMLDivElement>(null);
  const watcherWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [commentDraft, setCommentDraft] = useState('');
  const [sendingComment, setSendingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentDraft, setEditingCommentDraft] = useState('');
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingAttachmentId, setEditingAttachmentId] = useState<string | null>(null);
  const [attachmentDraft, setAttachmentDraft] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);

  useEffect(() => {
    if (!previewId) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setPreviewId(null);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [previewId]);

  async function refreshActivities() {
    try {
      const items = await taskApi.listActivities(taskId);
      setActivities(items);
    } catch {
      // biarkan daftar lama; tab menampilkan yang terakhir termuat
    }
  }

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError(false);
    Promise.all([
      taskApi.get(taskId),
      taskApi.listComments(taskId).catch(() => [] as Comment[]),
      taskApi.listActivities(taskId).catch(() => [] as TaskActivity[]),
    ])
      .then(([t, cs, acts]) => {
        if (!alive) return;
        setTask(t);
        setComments(cs);
        setActivities(acts);
        setTitleDraft(t.title);
        setDescDraft(t.description ?? '');
        onTaskLoaded?.(t);
        projectApi
          .listColumns(t.projectId)
          .then((cols) => {
            if (alive) setColumns(cols);
          })
          .catch(() => {});
      })
      .catch(() => {
        if (alive) setLoadError(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [taskId]);

  async function patch(body: Partial<Task>, opts?: { silent?: boolean }) {
    if (!task) return;
    setSaving(true);
    try {
      const updated = await taskApi.update(task.id, body);
      // Pertahankan lampiran & watchers lokal bila respons tak menyertakannya.
      const merged = {
        ...updated,
        attachments: updated.attachments ?? task.attachments,
        watchers: (updated as Task).watchers ?? task.watchers,
      };
      setTask(merged);
      setTitleDraft(merged.title);
      setDescDraft(merged.description ?? '');
      onUpdated(merged);
      // Kolom & assignee tercatat sebagai aktivitas baru di server.
      if (body.columnId !== undefined || 'assigneeIds' in body) refreshActivities();
    } catch {
      if (!opts?.silent) showToast('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function saveTitle() {
    if (!task) return setEditingTitle(false);
    const v = titleDraft.trim();
    if (!v || v === task.title) {
      setTitleDraft(task.title);
      setEditingTitle(false);
      return;
    }
    setEditingTitle(false);
    await patch({ title: v });
  }

  const descDirty = !!task && descDraft !== (task.description ?? '');

  async function saveDesc() {
    if (!task || !descDirty) return;
    await patch({ description: descDraft.trim() || undefined });
  }

  async function toggleAssignee(userId: string) {
    if (!task) return;
    const ids = task.assignees.map((a) => a.id);
    const next = ids.includes(userId) ? ids.filter((x) => x !== userId) : [...ids, userId];
    await patch({ assigneeIds: next } as Partial<Task>);
  }

  async function toggleWatcher(userId: string) {
    if (!task) return;
    const watching = (task.watchers ?? []).some((w) => w.id === userId);
    try {
      if (watching) {
        await taskApi.removeWatcher(task.id, userId);
        setTask({ ...task, watchers: (task.watchers ?? []).filter((w) => w.id !== userId) });
      } else {
        const watcher = await taskApi.addWatcher(task.id, userId);
        const rest = (task.watchers ?? []).filter((w) => w.id !== watcher.id);
        setTask({ ...task, watchers: [...rest, watcher] });
      }
    } catch {
      showToast('Gagal mengubah watcher. Coba lagi.');
    }
  }

  function readFiles(files: FileList | null) {
    if (!files || !task) return;
    const picked = Array.from(files).filter((f) => {
      if (f.size > 5 * 1024 * 1024) {
        showToast(`"${f.name}" melebihi 5 MB.`);
        return false;
      }
      return true;
    });
    if (picked.length === 0) return;
    setUploading(true);
    (async () => {
      const done: Attachment[] = [];
      let failed = 0;
      for (const file of picked) {
        const dataUrl = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result ?? '') || null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(file);
        });
        if (!dataUrl) {
          failed += 1;
          continue;
        }
        try {
          const att = await taskApi.addAttachment(task.id, {
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            dataUrl,
          });
          done.push(att);
        } catch {
          failed += 1;
        }
      }
      if (failed > 0) showToast(`${failed} lampiran gagal diunggah.`);
      if (done.length > 0) {
        setTask((prev) =>
          prev ? { ...prev, attachments: [...(prev.attachments ?? []), ...done] } : prev,
        );
        refreshActivities();
      }
      setUploading(false);
    })();
  }

  async function removeAttachment(attachmentId: string) {
    if (!task) return;
    if (!confirm('Hapus lampiran ini?')) return;
    try {
      await taskApi.removeAttachment(task.id, attachmentId);
      setTask((prev) =>
        prev ? { ...prev, attachments: (prev.attachments ?? []).filter((a) => a.id !== attachmentId) } : prev,
      );
    } catch {
      showToast('Gagal menghapus lampiran.');
    }
  }

  async function saveAttachmentCaption() {
    if (!task || !editingAttachmentId) return;
    try {
      const updated = await taskApi.updateAttachment(task.id, editingAttachmentId, attachmentDraft.trim() || null);
      setTask((prev) =>
        prev
          ? { ...prev, attachments: (prev.attachments ?? []).map((a) => (a.id === editingAttachmentId ? updated : a)) }
          : prev,
      );
      setEditingAttachmentId(null);
      setAttachmentDraft('');
    } catch {
      showToast('Gagal menyimpan deskripsi.');
    }
  }

  async function sendComment(e: React.FormEvent) {
    e.preventDefault();
    if (!task || !commentDraft.trim() || sendingComment) return;
    setSendingComment(true);
    try {
      const c = await taskApi.addComment(task.id, commentDraft.trim());
      setComments((prev) => [...prev, c]);
      setCommentDraft('');
    } catch {
      showToast('Gagal mengirim komentar.');
    } finally {
      setSendingComment(false);
    }
  }

  async function saveEditedComment() {
    if (!task || !editingCommentId || !editingCommentDraft.trim()) return;
    try {
      const updated = await taskApi.updateComment(task.id, editingCommentId, editingCommentDraft.trim());
      setComments((prev) => prev.map((c) => (c.id === editingCommentId ? updated : c)));
      setEditingCommentId(null);
      setEditingCommentDraft('');
    } catch {
      showToast('Gagal menyimpan komentar.');
    }
  }

  async function removeComment(commentId: string) {
    if (!task) return;
    if (!confirm('Hapus komentar ini?')) return;
    try {
      await taskApi.removeComment(task.id, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      showToast('Gagal menghapus komentar.');
    }
  }

  async function handleDelete() {
    if (!task) return;
    if (!confirm(`Hapus task "${task.title}"?`)) return;
    try {
      await taskApi.remove(task.id);
      onDeleted(task.id);
      onClose();
    } catch {
      showToast('Gagal menghapus task.');
    }
  }

  async function decideApproval(approval: 'APPROVED' | 'REJECTED') {
    if (!task) return;
    if (approval === 'REJECTED' && !confirm(`Tolak usulan "${task.title}"?`)) return;
    setSaving(true);
    try {
      const decided = approval === 'APPROVED' ? await taskApi.approve(task.id) : await taskApi.reject(task.id);
      const merged = { ...decided, attachments: decided.attachments ?? task.attachments };
      setTask(merged);
      onUpdated(merged);
    } catch {
      showToast('Gagal memproses persetujuan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {loading ? (
        <TaskDetailSkeleton />
      ) : loadError || !task ? (
        <div className="py-10 text-center">
          <p className="font-manrope text-sm text-gray-500">Task tidak ditemukan.</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 font-manrope text-xs font-semibold text-white"
          >
            Kembali
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
          {/* Kolom utama */}
          <div className="min-w-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex min-w-0 items-baseline gap-1.5">
                  <span className="shrink-0 font-manrope text-lg font-bold text-perrific-violet">
                    #{task.number}
                  </span>
                  {editingTitle ? (
                    <input
                      autoFocus
                      value={titleDraft}
                      onChange={(e) => setTitleDraft(e.target.value)}
                      onBlur={saveTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveTitle();
                        if (e.key === 'Escape') {
                          setTitleDraft(task.title);
                          setEditingTitle(false);
                        }
                      }}
                      maxLength={120}
                      className="min-w-0 flex-1 rounded-lg border border-perrific-violet px-2 py-1 font-manrope text-lg font-bold text-perrific-graphite focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingTitle(true)}
                      title="Ubah judul"
                      className="min-w-0 flex-1 truncate text-left font-manrope text-lg font-bold text-perrific-graphite hover:underline"
                    >
                      {task.title}
                    </button>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[11px] tracking-widest text-perrific-graphite/50">
                  {(project?.name ?? 'TASK').toUpperCase()} · {(task.column?.name ?? 'Tanpa kolom').toUpperCase()}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-manrope text-[11px] text-gray-400">
                  Dibuat {formatDayTime(task.createdAt)}
                </p>
                {task.assignees.length > 0 && (
                  <span className="mt-1 flex justify-end -space-x-1.5">
                    {task.assignees.slice(0, 4).map((a) => (
                      <Avatar key={a.id} src={a.avatarUrl} name={a.name} size={20} alt={a.name} className="h-5 w-5 text-[9px] ring-2 ring-white" />
                    ))}
                  </span>
                )}
              </div>
            </div>

            {(task.approval ?? 'APPROVED') !== 'APPROVED' && (
              <div
                className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl px-3 py-2.5 ${
                  task.approval === 'REJECTED' ? 'bg-red-50' : 'bg-amber-50'
                }`}
              >
                <p className={`font-manrope text-xs font-semibold ${task.approval === 'REJECTED' ? 'text-red-700' : 'text-amber-700'}`}>
                  {task.approval === 'REJECTED' ? 'Usulan ini ditolak admin.' : 'Usulan ini menunggu persetujuan admin.'}
                </p>
                {isAdmin && (
                  <span className="flex gap-1.5">
                    {task.approval !== 'REJECTED' && (
                      <button
                        type="button"
                        onClick={() => decideApproval('REJECTED')}
                        disabled={saving}
                        className="rounded-lg border border-red-200 bg-white px-3 py-1.5 font-manrope text-[11px] font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                      >
                        Tolak
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => decideApproval('APPROVED')}
                      disabled={saving}
                      className="rounded-lg bg-perrific-mint px-3 py-1.5 font-manrope text-[11px] font-bold text-perrific-graphite hover:brightness-95 disabled:opacity-50"
                    >
                      {task.approval === 'REJECTED' ? 'Setujui lagi' : 'Setujui'}
                    </button>
                  </span>
                )}
              </div>
            )}

            {/* Deskripsi */}
            <div className="mt-3">
              <textarea
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                placeholder="Tambahkan deskripsi agar anggota lain paham task ini"
                rows={3}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 font-manrope text-sm text-gray-700 placeholder:text-gray-400 focus:border-perrific-violet focus:outline-none"
              />
              {descDirty && (
                <div className="mt-1.5 flex gap-2">
                  <button
                    type="button"
                    onClick={saveDesc}
                    disabled={saving}
                    className="rounded-lg bg-perrific-violet px-3 py-1.5 font-manrope text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {saving ? 'Menyimpan…' : 'Simpan deskripsi'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDescDraft(task.description ?? '')}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 font-manrope text-xs text-gray-500 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                </div>
              )}
            </div>

            {/* Lampiran */}
            <div className="mt-4">
              <div className="flex items-center justify-between bg-gray-100 px-2 py-1.5">
                <p className="font-manrope text-xs font-bold text-perrific-graphite">
                  {(task.attachments ?? []).length} Attachments
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  aria-label="Tambah lampiran"
                  title="Tambah lampiran"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-perrific-mint font-manrope text-sm font-bold leading-none text-perrific-graphite transition hover:brightness-95"
                >
                  +
                </button>
              </div>
              {(task.attachments ?? []).length === 0 ? (
                <label
                  htmlFor="task-detail-files"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    readFiles(e.dataTransfer.files);
                  }}
                  className={`mt-1 block cursor-pointer rounded-lg border border-dashed px-3 py-4 text-center font-manrope text-xs transition ${
                    dragActive
                      ? 'border-perrific-violet bg-orange-50 text-perrific-violet'
                      : 'border-gray-300 text-gray-400 hover:border-perrific-violet hover:text-perrific-violet'
                  }`}
                >
                  {uploading ? 'Mengunggah…' : dragActive ? 'Lepaskan file di sini!' : 'Drop attachments here!'}
                </label>
              ) : (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={() => setDragActive(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragActive(false);
                    readFiles(e.dataTransfer.files);
                  }}
                  className={`mt-1 rounded-lg border ${dragActive ? 'border-perrific-violet bg-orange-50/50' : 'border-gray-200'}`}
                >
                  {dragActive && (
                    <p className="px-3 py-2 text-center font-manrope text-xs font-semibold text-perrific-violet">
                      Lepaskan file untuk menambah!
                    </p>
                  )}
                  <ul className="divide-y divide-gray-100">
                    {(task.attachments ?? []).map((a) => (
                      <li key={a.id} className="group px-3 py-2">
                        <div className="flex items-center justify-between gap-2">
                          {(() => {
                            const kind = previewKind(a);
                            if (!kind) return null;
                            return (
                              <button
                                type="button"
                                onClick={() => setPreviewId(a.id)}
                                title="Pratinjau file"
                                aria-label={`Pratinjau ${a.filename}`}
                                className="shrink-0 overflow-hidden rounded-md border border-gray-200 transition hover:border-perrific-violet"
                              >
                                {kind === 'image' ? (
                                  <img
                                    src={a.dataUrl}
                                    alt=""
                                    aria-hidden="true"
                                    loading="lazy"
                                    draggable={false}
                                    className="h-10 w-10 object-cover"
                                  />
                                ) : (
                                  <span
                                    className={`flex h-10 w-10 items-center justify-center font-manrope text-[10px] font-bold ${
                                      kind === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                                    }`}
                                  >
                                    {kind === 'pdf' ? 'PDF' : fileExtLabel(a.filename)}
                                  </span>
                                )}
                              </button>
                            );
                          })()}
                          <a
                            href={a.dataUrl}
                            download={a.filename}
                            className="min-w-0 flex-1 truncate font-manrope text-xs text-perrific-violet hover:underline"
                            title={a.filename}
                          >
                            {a.filename}
                          </a>
                          <span className="shrink-0 font-manrope text-[11px] text-gray-400">
                            {(a.size / 1024).toFixed(0)} KB
                          </span>
                          <span className="flex shrink-0 gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAttachmentId(a.id);
                                setAttachmentDraft(a.description ?? '');
                              }}
                              title="Tambah deskripsi"
                              aria-label={`Tambah deskripsi untuk ${a.filename}`}
                              className="rounded-md p-1 text-gray-400 hover:bg-orange-100 hover:text-perrific-violet"
                            >
                              <PencilIcon className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeAttachment(a.id)}
                              title="Hapus lampiran"
                              aria-label={`Hapus ${a.filename}`}
                              className="rounded-md p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                            >
                              <TrashIcon className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        </div>
                        {editingAttachmentId === a.id ? (
                          <div className="mt-1.5 flex gap-1.5">
                            <input
                              autoFocus
                              value={attachmentDraft}
                              onChange={(e) => setAttachmentDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveAttachmentCaption();
                                if (e.key === 'Escape') {
                                  setEditingAttachmentId(null);
                                  setAttachmentDraft('');
                                }
                              }}
                              placeholder="Deskripsi pendek… (maks 280)"
                              maxLength={280}
                              aria-label={`Deskripsi untuk ${a.filename}`}
                              className="min-w-0 flex-1 rounded-lg border border-perrific-violet px-2 py-1 font-manrope text-xs focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={saveAttachmentCaption}
                              className="shrink-0 rounded-lg bg-perrific-violet px-2.5 py-1 font-manrope text-[11px] font-semibold text-white"
                            >
                              Simpan
                            </button>
                          </div>
                        ) : (
                          a.description && <p className="mt-0.5 font-manrope text-[11px] text-gray-500">{a.description}</p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <input
                ref={fileInputRef}
                id="task-detail-files"
                type="file"
                multiple
                className="hidden"
                onChange={(e) => {
                  readFiles(e.target.files);
                  e.target.value = '';
                }}
              />
            </div>

            {/* Pratinjau gambar */}
            {(() => {
              const preview = (task.attachments ?? []).find((a) => a.id === previewId);
              if (!preview) return null;
              const kind = previewKind(preview);
              if (!kind) return null;
              return createPortal(
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Pratinjau ${preview.filename}`}
                  className="fixed inset-0 z-[80] flex flex-col bg-black/90"
                  onMouseDown={(e) => {
                    if (e.target === e.currentTarget) setPreviewId(null);
                  }}
                >
                  <div className="flex shrink-0 items-center justify-between gap-3 p-4">
                    <p className="min-w-0 flex-1 truncate font-manrope text-sm font-bold text-white">
                      {preview.filename}
                    </p>
                    <span className="flex shrink-0 gap-1.5">
                      <a
                        href={preview.dataUrl}
                        download={preview.filename}
                        className="rounded-lg bg-white/15 px-3 py-1.5 font-manrope text-xs font-semibold text-white transition hover:bg-white/25"
                      >
                        Unduh
                      </a>
                      <button
                        type="button"
                        onClick={() => setPreviewId(null)}
                        aria-label="Tutup pratinjau"
                        className="rounded-lg bg-white/15 px-3 py-1.5 font-manrope text-xs font-semibold text-white transition hover:bg-white/25"
                      >
                        Tutup
                      </button>
                    </span>
                  </div>
                  <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-4">
                    {kind === 'image' ? (
                      <img
                        src={preview.dataUrl}
                        alt={preview.filename}
                        className="max-h-full max-w-full object-contain"
                        draggable={false}
                      />
                    ) : kind === 'pdf' ? (
                      <object
                        data={preview.dataUrl}
                        type="application/pdf"
                        className="h-full min-h-[60vh] w-full max-w-6xl rounded-lg bg-white"
                      >
                        <p className="p-4 font-manrope text-sm text-gray-500">
                          Browser tidak bisa menampilkan PDF ini. Gunakan tombol Unduh.
                        </p>
                      </object>
                    ) : (
                      <pre className="max-h-full w-full max-w-4xl overflow-auto whitespace-pre-wrap break-words rounded-lg bg-white/10 p-4 text-left font-mono text-xs text-gray-100">
                        {decodeDataUrlText(preview.dataUrl)}
                      </pre>
                    )}
                  </div>
                  {preview.description && (
                    <p className="shrink-0 px-4 pb-4 text-center font-manrope text-xs text-gray-300">
                      {preview.description}
                    </p>
                  )}
                </div>,
                document.body,
              );
            })()}

            {/* Komentar / Aktivitas */}
            <div className="mt-4">
              <div className="flex gap-4 bg-gray-100 px-3">
                <button
                  type="button"
                  onClick={() => setTab('comments')}
                  className={`border-b-2 py-2 font-manrope text-xs font-bold ${tab === 'comments' ? 'border-perrific-graphite text-perrific-graphite' : 'border-transparent text-gray-400'}`}
                >
                  {comments.length} Comments
                </button>
                <button
                  type="button"
                  onClick={() => setTab('activities')}
                  className={`border-b-2 py-2 font-manrope text-xs font-bold ${tab === 'activities' ? 'border-perrific-graphite text-perrific-graphite' : 'border-transparent text-gray-400'}`}
                >
                  {activities.length} Activities
                </button>
              </div>
              {tab === 'comments' ? (
                <div className="mt-2">
                  {comments.length === 0 ? (
                    <p className="py-3 text-center font-manrope text-xs text-gray-400">Belum ada komentar.</p>
                  ) : (
                    <ul className="space-y-2">
                      {comments.map((c) => {
                        const mine = !!currentUserId && c.authorId === currentUserId;
                        const editing = editingCommentId === c.id;
                        return (
                          <li key={c.id} className="group flex items-start gap-2 rounded-xl bg-gray-50 px-3 py-2">
                            <Avatar src={c.author?.avatarUrl} name={c.author?.name ?? '?'} size={24} alt={c.author?.name ?? 'Penulis'} className="h-6 w-6 shrink-0 text-[10px]" />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-start justify-between gap-2 font-manrope text-[11px] text-gray-400">
                                <span>
                                  <span className="font-bold text-perrific-graphite">{c.author?.name ?? 'Anggota'}</span> · {timeAgo(c.createdAt)}
                                  {c.updatedAt !== c.createdAt && <span> · diubah</span>}
                                </span>
                                {mine && !editing && (
                                  <span className="flex shrink-0 gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentId(c.id);
                                        setEditingCommentDraft(c.content);
                                      }}
                                      title="Edit komentar"
                                      aria-label="Edit komentar"
                                      className="rounded-md p-1 text-gray-400 hover:bg-orange-100 hover:text-perrific-violet"
                                    >
                                      <PencilIcon className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => removeComment(c.id)}
                                      title="Hapus komentar"
                                      aria-label="Hapus komentar"
                                      className="rounded-md p-1 text-gray-400 hover:bg-red-100 hover:text-red-600"
                                    >
                                      <TrashIcon className="h-3.5 w-3.5" />
                                    </button>
                                  </span>
                                )}
                              </p>
                              {editing ? (
                                <div className="mt-1">
                                  <textarea
                                    autoFocus
                                    value={editingCommentDraft}
                                    onChange={(e) => setEditingCommentDraft(e.target.value)}
                                    rows={2}
                                    className="w-full rounded-lg border border-perrific-violet px-2 py-1.5 font-manrope text-sm focus:outline-none"
                                  />
                                  <div className="mt-1 flex gap-1.5">
                                    <button
                                      type="button"
                                      onClick={saveEditedComment}
                                      disabled={!editingCommentDraft.trim()}
                                      className="rounded-md bg-perrific-violet px-2.5 py-1 font-manrope text-[11px] font-semibold text-white disabled:opacity-50"
                                    >
                                      Simpan
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setEditingCommentDraft('');
                                      }}
                                      className="rounded-md border border-gray-200 px-2.5 py-1 font-manrope text-[11px] text-gray-500 hover:bg-gray-100"
                                    >
                                      Batal
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <p className="mt-0.5 font-manrope text-sm text-gray-700">{c.content}</p>
                              )}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  <form onSubmit={sendComment} className="mt-2">
                    <textarea
                      value={commentDraft}
                      onChange={(e) => setCommentDraft(e.target.value)}
                      placeholder="Type a new comment here"
                      rows={3}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2 font-manrope text-sm placeholder:text-gray-400 focus:border-perrific-violet focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={sendingComment || !commentDraft.trim()}
                      className="mt-1.5 rounded-lg bg-gray-900 px-4 py-2 font-manrope text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {sendingComment ? 'Mengirim…' : 'Kirim'}
                    </button>
                  </form>
                </div>
              ) : activities.length === 0 ? (
                <p className="py-3 text-center font-manrope text-xs text-gray-400">Belum ada aktivitas.</p>
              ) : (
                <ul className="mt-2 divide-y divide-gray-100">
                  {activities.map((a) => (
                    <li key={a.id} className="flex items-start gap-2 py-2">
                      <Avatar src={a.actor?.avatarUrl} name={a.actor?.name ?? '?'} size={24} alt={a.actor?.name ?? 'Pelaku'} className="h-6 w-6 shrink-0 text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <p className="font-manrope text-xs text-gray-600">
                          <span className="font-bold text-perrific-graphite">{a.actor?.name ?? 'Anggota'}</span>{' '}
                          {a.kind === 'MOVED' ? (
                            <>
                              memindahkan card dari{' '}
                              <span className="font-semibold">{a.fromColumn ?? '?'}</span>{' '}
                              ke <span className="font-semibold">{a.toColumn ?? '?'}</span>
                            </>
                          ) : a.kind === 'ASSIGNED' ? (
                            <>
                              memberi tugas ke <span className="font-semibold">{a.targetUser?.name ?? 'anggota'}</span>
                            </>
                          ) : a.kind === 'ATTACHMENT_ADDED' ? (
                            <UploadActivityText activity={a} attachments={task.attachments ?? []} onPreview={setPreviewId} />
                          ) : (
                            <>
                              menghapus <span className="font-semibold">{a.targetUser?.name ?? 'anggota'}</span> dari tugas
                            </>
                          )}
                        </p>
                        <p className="font-manrope text-[11px] text-gray-400">{timeAgo(a.createdAt)} · {formatFull(a.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="min-w-0 space-y-4">
            <div>
              <p className="font-manrope text-sm font-bold tracking-wide text-perrific-graphite">{task.column?.name ?? 'Tanpa kolom'}</p>
              <button
                ref={statusBtnRef}
                type="button"
                onClick={() => {
                  setStatusMenuOpen((v) => !v);
                  setPriorityMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={statusMenuOpen}
                aria-label="Pindah kolom"
                className="mt-1 flex w-full items-center justify-between rounded-md bg-gray-500 px-2 py-1.5 font-manrope text-[11px] font-bold tracking-widest text-white"
              >
                PINDAH KOLOM
                <span aria-hidden="true">▾</span>
              </button>
              {statusMenuOpen && (
                <MenuPortal anchorRef={statusBtnRef} label="Pindah kolom" estimatedHeight={150} onClose={() => setStatusMenuOpen(false)}>
                  {columns.map((o) => (
                    <button
                      key={o.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={task.columnId === o.id}
                      onClick={() => {
                        setStatusMenuOpen(false);
                        if (task.columnId !== o.id) patch({ columnId: o.id });
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left font-manrope text-xs font-bold tracking-widest transition hover:bg-gray-100 ${task.columnId === o.id ? 'text-perrific-violet' : 'text-perrific-graphite'}`}
                    >
                      {o.name.toUpperCase()}
                      {task.columnId === o.id && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </MenuPortal>
              )}
            </div>

            <div>
              <p className="font-mono text-[11px] tracking-widest text-perrific-graphite/50">PRIORITY</p>
              <button
                ref={priorityBtnRef}
                type="button"
                onClick={() => {
                  setPriorityMenuOpen((v) => !v);
                  setStatusMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={priorityMenuOpen}
                aria-label="Ubah prioritas"
                className="mt-1 flex w-full items-center justify-between rounded-xl bg-gray-200 py-2 pl-3 pr-3 font-manrope text-xs font-bold tracking-widest text-perrific-graphite"
              >
                {task.priority}
                <span aria-hidden="true" className="text-perrific-graphite/60">▾</span>
              </button>
              {priorityMenuOpen && (
                <MenuPortal anchorRef={priorityBtnRef} label="Ubah prioritas" estimatedHeight={180} onClose={() => setPriorityMenuOpen(false)}>
                  {PRIORITY_OPTS.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      role="menuitemradio"
                      aria-checked={task.priority === o.v}
                      onClick={() => {
                        setPriorityMenuOpen(false);
                        if (task.priority !== o.v) patch({ priority: o.v });
                      }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left font-manrope text-xs font-bold tracking-widest transition hover:bg-gray-100 ${task.priority === o.v ? 'text-perrific-violet' : 'text-perrific-graphite'}`}
                    >
                      {o.label}
                      {task.priority === o.v && <span aria-hidden="true">✓</span>}
                    </button>
                  ))}
                </MenuPortal>
              )}
              <label className="mt-2 block font-mono text-[11px] tracking-widest text-perrific-graphite/50" htmlFor="task-detail-due">
                DEADLINE
              </label>
              <input
                id="task-detail-due"
                type="date"
                value={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ''}
                onChange={(e) => patch({ dueDate: e.target.value ? new Date(`${e.target.value}T00:00:00`).toISOString() : undefined } as Partial<Task>)}
                className="mt-1 w-full rounded-xl border border-gray-200 px-2 py-2 font-manrope text-xs focus:border-perrific-violet focus:outline-none"
              />
            </div>

            <div ref={assignWrapRef}>
              <p className="font-mono text-[11px] tracking-widest text-perrific-graphite/50">ASSIGNED</p>
              {task.assignees.length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {task.assignees.map((a) => (
                    <span key={a.id} className="flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-1">
                      <Avatar src={a.avatarUrl} name={a.name} size={20} alt={a.name} className="h-5 w-5 text-[9px]" />
                      <span className="max-w-[90px] truncate font-manrope text-[11px] text-gray-600">{a.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleAssignee(a.id)}
                        aria-label={`Hapus ${a.name}`}
                        className="rounded-full px-1 font-manrope text-[11px] text-gray-400 hover:bg-gray-200 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setAssignQuery('');
                    setAssignMenuOpen(true);
                  }}
                  className="flex-1 rounded-md bg-gray-50 px-2 py-1.5 font-manrope text-[11px] text-gray-600 hover:bg-gray-100"
                >
                  + Add assigned
                </button>
                {currentUserId && !task.assignees.some((a) => a.id === currentUserId) && (
                  <button
                    type="button"
                    onClick={() => toggleAssignee(currentUserId)}
                    className="flex-1 rounded-md bg-gray-50 px-2 py-1.5 font-manrope text-[11px] text-gray-600 hover:bg-gray-100"
                  >
                    Assign to me
                  </button>
                )}
              </div>
              {assignMenuOpen && (
                <MenuPortal anchorRef={assignWrapRef} label="Cari anggota" width={224} estimatedHeight={260} onClose={() => setAssignMenuOpen(false)}>
                  <div className="px-2 pb-1">
                    <input
                      autoFocus
                      value={assignQuery}
                      onChange={(e) => setAssignQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setAssignMenuOpen(false);
                      }}
                      placeholder="Cari anggota…"
                      aria-label="Cari anggota"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-manrope text-xs focus:border-perrific-violet focus:outline-none"
                    />
                  </div>
                  <div className="nice-scroll max-h-44 overflow-y-auto">
                    {(() => {
                      const q = assignQuery.trim().toLowerCase();
                      const ids = task.assignees.map((a) => a.id);
                      const opts = (team?.members ?? []).filter(
                        (m) =>
                          !ids.includes(m.userId) &&
                          (!q || (m.user?.name ?? '').toLowerCase().includes(q) || (m.user?.email ?? '').toLowerCase().includes(q)),
                      );
                      if (opts.length === 0) return <p className="px-3 py-2 font-manrope text-xs text-gray-400">Belum ada anggota.</p>;
                      return opts.map((m) => {
                        const label = m.user?.name ?? m.user?.email ?? m.userId;
                        return (
                          <button
                            key={m.userId}
                            type="button"
                            onClick={() => {
                              setAssignMenuOpen(false);
                              toggleAssignee(m.userId);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-gray-100"
                          >
                            <Avatar src={m.user?.avatarUrl} name={label} size={24} alt={label} className="h-6 w-6 text-[10px]" />
                            <span className="min-w-0 flex-1 truncate font-manrope text-xs text-gray-600">{label}</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </MenuPortal>
              )}
            </div>

            <div ref={watcherWrapRef}>
              <p className="font-mono text-[11px] tracking-widest text-perrific-graphite/50">WATCHERS</p>
              {(task.watchers ?? []).length > 0 && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  {(task.watchers ?? []).map((w) => (
                    <span key={w.id} className="flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-1">
                      <Avatar src={w.avatarUrl} name={w.name} size={20} alt={w.name} className="h-5 w-5 text-[9px]" />
                      <span className="max-w-[90px] truncate font-manrope text-[11px] text-gray-600">{w.name}</span>
                      <button
                        type="button"
                        onClick={() => toggleWatcher(w.id)}
                        aria-label={`Hapus ${w.name} dari watchers`}
                        className="rounded-full px-1 font-manrope text-[11px] text-gray-400 hover:bg-gray-200 hover:text-red-600"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setWatcherQuery('');
                    setWatcherMenuOpen(true);
                  }}
                  className="flex-1 rounded-md bg-gray-50 px-2 py-1.5 font-manrope text-[11px] text-gray-600 hover:bg-gray-100"
                >
                  + Add watchers
                </button>
                {currentUserId && (
                  <button
                    type="button"
                    onClick={() => toggleWatcher(currentUserId)}
                    className="flex-1 rounded-md bg-gray-50 px-2 py-1.5 font-manrope text-[11px] text-gray-600 hover:bg-gray-100"
                  >
                    {(task.watchers ?? []).some((w) => w.id === currentUserId) ? 'Unwatch' : '◎ Watch'}
                  </button>
                )}
              </div>
              {watcherMenuOpen && (
                <MenuPortal anchorRef={watcherWrapRef} label="Cari anggota" width={224} estimatedHeight={260} onClose={() => setWatcherMenuOpen(false)}>
                  <div className="px-2 pb-1">
                    <input
                      autoFocus
                      value={watcherQuery}
                      onChange={(e) => setWatcherQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setWatcherMenuOpen(false);
                      }}
                      placeholder="Cari anggota…"
                      aria-label="Cari anggota"
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-manrope text-xs focus:border-perrific-violet focus:outline-none"
                    />
                  </div>
                  <div className="nice-scroll max-h-44 overflow-y-auto">
                    {(() => {
                      const q = watcherQuery.trim().toLowerCase();
                      const ids = (task.watchers ?? []).map((w) => w.id);
                      const opts = (team?.members ?? []).filter(
                        (m) =>
                          !ids.includes(m.userId) &&
                          (!q || (m.user?.name ?? '').toLowerCase().includes(q) || (m.user?.email ?? '').toLowerCase().includes(q)),
                      );
                      if (opts.length === 0) return <p className="px-3 py-2 font-manrope text-xs text-gray-400">Belum ada anggota.</p>;
                      return opts.map((m) => {
                        const label = m.user?.name ?? m.user?.email ?? m.userId;
                        return (
                          <button
                            key={m.userId}
                            type="button"
                            onClick={() => {
                              setWatcherMenuOpen(false);
                              toggleWatcher(m.userId);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-gray-100"
                          >
                            <Avatar src={m.user?.avatarUrl} name={label} size={24} alt={label} className="h-6 w-6 text-[10px]" />
                            <span className="min-w-0 flex-1 truncate font-manrope text-xs text-gray-600">{label}</span>
                          </button>
                        );
                      });
                    })()}
                  </div>
                </MenuPortal>
              )}
            </div>

            <div className="flex gap-1.5 border-t border-gray-200 pt-3">
              <button
                type="button"
                onClick={() => setEditingTitle(true)}
                title="Ubah judul"
                aria-label="Ubah judul"
                className="flex h-8 w-8 items-center justify-center rounded-md bg-orange-50 text-perrific-violet hover:bg-orange-100 cursor-pointer"
              >
                <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={handleDelete}
                  title="Hapus task"
                  aria-label="Hapus task"
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-red-50 text-red-600 hover:bg-red-100 cursor-pointer"
                >
                  <Trash2 size={14} strokeWidth={1.8} aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                title="Kembali"
                aria-label="Kembali"
                className="flex h-8 flex-1 items-center justify-center rounded-md bg-gray-100 font-manrope text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                Kembali
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
