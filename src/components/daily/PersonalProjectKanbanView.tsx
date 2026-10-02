import { useSocket } from '@/store/socket';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';
import { taskApi } from '@/api/tasks';
import { showToast } from '@/components/ui/Toast';
import ModalShell from '@/components/ui/ModalShell';
import MenuPortal from '@/components/ui/MenuPortal';
import KanbanBoard, { DEFAULT_BOARD_VIEW, loadBoardView, saveBoardView, type BoardView } from '@/components/kanban/KanbanBoard';
import BoardColumnEditor from '@/components/project/BoardColumnEditor';
import TaskDetailView from '@/components/task/TaskDetailView';
import { APP_SIDEBAR_EVENT, isAppSidebarCollapsed } from '@/components/layout/AppLayout';
import { ActivityIcon } from '@/components/icons';
import { useAuth } from '@/store/auth';
import { useUndo } from '@/hooks/useUndoStack';
import { Columns3, ChevronDown, Filter, Search, X } from 'lucide-react';
import type { BoardColumn, Project, Task } from '@/types';

function compareTasks(a: Task, b: Task) {
  if (a.order !== b.order) return a.order - b.order;
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
}

const FILTER_PRIORITIES = [
  { v: '', label: 'Semua prioritas' },
  { v: 'LOW', label: 'Low' },
  { v: 'MEDIUM', label: 'Medium' },
  { v: 'HIGH', label: 'High' },
  { v: 'URGENT', label: 'Urgent' },
] as const;

export default function PersonalProjectKanbanView() {
  const { user } = useAuth();
  const { push } = useUndo();
  const [project, setProject] = useState<Project | null>(null);
  const [personalProjects, setPersonalProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<BoardView>(DEFAULT_BOARD_VIEW);

  // Project Switcher Dropup & Create Project Modal
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [projectSearch, setProjectSearch] = useState('');
  const projectBtnRef = useRef<HTMLButtonElement>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creatingProject, setCreatingProject] = useState(false);

  // Modal Create Task
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('MEDIUM');
  const [status, setStatus] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [pendingFiles, setPendingFiles] = useState<{ filename: string; mimeType: string; size: number; dataUrl: string }[]>([]);
  const [creating, setCreating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Modal Detail Task
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // Modal Settings Project
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Filters & Search
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<'' | Task['priority']>('');
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [filterFlyout, setFilterFlyout] = useState<null | 'priority'>(null);
  const filterBtnRef = useRef<HTMLButtonElement>(null);
  const flyoutTimer = useRef<number | null>(null);

  // Floating pill offset
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(isAppSidebarCollapsed);
  useEffect(() => {
    const sync = () => setSbCollapsed(isAppSidebarCollapsed());
    window.addEventListener(APP_SIDEBAR_EVENT, sync);
    return () => window.removeEventListener(APP_SIDEBAR_EVENT, sync);
  }, []);

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

  function openFlyout(which: 'priority') {
    cancelFlyoutClose();
    setFilterFlyout(which);
  }

  useEffect(() => {
    return () => {
      if (flyoutTimer.current !== null) window.clearTimeout(flyoutTimer.current);
    };
  }, []);

  const activeStorageKey = `purrific:active-personal-project:${user?.id ?? 'anon'}`;

  // Muat project pribadi dan task-tasknya dari PostgreSQL
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const defaultProj = await projectApi.getMyPersonalProject();
      const allProjects = defaultProj.teamId
        ? await teamApi.listProjects(defaultProj.teamId).catch(() => [defaultProj])
        : [defaultProj];
      const list = allProjects.length > 0 ? allProjects : [defaultProj];
      setPersonalProjects(list);

      const savedId = localStorage.getItem(activeStorageKey);
      const activeProj: Project & { columns?: BoardColumn[] } =
        list.find((p) => p.id === savedId) ?? defaultProj;

      setProject(activeProj);
      setColumns(activeProj.columns ?? []);
      setSettingsName(activeProj.name);
      setSettingsDesc(activeProj.description ?? '');

      if (activeProj.id) {
        setView(loadBoardView(activeProj.id));
        const [taskList, colList] = await Promise.all([
          projectApi.listTasks(activeProj.id),
          projectApi.listColumns(activeProj.id),
        ]);
        setTasks(taskList);
        setColumns(colList);
        setStatus((prev) => (prev && colList.some((c) => c.id === prev) ? prev : (colList[0]?.id ?? '')));
      }
    } catch (err) {
      console.error('[PersonalProjectKanbanView] Gagal memuat project pribadi:', err);
      showToast('Gagal memuat project pribadi.');
    } finally {
      setLoading(false);
    }
  }, [activeStorageKey]);

  const handleSelectProject = useCallback(
    async (target: Project & { columns?: BoardColumn[] }, syncServer = true) => {
      setProjectMenuOpen(false);
      setProjectSearch('');
      if (target.id === project?.id) return;
      localStorage.setItem(activeStorageKey, target.id);
      if (syncServer) {
        projectApi.setActivePersonalProject(target.id).catch(() => {});
      }
      setProject(target);
      setSettingsName(target.name);
      setSettingsDesc(target.description ?? '');
      setView(loadBoardView(target.id));
      setTasks([]);
      if (target.columns && target.columns.length > 0) {
        setColumns(target.columns);
        setStatus(target.columns[0]?.id ?? '');
      }
      try {
        const [taskList, colList] = await Promise.all([
          projectApi.listTasks(target.id),
          projectApi.listColumns(target.id),
        ]);
        setTasks(taskList);
        setColumns(colList);
        setStatus(colList[0]?.id ?? '');
      } catch {
        showToast('Gagal memuat project yang dipilih.');
      }
    },
    [project?.id, activeStorageKey],
  );

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project?.teamId || !newProjectName.trim()) return;
    setCreatingProject(true);
    try {
      const created = await teamApi.createProject(project.teamId, {
        name: newProjectName.trim(),
        description: newProjectDesc.trim() || undefined,
      });
      setPersonalProjects((prev) =>
        prev.some((p) => p.id === created.id) ? prev : [...prev, created],
      );
      setNewProjectName('');
      setNewProjectDesc('');
      setCreateProjectOpen(false);
      showToast('Project pribadi baru berhasil dibuat.');
      await handleSelectProject(created);
    } catch {
      showToast('Gagal membuat project baru.');
    } finally {
      setCreatingProject(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const { socket } = useSocket();

  // Sinkronisasi otomatis saat pengguna membuka kembali tab / menyalakan layar HP (focus / visibilitychange / online / reconnect)
  useEffect(() => {
    const resume = () => {
      if (document.visibilityState !== 'visible') return;
      void loadData();
    };
    window.addEventListener('focus', resume);
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume);
    socket?.on('connect', resume);
    return () => {
      window.removeEventListener('focus', resume);
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume);
      socket?.off('connect', resume);
    };
  }, [socket, loadData]);

  useEffect(() => {
    if (!socket || !project?.id) return;
    let taskReq = 0;
    let projReq = 0;

    const refreshTasks = async (payload?: { projectId?: string }) => {
      if (payload?.projectId && payload.projectId !== project.id) return;
      const current = ++taskReq;
      try {
        const items = await projectApi.listTasks(project.id);
        if (current === taskReq) setTasks(items);
      } catch {
        /* keep the current board during a network failure */
      }
    };

    const handleProjectSwitched = (payload?: { projectId?: string }) => {
      if (!payload?.projectId || payload.projectId === project.id) return;
      setPersonalProjects((prevList) => {
        const found = prevList.find((p) => p.id === payload.projectId);
        if (found) {
          void handleSelectProject(found, false);
        } else {
          void loadData();
        }
        return prevList;
      });
    };

    const refreshProjectAndBoard = async (payload?: {
      teamId?: string;
      projectId?: string;
      action?: string;
    }) => {
      if (payload?.teamId && project.teamId && payload.teamId !== project.teamId) return;
      const current = ++projReq;
      try {
        if (project.teamId) {
          const allProjects = await teamApi.listProjects(project.teamId);
          if (current === projReq && allProjects.length > 0) {
            setPersonalProjects(allProjects);
            const updatedCurrent = allProjects.find((p) => p.id === project.id);
            if (updatedCurrent) {
              setProject((prev) => (prev ? { ...prev, ...updatedCurrent } : prev));
              setSettingsName(updatedCurrent.name);
              setSettingsDesc(updatedCurrent.description ?? '');
            } else {
              // Project saat ini telah dihapus di perangkat lain! Fallback ke project pertama
              const fallback = allProjects[0];
              showToast('Project saat ini telah dihapus di perangkat lain, dialihkan ke project utama.');
              void handleSelectProject(fallback, false);
              return;
            }
          }
        }
        if (!payload?.projectId || payload.projectId === project.id) {
          const [colList, taskList] = await Promise.all([
            projectApi.listColumns(project.id),
            projectApi.listTasks(project.id),
          ]);
          if (current === projReq) {
            setColumns(colList);
            setTasks(taskList);
            setStatus((prev) =>
              prev && colList.some((c) => c.id === prev) ? prev : (colList[0]?.id ?? ''),
            );
          }
        }
      } catch {
        /* keep the current board during a network failure */
      }
    };

    socket.on('task:updated', refreshTasks);
    socket.on('calendar:synced', refreshTasks);
    socket.on('project:updated', refreshProjectAndBoard);
    socket.on('personal-project:switched', handleProjectSwitched);
    return () => {
      taskReq++;
      projReq++;
      socket.off('task:updated', refreshTasks);
      socket.off('calendar:synced', refreshTasks);
      socket.off('project:updated', refreshProjectAndBoard);
      socket.off('personal-project:switched', handleProjectSwitched);
    };
  }, [socket, project?.id, project?.teamId, handleSelectProject, loadData]);

  // Pindah task antar kolom / reorder dengan optimistik update dan undo
  const moveTask = (taskId: string, columnId: string, insertAt?: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const prev = tasks;
    const fromColumnId = task.columnId;
    const fromOrder = task.order;

    const targetTasks = tasks
      .filter((t) => t.columnId === columnId && t.id !== taskId)
      .sort(compareTasks);

    let order: number;
    if (insertAt === undefined || targetTasks.length === 0) {
      order = targetTasks.length > 0 ? (targetTasks[targetTasks.length - 1].order ?? 0) + 1 : 0;
    } else if (insertAt <= 0) {
      order = (targetTasks[0].order ?? 0) - 1;
    } else if (insertAt >= targetTasks.length) {
      order = (targetTasks[targetTasks.length - 1].order ?? 0) + 1;
    } else {
      const prevOrder = targetTasks[insertAt - 1].order ?? 0;
      const nextOrder = targetTasks[insertAt].order ?? 0;
      if (prevOrder >= nextOrder) {
        order = prevOrder + 0.5;
      } else {
        order = (prevOrder + nextOrder) / 2;
      }
    }

    setTasks((current) =>
      current
        .map((t) => (t.id === taskId ? { ...t, columnId, order } : t))
        .sort(compareTasks),
    );

    push(`pindah "${task.title}"`, async () => {
      setTasks((current) =>
        current
          .map((t) => (t.id === taskId ? { ...t, columnId: fromColumnId, order: fromOrder } : t))
          .sort(compareTasks),
      );
      try {
        await taskApi.update(taskId, { columnId: fromColumnId, order: fromOrder });
      } catch {
        showToast('Gagal mengembalikan task ke kolom asal.');
      }
    });

    taskApi.update(taskId, { columnId, order }).then(
      (updated) => {
        setTasks((current) =>
          current
            .map((t) => (t.id === taskId ? updated : t))
            .sort(compareTasks),
        );
      },
      () => {
        setTasks(prev);
        showToast('Gagal memindah task. Coba lagi.');
      },
    );
  };

  const reorderColumn = (columnId: string, orderedIds: string[]) => {
    if (!project) return;
    const prev = tasks;
    const col = columns.find((c) => c.id === columnId);
    const prevOrderedIds = tasks
      .filter((t) => t.columnId === columnId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((t) => t.id);

    const orderOf = new Map(orderedIds.map((id, idx) => [id, idx] as const));
    setTasks((current) =>
      current
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

    push(`urutan "${col?.name ?? 'kolom'}"`, async () => {
      const prevOrderMap = new Map(prevOrderedIds.map((id, idx) => [id, idx] as const));
      setTasks((current) =>
        current
          .map((t) => (prevOrderMap.has(t.id) ? { ...t, order: prevOrderMap.get(t.id)! } : t))
          .sort((a, b) => {
            const ao = prevOrderMap.get(a.id);
            const bo = prevOrderMap.get(b.id);
            if (ao !== undefined && bo !== undefined) return ao - bo;
            if (ao !== undefined) return -1;
            if (bo !== undefined) return 1;
            return (a.order ?? 0) - (b.order ?? 0);
          }),
      );
      try {
        await projectApi.reorderTasks(project.id, columnId, prevOrderedIds);
      } catch {
        showToast('Gagal mengembalikan urutan task.');
      }
    });

    projectApi.reorderTasks(project.id, columnId, orderedIds).catch(() => {
      setTasks(prev);
      showToast('Gagal menyimpan urutan. Coba lagi.');
    });
  };

  const toggleCollapse = (columnId: string) => {
    if (!project) return;
    setView((prev) => {
      const collapsed = prev.collapsed.includes(columnId)
        ? prev.collapsed.filter((s) => s !== columnId)
        : [...prev.collapsed, columnId];
      const next = { ...prev, collapsed };
      saveBoardView(project.id, next);
      return next;
    });
  };

  const openCreateFor = (columnId: string) => {
    setStatus(columnId);
    setCreateOpen(true);
  };

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
        setPendingFiles((prev) => [
          ...prev,
          { filename: file.name, mimeType: file.type || 'application/octet-stream', size: file.size, dataUrl },
        ]);
      };
      reader.readAsDataURL(file);
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !title.trim()) return;
    setCreating(true);
    try {
      const created = await projectApi.createTask(project.id, {
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        columnId: status || undefined,
        assigneeIds: user?.id ? [user.id] : undefined,
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
      setPriority('MEDIUM');
      setStatus(columns[0]?.id ?? '');
      setDueDate('');
      setPendingFiles([]);
      setCreateOpen(false);
      showToast('Task berhasil ditambahkan.');
    } catch {
      showToast('Gagal menambahkan task.');
    } finally {
      setCreating(false);
    }
  };

  const handleSaveProjectSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!project || !settingsName.trim()) return;
    setSavingSettings(true);
    try {
      const updated = await projectApi.updateProject(project.id, {
        name: settingsName.trim(),
        description: settingsDesc.trim() || undefined,
      });
      setProject((prev) => (prev ? { ...prev, ...updated } : prev));
      setPersonalProjects((prev) =>
        prev.map((p) => (p.id === project.id ? { ...p, ...updated } : p)),
      );
      showToast('Pengaturan project berhasil disimpan.');
      setSettingsOpen(false);
    } catch {
      showToast('Gagal menyimpan pengaturan project.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleColumnsChange = useCallback((nextCols: BoardColumn[]) => {
    setColumns(nextCols);
    setStatus((prev) =>
      prev && nextCols.some((c) => c.id === prev) ? prev : (nextCols[0]?.id ?? ''),
    );
  }, []);

  const handleTasksMoved = useCallback(() => {
    if (!project?.id) return;
    void projectApi
      .listTasks(project.id)
      .then(setTasks)
      .catch(() => {});
  }, [project?.id]);

  const filteredPersonalProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return personalProjects;
    return personalProjects.filter((p) => p.name.toLowerCase().includes(q));
  }, [personalProjects, projectSearch]);

  // Filter tasks
  const visibleTasks = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      if (filterPriority && t.priority !== filterPriority) return false;
      if (q) {
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesNumber = String(t.number).includes(q);
        if (!matchesTitle && !matchesNumber) return false;
      }
      return true;
    });
  }, [tasks, filterSearch, filterPriority]);

  const filterOptionCount = filterPriority ? 1 : 0;
  const filterActive = filterSearch.trim() !== '' || filterPriority !== '';

  function clearFilter() {
    setFilterSearch('');
    setFilterPriority('');
  }

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        <p className="mt-3 font-manrope text-sm text-gray-500">Memuat project pribadi Anda…</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-[65vh] w-full space-y-4">
      {/* Header Bar: Menampilkan info project pribadi di kiri */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-3 pt-1">
        {/* Sisi Kiri: Info Project Pribadi */}
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-orange-700 shadow-2xs">
            <Columns3 size={18} strokeWidth={1.6} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-manrope text-lg font-bold text-gray-800">
              {project?.name ?? 'Project Pribadi'}
            </h1>
            <p className="truncate text-xs text-gray-500">
              {tasks.length} task tercatat
            </p>
          </div>
        </div>
      </div>

      {/* Board Kanban: 100% sama dengan board kanban di dalam project */}
      <KanbanBoard
        tasks={visibleTasks}
        columns={columns}
        onMove={moveTask}
        onReorder={reorderColumn}
        onOpen={(t) => setActiveTaskId(t.id)}
        onToggleCollapse={toggleCollapse}
        onAdd={openCreateFor}
        canAdd={true}
        view={view}
        showScheduleWarning={true}
      />

      <div aria-hidden="true" className="h-16" />

      {/* Floating Cell Pill Search Bar (Identik dengan BoardPage.tsx + Dropup Project Switcher) */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center transition-[left] duration-200 ${
          sbCollapsed ? 'md:left-0' : 'md:left-64'
        }`}
      >
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-gray-300 bg-white/95 p-2 shadow-[0_8px_24px_rgba(26,26,30,0.14)] backdrop-blur">
          {/* Dropup Project Switcher */}
          <button
            ref={projectBtnRef}
            type="button"
            onClick={() => {
              setProjectMenuOpen((v) => !v);
              setFilterMenuOpen(false);
              cancelFlyoutClose();
              setFilterFlyout(null);
            }}
            aria-haspopup="menu"
            aria-expanded={projectMenuOpen}
            aria-label="Pilih project pribadi"
            className={`flex max-w-[180px] shrink-0 items-center gap-2 rounded-full px-4 py-2.5 font-manrope text-sm font-semibold transition focus:outline-none ${
              projectMenuOpen
                ? 'bg-orange-600 text-white'
                : 'bg-orange-50 text-orange-700 hover:bg-orange-100'
            }`}
          >
            <Columns3 size={14} strokeWidth={1.6} className="shrink-0" />
            <span className="truncate">{project?.name ?? 'Project Pribadi'}</span>
            <ChevronDown
              size={12}
              strokeWidth={1.8}
              aria-hidden="true"
              className={`shrink-0 transition-transform duration-150 ${projectMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>

          <div aria-hidden="true" className="h-5 w-px shrink-0 bg-gray-400" />

          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => {
              setFilterMenuOpen((v) => !v);
              setProjectMenuOpen(false);
              cancelFlyoutClose();
              setFilterFlyout(null);
            }}
            aria-haspopup="menu"
            aria-expanded={filterMenuOpen}
            aria-label="Filter task"
            className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 font-manrope text-sm font-semibold transition focus:outline-none ${
              filterOptionCount > 0
                ? 'bg-perrific-graphite text-white'
                : 'text-gray-800 hover:bg-gray-200 hover:text-black'
            }`}
          >
            <Filter size={15} strokeWidth={1.6} />
            Filter
            {filterOptionCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 font-manrope text-[11px] font-bold text-perrific-graphite">
                {filterOptionCount}
              </span>
            )}
          </button>

          <div className="relative w-48 min-w-0 sm:w-72">
            <Search
              size={15}
              strokeWidth={1.6}
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Cari task…"
              aria-label="Cari task"
              className="w-full rounded-full bg-gray-100 py-2.5 pl-10 pr-4 font-manrope text-sm text-gray-800 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-perrific-violet/30"
            />
          </div>

          {/* Button Setting Project di samping kanan search bar dengan icon Settings */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Pengaturan Project"
            aria-label="Pengaturan Project"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 transition hover:bg-gray-100 hover:text-gray-900 active:scale-95 focus:outline-none"
          >
            <ActivityIcon name="gear" className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Dropup Menu Project Pribadi */}
      {projectMenuOpen && (
        <MenuPortal
          anchorRef={projectBtnRef}
          label="Daftar project pribadi"
          width={260}
          placement="above"
          onClose={() => {
            setProjectMenuOpen(false);
            setProjectSearch('');
          }}
        >
          <div className="px-2 pb-1.5 pt-1">
            {/* Button Tambah Project Baru */}
            <button
              type="button"
              onClick={() => {
                setProjectMenuOpen(false);
                setProjectSearch('');
                setCreateProjectOpen(true);
              }}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-orange-600 px-3 py-2 font-manrope text-xs font-semibold text-white transition hover:bg-orange-700"
            >
              <span aria-hidden="true" className="text-sm leading-none">+</span>
              <span>Tambah Project Baru</span>
            </button>

            {/* Searchbar Project */}
            <div className="relative mt-2">
              <Search
                size={13}
                strokeWidth={1.6}
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                placeholder="Cari project…"
                aria-label="Cari project"
                className="w-full rounded-lg border border-gray-200 bg-gray-50 py-1.5 pl-8 pr-2.5 font-manrope text-xs text-gray-800 placeholder:text-gray-400 focus:border-orange-400 focus:bg-white focus:outline-none"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-1">
            {/* Maksimal 3 nama project terlihat sekaligus (3 x 36px = 108px -> max-h-[112px]) dengan scrollbar jika lebih */}
            <div
              data-testid="personal-project-list"
              className="nice-scroll max-h-[112px] overflow-y-auto px-1"
            >
              {filteredPersonalProjects.length === 0 ? (
                <p className="py-3 text-center font-manrope text-xs text-gray-400">
                  Project tidak ditemukan
                </p>
              ) : (
                filteredPersonalProjects.map((p) => {
                  const isActive = p.id === project?.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="menuitemradio"
                      aria-checked={isActive}
                      onClick={() => void handleSelectProject(p)}
                      className={`flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left font-manrope text-xs font-semibold transition ${
                        isActive
                          ? 'bg-orange-50 text-orange-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <span className="truncate">{p.name}</span>
                      {isActive && (
                        <span aria-hidden="true" className="shrink-0 text-orange-600">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </MenuPortal>
      )}

      {/* Flyout Filter Menu */}
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
              className={`flex w-full items-center justify-between px-3 py-2 text-left font-manrope text-xs font-semibold transition hover:bg-gray-100 ${
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
                {FILTER_PRIORITIES.map((o) => (
                  <button
                    key={o.v || 'all'}
                    type="button"
                    role="menuitemradio"
                    aria-checked={filterPriority === o.v}
                    onClick={() => {
                      setFilterPriority(o.v);
                      setFilterMenuOpen(false);
                      setFilterFlyout(null);
                    }}
                    className={`flex w-full items-center justify-between px-3 py-2 text-left font-manrope text-xs font-semibold transition hover:bg-gray-100 ${
                      filterPriority === o.v ? 'text-perrific-violet' : 'text-perrific-graphite'
                    }`}
                  >
                    {o.label}
                    {filterPriority === o.v && <span aria-hidden="true">✓</span>}
                  </button>
                ))}
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
                className="w-full rounded-lg bg-gray-100 px-3 py-1.5 font-manrope text-xs font-semibold text-gray-600 hover:bg-gray-200"
              >
                Reset filter
              </button>
            </div>
          )}
        </MenuPortal>
      )}

      {/* Modal Task Baru (Identik dengan form di BoardPage.tsx) */}
      {createOpen && (
        <ModalShell label="Task baru" onClose={() => setCreateOpen(false)} wide>
          <div className="relative">
            <p className="text-center font-manrope text-lg font-bold text-perrific-graphite">Task baru</p>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              aria-label="Tutup"
              className="absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <X size={14} strokeWidth={1.6} />
            </button>
          </div>
          <form onSubmit={handleCreate} className="mt-3">
            <div className="grid gap-4 sm:grid-cols-[1fr_220px]">
              <div className="min-w-0 space-y-3">
                <div>
                  <label htmlFor="task-title" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
                    Judul
                  </label>
                  <input
                    id="task-title"
                    autoFocus
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Judul task..."
                    maxLength={120}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 font-manrope text-sm focus:border-perrific-violet focus:outline-none"
                  />
                </div>
                <div>
                  <label htmlFor="task-desc" className="mb-1.5 block font-manrope text-xs font-medium text-perrific-graphite">
                    Deskripsi
                  </label>
                  <textarea
                    id="task-desc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tambahkan catatan atau rincian task pribadi ini..."
                    rows={4}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 font-manrope text-sm focus:border-perrific-violet focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-gray-200 pt-3 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                <div>
                  <label htmlFor="task-col" className="mb-1 block font-manrope text-xs font-medium text-perrific-graphite">
                    Kolom status
                  </label>
                  <select
                    id="task-col"
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-manrope text-xs text-gray-700 focus:border-perrific-violet focus:outline-none"
                  >
                    {columns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label htmlFor="task-priority" className="mb-1 block font-manrope text-xs font-medium text-perrific-graphite">
                    Prioritas
                  </label>
                  <select
                    id="task-priority"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as Task['priority'])}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-manrope text-xs text-gray-700 focus:border-perrific-violet focus:outline-none"
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="task-due" className="mb-1 block font-manrope text-xs font-medium text-perrific-graphite">
                    Tenggat waktu
                  </label>
                  <input
                    id="task-due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-manrope text-xs text-gray-700 focus:border-perrific-violet focus:outline-none"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between bg-gray-100 px-2 py-1.5">
                    <p className="font-manrope text-xs font-bold text-perrific-graphite">
                      {pendingFiles.length} Lampiran
                    </p>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      aria-label="Tambah lampiran"
                      title="Tambah lampiran"
                      className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-gray-300 font-manrope text-sm font-bold leading-none text-gray-500 transition hover:border-perrific-violet hover:text-perrific-violet"
                    >
                      +
                    </button>
                  </div>
                  {pendingFiles.length > 0 && (
                    <ul className="mt-1 space-y-1">
                      {pendingFiles.map((f, i) => (
                        <li key={`${f.filename}-${i}`} className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-manrope text-gray-600">{f.filename}</span>
                          <button
                            type="button"
                            onClick={() => setPendingFiles((prev) => prev.filter((_, j) => j !== i))}
                            aria-label={`Hapus ${f.filename}`}
                            className="shrink-0 rounded px-1 font-manrope text-xs text-red-600 hover:bg-red-50"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {pendingFiles.length === 0 && (
                    <label
                      htmlFor="personal-task-files"
                      className="mt-1 block cursor-pointer rounded-lg border border-dashed border-gray-300 px-3 py-3 text-center font-manrope text-xs text-gray-400 transition hover:border-perrific-violet hover:text-perrific-violet"
                    >
                      Klik untuk pilih lampiran
                    </label>
                  )}
                  <input
                    ref={fileInputRef}
                    id="personal-task-files"
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

            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="mt-4 w-full rounded-lg bg-perrific-violet px-4 py-2.5 font-manrope text-xs font-bold tracking-widest text-white transition hover:bg-[#E64D0A] disabled:opacity-50"
            >
              {creating ? 'Menyimpan…' : 'Tambah Task'}
            </button>
          </form>
        </ModalShell>
      )}

      {/* Modal Detail Task (Identik dengan TaskDetailView) */}
      {activeTaskId && (
        <ModalShell label="Detail Task" onClose={() => setActiveTaskId(null)} wide>
          <TaskDetailView
            taskId={activeTaskId}
            project={project}
            team={null}
            currentUserId={user?.id}
            isAdmin={true}
            onClose={() => setActiveTaskId(null)}
            onUpdated={(updated) => {
              setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
            }}
            onDeleted={(deletedId) => {
              setTasks((prev) => prev.filter((t) => t.id !== deletedId));
              setActiveTaskId(null);
            }}
          />
        </ModalShell>
      )}

      {/* Modal Setting Project Pribadi */}
      {settingsOpen && project && (
        <ModalShell label="Pengaturan Project Pribadi" onClose={() => setSettingsOpen(false)} wide>
          <div className="relative mb-4">
            <h2 className="font-manrope text-lg font-bold text-gray-800">Pengaturan Project Pribadi</h2>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              aria-label="Tutup"
              className="absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800"
            >
              <X size={14} strokeWidth={1.6} />
            </button>
          </div>

          <div className="space-y-6">
            {/* Form Ubah Nama & Deskripsi Project */}
            <form onSubmit={handleSaveProjectSettings} className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <h3 className="font-manrope text-xs font-bold uppercase tracking-wider text-gray-500">
                Informasi Umum
              </h3>
              <div>
                <label htmlFor="settings-name" className="mb-1 block font-manrope text-xs font-medium text-gray-700">
                  Nama Project
                </label>
                <input
                  id="settings-name"
                  value={settingsName}
                  onChange={(e) => setSettingsName(e.target.value)}
                  placeholder="Nama project..."
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-manrope text-sm focus:border-perrific-violet focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="settings-desc" className="mb-1 block font-manrope text-xs font-medium text-gray-700">
                  Deskripsi
                </label>
                <textarea
                  id="settings-desc"
                  value={settingsDesc}
                  onChange={(e) => setSettingsDesc(e.target.value)}
                  placeholder="Deskripsi singkat project pribadi..."
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-manrope text-sm focus:border-perrific-violet focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={savingSettings || !settingsName.trim()}
                className="rounded-lg bg-gray-900 px-4 py-2 font-manrope text-xs font-semibold text-white transition hover:bg-black disabled:opacity-50"
              >
                {savingSettings ? 'Menyimpan…' : 'Simpan Informasi'}
              </button>
            </form>

            {/* Editor Kolom Kanban */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="mb-3 font-manrope text-xs font-bold uppercase tracking-wider text-gray-500">
                Kolom Kanban Board
              </h3>
              <BoardColumnEditor
                projectId={project.id}
                onColumnsChange={handleColumnsChange}
                onTasksMoved={handleTasksMoved}
              />
            </div>
          </div>
        </ModalShell>
      )}

      {/* Modal Tambah Project Pribadi Baru */}
      {createProjectOpen && (
        <ModalShell label="Tambah Project Pribadi Baru" onClose={() => setCreateProjectOpen(false)}>
          <div className="relative mb-4">
            <h2 className="font-manrope text-lg font-bold text-gray-800">Tambah Project Baru</h2>
            <button
              type="button"
              onClick={() => setCreateProjectOpen(false)}
              aria-label="Tutup"
              className="absolute right-0 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-800"
            >
              <X size={14} strokeWidth={1.6} />
            </button>
          </div>

          <form onSubmit={handleCreateProject} className="space-y-3">
            <div>
              <label htmlFor="new-project-name" className="mb-1 block font-manrope text-xs font-medium text-gray-700">
                Nama Project
              </label>
              <input
                id="new-project-name"
                autoFocus
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                placeholder="Mis. Belajar React, Side Project..."
                maxLength={100}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-manrope text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="new-project-desc" className="mb-1 block font-manrope text-xs font-medium text-gray-700">
                Deskripsi (Opsional)
              </label>
              <textarea
                id="new-project-desc"
                value={newProjectDesc}
                onChange={(e) => setNewProjectDesc(e.target.value)}
                placeholder="Deskripsi singkat project ini..."
                rows={3}
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 font-manrope text-sm focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCreateProjectOpen(false)}
                className="rounded-lg border border-gray-200 px-4 py-2 font-manrope text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={creatingProject || !newProjectName.trim()}
                className="rounded-lg bg-orange-600 px-4 py-2 font-manrope text-xs font-semibold text-white transition hover:bg-orange-700 disabled:opacity-50"
              >
                {creatingProject ? 'Membuat…' : 'Buat Project'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
