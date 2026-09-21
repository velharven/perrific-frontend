import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { teamApi } from '@/api/teams';
import { projectApi } from '@/api/projects';
import CreateProjectModal from '@/components/project/CreateProjectModal';
import { useAuth } from '@/store/auth';
import type { Project, Task, Team } from '@/types';

type TaskWithProject = Task & { projectName: string; projectId: string };

function TaskRow({
  task,
  showProject,
  onOpen,
}: {
  task: TaskWithProject;
  showProject: boolean;
  onOpen: (task: TaskWithProject) => void;
}) {
  const approved = (task.approval ?? 'APPROVED') === 'APPROVED';
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Buka detail ${task.title}`}
      onClick={() => onOpen(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(task);
        }
      }}
      className="cursor-pointer rounded-lg border border-gray-200 bg-white p-3 transition hover:border-perrific-violet/60 hover:shadow-sm"
    >
      <p className="text-sm font-medium text-gray-800">{task.title}</p>
      {!approved && (
        <p className="mt-1.5">
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
              task.approval === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'
            }`}
          >
            {task.approval === 'REJECTED' ? 'Ditolak' : 'Menunggu persetujuan'}
          </span>
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
        {showProject && <span className="font-semibold text-perrific-graphite/50">{task.projectName}</span>}
        {task.assignees.length > 0 && (
          <span>
            {task.assignees
              .slice(0, 2)
              .map((a) => a.name)
              .join(', ')}
            {task.assignees.length > 2 ? ` +${task.assignees.length - 2}` : ''}
          </span>
        )}
        <span>{task.column?.name ?? ''}</span>
        <span
          className={`rounded px-1.5 py-0.5 ${
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
    </div>
  );
}

export default function TeamPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasksByProject, setTasksByProject] = useState<Record<string, Task[]>>({});
  const [tasksLoading, setTasksLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const projectParam = searchParams.get('project');
  const filterProjectId = projects.some((p) => p.id === projectParam) ? projectParam : null;

  function setFilter(id: string | null) {
    if (id) setSearchParams({ project: id });
    else setSearchParams({});
  }

  async function refresh(tid: string) {
    const [t, ps] = await Promise.all([teamApi.getTeam(tid), teamApi.listProjects(tid)]);
    setTeam(t);
    setProjects(ps);
    setTasksLoading(true);
    try {
      const entries = await Promise.all(ps.map(async (p) => [p.id, await projectApi.listTasks(p.id)] as const));
      setTasksByProject(Object.fromEntries(entries));
    } finally {
      setTasksLoading(false);
    }
  }

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    refresh(teamId).finally(() => setLoading(false));
  }, [teamId]);

  const allTasks: TaskWithProject[] = useMemo(() => {
    const list = filterProjectId ? projects.filter((p) => p.id === filterProjectId) : projects;
    return list.flatMap((p) => (tasksByProject[p.id] ?? []).map((t) => ({ ...t, projectName: p.name, projectId: p.id })));
  }, [projects, tasksByProject, filterProjectId]);

  const mine = useMemo(() => allTasks.filter((t) => t.assignees.some((a) => a.id === user?.id)), [allTasks, user?.id]);
  const watching = useMemo(
    () =>
      allTasks.filter(
        (t) => (t.watchers ?? []).some((w) => w.id === user?.id) && !t.assignees.some((a) => a.id === user?.id),
      ),
    [allTasks, user?.id],
  );

  if (loading) return <p className="text-gray-500">Memuat…</p>;
  if (!team) return <p className="text-gray-500">Tim tidak ditemukan.</p>;

  const myRole = team.members?.find((m) => m.userId === user?.id)?.role;
  const isAdmin = myRole === 'ADMIN';

  function panel(title: string, items: TaskWithProject[], emptyLead: string, emptyRest: string) {
    return (
      <section className="w-[85vw] shrink-0 rounded-xl bg-gray-200 p-3 sm:w-80">
        <h2 className="px-1 pb-2 font-givonic text-sm font-semibold text-gray-600">
          {title} · {items.length}
        </h2>
        {items.length === 0 ? (
          <div className="py-6 text-center">
            <p className="font-givonic text-sm font-bold text-perrific-graphite">{emptyLead}</p>
            <p className="mx-auto mt-1 max-w-[260px] font-givonic text-xs leading-relaxed text-perrific-graphite/50">{emptyRest}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                showProject={!filterProjectId}
                onOpen={(task) => navigate(`/projects/${task.projectId}/kanban/${task.id}`)}
              />
            ))}
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-800">{team.name}</h1>
          {team.description && <p className="mt-0.5 truncate text-sm text-gray-500">{team.description}</p>}
        </div>
        <Link
          to="settings"
          title="Pengaturan tim"
          aria-label="Pengaturan tim"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>

      {tasksLoading ? (
        <p className="text-gray-500">Memuat…</p>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_260px]">
          <div className="nice-scroll flex min-w-0 items-start gap-4 overflow-x-auto pb-2">
            {panel(
              'Working on',
              mine,
              'Rasanya kosong, ya?',
              'Task yang di-assign ke kamu akan muncul di sini.',
            )}
            {panel(
              'Watching',
              watching,
              'Belum ada yang dipantau.',
              'Pantau task lewat tombol Watch di halaman detail task.',
            )}
          </div>

          <aside className="space-y-2">
            {projects.map((p) => {
              const active = filterProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  aria-pressed={active}
                  className={`block w-full rounded-xl border bg-white p-3 text-left transition hover:border-perrific-violet ${
                    active ? 'border-perrific-violet ring-1 ring-perrific-violet' : 'border-gray-200'
                  }`}
                >
                  <p className="truncate font-givonic text-sm font-bold text-perrific-graphite">{p.name}</p>
                  {p.description && (
                    <p className="mt-0.5 truncate font-givonic text-xs text-perrific-graphite/50">{p.description}</p>
                  )}
                  <p className="mt-1.5 font-mono text-[11px] text-perrific-graphite/50">
                    {p.status === 'ARCHIVED' ? 'Arsip' : 'Aktif'}
                  </p>
                </button>
              );
            })}
            {filterProjectId && (
              <button
                type="button"
                onClick={() => setFilter(null)}
                className="w-full font-givonic text-xs font-semibold text-perrific-violet hover:underline"
              >
                Tampilkan semua project
              </button>
            )}
            {isAdmin && (
              <button
                type="button"
                onClick={() => setCreateOpen(true)}
                aria-haspopup="dialog"
                className="block w-full rounded-lg border border-dashed border-perrific-violet/40 bg-perrific-violet/5 px-4 py-2.5 text-center font-givonic text-xs font-bold tracking-widest text-perrific-violet transition hover:bg-perrific-violet/10"
              >
                + PROJECT BARU
              </button>
            )}
            <Link
              to={`/team/${team.id}/projects`}
              className="block w-full rounded-lg bg-perrific-mint px-4 py-2.5 text-center font-givonic text-xs font-bold tracking-widest text-perrific-graphite transition hover:brightness-95"
            >
              MANAGE PROJECTS
            </Link>
          </aside>
        </div>
      )}

      {createOpen && teamId && (
        <CreateProjectModal
          teamId={teamId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            if (teamId) void refresh(teamId);
          }}
        />
      )}
    </div>
  );
}
