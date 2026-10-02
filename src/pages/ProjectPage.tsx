import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';
import Avatar from '@/components/ui/Avatar';
import SwipeRow from '@/components/ui/SwipeRow';
import { showToast } from '@/components/ui/Toast';
import { useAuth } from '@/store/auth';
import { PROJECT_UPDATED_EVENT } from '@/pages/ProjectSettingsPage';
import { PROJECT_SIDEBAR_EVENT, isProjectSidebarCollapsed } from '@/components/layout/ProjectLayout';
import { fileExtLabel, previewKind } from '@/lib/preview';
import { ListCardsSkeleton } from '@/components/ui/loading';
import type { Attachment, BoardColumn, Comment, Project, Task, TaskActivity, Team } from '@/types';

type OverviewTab = 'aktivitas' | 'team';

type FeedItem = {
  id: string;
  at: string;
  actor: string | null;
  avatarUrl?: string | null;
  text: React.ReactNode;
  taskId: string;
  upload?: { attachmentId: string; taskId: string };
};

function TaskLink({ projectId, taskId, title }: { projectId?: string; taskId: string; title: string }) {
  return (
    <Link
      to={`/projects/${projectId}/kanban/${taskId}`}
      title={`Buka ${title}`}
      className="font-semibold text-perrific-violet hover:underline"
    >
      {title}
    </Link>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'baru saja';
  if (m < 60) return `${m} mnt lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} jam lalu`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} hari lalu`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w} minggu lalu`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo} bulan lalu`;
  return `${Math.floor(d / 365)} tahun lalu`;
}

function initial(name: string) {
  return (name.trim().charAt(0) || '?').toUpperCase();
}

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [columns, setColumns] = useState<BoardColumn[]>([]);
  const [comments, setComments] = useState<(Comment & { taskTitle: string })[]>([]);
  const [activities, setActivities] = useState<(TaskActivity & { taskTitle: string })[]>([]);
  const [attachmentsById, setAttachmentsById] = useState<Record<string, Attachment & { taskId: string }>>({});
  const [team, setTeam] = useState<Team | null>(null);
  const [tab, setTab] = useState<OverviewTab>('aktivitas');
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  // Offset pill fixed agar center ke area konten (di luar sidebar project).
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(isProjectSidebarCollapsed);

  useEffect(() => {
    const sync = () => setSbCollapsed(isProjectSidebarCollapsed());
    window.addEventListener(PROJECT_SIDEBAR_EVENT, sync);
    return () => window.removeEventListener(PROJECT_SIDEBAR_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    projectApi
      .getProject(projectId)
      .then(async (p) => {
        setProject(p);
        const ts = await projectApi.listTasks(projectId);
        setTasks(ts);
        projectApi.listColumns(projectId).then(setColumns).catch(() => setColumns([]));
        const [cs, acts] = await Promise.all([
          projectApi.listAllComments(projectId).catch(() => []),
          projectApi.listAllActivities(projectId).catch(() => []),
        ]);
        setComments(
          (cs as (Comment & { task: Pick<Task, 'id' | 'title'> })[]).map((c) => ({ ...c, taskTitle: c.task.title })),
        );
        setActivities(
          (acts as (TaskActivity & { task: Pick<Task, 'id' | 'title'> })[]).map((a) => ({ ...a, taskTitle: a.task.title })),
        );
        try {
          const atts = await projectApi.listAttachments(projectId);
          const byId: Record<string, Attachment & { taskId: string }> = {};
          for (const a of atts) {
            byId[a.id] = { ...a, taskId: a.taskId };
          }
          setAttachmentsById(byId);
        } catch {
          setAttachmentsById({});
        }
      })
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    const onUpdated = (e: Event) => setProject((e as CustomEvent<Project>).detail);
    window.addEventListener(PROJECT_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROJECT_UPDATED_EVENT, onUpdated);
  }, []);

  useEffect(() => {
    if (!project?.teamId) return;
    teamApi
      .getTeam(project.teamId)
      .then(setTeam)
      .catch(() => setTeam(null));
  }, [project?.teamId]);

  const isTeamAdmin = (team?.members ?? []).some((m) => m.userId === user?.id && m.role === 'ADMIN');
  const canSeeInvite = isTeamAdmin || team?.canManageInvite;

  function openTask(taskId: string) {
    navigate(`/projects/${projectId}/kanban/${taskId}`);
  }

  async function kickMember(memberUserId: string, label: string) {
    if (!project?.teamId) return;
    if (!confirm(`Keluarkan ${label} dari tim?`)) return;
    try {
      await teamApi.removeMember(project.teamId, memberUserId);
      const updated = await teamApi.getTeam(project.teamId).catch(() => null);
      if (updated) setTeam(updated);
    } catch {
      showToast('Gagal mengeluarkan anggota.');
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!project?.teamId || !email.trim()) return;
    await teamApi.addMember(project.teamId, { email });
    setEmail('');
    const updated = await teamApi.getTeam(project.teamId).catch(() => null);
    if (updated) setTeam(updated);
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

  const feed: FeedItem[] = useMemo(() => {
    const items: FeedItem[] = [];
    for (const t of tasks) {
      items.push({
        id: `created-${t.id}`,
        at: t.createdAt,
        actor: t.createdBy?.name ?? null,
        avatarUrl: t.createdBy?.avatarUrl ?? null,
        taskId: t.id,
        text: (
          <>
            Task <TaskLink projectId={projectId} taskId={t.id} title={t.title} /> dibuat
          </>
        ),
      });
      // Catatan: entri turunan "diperbarui → Status" sengaja tidak ada;
      // sudah digantikan log aktivitas beneran (MOVED/ASSIGNED/upload) di bawah.
    }
    for (const c of comments) {
      items.push({
        id: `comment-${c.id}`,
        at: c.createdAt,
        actor: c.author?.name ?? null,
        avatarUrl: c.author?.avatarUrl ?? null,
        taskId: c.taskId,
        text: (
          <>
            mengomentari <TaskLink projectId={projectId} taskId={c.taskId} title={c.taskTitle} />
            <span className="mt-0.5 block truncate text-gray-400">“{c.content}”</span>
          </>
        ),
      });
    }
    for (const a of activities) {
      const detail =
        a.kind === 'MOVED' ? (
          <>
            memindahkan <TaskLink projectId={projectId} taskId={a.taskId} title={a.taskTitle} /> dari{' '}
            {a.fromColumn ?? '?'} ke {a.toColumn ?? '?'}
          </>
        ) : a.kind === 'ASSIGNED' ? (
          <>
            memberi <TaskLink projectId={projectId} taskId={a.taskId} title={a.taskTitle} /> ke{' '}
            {a.targetUser?.name ?? 'anggota'}
          </>
        ) : a.kind === 'ATTACHMENT_ADDED' ? (
          <>
            mengunggah <span className="font-semibold text-perrific-graphite">{a.meta?.filename ?? 'file'}</span> ke{' '}
            <TaskLink projectId={projectId} taskId={a.taskId} title={a.taskTitle} />
          </>
        ) : (
          <>
            menghapus {a.targetUser?.name ?? 'anggota'} dari{' '}
            <TaskLink projectId={projectId} taskId={a.taskId} title={a.taskTitle} />
          </>
        );
      items.push({
        id: `activity-${a.id}`,
        at: a.createdAt,
        actor: a.actor?.name ?? null,
        avatarUrl: a.actor?.avatarUrl ?? null,
        taskId: a.taskId,
        text: detail,
        ...(a.kind === 'ATTACHMENT_ADDED' && a.meta?.attachmentId
          ? { upload: { attachmentId: a.meta.attachmentId, taskId: a.taskId } }
          : {}),
      });
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 30);
  }, [tasks, comments, activities]);

  if (loading) return <ListCardsSkeleton />;
  if (!project) return <p className="text-gray-500">Project tidak ditemukan.</p>;

  return (
    <div className="w-full space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          {project.avatarUrl ? (
            <img
              src={project.avatarUrl}
              alt={`Foto ${project.name}`}
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-perrific-mint font-givonic text-2xl font-bold text-perrific-graphite"
            >
              {initial(project.name)}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-gray-800">{project.name}</h1>
            {project.description && <p className="mt-0.5 text-sm text-gray-500">{project.description}</p>}
            <p className="mt-1.5 font-mono text-[11px] text-perrific-graphite/50">
              {columns.length > 0
                ? columns.map((c) => `${tasks.filter((t) => t.columnId === c.id).length} ${c.name.toLowerCase()}`).join(' · ')
                : `${tasks.length} task`}
              {project.status === 'ARCHIVED' ? ' · arsip' : ''}
            </p>
          </div>
        </div>
      </div>

      {tab === 'team' ? (
        <section aria-label="Anggota tim" className="min-h-[320px]">
          {canSeeInvite && team?.inviteCode && (
            <div className="mb-2 flex items-center gap-2">
              <p className="font-mono text-[11px] tracking-widest text-perrific-graphite/40">KODE TIM</p>
              <code className="rounded-lg bg-gray-100 px-2.5 py-1 font-mono text-sm font-bold tracking-[0.15em] text-perrific-graphite">
                {team.inviteCode}
              </code>
              <button
                type="button"
                onClick={() => void handleCopyCode()}
                className="rounded-lg px-2 py-1 font-givonic text-xs font-semibold text-perrific-violet transition hover:bg-perrific-violet/10"
              >
                Salin
              </button>
            </div>
          )}
          <form onSubmit={handleInvite} className="mb-2 flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email anggota"
              className="min-w-0 flex-1 rounded-xl border border-gray-200 px-3 py-2 font-givonic text-sm focus:border-perrific-violet focus:outline-none"
            />
            <button className="shrink-0 rounded-full bg-perrific-violet px-4 py-2 font-givonic text-xs font-semibold text-white transition hover:brightness-110">
              Undang
            </button>
          </form>
          {!team ? (
            <p className="rounded-xl border border-gray-200 bg-white px-3 py-6 font-givonic text-sm text-gray-400">
              Memuat anggota…
            </p>
          ) : (team.members ?? []).length === 0 ? (
            <p className="rounded-xl border border-gray-200 bg-white px-3 py-6 font-givonic text-sm text-gray-400">
              Belum ada anggota.
            </p>
          ) : (
            <ul className="space-y-2">
              {(team.members ?? []).map((m) => {
                const label = m.user?.name ?? m.user?.email ?? m.userId;
                const canKick = isTeamAdmin && m.userId !== user?.id;
                return (
                  <SwipeRow
                    key={m.id}
                    actions={
                      canKick
                        ? [{ label: 'Keluarkan', danger: true, onClick: () => void kickMember(m.userId, label) }]
                        : []
                    }
                    contentClassName="flex items-center gap-3 px-3 py-2.5"
                  >
                    <Avatar
                      src={m.user?.avatarUrl}
                      name={label}
                      size={32}
                      alt={label}
                      className="h-8 w-8 shrink-0 text-sm"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-givonic text-sm font-semibold text-perrific-graphite">
                        {label}
                      </span>
                      {m.user?.email && m.user?.name && (
                        <span className="block truncate font-givonic text-xs text-gray-400">{m.user.email}</span>
                      )}
                    </span>
                    <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-givonic text-[11px] font-semibold text-gray-500">
                      {m.role === 'ADMIN' ? 'Admin' : 'Member'}
                    </span>
                  </SwipeRow>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
      <section aria-label="Aktivitas" className="min-h-[320px]">
        {feed.length === 0 ? (
          <p className="rounded-xl border border-gray-200 bg-white px-3 py-6 font-givonic text-sm text-gray-400">
            Belum ada aktivitas di project ini.
          </p>
        ) : (
          <ul className="space-y-2">
            {feed.map((item) => (
              <SwipeRow
                key={item.id}
                actions={[{ label: 'Buka', onClick: () => openTask(item.taskId) }]}
                contentClassName="flex items-start gap-3 px-3 py-2.5"
              >
                <Avatar
                  src={item.avatarUrl}
                  name={item.actor ?? '?'}
                  size={32}
                  alt={item.actor ?? 'Aktivitas'}
                  className="h-8 w-8 shrink-0 text-sm"
                />
                <p className="min-w-0 flex-1 font-givonic text-sm text-gray-600">
                  {item.actor && <span className="font-bold text-perrific-graphite">{item.actor} </span>}
                  {item.text}
                  {item.upload &&
                    (() => {
                      const att = attachmentsById[item.upload.attachmentId];
                      if (!att) return null;
                      const kind = previewKind(att);
                      const to = `/projects/${projectId}/kanban/${item.upload.taskId}`;
                      return (
                        <Link
                          to={to}
                          title="Buka task"
                          className="mt-1.5 block w-fit overflow-hidden rounded-lg border border-gray-200 transition hover:border-perrific-violet"
                        >
                          {kind === 'image' ? (
                            <img
                              src={att.dataUrl}
                              alt={att.filename}
                              loading="lazy"
                              draggable={false}
                              className="h-20 w-auto max-w-full object-cover"
                            />
                          ) : (
                            <span
                              className={`flex h-12 w-12 items-center justify-center font-givonic text-[11px] font-bold ${
                                kind === 'pdf' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {kind === 'pdf' ? 'PDF' : fileExtLabel(att.filename)}
                            </span>
                          )}
                        </Link>
                      );
                    })()}
                </p>
                <span className="shrink-0 font-givonic text-xs text-gray-400">{timeAgo(item.at)}</span>
              </SwipeRow>
            ))}
          </ul>
        )}
      </section>
      )}
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center transition-[left] duration-200 ${
          sbCollapsed ? 'md:left-0' : 'md:left-56'
        }`}
      >
        <div
          className="pointer-events-auto nice-scroll flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-300 bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(26,26,30,0.14)] backdrop-blur"
          role="tablist"
          aria-label="Navigasi overview"
        >
          {(
            [
              { id: 'aktivitas', label: 'Aktivitas' },
              { id: 'team', label: 'Team' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 font-givonic text-xs font-semibold transition ${
                tab === t.id
                  ? 'bg-perrific-graphite text-white'
                  : 'text-gray-800 hover:bg-gray-200 hover:text-black'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
