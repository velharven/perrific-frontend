import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { teamApi } from '@/api/teams';
import { projectApi } from '@/api/projects';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CreateProjectModal from '@/components/project/CreateProjectModal';
import RejectProposalModal from '@/components/team/RejectProposalModal';
import { PROJECT_UPDATED_EVENT } from '@/pages/ProjectSettingsPage';
import { useAuth } from '@/store/auth';
import { showToast } from '@/components/ui/Toast';
import { Briefcase, MoreVertical } from 'lucide-react';
import { ListCardsSkeleton } from '@/components/ui/loading';
import type { Project, Team, ProjectProposal } from '@/types';

export default function TeamProjectsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [proposals, setProposals] = useState<ProjectProposal[]>([]);
  const [actionProposalId, setActionProposalId] = useState<string | null>(null);
  const [rejectingProposal, setRejectingProposal] = useState<ProjectProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { name: string; description: string; status: Project['status'] }>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; mode: 'rename' | 'full' } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh(tid: string) {
    const [t, ps, props] = await Promise.all([
      teamApi.getTeam(tid),
      teamApi.listProjects(tid),
      teamApi.listProjectProposals(tid).catch(() => []),
    ]);
    setTeam(t);
    setProjects(ps);
    setProposals(props);
    setDrafts(Object.fromEntries(ps.map((p) => [p.id, { name: p.name, description: p.description ?? '', status: p.status }])));
  }

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    refresh(teamId).finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const updated = (e as CustomEvent<Project>).detail;
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: { name: updated.name, description: updated.description ?? '', status: updated.status },
      }));
    };
    window.addEventListener(PROJECT_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROJECT_UPDATED_EVENT, onUpdated);
  }, []);

  async function handleCreated() {
    if (!teamId) return;
    setCreateOpen(false);
    await refresh(teamId);
  }

  async function handleSave(p: Project) {
    const d = drafts[p.id];
    if (!d) return;
    setSavingId(p.id);
    try {
      const updated = await projectApi.updateProject(p.id, {
        ...(d.name.trim() !== '' && d.name.trim() !== p.name ? { name: d.name.trim() } : {}),
        ...(d.description.trim() !== (p.description ?? '') ? { description: d.description.trim() || null } : {}),
        ...(d.status !== p.status ? { status: d.status } : {}),
      });
      setProjects((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      setDrafts((prev) => ({ ...prev, [p.id]: { name: updated.name, description: updated.description ?? '', status: updated.status } }));
      setEditing(null);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !teamId) return;
    setDeleting(true);
    try {
      await projectApi.removeProject(deleteTarget.id);
      setDeleteTarget(null);
      await refresh(teamId);
    } finally {
      setDeleting(false);
    }
  }

  async function handleApproveProposal(proposal: ProjectProposal) {
    if (!teamId) return;
    setActionProposalId(proposal.id);
    try {
      await teamApi.approveProjectProposal(teamId, proposal.id);
      showToast(`Project "${proposal.name}" disetujui dan berhasil dibuat!`);
      await refresh(teamId);
    } catch {
      showToast('Gagal menyetujui usulan project.');
    } finally {
      setActionProposalId(null);
    }
  }

  async function handleConfirmReject(reason?: string) {
    if (!teamId || !rejectingProposal) return;
    setActionProposalId(rejectingProposal.id);
    try {
      await teamApi.rejectProjectProposal(teamId, rejectingProposal.id, reason);
      showToast(`Usulan project "${rejectingProposal.name}" ditolak.`);
      setRejectingProposal(null);
      await refresh(teamId);
    } catch {
      showToast('Gagal menolak usulan project.');
    } finally {
      setActionProposalId(null);
    }
  }

  if (loading) return <ListCardsSkeleton />;
  if (!team) return <p className="text-gray-500">Tim tidak ditemukan.</p>;

  const isAdmin = team.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        to={`/team/${team.id}`}
        className="inline-block font-manrope text-xs font-semibold text-perrific-violet hover:underline"
      >
        ← Kembali ke board
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
        <p className="mt-0.5 text-sm text-gray-500">{team.name}</p>
      </div>

      {/* Usulan Project dari Organisasi */}
      {proposals.length > 0 && (
        <div className="space-y-3 rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-100 text-amber-700">
                <Briefcase size={14} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <h2 className="font-manrope text-sm font-bold text-amber-950">
                Usulan Project dari Organisasi
              </h2>
            </div>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-mono text-[11px] font-bold text-amber-800">
              {proposals.filter((p) => p.status === 'PENDING').length} Menunggu
            </span>
          </div>

          <div className="space-y-2">
            {proposals.map((prop) => (
              <div
                key={prop.id}
                className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-white p-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-manrope text-sm font-bold text-perrific-graphite">{prop.name}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        prop.status === 'APPROVED'
                          ? 'bg-emerald-100 text-emerald-700'
                          : prop.status === 'REJECTED'
                            ? 'bg-red-100 text-red-600'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {prop.status === 'APPROVED' ? 'Disetujui' : prop.status === 'REJECTED' ? 'Ditolak' : 'Menunggu Approval'}
                    </span>
                  </div>
                  {prop.description && (
                    <p className="mt-0.5 text-xs text-gray-500">{prop.description}</p>
                  )}
                  <p className="mt-1 text-[11px] text-gray-400">
                    Organisasi: <strong className="text-gray-600">{prop.organization?.name}</strong> • Diajukan oleh: {prop.createdBy?.name}
                  </p>
                  {prop.rejectionReason && (
                    <p className="mt-1 text-[11px] text-red-600">Alasan: {prop.rejectionReason}</p>
                  )}
                </div>

                {prop.status === 'PENDING' && isAdmin && (
                  <div className="flex shrink-0 items-center gap-2 pt-2 sm:pt-0">
                    <button
                      type="button"
                      disabled={actionProposalId === prop.id}
                      onClick={() => handleApproveProposal(prop)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 font-manrope text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {actionProposalId === prop.id ? 'Memproses...' : 'Setujui'}
                    </button>
                    <button
                      type="button"
                      disabled={actionProposalId === prop.id}
                      onClick={() => setRejectingProposal(prop)}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 font-manrope text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 cursor-pointer"
                    >
                      Tolak
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <p className="font-manrope text-sm text-perrific-graphite/60">
          {projects.length} projects · {projects.filter((p) => p.status === 'ACTIVE').length} aktif
        </p>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-haspopup="dialog"
            className="shrink-0 rounded-full bg-perrific-violet px-4 py-2 font-manrope text-xs font-semibold text-white transition hover:brightness-110"
          >
            + Project baru
          </button>
        )}
      </div>

      <div className="space-y-2">
        {projects.length === 0 && <p className="text-sm text-gray-400">Belum ada project di tim ini.</p>}
        {projects.map((p) => {
          const d = drafts[p.id] ?? { name: p.name, description: p.description ?? '', status: p.status };
          const dirty =
            (d.name.trim() !== '' && d.name.trim() !== p.name) ||
            d.description.trim() !== (p.description ?? '') ||
            d.status !== p.status;
          const menuOpen = openMenuId === p.id;
          const editMode = editing?.id === p.id ? editing.mode : null;
          return (
            <div key={p.id} className="relative rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="block min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-manrope text-sm font-bold text-perrific-graphite hover:text-perrific-violet">
                    {p.name}
                  </p>
                  {p.description && (
                    <p className="mt-0.5 truncate font-manrope text-xs text-perrific-graphite/50">{p.description}</p>
                  )}
                <p className="mt-1.5 font-mono text-[11px] text-perrific-graphite/50">
                  {p.status === 'ARCHIVED' ? 'Arsip' : 'Aktif'}
                </p>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(menuOpen ? null : p.id)}
                    title="Opsi project"
                    aria-label={`Opsi ${p.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite cursor-pointer"
                  >
                    <MoreVertical size={14} strokeWidth={1.6} aria-hidden="true" />
                  </button>
                )}
              </div>
              {isAdmin && menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} aria-hidden="true" />
                  <div role="menu" aria-label={`Opsi ${p.name}`} className="absolute right-2 top-10 z-20 min-w-[160px] rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)]">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEditing({ id: p.id, mode: 'rename' });
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center px-3 py-2 font-manrope text-sm text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEditing({ id: p.id, mode: 'full' });
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center px-3 py-2 font-manrope text-sm text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDeleteTarget(p);
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center px-3 py-2 font-manrope text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </div>
                </>
              )}
              {isAdmin && editMode && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <div className="space-y-2">
                    <input
                      value={d.name}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: { ...d, name: e.target.value } }))}
                      maxLength={60}
                      aria-label={`Nama ${p.name}`}
                      autoFocus={editMode === 'rename'}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-manrope text-sm focus:border-perrific-violet focus:outline-none"
                    />
                    {editMode === 'full' && (
                      <>
                        <input
                          value={d.description}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: { ...d, description: e.target.value } }))}
                          maxLength={500}
                          placeholder="Deskripsi (opsional)"
                          aria-label="Deskripsi project"
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-manrope text-sm focus:border-perrific-violet focus:outline-none"
                        />
                        <select
                          value={d.status}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [p.id]: { ...d, status: e.target.value as Project['status'] } }))
                          }
                          aria-label="Status project"
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 font-manrope text-xs focus:border-perrific-violet focus:outline-none"
                        >
                          <option value="ACTIVE">Aktif</option>
                          <option value="ARCHIVED">Arsip</option>
                        </select>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-full px-3 py-1.5 font-manrope text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={!dirty || savingId === p.id}
                      onClick={() => void handleSave(p)}
                      className="rounded-full bg-perrific-graphite px-3 py-1.5 font-manrope text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                    >
                      {savingId === p.id ? 'Menyimpan…' : 'Simpan'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus project?"
        message={`"${deleteTarget?.name}" dan semua task di dalamnya ikut terhapus. Lanjutkan?`}
        confirmLabel="Hapus"
        busy={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />

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
          onCreated={() => void handleCreated()}
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
