import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '@/api/projects';
import { taskApi } from '@/api/tasks';
import { teamApi } from '@/api/teams';
import { showToast } from '@/components/ui/Toast';
import ModalShell from '@/components/ui/ModalShell';
import MenuPortal from '@/components/ui/MenuPortal';
import KanbanBoard, { DEFAULT_BOARD_VIEW, loadBoardView, saveBoardView, type BoardView } from '@/components/kanban/KanbanBoard';
import { APP_SIDEBAR_EVENT, isAppSidebarCollapsed } from '@/components/layout/AppLayout';
import { PROJECT_SIDEBAR_EVENT, isProjectSidebarCollapsed } from '@/components/layout/ProjectLayout';
import { PROJECT_UPDATED_EVENT } from '@/pages/ProjectSettingsPage';
import Avatar from '@/components/ui/Avatar';
import { useAuth } from '@/store/auth';
import type { BoardColumn, Project, Task, Team } from '@/types';

export const BOARD_VIEW_EVENT = 'boardview-changed';

export default function BoardPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<BoardView>(DEFAULT_BOARD_VIEW);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [assignMenuOpen, setAssignMenuOpen] = useState(false);
  const [assignQuery, setAssignQuery] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM');
  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [statusMenuOpen, setStatusMenuOpen] = useState(false);
  const [dueDate, setDueDate] = useState('');
  const [pendingFiles, setPendingFiles] = useState<{ filename: string; mimeType: string; size: number; dataUrl: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<'' | Task['priority']>('');
  const [filterAssignee, setFilterAssignee] = useState<string>('all');
  const [assigneeMenuQuery, setAssigneeMenuQuery] = useState('');
  const [createdByMenuQuery, setCreatedByMenuQuery] = useState('');
  const [priorityMenuQuery, setPriorityMenuQuery] = useState('');
  const [roleMenuQuery, setRoleMenuQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'all' | 'ADMIN' | 'MEMBER'>('all');
  const [filterCreatedBy, setFilterCreatedBy] = useState<string>('all');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterFlyout, setFilterFlyout] = useState<null | 'priority' | 'assignee' | 'role' | 'createdBy'>(null);
  // Offset pill bawah agar center ke area konten (di luar sidebar).
  // Route /board/* memakai sidebar utama (256px), tab kanban project memakai sidebar project (224px).
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(() =>
    location.pathname.startsWith('/board/') ? isAppSidebarCollapsed() : isProjectSidebarCollapsed(),
  );

  useEffect(() => {
    const sync = () =>
      setSbCollapsed(
        location.pathname.startsWith('/board/') ? isAppSidebarCollapsed() : isProjectSidebarCollapsed(),
      );
    window.addEventListener(APP_SIDEBAR_EVENT, sync);
    window.addEventListener(PROJECT_SIDEBAR_EVENT, sync);
    return () => {
      window.removeEventListener(APP_SIDEBAR_EVENT, sync);
      window.removeEventListener(PROJECT_SIDEBAR_EVENT, sync);
    };
  }, [location.pathname]);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const flyoutTimer = useRef<number | null>(null);

  // Toleransi hover: tutup flyout 220ms setelah kursor pergi, batal bila kembali.
  function cancelFlyoutClose() {
    if (flyoutTimer.current !== null) {
      window.clearTimeout(flyoutTimer.current);
      flyoutTimer.current = null;
    }
  }

  function scheduleFlyoutClose() {
    cancelFlyoutClose();
    flyoutTimer.current = window.setTimeout(() => setFilterFlyout(null), 220);
  }

  function openFlyout(which: 'priority' | 'assignee' | 'role' | 'createdBy') {
    cancelFlyoutClose();
    setFilterFlyout(which);
  }

  useEffect(() => {
    return () => {
      if (flyoutTimer.current !== null) window.clearTimeout(flyoutTimer.current);
    };
  }, []);

  const FILTER_PRIORITIES = [
    { v: '', label: 'Semua prioritas' },
    { v: 'LOW', label: 'Low' },
    { v: 'MEDIUM', label: 'Medium' },
    { v: 'HIGH', label: 'High' },
    { v: 'URGENT', label: 'Urgent' },
  ] as const;

  const FILTER_ASSIGNEES = [
    { v: 'all', label: 'Semua task' },
    { v: 'mine', label: 'Punya saya' },
    { v: 'unassigned', label: 'Belum di-assign' },
  ] as const;

  const FILTER_ROLES = [
    { v: 'all', label: 'Semua role' },
    { v: 'ADMIN', label: 'Admin' },
    { v: 'MEMBER', label: 'Member' },
  ] as const;

  const filterOptionCount =
    (filterPriority ? 1 : 0) +
    (filterAssignee !== 'all' ? 1 : 0) +
    (filterRole !== 'all' ? 1 : 0) +
    (filterCreatedBy !== 'all' ? 1 : 0);
  const priorityBtnRef = useRef<HTMLButtonElement>(null);
  const statusBtnRef = useRef<HTMLButtonElement>(null);
  const assignWrapRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!projectId) return;
    setView(loadBoardView(projectId));
    const reload = () => setView(loadBoardView(projectId));
    window.addEventListener(BOARD_VIEW_EVENT, reload);
    return () => window.removeEventListener(BOARD_VIEW_EVENT, reload);
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;
    Promise.all([projectApi.getProject(projectId), projectApi.listTasks(projectId), projectApi.listColumns(projectId)])
      .then(async ([p, t, cols]) => {
        setProject(p);
        setTasks(t);
        setColumns(cols);
        setStatus((prev) => (prev && cols.some((c) => c.id === prev) ? prev : (cols[0]?.id ?? '')));
        if (p.teamId) {
          teamApi
            .getTeam(p.teamId)
            .then(setTeam)
            .catch(() => setTeam(null));
        }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    const onUpdated = (e: Event) => setProject((e as CustomEvent<Project>).detail);
    window.addEventListener(PROJECT_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROJECT_UPDATED_EVENT, onUpdated);
  }, []);

  function moveTask(taskId: string, columnId: string, insertAt?: number) {
    const prev = tasks;
    // Pindah antar kolom ke posisi lubang (order pecahan di antara tetangga),
    // atau ke ujung bila tanpa indeks.
    const targetOrders = tasks
      .filter((t) => t.columnId === columnId && t.id !== taskId)
      .map((t) => t.order ?? 0)
      .sort((a, b) => a - b);
    let order: number;
    if (insertAt === undefined || targetOrders.length === 0) {
      order = targetOrders.length > 0 ? targetOrders[targetOrders.length - 1] + 1 : 0;
    } else if (insertAt <= 0) {
      order = targetOrders[0] - 1;
    } else if (insertAt >= targetOrders.length) {
      order = targetOrders[targetOrders.length - 1] + 1;
    } else {
      order = (targetOrders[insertAt - 1] + targetOrders[insertAt]) / 2;
    }
    setTasks((tasks) => tasks.map((t) => (t.id === taskId ? { ...t, columnId, order } : t)));
    taskApi.update(taskId, { columnId, order }).then(
      (updated) => {
        setTasks((tasks) => tasks.map((t) => (t.id === taskId ? updated : t)));
      },
      (e) => {
        setTasks(prev);
        showToast(apiMessage(e, 'Gagal memindah task. Coba lagi.'));
      },
    );
  }

  function reorderColumn(columnId: string, orderedIds: string[]) {
    const prev = tasks;
    const orderOf = new Map(orderedIds.map((id, idx) => [id, idx] as const));
    setTasks((tasks) =>
      tasks
        .map((t) => (orderOf.has(t.id) ? { ...t, order: orderOf.get(t.id)! } : t))
        .sort((a, b) => {
          const ao = orderOf.get(a.id);
          const bo = orderOf.get(b.id);
          if (ao !== undefined && bo !== undefined) return ao - bo;
          if (ao !== undefined) return -1;
          if (bo !== undefined) return 1;
          return (a.order ?? 0) - (b.order ?? 0);
        }),
    );
    if (!projectId) return;
    projectApi.reorderTasks(projectId, columnId, orderedIds).catch(() => {
      setTasks(prev);
      showToast('Gagal menyimpan urutan. Coba lagi.');
    });
  }

  function toggleCollapse(columnId: string) {
    if (!projectId) return;
    setView((prev) => {
      const collapsed = prev.collapsed.includes(columnId)
        ? prev.collapsed.filter((s) => s !== columnId)
        : [...prev.collapsed, columnId];
      const next = { ...prev, collapsed };
      saveBoardView(projectId, next);
      return next;
    });
  }

  function openCreateFor(columnId: string) {
    setStatus(columnId);
    setCreateOpen(true);
  }

  function readFiles(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      if (file.size > 5 * 1024 * 1024) {
        showToast(`"${file.name}" melebihi 5 MB.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = String(reader.result ?? '');
        if (!dataUrl) return;
        setPendingFiles((prev) => [...prev, { filename: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, dataUrl }]);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId || !title.trim()) return;
    setCreating(true);
    try {
      const created = await projectApi.createTask(projectId, {
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeIds,
        priority,
        columnId: status || undefined,
        dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : undefined,
      });
      if (pendingFiles.length > 0) {
        const results = await Promise.allSettled(pendingFiles.map((f) => taskApi.addAttachment(created.id, f)));
        const failed = results.filter((r) => r.status === 'rejected').length;
        if (failed > 0) showToast(`${failed} lampiran gagal diunggah.`);
      }
      setTasks((prev) => [...prev, created]);
      setTitle('');
      setDescription('');
      setAssigneeIds([]);
      setPriority('MEDIUM');
      setStatus(columns[0]?.id ?? '');
      setDueDate('');
      setPendingFiles([]);
      setCreateOpen(false);
    } finally {
      setCreating(false);
    }
  }

  const visibleTasks = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    const roleOf = new Map((team?.members ?? []).map((m) => [m.userId, m.role] as const));
    return tasks.filter((t) => {
      if (filterPriority && t.priority !== filterPriority) return false;
      if (filterAssignee === 'mine' && !(user && t.assignees.some((a) => a.id === user.id))) return false;
      else if (filterAssignee === 'unassigned' && t.assignees.length > 0) return false;
      else if (
        filterAssignee !== 'all' &&
        filterAssignee !== 'mine' &&
        filterAssignee !== 'unassigned' &&
        !t.assignees.some((a) => a.id === filterAssignee)
      )
        return false;
      if (filterRole !== 'all' && !t.assignees.some((a) => roleOf.get(a.id) === filterRole)) return false;
      if (filterCreatedBy !== 'all' && t.createdById !== filterCreatedBy) return false;
      if (q && !`${t.title} ${t.description ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, team, filterSearch, filterPriority, filterAssignee, filterRole, filterCreatedBy, user?.id]);

  const filterActive =
    filterSearch.trim() !== '' ||
    filterPriority !== '' ||
    filterAssignee !== 'all' ||
    filterRole !== 'all' ||
    filterCreatedBy !== 'all';

  if (loading) return <p className="text-gray-500">Memuat…</p>;

  const isAdmin = team?.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false;
  const isMember = team?.members?.some((m) => m.userId === user?.id) ?? false;

  function apiMessage(e: unknown, fallback: string): string {
    const r = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
    return r || fallback;
  }

  function clearFilter() {
    setFilterSearch('');
    setFilterPriority('');
    setFilterAssignee('all');
    setFilterRole('all');
    setFilterCreatedBy('all');
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="truncate text-2xl font-bold text-gray-800">{project?.name ?? 'Kanban Board'}</h1>
        {isMember && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="shrink-0 rounded-full bg-perrific-violet px-4 py-2 font-givonic text-xs font-semibold text-white transition hover:brightness-110"
          >
            + Task baru
          </button>
        )}
      </div>
      {filterMenuOpen && (
        <MenuPortal
          anchorRef={filterBtnRef}
          label="Filter task"
          width={256}
          placement="above"
          onClose={() => {
            setFilterMenuOpen(false);
            setFilterFlyout(null);
          }}
        >
          <div className="relative" onMouseEnter={cancelFlyoutClose} onMouseLeave={scheduleFlyoutClose}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={filterFlyout === 'priority'}
              onMouseEnter={() => openFlyout('priority')}
              onClick={() => setFilterFlyout((v) => (v === 'priority' ? null : 'priority'))}
              className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-semibold transition hover:bg-gray-100 ${
                filterPriority ? 'text-perrific-violet' : 'text-perrific-graphite'
              }`}
            >
              <span>
                Prioritas
                <span className="ml-1.5 font-normal text-gray-400">
                  {FILTER_PRIORITIES.find((o) => o.v === filterPriority)?.label ?? 'Semua prioritas'}
                </span>
              </span>
              <span aria-hidden="true" className="text-gray-400">›</span>
            </button>
            {filterFlyout === 'priority' && (
              <div
                role="menu"
                aria-label="Pilih prioritas"
                className="absolute bottom-full left-0 z-10 mb-1 max-h-[50vh] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)] md:top-auto md:left-full md:bottom-0 md:mb-0 md:ml-2 md:w-56"
              >
                {(() => {
                  const q = priorityMenuQuery.trim().toLowerCase();
                  const opts = FILTER_PRIORITIES.filter((o) => !q || o.label.toLowerCase().includes(q));
                  if (opts.length === 0) {
                    return <p className="px-3 py-2 font-givonic text-xs text-gray-400">Tidak ditemukan.</p>;
                  }
                  return opts.map((o) => (
                    <button
                      key={o.v || 'all'}
                      type="button"
                      role="menuitemradio"
                      aria-checked={filterPriority === o.v}
                      onClick={() => setFilterPriority(o.v)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-semibold transition hover:bg-gray-100 ${
                        filterPriority === o.v ? 'text-perrific-violet' : 'text-perrific-graphite'
                      }`}
                    >
                      {o.label}
                      {filterPriority === o.v && <span aria-hidden="true">✓</span>}
                    </button>
                  ));
                })()}
                <div className="mx-3 my-1 border-t border-gray-100" />
                <div className="px-2 pt-1">
                  <input
                    value={priorityMenuQuery}
                    onChange={(e) => setPriorityMenuQuery(e.target.value)}
                    placeholder="Cari prioritas…"
                    aria-label="Cari prioritas"
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-givonic text-xs focus:border-perrific-violet focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="relative" onMouseEnter={cancelFlyoutClose} onMouseLeave={scheduleFlyoutClose}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={filterFlyout === 'assignee'}
              onMouseEnter={() => openFlyout('assignee')}
              onClick={() => setFilterFlyout((v) => (v === 'assignee' ? null : 'assignee'))}
              className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-semibold transition hover:bg-gray-100 ${
                filterAssignee !== 'all' ? 'text-perrific-violet' : 'text-perrific-graphite'
              }`}
            >
              <span>
                Assignee
                <span className="ml-1.5 font-normal text-gray-400">
                  {FILTER_ASSIGNEES.find((o) => o.v === filterAssignee)?.label ??
                    ((team?.members ?? []).find((m) => m.userId === filterAssignee)?.user?.name ??
                      (team?.members ?? []).find((m) => m.userId === filterAssignee)?.user?.email ??
                      'Anggota')}
                </span>
              </span>
              <span aria-hidden="true" className="text-gray-400">›</span>
            </button>
            {filterFlyout === 'assignee' && (
              <div
                role="menu"
                aria-label="Pilih assignee"
                className="absolute bottom-full left-0 z-10 mb-1 max-h-[50vh] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)] md:top-auto md:left-full md:bottom-0 md:mb-0 md:ml-2 md:w-60"
              >
                {FILTER_ASSIGNEES.map((o) => (
                  <button
                    key={o.v}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filterAssignee === o.v}
                    onClick={() => setFilterAssignee(o.v)}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-semibold transition hover:bg-gray-100 ${
                      filterAssignee === o.v ? 'text-perrific-violet' : 'text-perrific-graphite'
                    }`}
                  >
                    {o.label}
                    {filterAssignee === o.v && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
                <div className="nice-scroll max-h-44 overflow-y-auto">
                  {(() => {
                    const q = assigneeMenuQuery.trim().toLowerCase();
                    const opts = (team?.members ?? []).filter(
                      (m) =>
                        !q ||
                        (m.user?.name ?? '').toLowerCase().includes(q) ||
                        (m.user?.email ?? '').toLowerCase().includes(q),
                    );
                    if (opts.length === 0) {
                      return <p className="px-3 py-2 font-givonic text-xs text-gray-400">User tidak ditemukan.</p>;
                    }
                    return opts.map((m) => {
                      const label = m.user?.name ?? m.user?.email ?? m.userId;
                      return (
                        <button
                          key={m.userId}
                          type="button"
                          role="menuitemradio"
                          aria-checked={filterAssignee === m.userId}
                          onClick={() => setFilterAssignee(m.userId)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-gray-100 ${
                            filterAssignee === m.userId ? 'text-perrific-violet' : ''
                          }`}
                        >
                          <Avatar
                            src={m.user?.avatarUrl}
                            name={label}
                            size={20}
                            alt={label}
                            className="h-5 w-5 shrink-0 text-[9px]"
                          />
                          <span className="min-w-0 flex-1 truncate font-givonic text-xs font-semibold text-gray-600">
                            {label}
                          </span>
                          {filterAssignee === m.userId && <span aria-hidden="true">✓</span>}
                        </button>
                      );
                    });
                  })()}
                </div>
                <div className="mx-3 my-1 border-t border-gray-100" />
                <div className="px-2 pt-1">
                  <input
                    value={assigneeMenuQuery}
                    onChange={(e) => setAssigneeMenuQuery(e.target.value)}
                    placeholder="Cari user…"
                    aria-label="Cari user assignee"
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-givonic text-xs focus:border-perrific-violet focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="relative" onMouseEnter={cancelFlyoutClose} onMouseLeave={scheduleFlyoutClose}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={filterFlyout === 'role'}
              onMouseEnter={() => openFlyout('role')}
              onClick={() => setFilterFlyout((v) => (v === 'role' ? null : 'role'))}
              className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-semibold transition hover:bg-gray-100 ${
                filterRole !== 'all' ? 'text-perrific-violet' : 'text-perrific-graphite'
              }`}
            >
              <span>
                Role
                <span className="ml-1.5 font-normal text-gray-400">
                  {FILTER_ROLES.find((o) => o.v === filterRole)?.label ?? 'Semua role'}
                </span>
              </span>
              <span aria-hidden="true" className="text-gray-400">›</span>
            </button>
            {filterFlyout === 'role' && (
              <div
                role="menu"
                aria-label="Pilih role"
                className="absolute bottom-full left-0 z-10 mb-1 max-h-[50vh] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)] md:top-auto md:left-full md:bottom-0 md:mb-0 md:ml-2 md:w-56"
              >
                {(() => {
                  const q = roleMenuQuery.trim().toLowerCase();
                  const opts = FILTER_ROLES.filter((o) => !q || o.label.toLowerCase().includes(q));
                  if (opts.length === 0) {
                    return <p className="px-3 py-2 font-givonic text-xs text-gray-400">Tidak ditemukan.</p>;
                  }
                  return opts.map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      role="menuitemradio"
                      aria-checked={filterRole === o.v}
                      onClick={() => setFilterRole(o.v)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-semibold transition hover:bg-gray-100 ${
                        filterRole === o.v ? 'text-perrific-violet' : 'text-perrific-graphite'
                      }`}
                    >
                      {o.label}
                      {filterRole === o.v && <span aria-hidden="true">✓</span>}
                    </button>
                  ));
                })()}
                <div className="mx-3 my-1 border-t border-gray-100" />
                <div className="px-2 pt-1">
                  <input
                    value={roleMenuQuery}
                    onChange={(e) => setRoleMenuQuery(e.target.value)}
                    placeholder="Cari role…"
                    aria-label="Cari role"
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-givonic text-xs focus:border-perrific-violet focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
          <div className="relative" onMouseEnter={cancelFlyoutClose} onMouseLeave={scheduleFlyoutClose}>
            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={filterFlyout === 'createdBy'}
              onMouseEnter={() => openFlyout('createdBy')}
              onClick={() => setFilterFlyout((v) => (v === 'createdBy' ? null : 'createdBy'))}
              className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-semibold transition hover:bg-gray-100 ${
                filterCreatedBy !== 'all' ? 'text-perrific-violet' : 'text-perrific-graphite'
              }`}
            >
              <span>
                Dibuat oleh
                <span className="ml-1.5 font-normal text-gray-400">
                  {filterCreatedBy === 'all'
                    ? 'Semua'
                    : (team?.members ?? []).find((m) => m.userId === filterCreatedBy)?.user?.name ??
                      (team?.members ?? []).find((m) => m.userId === filterCreatedBy)?.user?.email ??
                      'Anggota'}
                </span>
              </span>
              <span aria-hidden="true" className="text-gray-400">›</span>
            </button>
            {filterFlyout === 'createdBy' && (
              <div
                role="menu"
                aria-label="Pilih pembuat"
                className="absolute bottom-full left-0 z-10 mb-1 max-h-[50vh] w-full overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)] md:top-auto md:left-full md:bottom-0 md:mb-0 md:ml-2 md:w-60"
              >
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={filterCreatedBy === 'all'}
                  onClick={() => setFilterCreatedBy('all')}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-semibold transition hover:bg-gray-100 ${
                    filterCreatedBy === 'all' ? 'text-perrific-violet' : 'text-perrific-graphite'
                  }`}
                >
                  Semua
                  {filterCreatedBy === 'all' && <span aria-hidden="true">✓</span>}
                </button>
                <div className="mx-3 my-1 border-t border-gray-100" />
                <div className="nice-scroll max-h-44 overflow-y-auto">
                  {(() => {
                    const q = createdByMenuQuery.trim().toLowerCase();
                    const opts = (team?.members ?? []).filter(
                      (m) =>
                        !q ||
                        (m.user?.name ?? '').toLowerCase().includes(q) ||
                        (m.user?.email ?? '').toLowerCase().includes(q),
                    );
                    if (opts.length === 0) {
                      return <p className="px-3 py-2 font-givonic text-xs text-gray-400">User tidak ditemukan.</p>;
                    }
                    return opts.map((m) => {
                      const label = m.user?.name ?? m.user?.email ?? m.userId;
                      return (
                      <button
                        key={m.userId}
                        type="button"
                        role="menuitemradio"
                        aria-checked={filterCreatedBy === m.userId}
                        onClick={() => setFilterCreatedBy(m.userId)}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-gray-100 ${
                          filterCreatedBy === m.userId ? 'text-perrific-violet' : ''
                        }`}
                      >
                        <Avatar
                          src={m.user?.avatarUrl}
                          name={label}
                          size={20}
                          alt={label}
                          className="h-5 w-5 shrink-0 text-[9px]"
                        />
                        <span className="min-w-0 flex-1 truncate font-givonic text-xs font-semibold text-gray-600">{label}</span>
                        {filterCreatedBy === m.userId && <span aria-hidden="true">✓</span>}
                      </button>
                    );
                    });
                  })()}
                </div>
                <div className="mx-3 my-1 border-t border-gray-100" />
                <div className="px-2 pt-1">
                  <input
                    value={createdByMenuQuery}
                    onChange={(e) => setCreatedByMenuQuery(e.target.value)}
                    placeholder="Cari user…"
                    aria-label="Cari user pembuat"
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-givonic text-xs focus:border-perrific-violet focus:outline-none"
                  />
                </div>
              </div>
            )}
          </div>
          {filterActive && (
            <div className="border-t border-gray-100 p-2">
              <button
                type="button"
                onClick={() => {
                  clearFilter();
                  setFilterMenuOpen(false);
                  setFilterFlyout(null);
                }}
                className="w-full rounded-lg bg-gray-100 px-3 py-1.5 font-givonic text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                Reset filter
              </button>
            </div>
          )}
        </MenuPortal>
      )}
      <KanbanBoard
        tasks={visibleTasks}
        columns={columns}
        onMove={moveTask}
        onReorder={reorderColumn}
        onOpen={(t) => {
          // Navigasi relatif mengikuti layout asal: /board/:projectId memakai
          // task/:taskId, tab kanban project memakai :taskId.
          if (location.pathname.startsWith('/board/')) navigate(`task/${t.id}`);
          else navigate(`${t.id}`);
        }}
        onToggleCollapse={toggleCollapse}
        onAdd={openCreateFor}
        canAdd={isMember}
        view={view}
      />
      <div aria-hidden="true" className="h-16" />

      <div
        className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center transition-[left] duration-200 ${
          sbCollapsed ? 'md:left-[68px]' : location.pathname.startsWith('/board/') ? 'md:left-64' : 'md:left-56'
        }`}
      >
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-gray-300 bg-white/95 p-2 shadow-[0_8px_24px_rgba(26,26,30,0.14)] backdrop-blur">
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => {
              setFilterMenuOpen((v) => !v);
              cancelFlyoutClose();
              setFilterFlyout(null);
            }}
            aria-haspopup="menu"
            aria-expanded={filterMenuOpen}
            aria-label="Filter task"
            className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 font-givonic text-sm font-semibold transition focus:outline-none ${
              filterOptionCount > 0
                ? 'bg-perrific-graphite text-white'
                : 'text-gray-800 hover:bg-gray-200 hover:text-black'
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 3.5h11l-4.2 4.8v3.4l-2.6 1.5V8.3L2.5 3.5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Filter
            {filterOptionCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 font-givonic text-[11px] font-bold text-perrific-graphite">
                {filterOptionCount}
              </span>
            )}
          </button>
          <div className="relative w-48 min-w-0 sm:w-72">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Cari task…"
              aria-label="Cari task"
              className="w-full rounded-full bg-gray-100 py-2.5 pl-10 pr-4 font-givonic text-sm text-gray-800 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-perrific-violet/30"
            />
          </div>
        </div>
      </div>

      {createOpen && (
        <ModalShell label="Task baru" onClose={() => setCreateOpen(false)} wide>
          <div className="relative">
            <p className="text-center font-givonic text-lg font-bold text-perrific-graphite">Task baru</p>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              aria-label="Tutup"
              className="absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleCreate} className="mt-3">
            <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
              <div className="min-w-0 space-y-3">
                <div>
                  <label htmlFor="task-title" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
                    Judul
                  </label>
                  <input
                    id="task-title"
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Subject"
                    maxLength={120}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 font-givonic text-sm focus:border-perrific-violet focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="task-desc" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
                    Deskripsi
                  </label>
                  <textarea
                    id="task-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tambahkan deskripsi agar anggota lain paham task ini"
                    rows={6}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 font-givonic text-sm focus:border-perrific-violet focus:outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="mb-1.5 font-givonic text-xs font-medium text-perrific-graphite">
                      Prioritas
                    </p>
                    <div>
                      <button
                        ref={priorityBtnRef}
                        type="button"
                        onClick={() => {
                          setPriorityMenuOpen((v) => !v);
                          setStatusMenuOpen(false);
                        }}
                        aria-haspopup="menu"
                        aria-expanded={priorityMenuOpen}
                        aria-label="Prioritas"
                        className="flex w-full items-center justify-between rounded-xl bg-gray-200 py-2.5 pl-3 pr-3 font-givonic text-xs font-bold tracking-widest text-perrific-graphite focus:outline-none"
                      >
                        {priority}
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`text-perrific-graphite/60 transition-transform duration-200 ${priorityMenuOpen ? 'rotate-180' : ''}`}>
                          <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </button>
                      {priorityMenuOpen && (
                        <MenuPortal
                          anchorRef={priorityBtnRef}
                          label="Prioritas"
                          estimatedHeight={180}
                          onClose={() => setPriorityMenuOpen(false)}
                        >
                          {(
                            [
                              { v: 'LOW', label: 'LOW' },
                              { v: 'MEDIUM', label: 'MEDIUM' },
                              { v: 'HIGH', label: 'HIGH' },
                              { v: 'URGENT', label: 'URGENT' },
                            ] as const
                          ).map((o) => (
                            <button
                              key={o.v}
                              type="button"
                              role="menuitemradio"
                              aria-checked={priority === o.v}
                              onClick={() => {
                                setPriority(o.v);
                                setPriorityMenuOpen(false);
                              }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-bold tracking-widest transition hover:bg-gray-100 ${
                                priority === o.v ? 'text-perrific-violet' : 'text-perrific-graphite'
                              }`}
                            >
                              {o.label}
                              {priority === o.v && <span aria-hidden="true">✓</span>}
                            </button>
                          ))}
                        </MenuPortal>
                      )}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <label htmlFor="task-due" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
                      Deadline
                    </label>
                    <input
                      id="task-due"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 px-2 py-2 font-givonic text-xs focus:border-perrific-violet focus:outline-none"
                    />
                  </div>
                </div>
              </div>
              <div className="min-w-0 space-y-3">
                <div>
                  <button
                    ref={statusBtnRef}
                    type="button"
                    onClick={() => {
                      setStatusMenuOpen((v) => !v);
                      setPriorityMenuOpen(false);
                    }}
                    aria-haspopup="menu"
                    aria-expanded={statusMenuOpen}
                    aria-label="Kolom awal"
                    className="flex w-full items-center justify-between rounded-xl bg-gray-200 py-2.5 pl-3 pr-3 font-givonic text-xs font-bold tracking-widest text-perrific-graphite focus:outline-none"
                  >
                    {(columns.find((c) => c.id === status)?.name ?? 'Pilih kolom').toUpperCase()}
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`text-perrific-graphite/60 transition-transform duration-200 ${statusMenuOpen ? 'rotate-180' : ''}`}>
                      <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {statusMenuOpen && (
                    <MenuPortal
                      anchorRef={statusBtnRef}
                      label="Kolom awal"
                      estimatedHeight={150}
                      onClose={() => setStatusMenuOpen(false)}
                    >
                      {columns.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          role="menuitemradio"
                          aria-checked={status === o.id}
                          onClick={() => {
                            setStatus(o.id);
                            setStatusMenuOpen(false);
                          }}
                          className={`flex w-full items-center justify-between px-3 py-2 text-left font-givonic text-xs font-bold tracking-widest transition hover:bg-gray-100 ${
                            status === o.id ? 'text-perrific-violet' : 'text-perrific-graphite'
                          }`}
                        >
                          {o.name.toUpperCase()}
                          {status === o.id && <span aria-hidden="true">✓</span>}
                        </button>
                      ))}
                    </MenuPortal>
                  )}
                </div>
                <div ref={assignWrapRef}>
                  <p className="font-mono text-[11px] tracking-widest text-perrific-graphite/50">ASSIGN</p>
                  {assigneeIds.length === 0 ? (
                    <p className="mt-1 font-givonic text-xs text-perrific-graphite">
                      <button
                        type="button"
                        onClick={() => {
                          setAssignQuery('');
                          setAssignMenuOpen(true);
                        }}
                        className="font-semibold hover:underline"
                      >
                        Assign
                      </button>{' '}
                      or{' '}
                      <button
                        type="button"
                        onClick={() => user && setAssigneeIds((prev) => (prev.includes(user.id) ? prev : [...prev, user.id]))}
                        className="font-semibold hover:underline"
                      >
                        Assign to me
                      </button>
                    </p>
                  ) : (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      {assigneeIds.map((id) => {
                        const m = team?.members?.find((x) => x.userId === id);
                        const label = m?.user?.name ?? m?.user?.email ?? 'Anggota';
                        return (
                          <span
                            key={id}
                            className="flex items-center gap-1 rounded-full bg-gray-100 py-0.5 pl-0.5 pr-1"
                          >
                            <Avatar src={m?.user?.avatarUrl} name={label} size={20} alt={label} className="h-5 w-5 text-[9px]" />
                            <span className="max-w-[90px] truncate font-givonic text-[11px] text-gray-600">{label}</span>
                            <button
                              type="button"
                              onClick={() => setAssigneeIds((prev) => prev.filter((x) => x !== id))}
                              aria-label={`Hapus ${label}`}
                              className="rounded-full px-1 font-givonic text-[11px] text-gray-400 hover:bg-gray-200 hover:text-red-600"
                            >
                              ×
                            </button>
                          </span>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => {
                          setAssignQuery('');
                          setAssignMenuOpen(true);
                        }}
                        className="rounded-full border border-dashed border-gray-300 px-2 py-0.5 font-givonic text-[11px] font-semibold text-gray-500 transition hover:border-perrific-violet hover:text-perrific-violet"
                      >
                        + Add Assign
                      </button>
                    </div>
                  )}
                  {assignMenuOpen && (
                    <MenuPortal
                      anchorRef={assignWrapRef}
                      label="Cari anggota"
                      width={224}
                      estimatedHeight={260}
                      onClose={() => setAssignMenuOpen(false)}
                    >
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
                            className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-givonic text-xs focus:border-perrific-violet focus:outline-none"
                          />
                        </div>
                        <div className="nice-scroll max-h-44 overflow-y-auto">
                          {(() => {
                            const q = assignQuery.trim().toLowerCase();
                            const opts = (team?.members ?? []).filter(
                              (m) =>
                                !assigneeIds.includes(m.userId) &&
                                (!q ||
                                  (m.user?.name ?? '').toLowerCase().includes(q) ||
                                  (m.user?.email ?? '').toLowerCase().includes(q)),
                            );
                            if (opts.length === 0) {
                              return <p className="px-3 py-2 font-givonic text-xs text-gray-400">Belum ada anggota.</p>;
                            }
                            return opts.map((m) => {
                              const label = m.user?.name ?? m.user?.email ?? m.userId;
                              return (
                                <button
                                  key={m.userId}
                                  type="button"
                                  onClick={() => {
                                    setAssigneeIds((prev) => (prev.includes(m.userId) ? prev : [...prev, m.userId]));
                                    setAssignMenuOpen(false);
                                  }}
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-gray-100"
                                >
                                  <Avatar
                                    src={m.user?.avatarUrl}
                                    name={label}
                                    size={24}
                                    alt={label}
                                    className="h-6 w-6 text-[10px]"
                                  />
                                  <span className="min-w-0 flex-1 truncate font-givonic text-xs text-gray-600">{label}</span>
                                </button>
                              );
                            });
                          })()}
                        </div>
                    </MenuPortal>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between bg-gray-100 px-2 py-1.5">
                    <p className="font-givonic text-xs font-bold text-perrific-graphite">
                      {pendingFiles.length} Attachments
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Tambah lampiran"
                      title="Tambah lampiran"
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-gray-300 font-givonic text-sm font-bold leading-none text-gray-500 transition hover:border-perrific-violet hover:text-perrific-violet"
                    >
                      +
                    </button>
                  </div>
                  {pendingFiles.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {pendingFiles.map((f, i) => (
                        <li key={`${f.filename}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-givonic text-gray-600">{f.filename}</span>
                          <button
                            type="button"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                            aria-label={`Hapus ${f.filename}`}
                            className="shrink-0 rounded px-1 font-givonic text-xs text-red-600 hover:bg-red-50"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {pendingFiles.length === 0 && (
                    <label
                      htmlFor="task-files"
                      className="mt-1 block cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center font-givonic text-xs text-gray-400 transition hover:border-perrific-violet hover:text-perrific-violet"
                    >
                      Drop attachments here / klik untuk pilih
                    </label>
                  )}
                  <input
                    ref={fileInputRef}
                    id="task-files"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      readFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </div>
              </div>
            </div>
            {!isAdmin && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center font-givonic text-[11px] text-amber-700">
                Task yang kamu buat perlu persetujuan admin sebelum bisa dipindah.
              </p>
            )}
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="mt-4 w-full rounded-lg bg-perrific-violet px-4 py-2.5 font-givonic text-xs font-bold tracking-widest text-white transition hover:bg-[#E64D0A] disabled:opacity-50"
            >
              {creating ? 'Membuat…' : 'Buat'}
            </button>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
