import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { teamApi } from '@/api/teams';
import { taskApi } from '@/api/tasks';
import { projectApi } from '@/api/projects';
import { useAuth } from '@/store/auth';
import { useSocket } from '@/store/socket';
import { APP_SIDEBAR_EVENT, isAppSidebarCollapsed } from '@/components/layout/AppLayout';
import { TEAMS_CHANGED_EVENT, useTrash } from '@/hooks/useNavLabels';
import { PROJECT_UPDATED_EVENT } from '@/pages/ProjectSettingsPage';
import Avatar from '@/components/ui/Avatar';
import MenuPortal from '@/components/ui/MenuPortal';
import ModalShell from '@/components/ui/ModalShell';
import TaskDetailView from '@/components/task/TaskDetailView';
import { showToast } from '@/components/ui/Toast';
import { useUndoStack } from '@/hooks/useUndoStack';
import {
  Clock,
  ChevronRight,
  ChevronLeft,
  Users,
  Columns3,
  ArrowUpRight,
  Filter,
  Search,
  X,
  ChevronsUpDown,
  ChevronsDownUp,
  Check,
} from 'lucide-react';
import type { Team, Project, BoardColumn, Task, AssignedTeamTask, TaskPriority } from '@/types';

const PRIORITY_META: Record<TaskPriority, { label: string; badgeClass: string }> = {
  URGENT: { label: 'URGENT', badgeClass: 'bg-red-100 text-red-600' },
  HIGH: { label: 'HIGH', badgeClass: 'bg-orange-100 text-orange-600' },
  MEDIUM: { label: 'MEDIUM', badgeClass: 'bg-yellow-100 text-yellow-600' },
  LOW: { label: 'LOW', badgeClass: 'bg-gray-100 text-gray-500' },
};

const FILTER_PRIORITIES = [
  { v: null, label: 'Semua prioritas' },
  { v: 'URGENT', label: 'Urgent' },
  { v: 'HIGH', label: 'Tinggi' },
  { v: 'MEDIUM', label: 'Sedang' },
  { v: 'LOW', label: 'Rendah' },
] as const;

function formatDueDate(dueDateStr?: string | null): { text: string; isOverdue: boolean } | null {
  if (!dueDateStr) return null;
  const d = new Date(dueDateStr);
  if (isNaN(d.getTime())) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(d);
  target.setHours(0, 0, 0, 0);

  const isOverdue = target < now;
  const isToday = target.getTime() === now.getTime();

  let text = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
  if (isToday) text = 'Hari ini';
  else if (isOverdue) text = `${text} (Terlewat)`;

  return { text, isOverdue };
}

/* ========================================================================= */
/* CARD VIEW (Identik dengan KanbanBoard.tsx)                                */
/* ========================================================================= */
function CardView({
  task,
  overlay,
  className,
  bare,
  onOpenTitle,
}: {
  task: AssignedTeamTask;
  overlay?: boolean;
  className?: string;
  bare?: boolean;
  onOpenTitle?: () => void;
}) {
  const approved = (task.approval ?? 'APPROVED') === 'APPROVED';
  const dueInfo = formatDueDate(task.dueDate);
  const priorityMeta = PRIORITY_META[task.priority] ?? PRIORITY_META.LOW;

  return (
    <div
      className={`rounded-lg border bg-white p-3 ${
        overlay
          ? 'border-perrific-violet/50 shadow-xl'
          : bare
            ? 'border-transparent'
            : 'border-gray-200'
      } ${className ?? ''}`}
    >
      <div className="flex min-w-0 items-baseline gap-1.5">
        {onOpenTitle ? (
          <>
            <button
              type="button"
              onClick={onOpenTitle}
              title={`Buka detail ${task.title}`}
              aria-label={`Buka detail ${task.title} lewat ID`}
              className="shrink-0 font-manrope text-xs font-bold text-perrific-violet hover:underline cursor-pointer"
            >
              #{task.number}
            </button>
            <button
              type="button"
              onClick={onOpenTitle}
              title={`Buka detail ${task.title}`}
              aria-label={`Buka detail ${task.title} lewat judul`}
              className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-800 hover:underline cursor-pointer"
            >
              {task.title}
            </button>
          </>
        ) : (
          <>
            <span className="shrink-0 font-manrope text-xs font-bold text-perrific-violet">
              #{task.number}
            </span>
            <p className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800">{task.title}</p>
          </>
        )}
      </div>

      {!approved && (
        <p className="mt-1.5">
          <span
            title={task.approval === 'REJECTED' ? 'Usulan ditolak admin' : 'Menunggu persetujuan admin'}
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
              task.approval === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {task.approval === 'REJECTED' ? 'Ditolak' : 'Menunggu persetujuan'}
          </span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${priorityMeta.badgeClass}`}
        >
          {task.priority}
        </span>

        {dueInfo && (
          <span
            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
              dueInfo.isOverdue ? 'bg-rose-100 text-rose-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            <Clock size={10} strokeWidth={1.6} />
            {dueInfo.text}
          </span>
        )}
      </div>

      <div className="mt-2">
        <p className="text-[11px] text-gray-400">Assigned to:</p>
        {task.assignees && task.assignees.length > 0 ? (
          <p className="mt-1 flex items-center gap-1.5">
            <span className="flex shrink-0 -space-x-1.5">
              {task.assignees.slice(0, 3).map((a) => (
                <Avatar
                  key={a.id}
                  src={a.avatarUrl}
                  name={a.name}
                  size={24}
                  alt={a.name}
                  className="h-6 w-6 text-[10px] ring-2 ring-white"
                />
              ))}
            </span>
            <span className="max-w-[110px] truncate text-xs text-gray-600">
              {task.assignees.length > 3 ? `+${task.assignees.length - 3} ` : ''}
              {task.assignees
                .slice(0, 3)
                .map((a) => a.name)
                .join(', ')}
            </span>
          </p>
        ) : (
          <p className="mt-1 text-xs italic text-gray-300">Belum di-assign</p>
        )}
      </div>
    </div>
  );
}

/* ========================================================================= */
/* CARD (useSortable dengan dynamic ghost hole & registerNode)               */
/* ========================================================================= */
function Card({
  task,
  onOpen,
  dragActive,
  registerNode,
  gone,
}: {
  task: AssignedTeamTask;
  onOpen?: (task: AssignedTeamTask) => void;
  dragActive?: boolean;
  registerNode?: (id: string, el: HTMLElement | null) => void;
  gone?: boolean;
}) {
  const approved = (task.approval ?? 'APPROVED') === 'APPROVED';
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `task:${task.id}`,
    disabled: !approved,
  });

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        registerNode?.(task.id, el);
      }}
      {...attributes}
      {...listeners}
      onPointerDown={(e) => {
        listeners?.onPointerDown?.(e);
      }}
      className={`rounded-lg ${
        isDragging ? (gone ? 'hidden' : 'opacity-40') : dragActive ? '' : 'transition'
      }`}
    >
      <CardView
        task={task}
        bare={dragActive && !isDragging}
        onOpenTitle={onOpen && !isDragging ? () => onOpen(task) : undefined}
      />
    </div>
  );
}

/* ========================================================================= */
/* COLUMN (useDroppable dengan collapsible strip & highlight)                */
/* ========================================================================= */
function Column({
  columnId,
  label,
  color,
  count,
  collapsed,
  sortableIds,
  onToggleCollapse,
  registerColumn,
  children,
}: {
  columnId: string;
  label: string;
  color: string;
  count: number;
  collapsed: boolean;
  sortableIds: string[];
  onToggleCollapse: () => void;
  registerColumn?: (columnId: string, el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${columnId}` });

  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        registerColumn?.(columnId, el);
      }}
      className={`shrink-0 overflow-hidden rounded-xl transition-[width,background-color] duration-300 ease-out ${
        collapsed ? 'w-11 self-stretch h-[460px] min-h-[460px]' : 'w-72 sm:w-80 h-[460px] min-h-[460px]'
      } ${isOver ? (collapsed ? 'bg-perrific-violet/20' : 'bg-perrific-violet/10') : 'bg-gray-200'}`}
    >
      {collapsed ? (
        <div key="strip" className="flex h-full w-11 flex-col items-center gap-1 py-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={`Bentangkan kolom ${label}`}
            aria-label={`Bentangkan kolom ${label}`}
            aria-expanded="false"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-perrific-violet transition hover:bg-gray-300 cursor-pointer"
          >
            <ChevronRight size={12} strokeWidth={1.8} />
          </button>
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
          <span className="truncate font-manrope text-xs font-bold tracking-widest text-gray-500 [writing-mode:vertical-rl]">
            {label.toUpperCase()}
          </span>
          <span className="rounded bg-gray-300 px-1.5 py-0.5 font-manrope text-[11px] font-semibold text-gray-600">
            {count}
          </span>
        </div>
      ) : (
        <div key="full" className="flex h-full max-h-full w-72 sm:w-80 flex-col p-3">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-1 px-1">
            <h3 className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold text-gray-600">
              <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1 truncate">
                {label} · {count}
              </span>
            </h3>
            <button
              type="button"
              onClick={onToggleCollapse}
              title={`Ciutkan kolom ${label}`}
              aria-label={`Ciutkan kolom ${label}`}
              aria-expanded="true"
              className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-300 hover:text-gray-700 cursor-pointer"
            >
              <ChevronLeft size={12} strokeWidth={1.8} />
            </button>
          </div>
          <div className="kanban-scroll h-[400px] min-h-[400px] max-h-[400px] flex-1 space-y-2 overflow-y-auto pr-0.5">
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {children}
            </SortableContext>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========================================================================= */
/* TASK SORTING HELPER                                                       */
/* ========================================================================= */
function compareTasks(a: { order?: number; id: string }, b: { order?: number; id: string }): number {
  const diff = (a.order ?? 0) - (b.order ?? 0);
  if (diff !== 0) return diff;
  return a.id.localeCompare(b.id);
}

/* ========================================================================= */
/* PROJECT KANBAN BOARD (Sistem Drag n Drop Identik dengan KanbanBoard.tsx)   */
/* ========================================================================= */
function ProjectKanbanBoard({
  project,
  columns,
  tasks,
  onMove,
  onReorder,
  onOpen,
}: {
  project: Project;
  columns: BoardColumn[];
  tasks: AssignedTeamTask[];
  onMove: (taskId: string, columnId: string, insertAt?: number) => void;
  onReorder: (columnId: string, orderedIds: string[]) => void;
  onOpen: (task: AssignedTeamTask) => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  const [collapsedCols, setCollapsedCols] = useState<string[]>([]);
  const toggleCollapseCol = (colId: string) => {
    setCollapsedCols((prev) => (prev.includes(colId) ? prev.filter((id) => id !== colId) : [...prev, colId]));
  };

  const visible = useMemo(() => {
    const list =
      columns.length > 0
        ? columns
        : [
            { id: 'todo', name: 'To Do', color: '#94a3b8', order: 0, projectId: project.id, createdAt: '' },
            { id: 'in_progress', name: 'In Progress', color: '#6366f1', order: 1, projectId: project.id, createdAt: '' },
            { id: 'done', name: 'Done', color: '#10b981', order: 2, projectId: project.id, createdAt: '' },
          ];
    return [...list].sort((a, b) => a.order - b.order);
  }, [columns, project.id]);

  const [activeId, setActiveId] = useState<string | null>(null);
  const [hover, setHover] = useState<{ columnId: string; index: number } | null>(null);
  const cardNodes = useRef(new Map<string, HTMLElement>());
  const columnNodes = useRef(new Map<string, HTMLElement>());
  const dragging = activeId !== null;

  function sameIds(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((id, i) => id === b[i]);
  }

  function columnIds(columnId: string): string[] {
    return tasks
      .filter((t) => t.columnId === columnId)
      .sort(compareTasks)
      .map((t) => t.id);
  }

  function registerNode(id: string, el: HTMLElement | null) {
    if (el) cardNodes.current.set(id, el);
    else cardNodes.current.delete(id);
  }

  function registerColumn(columnId: string, el: HTMLElement | null) {
    if (el) columnNodes.current.set(columnId, el);
    else columnNodes.current.delete(columnId);
  }

  function moveWithin(ids: string[], fromId: string, insertAt: number): string[] {
    const arr = [...ids];
    const from = arr.indexOf(fromId);
    if (from === -1) return ids;
    const [m] = arr.splice(from, 1);
    arr.splice(insertAt > from ? insertAt - 1 : insertAt, 0, m);
    return arr;
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  // Pointer move: kalkulasi posisi lubang sisipan secara real-time
  useEffect(() => {
    if (!activeId) return;
    const taskId = activeId.replace(/^task:/, '');
    const onPointerMove = (e: PointerEvent) => {
      const origin = tasks.find((t) => t.id === taskId);
      if (!origin) {
        setHover((h) => (h ? null : h));
        return;
      }
      let found: { columnId: string; index: number } | null = null;
      for (const col of visible) {
        if (collapsedCols.includes(col.id)) continue;
        const colEl = columnNodes.current.get(col.id);
        if (!colEl) continue;
        const r = colEl.getBoundingClientRect();
        if (
          e.clientX < r.left - 12 ||
          e.clientX > r.right + 12 ||
          e.clientY < r.top - 8 ||
          e.clientY > r.bottom + 8
        ) {
          continue;
        }
        const ids = tasks
          .filter((t) => t.columnId === col.id)
          .sort(compareTasks)
          .map((t) => t.id);
        let index = ids.length;
        for (let i = 0; i < ids.length; i++) {
          if (ids[i] === taskId) continue;
          const el = cardNodes.current.get(ids[i]);
          if (!el) continue;
          const cr = el.getBoundingClientRect();
          if (e.clientY < cr.top + cr.height / 2) {
            index = i;
            break;
          }
        }
        found = { columnId: col.id, index };
        break;
      }
      setHover((h) => {
        if (!found && !h) return h;
        if (found && h && h.columnId === found.columnId && h.index === found.index) return h;
        return found;
      });
    };
    window.addEventListener('pointermove', onPointerMove);
    return () => window.removeEventListener('pointermove', onPointerMove);
  }, [activeId, tasks, visible, collapsedCols]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const dropHover = hover;
    setHover(null);
    setActiveId(null);
    if (!over) return;
    const taskId = String(active.id).replace(/^task:/, '');
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const overId = String(over.id);
    if (overId.startsWith('task:')) {
      const overTask = tasks.find((t) => `task:${t.id}` === overId);
      if (!overTask) return;
      if (overTask.columnId !== task.columnId) {
        // Pindah kolom ke posisi lubang bila lubang ada di kolom tujuan
        const target = columnIds(overTask.columnId);
        const insertAt =
          dropHover && dropHover.columnId === overTask.columnId
            ? Math.max(0, Math.min(dropHover.index, target.length))
            : target.length;
        onMove(taskId, overTask.columnId, insertAt);
        return;
      }
      // Se-kolom: pakai indeks pointer bila ada, kalau tidak pakai target
      const current = columnIds(task.columnId);
      const next =
        dropHover && dropHover.columnId === task.columnId
          ? moveWithin(current, taskId, dropHover.index)
          : arrayMove(current, current.indexOf(taskId), current.indexOf(overTask.id));
      if (sameIds(next, current)) return;
      onReorder(task.columnId, next);
      return;
    }
    // Drop di area kolom
    const to = overId.replace(/^col:/, '');
    if (!visible.some((c) => c.id === to)) return;
    if (task.columnId !== to) {
      const target = columnIds(to);
      const insertAt =
        dropHover && dropHover.columnId === to
          ? Math.max(0, Math.min(dropHover.index, target.length))
          : target.length;
      onMove(taskId, to, insertAt);
      return;
    }
    const current = columnIds(task.columnId);
    if (current.length <= 1) return;
    if (dropHover && dropHover.columnId === task.columnId) {
      const next = moveWithin(current, taskId, dropHover.index);
      if (sameIds(next, current)) return;
      onReorder(task.columnId, next);
    }
  }

  const activeTask = activeId ? (tasks.find((t) => `task:${t.id}` === activeId) ?? null) : null;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setHover(null);
        setActiveId(null);
      }}
    >
      <div className="nice-scroll flex items-stretch gap-4 overflow-x-auto pb-2 pt-1">
        {visible.map((col) => {
          const items = tasks.filter((t) => t.columnId === col.id).sort(compareTasks);
          const isCollapsed = collapsedCols.includes(col.id);
          const activeIdStr = activeId?.replace(/^task:/, '') ?? null;
          const isOrigin = !!activeTask && activeTask.columnId === col.id;
          const hv = hover && hover.columnId === col.id && !isCollapsed ? hover : null;
          // Placeholder hanya di kolom hover. Card asal disembunyikan total bila placeholder tampil di kolom lain
          const hideOrigin = isOrigin && !!hover && !!activeIdStr && hover.columnId !== col.id;
          const ordered = (() => {
            if (!hv || !activeIdStr || !isOrigin) return items;
            const from = items.findIndex((t) => t.id === activeIdStr);
            if (from === -1) return items;
            const arr = [...items];
            const [m] = arr.splice(from, 1);
            arr.splice(hv.index > from ? hv.index - 1 : hv.index, 0, m);
            return arr;
          })();
          const showPh = !!hv && !!activeTask && !isOrigin;
          const nodes: React.ReactNode[] = [];
          ordered.forEach((task, i) => {
            if (showPh && hv.index === i && activeTask) {
              nodes.push(
                <div key={`ph-${i}`} aria-hidden="true" className="opacity-40">
                  <CardView task={activeTask} />
                </div>,
              );
            }
            nodes.push(
              <Card
                key={task.id}
                task={task}
                onOpen={onOpen}
                dragActive={dragging}
                registerNode={registerNode}
                gone={hideOrigin && task.id === activeIdStr}
              />,
            );
          });
          if (showPh && activeTask && hv.index >= ordered.length) {
            nodes.push(
              <div key="ph-end" aria-hidden="true" className="opacity-40">
                <CardView task={activeTask} />
              </div>,
            );
          }
          return (
            <Column
              key={col.id}
              columnId={col.id}
              label={col.name}
              color={col.color}
              count={items.length}
              collapsed={isCollapsed}
              sortableIds={items.map((t) => `task:${t.id}`)}
              onToggleCollapse={() => toggleCollapseCol(col.id)}
              registerColumn={registerColumn}
            >
              {nodes}
              {items.length === 0 && !showPh && (
                <div className="flex h-[392px] flex-col items-center justify-center rounded-lg border border-dashed border-gray-300/80 text-center">
                  <p className="text-xs text-gray-400">Belum ada task</p>
                </div>
              )}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-72 sm:w-80">
            <CardView task={activeTask} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

/* ========================================================================= */
/* MAIN TEAM TASK VIEW COMPONENT                                             */
/* ========================================================================= */
interface TeamTaskViewProps {
  onRefreshDaily?: () => void;
}

export default function TeamTaskView({ onRefreshDaily: _onRefreshDaily }: TeamTaskViewProps) {
  const { user } = useAuth();
  const { socket } = useSocket();
  const undoStack = useUndoStack();
  const { items: trashItems } = useTrash(user?.id);
  const trashedTeamIds = useMemo(
    () => new Set(trashItems.filter((t) => t.kind === 'team').map((t) => t.id)),
    [trashItems],
  );
  const trashedTeamIdsRef = useRef(trashedTeamIds);
  trashedTeamIdsRef.current = trashedTeamIds;

  // Data utama
  const [teams, setTeams] = useState<Team[]>([]);
  const [tasks, setTasks] = useState<AssignedTeamTask[]>([]);
  const [projectsByTeam, setProjectsByTeam] = useState<Record<string, Project[]>>({});
  const [columnsByProject, setColumnsByProject] = useState<Record<string, BoardColumn[]>>({});

  // Loading states
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingProjects, setLoadingProjects] = useState<Record<string, boolean>>({});
  const [loadingColumns, setLoadingColumns] = useState<Record<string, boolean>>({});

  // Accordion states
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  // Refs untuk akses sinkron pada callback real-time tanpa memicu loop re-render
  const teamsRef = useRef(teams);
  teamsRef.current = teams;
  const projectsByTeamRef = useRef(projectsByTeam);
  projectsByTeamRef.current = projectsByTeam;
  const loadingProjectsRef = useRef(loadingProjects);
  loadingProjectsRef.current = loadingProjects;
  const columnsByProjectRef = useRef(columnsByProject);
  columnsByProjectRef.current = columnsByProject;
  const loadingColumnsRef = useRef(loadingColumns);
  loadingColumnsRef.current = loadingColumns;
  const expandedTeamsRef = useRef(expandedTeams);
  expandedTeamsRef.current = expandedTeams;
  const expandedProjectsRef = useRef(expandedProjects);
  expandedProjectsRef.current = expandedProjects;

  // Tim aktif (tidak berada di Sampah)
  const activeTeams = useMemo(
    () => teams.filter((t) => !trashedTeamIds.has(t.id)),
    [teams, trashedTeamIds],
  );

  // Search & Filter (Pill bar)
  const [filterSearch, setFilterSearch] = useState('');
  const [filterPriority, setFilterPriority] = useState<TaskPriority | null>(null);
  const [onlyWithTasks, setOnlyWithTasks] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const filterBtnRef = useRef<HTMLButtonElement>(null);

  // Responsive sidebar offset untuk floating pill bar
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(isAppSidebarCollapsed);
  useEffect(() => {
    const sync = () => setSbCollapsed(isAppSidebarCollapsed());
    window.addEventListener(APP_SIDEBAR_EVENT, sync);
    return () => window.removeEventListener(APP_SIDEBAR_EVENT, sync);
  }, []);

  // Modal Task Detail
  const [activeTaskDetail, setActiveTaskDetail] = useState<{
    task: AssignedTeamTask;
    project: Project | null;
    team: Team | null;
  } | null>(null);

  // Muat project untuk tim tertentu saat tim dibuka (atau force reload saat update real-time)
  const loadProjectsForTeam = useCallback(async (teamId: string, force = false) => {
    if (!force && (projectsByTeamRef.current[teamId] || loadingProjectsRef.current[teamId])) return;
    const isInitial = !projectsByTeamRef.current[teamId];
    try {
      if (isInitial) setLoadingProjects((prev) => ({ ...prev, [teamId]: true }));
      const projects = await teamApi.listProjects(teamId);
      setProjectsByTeam((prev) => ({ ...prev, [teamId]: projects }));
    } catch (err) {
      console.error(`[TeamTaskView] Gagal memuat project untuk tim ${teamId}:`, err);
      if (isInitial) showToast('Gagal memuat project tim.');
    } finally {
      if (isInitial) setLoadingProjects((prev) => ({ ...prev, [teamId]: false }));
    }
  }, []);

  // Muat kolom kanban untuk project tertentu saat project dibuka (atau force reload saat update real-time)
  const loadColumnsForProject = useCallback(async (projectId: string, force = false) => {
    if (!force && (columnsByProjectRef.current[projectId] || loadingColumnsRef.current[projectId])) return;
    const isInitial = !columnsByProjectRef.current[projectId];
    try {
      if (isInitial) setLoadingColumns((prev) => ({ ...prev, [projectId]: true }));
      const cols = await projectApi.listColumns(projectId);
      setColumnsByProject((prev) => ({ ...prev, [projectId]: cols }));
    } catch (err) {
      console.error(`[TeamTaskView] Gagal memuat kolom untuk project ${projectId}:`, err);
      if (isInitial) showToast('Gagal memuat kolom project.');
    } finally {
      if (isInitial) setLoadingColumns((prev) => ({ ...prev, [projectId]: false }));
    }
  }, []);

  // Muat data tim dan tasks (beserta refresh project & kolom terbuka saat silent refresh)
  const fetchData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setLoadingInitial(true);
        const prevTeamIds = new Set(teamsRef.current.map((t) => t.id));
        const [fetchedTeams, fetchedTasks] = await Promise.all([
          teamApi.listMyTeams(),
          taskApi.listMyAssigned(),
        ]);
        setTeams(fetchedTeams);
        setTasks(fetchedTasks);

        const nonTrashed = fetchedTeams.filter((t) => !trashedTeamIdsRef.current.has(t.id));
        if (!silent && nonTrashed.length > 0) {
          setExpandedTeams(new Set([nonTrashed[0].id]));
        } else if (silent) {
          // Jika ada tim baru yang dibuat secara real-time, otomatis buka & muat project-nya
          const newTeams = nonTrashed.filter((t) => !prevTeamIds.has(t.id));
          if (newTeams.length > 0) {
            setExpandedTeams((prev) => {
              const next = new Set(prev);
              newTeams.forEach((nt) => next.add(nt.id));
              return next;
            });
            newTeams.forEach((nt) => void loadProjectsForTeam(nt.id, true));
          }
          // Segarkan project dan kolom yang sedang terbuka
          const validIds = new Set(nonTrashed.map((t) => t.id));
          expandedTeamsRef.current.forEach((tid) => {
            if (validIds.has(tid)) void loadProjectsForTeam(tid, true);
          });
          expandedProjectsRef.current.forEach((pid) => {
            void loadColumnsForProject(pid, true);
          });
        }
      } catch (err) {
        console.error('[TeamTaskView] Gagal memuat data:', err);
        if (!silent) showToast('Gagal memuat daftar tim dan tugas.');
      } finally {
        if (!silent) setLoadingInitial(false);
      }
    },
    [loadProjectsForTeam, loadColumnsForProject],
  );

  useEffect(() => {
    void fetchData(false);
  }, [fetchData]);

  // Dengarkan event perubahan tim/project lokal (sidebar, modal, tab lain)
  useEffect(() => {
    const refresh = () => {
      void fetchData(true);
    };
    const onStorage = (e: StorageEvent) => {
      if (
        !e.key ||
        e.key === TEAMS_CHANGED_EVENT ||
        e.key === PROJECT_UPDATED_EVENT ||
        e.key.startsWith('purrific:trash:')
      ) {
        void fetchData(true);
      }
    };
    window.addEventListener(TEAMS_CHANGED_EVENT, refresh);
    window.addEventListener(PROJECT_UPDATED_EVENT, refresh);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(TEAMS_CHANGED_EVENT, refresh);
      window.removeEventListener(PROJECT_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, [fetchData]);

  // Dengarkan event socket real-time untuk tim, project, kolom, dan task
  useEffect(() => {
    if (!socket) return;
    const handleRefresh = () => {
      void fetchData(true);
    };
    const handleProjectUpdated = (payload?: { teamId?: string; projectId?: string }) => {
      void fetchData(true);
      if (payload?.teamId) void loadProjectsForTeam(payload.teamId, true);
      if (payload?.projectId) void loadColumnsForProject(payload.projectId, true);
    };
    socket.on('task:assigned', handleRefresh);
    socket.on('task:updated', handleRefresh);
    socket.on('team:updated', handleRefresh);
    socket.on('project:updated', handleProjectUpdated);
    return () => {
      socket.off('task:assigned', handleRefresh);
      socket.off('task:updated', handleRefresh);
      socket.off('team:updated', handleRefresh);
      socket.off('project:updated', handleProjectUpdated);
    };
  }, [socket, fetchData, loadProjectsForTeam, loadColumnsForProject]);

  // Otomatis muat project untuk tim yang dibuka
  useEffect(() => {
    expandedTeams.forEach((teamId) => {
      if (!trashedTeamIds.has(teamId)) {
        void loadProjectsForTeam(teamId);
      }
    });
  }, [expandedTeams, trashedTeamIds, loadProjectsForTeam]);

  // Otomatis muat kolom untuk project yang dibuka
  useEffect(() => {
    expandedProjects.forEach((projectId) => {
      void loadColumnsForProject(projectId);
    });
  }, [expandedProjects, loadColumnsForProject]);

  // Toggle buka/tutup tim
  const toggleTeam = (teamId: string) => {
    setExpandedTeams((prev) => {
      const next = new Set(prev);
      if (next.has(teamId)) next.delete(teamId);
      else {
        next.add(teamId);
        void loadProjectsForTeam(teamId);
      }
      return next;
    });
  };

  // Toggle buka/tutup project
  const toggleProject = (projectId: string) => {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(projectId)) next.delete(projectId);
      else {
        next.add(projectId);
        void loadColumnsForProject(projectId);
      }
      return next;
    });
  };

  // Expand / Collapse All
  const allExpanded = useMemo(() => {
    if (activeTeams.length === 0) return false;
    return activeTeams.every((t) => expandedTeams.has(t.id));
  }, [activeTeams, expandedTeams]);

  const toggleExpandAll = () => {
    if (allExpanded) {
      setExpandedTeams(new Set());
      setExpandedProjects(new Set());
    } else {
      const allTeamIds = new Set(activeTeams.map((t) => t.id));
      setExpandedTeams(allTeamIds);
      activeTeams.forEach((t) => void loadProjectsForTeam(t.id));

      const allProjectIds = new Set<string>();
      activeTeams.forEach((t) => {
        (projectsByTeam[t.id] ?? []).forEach((p) => {
          allProjectIds.add(p.id);
          void loadColumnsForProject(p.id);
        });
      });
      setExpandedProjects(allProjectIds);
    }
  };

  // Pindah kolom task (Penyelarasan dengan KanbanBoard.tsx moveTask)
  const handleMoveTask = (taskId: string, targetColumnId: string, insertAt?: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    const prev = tasks;
    const fromColumnId = task.columnId;
    const fromOrder = task.order ?? 0;
    const projectCols = columnsByProject[task.projectId] ?? [];
    const fromCol = projectCols.find((c) => c.id === fromColumnId);
    const targetCol = projectCols.find((c) => c.id === targetColumnId);

    // Jika dipindah ke kolom yang sama tanpa reorder, abaikan
    if (fromColumnId === targetColumnId && insertAt === undefined) return;

    const targetTasks = tasks
      .filter((t) => t.columnId === targetColumnId && t.id !== taskId)
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

    // Optimistic update
    setTasks((prevTasks) =>
      prevTasks
        .map((t) =>
          t.id === taskId
            ? {
                ...t,
                columnId: targetColumnId,
                order,
                column: targetCol
                  ? { id: targetCol.id, name: targetCol.name, order: targetCol.order }
                  : t.column,
              }
            : t,
        )
        .sort(compareTasks),
    );

    // Daftarkan aksi undo ke stack (Ctrl+Z)
    undoStack?.push(`pindah "${task.title}"`, async () => {
      setTasks((prevTasks) =>
        prevTasks
          .map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  columnId: fromColumnId,
                  order: fromOrder,
                  column: fromCol
                    ? { id: fromCol.id, name: fromCol.name, order: fromCol.order }
                    : t.column,
                }
              : t,
          )
          .sort(compareTasks),
      );
      try {
        await taskApi.update(taskId, { columnId: fromColumnId, order: fromOrder });
      } catch {
        showToast('Gagal mengembalikan task ke kolom asal.');
      }
    });

    taskApi.update(taskId, { columnId: targetColumnId, order }).then(
      (updated) => {
        setTasks((prevTasks) =>
          prevTasks
            .map((t) => (t.id === taskId ? { ...t, ...updated } : t))
            .sort(compareTasks),
        );
      },
      () => {
        setTasks(prev);
        showToast('Gagal memindah task. Coba lagi.');
      },
    );
  };

  // Reorder se-kolom (Penyelarasan dengan KanbanBoard.tsx reorderColumn)
  const handleReorderColumn = (projectId: string, columnId: string, orderedIds: string[]) => {
    const prev = tasks;
    const projectCols = columnsByProject[projectId] ?? [];
    const col = projectCols.find((c) => c.id === columnId);
    const prevOrderedIds = tasks
      .filter((t) => t.columnId === columnId && t.projectId === projectId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((t) => t.id);

    const orderOf = new Map(orderedIds.map((id, idx) => [id, idx] as const));
    setTasks((prevTasks) =>
      prevTasks
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

    undoStack?.push(`urutan "${col?.name ?? 'kolom'}"`, async () => {
      const prevOrderMap = new Map(prevOrderedIds.map((id, idx) => [id, idx] as const));
      setTasks((currentTasks) =>
        currentTasks
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
        await projectApi.reorderTasks(projectId, columnId, prevOrderedIds);
      } catch {
        showToast('Gagal mengembalikan urutan task.');
      }
    });

    projectApi.reorderTasks(projectId, columnId, orderedIds).catch(() => {
      setTasks(prev);
      showToast('Gagal menyimpan urutan. Coba lagi.');
    });
  };

  // Filter tasks berdasarkan sampah, filter tugas saya, query pencarian, dan prioritas
  const filteredTasks = useMemo(() => {
    const q = filterSearch.trim().toLowerCase();
    return tasks.filter((t) => {
      const teamId = t.project?.team?.id;
      if (teamId && trashedTeamIds.has(teamId)) return false;
      if (onlyWithTasks && (!user?.id || !t.assignees.some((a) => a.id === user.id))) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      if (q) {
        const matchesTitle = t.title.toLowerCase().includes(q);
        const matchesNumber = String(t.number).includes(q);
        const matchesProject = t.project?.name.toLowerCase().includes(q);
        if (!matchesTitle && !matchesNumber && !matchesProject) return false;
      }
      return true;
    });
  }, [tasks, trashedTeamIds, onlyWithTasks, user?.id, filterSearch, filterPriority]);

  // Hitung jumlah task per team dan per project
  const taskCountByTeam = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTasks.forEach((t) => {
      const teamId = t.project?.team?.id;
      if (teamId) {
        counts[teamId] = (counts[teamId] ?? 0) + 1;
      }
    });
    return counts;
  }, [filteredTasks]);

  const taskCountByProject = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredTasks.forEach((t) => {
      counts[t.projectId] = (counts[t.projectId] ?? 0) + 1;
    });
    return counts;
  }, [filteredTasks]);

  // Tasks grouped by project id
  const tasksByProject = useMemo(() => {
    const map: Record<string, AssignedTeamTask[]> = {};
    filteredTasks.forEach((t) => {
      if (!map[t.projectId]) map[t.projectId] = [];
      map[t.projectId].push(t);
    });
    return map;
  }, [filteredTasks]);

  // Tim yang tampil (setelah filter sampah & onlyWithTasks)
  const displayedTeams = useMemo(() => {
    if (!onlyWithTasks) return activeTeams;
    return activeTeams.filter((t) => (taskCountByTeam[t.id] ?? 0) > 0);
  }, [activeTeams, onlyWithTasks, taskCountByTeam]);

  const filterOptionCount = (filterPriority ? 1 : 0) + (onlyWithTasks ? 1 : 0);

  return (
    <div className="relative min-h-[60vh] w-full">
      {/* Konten Utama: Daftar Hierarki Tim -> Project -> Kanban */}
      {loadingInitial ? (
        <div className="py-20 text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
          <p className="mt-3 font-manrope text-sm text-gray-500">Memuat task dan tim Anda...</p>
        </div>
      ) : displayedTeams.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center shadow-xs">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
            <Users size={28} strokeWidth={1.6} />
          </div>
          <h3 className="mt-4 font-manrope text-base font-semibold text-gray-800">
            {onlyWithTasks || filterSearch || filterPriority
              ? 'Tidak ada task yang cocok dengan filter'
              : 'Belum ada tim atau tugas yang terhubung'}
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            {onlyWithTasks || filterSearch || filterPriority
              ? 'Coba bersihkan pencarian atau ubah filter prioritas di pill bar bawah.'
              : 'Bergabunglah ke tim untuk mulai mengelola task kolaboratif Anda.'}
          </p>
          {(onlyWithTasks || filterSearch || filterPriority) && (
            <button
              type="button"
              onClick={() => {
                setFilterSearch('');
                setFilterPriority(null);
                setOnlyWithTasks(false);
              }}
              className="mt-4 rounded-lg bg-gray-900 px-4 py-2 font-manrope text-xs font-semibold text-white transition hover:bg-black"
            >
              Reset Filter
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedTeams.map((team) => {
            const isTeamOpen = expandedTeams.has(team.id);
            const teamTaskCount = taskCountByTeam[team.id] ?? 0;
            const projects = projectsByTeam[team.id] ?? [];
            const isLoadingProj = loadingProjects[team.id];

            return (
              <div
                key={team.id}
                className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs transition-all duration-200 hover:border-gray-300"
              >
                {/* Header Tingkat Tim */}
                <div
                  onClick={() => toggleTeam(team.id)}
                  className="flex cursor-pointer items-center justify-between gap-3 bg-gray-50/70 px-4 py-3.5 transition hover:bg-gray-100/70"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {/* Tombol Dropdown Tim (kiri nama tim) */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTeam(team.id);
                      }}
                      title={isTeamOpen ? 'Ciutkan tim' : 'Bentangkan tim'}
                      aria-label={isTeamOpen ? `Ciutkan tim ${team.name}` : `Bentangkan tim ${team.name}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-200/80 hover:text-gray-900 transition cursor-pointer"
                    >
                      <ChevronRight
                        size={16}
                        strokeWidth={1.8}
                        className={`transition-transform duration-200 ${
                          isTeamOpen ? 'rotate-90 text-gray-800' : 'text-gray-400'
                        }`}
                        aria-hidden="true"
                      />
                    </button>

                    {/* Avatar / Foto Tim */}
                    {team.avatarUrl ? (
                      <img
                        src={team.avatarUrl}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-xl object-cover shadow-sm"
                      />
                    ) : (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-perrific-violet/20 bg-perrific-violet/10 font-manrope text-xs font-bold text-perrific-violet">
                        {team.name.trim().slice(0, 2).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate font-manrope text-sm font-bold text-gray-900">
                          {team.name}
                        </h2>
                      </div>
                      {team.description && (
                        <p className="truncate text-xs text-gray-400">{team.description}</p>
                      )}
                    </div>
                  </div>

                  {/* Badges Info Tim */}
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 font-manrope text-xs font-semibold ${
                        teamTaskCount > 0
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {teamTaskCount} {onlyWithTasks ? 'Tugas Anda' : 'Tugas'}
                    </span>
                    <span className="hidden sm:inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 font-manrope text-xs text-gray-600">
                      {projects.length > 0 ? `${projects.length} Project` : 'Project'}
                    </span>
                  </div>
                </div>

                {/* Konten Tim (Daftar Project) */}
                {isTeamOpen && (
                  <div className="border-t border-gray-100 p-4">
                    {isLoadingProj ? (
                      <div className="py-6 text-center text-xs text-gray-400">
                        <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                        <span className="ml-2">Memuat daftar project...</span>
                      </div>
                    ) : projects.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-gray-200 py-6 text-center text-xs text-gray-400">
                        Belum ada project di tim ini.
                      </div>
                    ) : (
                      <div className="ml-2 sm:ml-4 space-y-3 border-l-2 border-orange-200 pl-3 sm:pl-4">
                        {projects.map((project) => {
                          const isProjOpen = expandedProjects.has(project.id);
                          const projTaskCount = taskCountByProject[project.id] ?? 0;
                          const projectCols = columnsByProject[project.id] ?? [];
                          const isLoadingCols = loadingColumns[project.id];
                          const projectTasks = tasksByProject[project.id] ?? [];

                          return (
                            <div
                              key={project.id}
                              className="overflow-hidden rounded-xl border border-gray-200/80 bg-gray-50/50 shadow-2xs transition-all"
                            >
                              {/* Header Tingkat Project */}
                              <div
                                onClick={() => toggleProject(project.id)}
                                className="flex cursor-pointer items-center justify-between gap-2.5 px-3.5 py-2.5 transition hover:bg-gray-100/60"
                              >
                                <div className="flex min-w-0 items-center gap-2.5">
                                  {/* Tombol Dropdown Project */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleProject(project.id);
                                    }}
                                    title={isProjOpen ? 'Ciutkan kanban' : 'Bentangkan kanban'}
                                    aria-label={isProjOpen ? `Ciutkan board ${project.name}` : `Bentangkan board ${project.name}`}
                                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-400 hover:bg-gray-200 hover:text-gray-700 transition cursor-pointer"
                                  >
                                    <ChevronRight
                                      size={14}
                                      strokeWidth={1.8}
                                      className={`transition-transform duration-200 ${
                                        isProjOpen ? 'rotate-90 text-gray-700' : 'text-gray-400'
                                      }`}
                                      aria-hidden="true"
                                    />
                                  </button>

                                  {/* Ikon Project */}
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-gray-600 shadow-2xs border border-gray-200/80">
                                    <Columns3 size={13} strokeWidth={1.6} />
                                  </span>

                                  <span className="truncate font-manrope text-xs font-semibold text-gray-800">
                                    {project.name}
                                  </span>
                                </div>

                                {/* Badges & Action */}
                                <div className="flex shrink-0 items-center gap-2">
                                  <span
                                    className={`inline-flex items-center rounded-full px-2 py-0.5 font-manrope text-[11px] font-semibold ${
                                      projTaskCount > 0
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : 'bg-gray-200/70 text-gray-500'
                                    }`}
                                  >
                                    {projTaskCount} Tugas
                                  </span>

                                  <Link
                                    to={`/projects/${project.id}/kanban`}
                                    onClick={(e) => e.stopPropagation()}
                                    title="Buka board tim penuh"
                                    className="hidden sm:flex items-center gap-1 rounded-md px-2 py-1 font-manrope text-[11px] font-medium text-gray-500 hover:bg-white hover:text-orange-700 hover:shadow-2xs transition"
                                  >
                                    <span>Board Tim</span>
                                    <ArrowUpRight size={11} strokeWidth={1.8} aria-hidden="true" />
                                  </Link>
                                </div>
                              </div>

                              {/* Konten Project (Kanban Board dengan Drag n Drop Identik Project Kanban) */}
                              {isProjOpen && (
                                <div className="border-t border-gray-200/70 bg-white p-3">
                                  {isLoadingCols ? (
                                    <div className="py-8 text-center text-xs text-gray-400">
                                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
                                      <span className="ml-2">Memuat board kanban...</span>
                                    </div>
                                  ) : (
                                    <ProjectKanbanBoard
                                      project={project}
                                      columns={projectCols}
                                      tasks={projectTasks}
                                      onMove={handleMoveTask}
                                      onReorder={(colId, orderedIds) =>
                                        handleReorderColumn(project.id, colId, orderedIds)
                                      }
                                      onOpen={(t) =>
                                        setActiveTaskDetail({
                                          task: t,
                                          project,
                                          team,
                                        })
                                      }
                                    />
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Spacer di bawah agar konten paling bawah tidak tertutup oleh floating pill bar */}
      <div aria-hidden="true" className="h-28" />

      {/* ========================================================================= */}
      {/* FLOATING PILL BAR (Identik dengan Project Kanban BoardPage.tsx)           */}
      {/* ========================================================================= */}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center transition-[left] duration-200 ${
          sbCollapsed ? 'md:left-0' : 'md:left-64'
        }`}
      >
        <div className="pointer-events-auto flex max-w-full items-center gap-2 rounded-full border border-gray-300 bg-white/95 p-2 shadow-[0_8px_24px_rgba(26,26,30,0.14)] backdrop-blur">
          {/* Tombol Filter */}
          <button
            ref={filterBtnRef}
            type="button"
            onClick={() => setFilterMenuOpen((v) => !v)}
            aria-haspopup="menu"
            aria-expanded={filterMenuOpen}
            aria-label="Filter task tim"
            className={`flex shrink-0 items-center gap-2 rounded-full px-5 py-2.5 font-manrope text-sm font-semibold transition focus:outline-none ${
              filterOptionCount > 0
                ? 'bg-perrific-graphite text-white'
                : 'text-gray-800 hover:bg-gray-200 hover:text-black'
            }`}
          >
            <Filter size={15} strokeWidth={1.6} aria-hidden="true" />
            Filter
            {filterOptionCount > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-white px-1.5 font-manrope text-[11px] font-bold text-perrific-graphite">
                {filterOptionCount}
              </span>
            )}
          </button>

          {/* Input Pencarian Bulat */}
          <div className="relative w-48 min-w-0 sm:w-72">
            <Search size={15} strokeWidth={1.6} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="Cari task..."
              aria-label="Cari task"
              className="w-full rounded-full bg-gray-100 py-2.5 pl-10 pr-8 font-manrope text-sm text-gray-800 placeholder:text-gray-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-perrific-violet/30"
            />
            {filterSearch && (
              <button type="button" onClick={() => setFilterSearch('')} aria-label="Hapus pencarian" className="absolute right-3 top-1/2 -translate-y-1/2 flex h-5 w-5 items-center justify-center rounded-full text-gray-400 hover:bg-gray-200 hover:text-gray-700 cursor-pointer">
                <X size={10} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </div>

          {/* Tombol Expand All / Collapse All */}
          <button
            type="button"
            onClick={toggleExpandAll}
            title={allExpanded ? 'Tutup semua' : 'Buka semua'}
            aria-label={allExpanded ? 'Tutup semua hierarki' : 'Buka semua hierarki'}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition cursor-pointer"
          >
            {allExpanded ? (
              <ChevronsDownUp size={16} strokeWidth={1.5} aria-hidden="true" />
            ) : (
              <ChevronsUpDown size={16} strokeWidth={1.5} aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Popover Menu Filter via MenuPortal (Placement: above) */}
      {filterMenuOpen && (
        <MenuPortal
          anchorRef={filterBtnRef}
          label="Filter task tim"
          width={260}
          placement="above"
          onClose={() => setFilterMenuOpen(false)}
        >
          <div className="p-2 space-y-1">
            <p className="px-2 py-1 font-manrope text-[11px] font-bold tracking-wider text-gray-400 uppercase">
              Prioritas
            </p>
            {FILTER_PRIORITIES.map((opt) => (
              <button
                key={opt.v ?? 'all'}
                type="button"
                onClick={() => {
                  setFilterPriority(opt.v as TaskPriority | null);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-manrope text-xs font-semibold transition hover:bg-gray-100 cursor-pointer ${
                  filterPriority === opt.v ? 'text-orange-700 bg-orange-50/60' : 'text-gray-700'
                }`}
              >
                <span>{opt.label}</span>
                {filterPriority === opt.v && <Check size={12} strokeWidth={2.2} aria-hidden="true" />}
              </button>
            ))}

            <div className="my-1.5 border-t border-gray-100" />

            <p className="px-2 py-1 font-manrope text-[11px] font-bold tracking-wider text-gray-400 uppercase">
              Tampilan
            </p>
            <button
              type="button"
              onClick={() => setOnlyWithTasks((prev) => !prev)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 font-manrope text-xs font-semibold transition hover:bg-gray-100 cursor-pointer ${
                onlyWithTasks ? 'text-orange-700 bg-orange-50/60' : 'text-gray-700'
              }`}
            >
              <span>Hanya yang ada tugas saya</span>
              {onlyWithTasks && <Check size={12} strokeWidth={2.2} aria-hidden="true" />}
            </button>

            {filterOptionCount > 0 && (
              <>
                <div className="my-1.5 border-t border-gray-100" />
                <button
                  type="button"
                  onClick={() => {
                    setFilterPriority(null);
                    setOnlyWithTasks(false);
                    setFilterMenuOpen(false);
                  }}
                  className="w-full rounded-lg px-2.5 py-1.5 text-center font-manrope text-xs font-semibold text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                >
                  Bersihkan semua filter
                </button>
              </>
            )}
          </div>
        </MenuPortal>
      )}

      {/* ========================================================================= */}
      {/* MODAL TASK DETAIL (In-Page)                                               */}
      {/* ========================================================================= */}
      {activeTaskDetail && (
        <ModalShell
          label="Detail Task"
          wide
          zClass="z-[60]"
          onClose={() => setActiveTaskDetail(null)}
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setActiveTaskDetail(null)}
              aria-label="Tutup"
              className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 cursor-pointer"
            >
              <X size={14} strokeWidth={1.6} aria-hidden="true" />
            </button>

            <TaskDetailView
              taskId={activeTaskDetail.task.id}
              project={activeTaskDetail.project}
              team={activeTaskDetail.team}
              currentUserId={user?.id}
              isAdmin={false}
              onClose={() => setActiveTaskDetail(null)}
              onUpdated={(updated: Task) => {
                setTasks((prev) =>
                  prev.map((t) =>
                    t.id === updated.id
                      ? {
                          ...t,
                          title: updated.title,
                          description: updated.description,
                          priority: updated.priority,
                          columnId: updated.columnId,
                          dueDate: updated.dueDate,
                        }
                      : t,
                  ),
                );
              }}
              onDeleted={(deletedId: string) => {
                setTasks((prev) => prev.filter((t) => t.id !== deletedId));
                setActiveTaskDetail(null);
              }}
            />
          </div>
        </ModalShell>
      )}
    </div>
  );
}
