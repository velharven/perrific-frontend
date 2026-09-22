import { useEffect, useRef, useState } from 'react';
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
import Avatar from '@/components/ui/Avatar';
import type { BoardColumn, Task } from '@/types';

export type BoardView = { collapsed: string[] };

export const DEFAULT_BOARD_VIEW: BoardView = { collapsed: [] };

function viewKey(projectId: string) {
  return `purrific:boardview:${projectId}`;
}

export function loadBoardView(projectId: string): BoardView {
  try {
    const raw = localStorage.getItem(viewKey(projectId));
    if (!raw) return DEFAULT_BOARD_VIEW;
    const parsed = JSON.parse(raw) as Partial<BoardView> & { tampilkanSelesai?: boolean };
    const collapsed = Array.isArray(parsed.collapsed) ? parsed.collapsed.filter((s): s is string => typeof s === 'string') : [];
    return { collapsed };
  } catch {
    return DEFAULT_BOARD_VIEW;
  }
}

export function saveBoardView(projectId: string, view: BoardView) {
  try {
    localStorage.setItem(viewKey(projectId), JSON.stringify(view));
  } catch {
    // penyimpanan penuh/privat: preferensi sesi ini tetap dipakai
  }
}

function CardView({
  task,
  overlay,
  className,
  bare,
  onOpenTitle,
}: {
  task: Task;
  overlay?: boolean;
  className?: string;
  bare?: boolean;
  onOpenTitle?: () => void;
}) {
  const approved = (task.approval ?? 'APPROVED') === 'APPROVED';
  return (
    <div
      className={`rounded-lg border bg-white p-3 ${overlay ? 'border-perrific-violet/50 shadow-xl' : bare ? 'border-transparent' : 'border-gray-200'} ${className ?? ''}`}
    >
      <div className="flex min-w-0 items-baseline gap-1.5">
        {onOpenTitle ? (
          <>
            <button
              type="button"
              onClick={onOpenTitle}
              title={`Buka detail ${task.title}`}
              aria-label={`Buka detail ${task.title} lewat ID`}
              className="shrink-0 font-givonic text-xs font-bold text-perrific-violet hover:underline"
            >
              #{task.number}
            </button>
            <button
              type="button"
              onClick={onOpenTitle}
              title={`Buka detail ${task.title}`}
              aria-label={`Buka detail ${task.title} lewat judul`}
              className="min-w-0 flex-1 truncate text-left text-sm font-medium text-gray-800 hover:underline"
            >
              {task.title}
            </button>
          </>
        ) : (
          <>
            <span className="shrink-0 font-givonic text-xs font-bold text-perrific-violet">
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
      <div className="mt-2">
        <span
          className={`rounded px-1.5 py-0.5 text-xs ${
            task.priority === 'URGENT'
              ? 'bg-red-100 text-red-600'
              : task.priority === 'HIGH'
                ? 'bg-orange-100 text-orange-600'
                : task.priority === 'MEDIUM'
                  ? 'bg-yellow-100 text-yellow-600'
                  : 'bg-gray-100 text-gray-500'
          }`}
        >
          {task.priority}
        </span>
      </div>
      <div className="mt-2">
        <p className="text-[11px] text-gray-400">Assigned to:</p>
        {task.assignees.length > 0 ? (
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
            <span className="truncate text-xs text-gray-600">
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

function Card({
  task,
  onOpen,
  dragActive,
  registerNode,
  gone,
}: {
  task: Task;
  onOpen?: (task: Task) => void;
  dragActive?: boolean;
  registerNode?: (id: string, el: HTMLElement | null) => void;
  gone?: boolean;
}) {
  const approved = (task.approval ?? 'APPROVED') === 'APPROVED';
  const { attributes, listeners, setNodeRef, isDragging } = useSortable({
    id: `task:${task.id}`,
    // Usulan yang belum disetujui tidak bisa di-drag pindah/diurutkan.
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
      // Daftar statis selama drag (tanpa animasi): visual ikut overlay,
      // commit posisi saat drop. Disembunyikan total bila bayangannya
      // tampil di kolom lain agar tidak dobel.
      // Aktif: pudar di tempat, atau runtuh total (node tetap mount)
      // saat bayangannya tampil di kolom lain.
      className={`rounded-lg ${isDragging ? (gone ? 'hidden' : 'opacity-40') : dragActive ? '' : 'transition'}`}
    >
      <CardView
        task={task}
        bare={dragActive && !isDragging}
        onOpenTitle={onOpen && !isDragging ? () => onOpen(task) : undefined}
      />
    </div>
  );
}

function Column({
  columnId,
  label,
  color,
  count,
  collapsed,
  canAdd,
  sortableIds,
  onToggleCollapse,
  onAdd,
  registerColumn,
  children,
}: {
  columnId: string;
  label: string;
  color: string;
  count: number;
  collapsed: boolean;
  canAdd: boolean;
  sortableIds: string[];
  onToggleCollapse: () => void;
  onAdd: () => void;
  registerColumn?: (columnId: string, el: HTMLElement | null) => void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${columnId}` });
  // Satu wadah + lebar bertransisi agar buka/tutup kolom menganimasi halus;
  // isi dalam berganti dengan keyframe col-enter, konten penuh terpotong
  // overflow selama transisi (efek laci). Strip tetap droppable.
  return (
    <div
      ref={(el) => {
        setNodeRef(el);
        registerColumn?.(columnId, el);
      }}
      className={`shrink-0 overflow-hidden rounded-xl transition-[width,background-color] duration-300 ease-out ${
        collapsed ? 'w-11 self-stretch' : 'w-[85vw] sm:w-80'
      } ${isOver ? (collapsed ? 'bg-perrific-violet/20' : 'bg-perrific-violet/10') : 'bg-gray-200'}`}
    >
      {collapsed ? (
        <div key="strip" className="col-enter flex h-full w-11 flex-col items-center gap-1 py-3">
          <button
            type="button"
            onClick={onToggleCollapse}
            title={`Bentangkan kolom ${label}`}
            aria-label={`Bentangkan kolom ${label}`}
            aria-expanded="false"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-perrific-violet transition hover:bg-gray-300"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
          <span className="truncate font-givonic text-xs font-bold tracking-widest text-gray-500 [writing-mode:vertical-rl]">
            {label.toUpperCase()}
          </span>
          <span className="rounded bg-gray-300 px-1.5 py-0.5 font-givonic text-[11px] font-semibold text-gray-600">
            {count}
          </span>
        </div>
      ) : (
        <div key="full" className="col-enter flex h-full max-h-full w-[85vw] flex-col p-3 sm:w-80">
          <div className="mb-3 flex shrink-0 items-center justify-between gap-1 px-1">
            <h2 className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-sm font-semibold text-gray-600">
              <span aria-hidden="true" className="h-3.5 w-3.5 shrink-0 rounded-[3px]" style={{ backgroundColor: color }} />
              <span className="min-w-0 flex-1 truncate">
                {label} · {count}
              </span>
            </h2>
            <span className="flex shrink-0 items-center">
              {canAdd && (
                <button
                  type="button"
                  onClick={onAdd}
                  title={`Tambah task di ${label}`}
                  aria-label={`Tambah task di ${label}`}
                  className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-300 hover:text-perrific-violet"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                    <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              )}
              <button
                type="button"
                onClick={onToggleCollapse}
                title={`Ciutkan kolom ${label}`}
                aria-label={`Ciutkan kolom ${label}`}
                aria-expanded="true"
                className="flex h-6 w-6 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-300 hover:text-gray-700"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M10 4L6 8l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </span>
          </div>
          <div className="kanban-scroll min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
            <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
              {children}
            </SortableContext>
          </div>
        </div>
      )}
    </div>
  );
}

export default function KanbanBoard({
  tasks,
  columns,
  onMove,
  onReorder,
  onOpen,
  onToggleCollapse,
  onAdd,
  canAdd = false,
  view = DEFAULT_BOARD_VIEW,
}: {
  tasks: Task[];
  columns: BoardColumn[];
  onMove: (taskId: string, columnId: string, insertAt?: number) => void;
  onReorder: (columnId: string, orderedIds: string[]) => void;
  onOpen?: (task: Task) => void;
  onToggleCollapse?: (columnId: string) => void;
  onAdd?: (columnId: string) => void;
  canAdd?: boolean;
  view?: BoardView;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );
  const visible = [...columns].sort((a, b) => a.order - b.order);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Indeks sisip dari posisi pointer (bukan dari target tabrakan):
  // { kolom asal, posisi 0..n }. Render pratinjau instan dari sini.
  const [hover, setHover] = useState<{ columnId: string; index: number } | null>(null);
  const cardNodes = useRef(new Map<string, HTMLElement>());
  const columnNodes = useRef(new Map<string, HTMLElement>());
  const dragging = activeId !== null;

  function sameIds(a: string[], b: string[]): boolean {
    return a.length === b.length && a.every((id, i) => id === b[i]);
  }

  function columnIds(columnId: string): string[] {
    return tasks.filter((t) => t.columnId === columnId).map((t) => t.id);
  }

  function registerNode(id: string, el: HTMLElement | null) {
    if (el) cardNodes.current.set(id, el);
    else cardNodes.current.delete(id);
  }

  function registerColumn(columnId: string, el: HTMLElement | null) {
    if (el) columnNodes.current.set(columnId, el);
    else columnNodes.current.delete(columnId);
  }

  // Sisip ke posisi indeks (0..n) dalam urutan kolom saat ini.
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

  // Lacak pointer selama drag: lubang sisip mengikuti kolom di bawah pointer
  // (kolom asal maupun tujuan), dihitung dari posisi tengah tiap card.
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
        if ((view.collapsed ?? []).includes(col.id)) continue;
        const colEl = columnNodes.current.get(col.id);
        if (!colEl) continue;
        const r = colEl.getBoundingClientRect();
        if (e.clientX < r.left - 12 || e.clientX > r.right + 12 || e.clientY < r.top - 8 || e.clientY > r.bottom + 8) {
          continue;
        }
        const ids = tasks.filter((t) => t.columnId === col.id).map((t) => t.id);
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
  }, [activeId, tasks, visible, view.collapsed]);

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
        // Pindah kolom ke posisi lubang bila lubang ada di kolom tujuan.
        const target = columnIds(overTask.columnId);
        const insertAt =
          dropHover && dropHover.columnId === overTask.columnId
            ? Math.max(0, Math.min(dropHover.index, target.length))
            : target.length;
        onMove(taskId, overTask.columnId, insertAt);
        return;
      }
      // Se-kolom: pakai indeks pointer bila ada, kalau tidak pakai target.
      const current = columnIds(task.columnId);
      const next =
        dropHover && dropHover.columnId === task.columnId
          ? moveWithin(current, taskId, dropHover.index)
          : arrayMove(current, current.indexOf(taskId), current.indexOf(overTask.id));
      if (sameIds(next, current)) return;
      onReorder(task.columnId, next);
      return;
    }
    // Drop di area kosong kolom/strip: pindah kolom; bila kolomnya sama,
    // pakai indeks pointer bila ada, kalau tidak jangan gerakkan apa pun.
    const to = overId.replace(/^col:/, '');
    if (!columns.some((c) => c.id === to)) return;
    if (task.columnId !== to) {
      const target = columnIds(to);
      const insertAt =
        dropHover && dropHover.columnId === to ? Math.max(0, Math.min(dropHover.index, target.length)) : target.length;
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
      <div className="nice-scroll flex h-[calc(100dvh-16rem)] min-h-[300px] items-stretch gap-4 overflow-x-auto pb-2 md:h-[calc(100dvh-10.5rem)]">
        {visible.map((col) => {
          const items = tasks.filter((t) => t.columnId === col.id);
          const isCollapsed = (view.collapsed ?? []).includes(col.id);
          const activeIdStr = activeId?.replace(/^task:/, '') ?? null;
          const isOrigin = !!activeTask && activeTask.columnId === col.id;
          const hv = hover && hover.columnId === col.id && !isCollapsed ? hover : null;
          // Placeholder hanya satu: di kolom hover. Card asal disembunyikan
          // total selama placeholder tampil di kolom lain.
          const hideOrigin = isOrigin && !!hover && !!activeIdStr && hover.columnId !== col.id;
          // Lubang di kolom asal: susun ulang instan. Lubang di kolom lain:
          // placeholder pudar di indeks pointer.
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
              canAdd={canAdd}
              sortableIds={items.map((t) => `task:${t.id}`)}
              onToggleCollapse={() => onToggleCollapse?.(col.id)}
              onAdd={() => onAdd?.(col.id)}
              registerColumn={registerColumn}
            >
              {nodes}
              {items.length === 0 && <p className="text-center text-xs text-gray-400">Kosong</p>}
            </Column>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
          <div className="w-[85vw] sm:w-80">
            <CardView task={activeTask} overlay />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
