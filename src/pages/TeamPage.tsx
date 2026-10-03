import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { teamApi } from '@/api/teams';
import { projectApi } from '@/api/projects';
import CreateProjectModal from '@/components/project/CreateProjectModal';
import Avatar from '@/components/ui/Avatar';
import { showToast } from '@/components/ui/Toast';
import { APP_SIDEBAR_EVENT, isAppSidebarCollapsed } from '@/components/layout/AppLayout';
import { TEAMS_CHANGED_EVENT } from '@/hooks/useNavLabels';
import { useAuth } from '@/store/auth';
import { Briefcase } from 'lucide-react';
import { KanbanSkeleton } from '@/components/ui/loading';
import RejectProposalModal from '@/components/team/RejectProposalModal';
import ProjectProposalCard from '@/components/team/ProjectProposalCard';
import type { Project, Task, Team, ProjectProposal } from '@/types';

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
  const [tab, setTab] = useState<'project' | 'team' | 'usulan'>('project');
  const [email, setEmail] = useState('');
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [pendingProposalCount, setPendingProposalCount] = useState(0);
  const [actionProposalId, setActionProposalId] = useState<string | null>(null);
  // Offset pill fixed agar center ke area konten (di luar sidebar utama).
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(isAppSidebarCollapsed);

  useEffect(() => {
    const sync = () => setSbCollapsed(isAppSidebarCollapsed());
    window.addEventListener(APP_SIDEBAR_EVENT, sync);
    return () => window.removeEventListener(APP_SIDEBAR_EVENT, sync);
  }, []);

  const projectParam = searchParams.get('project');
  const filterProjectId = projects.some((p) => p.id === projectParam) ? projectParam : null;

  function setFilter(id: string | null) {
    if (id) setSearchParams({ project: id });
    else setSearchParams({});
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId || !email.trim()) return;
    try {
      await teamApi.addMember(teamId, { email });
      setEmail('');
      const updated = await teamApi.getTeam(teamId).catch(() => null);
      if (updated) setTeam(updated);
      showToast('Undangan terkirim.');
    } catch {
      showToast('Gagal mengundang. Coba lagi.');
    }
  }

  async function handleCopyCode() {
    if (!team?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(team.inviteCode);
      showToast('Kode tim disalin. Bagikan ke calon anggota.');
    } catch {
      showToast('Gagal menyalin. Salin manual dari layar.');
    }
  }

  async function handleApproveProposal(proposal: ProjectProposal) {
    if (!teamId) return;
    setActionProposalId(proposal.id);
    try {
      await teamApi.approveProjectProposal(teamId, proposal.id);
      showToast(`Project "${proposal.name}" disetujui dan berhasil dibuat!`);
      await refresh(teamId);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Gagal menyetujui usulan project.';
      showToast(msg);
    } finally {
      setActionProposalId(null);
    }
  }

  const [rejectingProposal, setRejectingProposal] = useState<ProjectProposal | null>(null);

  async function handleConfirmReject(reason?: string) {
    if (!teamId || !rejectingProposal) return;
    setActionProposalId(rejectingProposal.id);
    try {
      await teamApi.rejectProjectProposal(teamId, rejectingProposal.id, reason);
      showToast(`Usulan project "${rejectingProposal.name}" ditolak.`);
      setRejectingProposal(null);
      await refresh(teamId);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Gagal menolak usulan project.';
      showToast(msg);
    } finally {
      setActionProposalId(null);
    }
  }

  async function refresh(tid: string) {
    const [t, ps, props] = await Promise.all([
      teamApi.getTeam(tid),
      teamApi.listProjects(tid),
      teamApi.listProjectProposals(tid).catch(() => []),
    ]);
    setTeam(t);
    setProjects(ps);
    setProposals(props);
    setPendingProposalCount(props.filter((p) => p.status === 'PENDING').length);
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
    const onTeamsChanged = () => {
      teamApi.getTeam(teamId).then(setTeam).catch(() => {});
    };
    window.addEventListener(TEAMS_CHANGED_EVENT, onTeamsChanged);
    return () => window.removeEventListener(TEAMS_CHANGED_EVENT, onTeamsChanged);
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

  if (loading) return <KanbanSkeleton />;
  if (!team) return <p className="text-gray-500">Tim tidak ditemukan.</p>;

  const myRole = team.members?.find((m) => m.userId === user?.id)?.role;
  const isAdmin = myRole === 'ADMIN';

  function panel(title: string, items: TaskWithProject[], emptyLead: string, emptyRest: string) {
    return (
      <section className="w-[85vw] shrink-0 rounded-xl bg-gray-200 p-3 sm:w-80">
        <h2 className="px-1 pb-2 font-manrope text-sm font-semibold text-gray-600">
          {title} · {items.length}
        </h2>
        {items.length === 0 ? (
          <div className="py-6 text-center">
            <p className="font-manrope text-sm font-bold text-perrific-graphite">{emptyLead}</p>
            <p className="mx-auto mt-1 max-w-[260px] font-manrope text-xs leading-relaxed text-perrific-graphite/50">{emptyRest}</p>
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
    <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col space-y-5">
      <div className="flex min-w-0 items-center gap-3">
        {team.avatarUrl ? (
          <img
            src={team.avatarUrl}
            alt=""
            className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-perrific-violet/20 bg-perrific-violet/10 font-manrope text-sm font-bold text-perrific-violet"
          >
            {team.name.trim().slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold text-gray-800">{team.name}</h1>
          {team.description && <p className="mt-0.5 truncate text-sm text-gray-500">{team.description}</p>}
        </div>
      </div>

      {isAdmin && pendingProposalCount > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-700">
              <Briefcase size={14} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <p>
              Ada <strong>{pendingProposalCount} usulan project baru</strong> dari organisasi yang menunggu persetujuan Anda.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTab('usulan')}
            className="shrink-0 self-start sm:self-auto rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white transition hover:bg-amber-700 cursor-pointer"
          >
            Tinjau Usulan
          </button>
        </div>
      )}

      <div className="flex-1">
        {tab === 'project' ? (
          tasksLoading ? (
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
                      <p className="truncate font-manrope text-sm font-bold text-perrific-graphite">{p.name}</p>
                      {p.description && (
                        <p className="mt-0.5 truncate font-manrope text-xs text-perrific-graphite/50">{p.description}</p>
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
                    className="w-full font-manrope text-xs font-semibold text-perrific-violet hover:underline"
                  >
                    Tampilkan semua project
                  </button>
                )}
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setCreateOpen(true)}
                    aria-haspopup="dialog"
                    className="block w-full rounded-lg border border-dashed border-perrific-violet/40 bg-perrific-violet/5 px-4 py-2.5 text-center font-manrope text-xs font-bold tracking-widest text-perrific-violet transition hover:bg-perrific-violet/10"
                  >
                    + PROJECT BARU
                  </button>
                )}
                <Link
                  to={`/team/${team.id}/projects`}
                  className="block w-full rounded-lg bg-perrific-mint px-4 py-2.5 text-center font-manrope text-xs font-bold tracking-widest text-perrific-graphite transition hover:brightness-95"
                >
                  MANAGE PROJECTS
                </Link>
              </aside>
            </div>
          )
        ) : tab === 'team' ? (
          <section aria-label="Undang dan anggota tim" className="space-y-5">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="font-manrope text-sm font-bold text-perrific-graphite">Undang anggota</h2>
              <p className="mt-0.5 font-manrope text-xs text-gray-500">Kode tim atau email langsung</p>
              {(isAdmin || team.canManageInvite) && team.inviteCode && (
                <div className="mt-3 flex items-center gap-2">
                  <p className="font-mono text-[11px] tracking-widest text-perrific-graphite/40">KODE TIM</p>
                  <code className="rounded-lg bg-gray-100 px-2.5 py-1 font-mono text-sm font-bold tracking-[0.15em] text-perrific-graphite">
                    {team.inviteCode}
                  </code>
                  <button
                    type="button"
                    onClick={() => void handleCopyCode()}
                    className="rounded-lg px-2 py-1 font-manrope text-xs font-semibold text-perrific-violet transition hover:bg-perrific-violet/10 cursor-pointer"
                  >
                    Salin
                  </button>
                </div>
              )}
              <form onSubmit={handleInvite} className="mt-3 flex gap-2">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email anggota"
                  className="min-w-0 flex-1 rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
                />
                <button className="shrink-0 rounded-full bg-perrific-violet px-5 py-2.5 font-manrope text-sm font-semibold text-white transition hover:bg-[#E64D0A] cursor-pointer">
                  Undang
                </button>
              </form>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className="font-manrope text-sm font-bold text-perrific-graphite">
                Anggota · {team.members?.length ?? 0}
              </h2>
              <ul className="mt-2 divide-y divide-gray-100">
                {(team.members ?? []).map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-2.5">
                    <Avatar src={m.user?.avatarUrl ?? undefined} name={m.user?.name ?? '?'} size={32} alt={m.user?.name ?? 'anggota'} className="h-8 w-8 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-manrope text-sm font-semibold text-perrific-graphite">{m.user?.name}</p>
                      <p className="truncate font-manrope text-xs text-gray-500">{m.user?.email}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 font-manrope text-[11px] font-semibold text-gray-600">
                      {m.role}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : (
          <section aria-label="Usulan project dari organisasi" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-manrope text-base font-bold text-perrific-graphite">Usulan Project dari Organisasi</h2>
                <p className="text-xs text-gray-500">Daftar usulan project yang diajukan oleh organisasi binaan</p>
              </div>
              {pendingProposalCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-mono text-[11px] font-bold text-amber-800">
                  {pendingProposalCount} Menunggu
                </span>
              )}
            </div>

            {proposals.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
                <Briefcase size={28} className="mx-auto text-gray-300" strokeWidth={1.5} />
                <p className="mt-2 font-manrope text-sm font-bold text-perrific-graphite">Belum ada usulan project</p>
                <p className="mt-1 text-xs text-gray-500">Belum ada usulan project dari organisasi untuk tim ini.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((prop) => (
                  <ProjectProposalCard
                    key={prop.id}
                    proposal={prop}
                    isAdmin={isAdmin}
                    isProcessing={actionProposalId === prop.id}
                    onApprove={(p) => void handleApproveProposal(p)}
                    onReject={(p) => setRejectingProposal(p)}
                  />
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      <div
        className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center transition-[left] duration-200 ${
          sbCollapsed ? 'md:left-0' : 'md:left-64'
        }`}
      >
        <div
          className="pointer-events-auto nice-scroll flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-300 bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(26,26,30,0.14)] backdrop-blur"
          role="tablist"
          aria-label="Navigasi tim"
        >
          {(
            [
              { id: 'project', label: 'Project' },
              { id: 'team', label: 'Team' },
              { id: 'usulan', label: 'Usulan', badge: pendingProposalCount },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 shrink-0 rounded-full px-4 py-2 font-manrope text-xs font-semibold transition cursor-pointer ${
                tab === t.id
                  ? 'bg-perrific-graphite text-white'
                  : 'text-gray-800 hover:bg-gray-200 hover:text-black'
              }`}
            >
              <span>{t.label}</span>
              {'badge' in t && t.badge > 0 && (
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
                    tab === t.id ? 'bg-amber-500 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {createOpen && teamId && (
        <CreateProjectModal
          teamId={teamId}
          projects={projects}
          members={(team?.members ?? []).map((m) => ({
            userId: m.userId,
            name: m.user?.name,
            email: m.user?.email,
            avatarUrl: m.user?.avatarUrl,
          }))}
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            if (teamId) void refresh(teamId);
          }}
        />
      )}

      <RejectProposalModal
        proposal={rejectingProposal}
        submitting={actionProposalId === rejectingProposal?.id}
        onClose={() => setRejectingProposal(null)}
        onConfirm={handleConfirmReject}
      />
    </div>
  );
}
