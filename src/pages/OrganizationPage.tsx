import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { organizationApi } from '@/api/organizations';
import { teamApi } from '@/api/teams';
import { useAuth } from '@/store/auth';
import { useTrash } from '@/hooks/useNavLabels';
import { showToast } from '@/components/ui/Toast';
import Avatar from '@/components/ui/Avatar';
import ProposeProjectModal from '@/components/organization/ProposeProjectModal';
import SendTaskModal from '@/components/organization/SendTaskModal';
import ModalShell from '@/components/ui/ModalShell';
import { Building2, Plus, Briefcase, ChevronRight, CheckCircle2, X } from 'lucide-react';
import { ListCardsSkeleton } from '@/components/ui/loading';
import type { Organization, Team } from '@/types';

export default function OrganizationPage() {
  const { orgId } = useParams<{ orgId: string }>();
  const { user } = useAuth();
  const { items: trashItems } = useTrash(user?.id);
  const trashedTeamIds = useMemo(
    () => new Set(trashItems.filter((t) => t.kind === 'team').map((t) => t.id)),
    [trashItems],
  );
  const navigate = useNavigate();

  const [org, setOrg] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'proposals' | 'tasks' | 'teams' | 'members'>('proposals');

  // Modals
  const [proposeOpen, setProposeOpen] = useState(false);
  const [sendTaskOpen, setSendTaskOpen] = useState(false);
  const [connectTeamOpen, setConnectTeamOpen] = useState(false);
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);

  // Teams available to connect
  const [myTeams, setMyTeams] = useState<Team[]>([]);
  const [loadingConnectTeams, setLoadingConnectTeams] = useState(false);
  const [connectingTeamId, setConnectingTeamId] = useState('');

  const reload = useCallback(async () => {
    if (!orgId) return;
    try {
      const data = await organizationApi.get(orgId);
      setOrg(data);
    } catch {
      setOrg(null);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (connectTeamOpen) {
      setLoadingConnectTeams(true);
      teamApi
        .listMyTeams()
        .then((teams) => {
          const connectedIds = new Set((org?.connectedTeams ?? []).map((ct) => ct.teamId));
          const available = teams.filter((t) => !trashedTeamIds.has(t.id) && !connectedIds.has(t.id));
          setMyTeams(available);
          if (available.length > 0) setConnectingTeamId(available[0].id);
          else setConnectingTeamId('');
        })
        .catch(() => {
          setMyTeams([]);
          setConnectingTeamId('');
        })
        .finally(() => setLoadingConnectTeams(false));
    }
  }, [connectTeamOpen, org?.connectedTeams, trashedTeamIds]);

  const visibleConnectedTeams = useMemo(
    () => (org?.connectedTeams ?? []).filter((ct) => !trashedTeamIds.has(ct.teamId)),
    [org?.connectedTeams, trashedTeamIds],
  );

  const connectedTeamOptions = useMemo(
    () =>
      visibleConnectedTeams.map((ct) => ({
        id: ct.team?.id ?? ct.teamId,
        name: ct.team?.name ?? 'Tim',
        projects: ct.team?.projects ?? [],
      })),
    [visibleConnectedTeams],
  );

  if (loading) {
    return <ListCardsSkeleton />;
  }

  if (!org) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-base font-semibold text-gray-700">Organisasi tidak ditemukan atau akses terbatas.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-lg bg-perrific-violet px-4 py-2 text-xs font-semibold text-white"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

  const isOrgAdmin = org.createdById === user?.id || org.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN');
  const pendingProposalsCount = (org.projectProposals ?? []).filter((p) => p.status === 'PENDING').length;
  const pendingTasksCount = (org.tasks ?? []).filter((t) => (t.approval ?? 'APPROVED') === 'PENDING').length;

  async function handleConnectTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !connectingTeamId) return;
    try {
      await organizationApi.connectTeam(orgId, connectingTeamId);
      showToast('Tim berhasil dihubungkan ke organisasi.');
      setConnectTeamOpen(false);
      void reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Gagal menghubungkan tim.');
    }
  }

  async function handleDisconnectTeam(teamId: string, teamName: string) {
    if (!orgId) return;
    if (!window.confirm(`Yakin ingin memutuskan hubungan tim "${teamName}" dari organisasi ini?`)) return;
    try {
      await organizationApi.disconnectTeam(orgId, teamId);
      showToast(`Tim "${teamName}" diputuskan dari organisasi.`);
      void reload();
    } catch {
      showToast('Gagal memutuskan tim.');
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!orgId || !addMemberEmail.trim()) return;
    setAddingMember(true);
    try {
      await organizationApi.addMember(orgId, addMemberEmail.trim());
      showToast('Anggota berhasil ditambahkan ke organisasi.');
      setAddMemberEmail('');
      void reload();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      showToast(msg || 'Gagal menambahkan anggota.');
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember(userId: string, memberName: string) {
    if (!orgId) return;
    if (!window.confirm(`Yakin ingin mengeluarkan "${memberName}" dari organisasi?`)) return;
    try {
      await organizationApi.removeMember(orgId, userId);
      showToast(`"${memberName}" berhasil dikeluarkan.`);
      void reload();
    } catch {
      showToast('Gagal mengeluarkan anggota.');
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-20">
      {/* Header Profile Organisasi */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-perrific-violet/10 text-perrific-violet shadow-inner">
              <Building2 size={28} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-givonic text-2xl font-bold text-perrific-graphite">{org.name}</h1>
                <span className="rounded-full bg-perrific-violet/10 px-2.5 py-0.5 font-givonic text-[11px] font-semibold text-perrific-violet">
                  Organisasi
                </span>
              </div>
              <p className="mt-1 text-sm text-gray-500">{org.description || 'Tidak ada deskripsi organisasi.'}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => setProposeOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 font-givonic text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 cursor-pointer"
            >
              <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Usulkan Project</span>
            </button>
            <button
              onClick={() => setSendTaskOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 font-givonic text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 cursor-pointer"
            >
              <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Kirim Task</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[11px] font-semibold text-gray-400">Usulan Project</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-perrific-graphite">{org.projectProposals?.length ?? 0}</span>
              {pendingProposalsCount > 0 && (
                <span className="text-xs font-semibold text-amber-600">({pendingProposalsCount} Menunggu)</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[11px] font-semibold text-gray-400">Task Terkirim</p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-bold text-perrific-graphite">{org.tasks?.length ?? 0}</span>
              {pendingTasksCount > 0 && (
                <span className="text-xs font-semibold text-amber-600">({pendingTasksCount} Pending)</span>
              )}
            </div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[11px] font-semibold text-gray-400">Tim Terhubung</p>
            <p className="mt-1 text-xl font-bold text-perrific-graphite">{visibleConnectedTeams.length}</p>
          </div>
          <div className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
            <p className="text-[11px] font-semibold text-gray-400">Anggota Organisasi</p>
            <p className="mt-1 text-xl font-bold text-perrific-graphite">{org.members?.length ?? 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs Navigasi */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-6">
          <button
            onClick={() => setActiveTab('proposals')}
            className={`flex items-center gap-2 border-b-2 pb-3 font-givonic text-sm font-semibold transition ${
              activeTab === 'proposals'
                ? 'border-perrific-violet text-perrific-violet'
                : 'border-transparent text-gray-500 hover:text-perrific-graphite'
            }`}
          >
            <span>Usulan Project</span>
            {pendingProposalsCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {pendingProposalsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 border-b-2 pb-3 font-givonic text-sm font-semibold transition ${
              activeTab === 'tasks'
                ? 'border-perrific-violet text-perrific-violet'
                : 'border-transparent text-gray-500 hover:text-perrific-graphite'
            }`}
          >
            <span>Task Terkirim</span>
            {pendingTasksCount > 0 && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {pendingTasksCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-2 border-b-2 pb-3 font-givonic text-sm font-semibold transition ${
              activeTab === 'teams'
                ? 'border-perrific-violet text-perrific-violet'
                : 'border-transparent text-gray-500 hover:text-perrific-graphite'
            }`}
          >
            <span>Tim Terhubung ({visibleConnectedTeams.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 border-b-2 pb-3 font-givonic text-sm font-semibold transition ${
              activeTab === 'members'
                ? 'border-perrific-violet text-perrific-violet'
                : 'border-transparent text-gray-500 hover:text-perrific-graphite'
            }`}
          >
            <span>Anggota ({org.members?.length ?? 0})</span>
          </button>
        </nav>
      </div>

      {/* Konten Tab 1: Usulan Project */}
      {activeTab === 'proposals' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-givonic text-base font-bold text-perrific-graphite">Daftar Usulan Project</h2>
              <p className="text-xs text-gray-400">Usulan project baru yang dikirimkan ke tim-tim terkait</p>
            </div>
            <button
              onClick={() => setProposeOpen(true)}
              className="rounded-lg bg-blue-50 px-3 py-1.5 font-givonic text-xs font-semibold text-blue-600 hover:bg-blue-100"
            >
              + Usulkan Project Baru
            </button>
          </div>

          {(org.projectProposals ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500">
                <Briefcase size={24} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-perrific-graphite">Belum ada usulan project</p>
              <p className="mt-1 text-xs text-gray-400">
                Mulai dengan mengusulkan project baru untuk tim yang terhubung dengan organisasi ini.
              </p>
              <button
                onClick={() => setProposeOpen(true)}
                className="mt-4 rounded-lg bg-blue-600 px-4 py-2 font-givonic text-xs font-semibold text-white hover:bg-blue-700"
              >
                Usulkan Project Pertama
              </button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {org.projectProposals!.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-givonic text-sm font-bold text-perrific-graphite">{p.name}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          p.status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-700'
                            : p.status === 'REJECTED'
                              ? 'bg-red-100 text-red-600'
                              : 'bg-amber-100 text-amber-700'
                        }`}
                      >
                        {p.status === 'APPROVED'
                          ? 'Disetujui Admin Tim'
                          : p.status === 'REJECTED'
                            ? 'Ditolak'
                            : 'Menunggu Persetujuan'}
                      </span>
                    </div>
                    {p.description && <p className="mt-1.5 text-xs text-gray-500 line-clamp-2">{p.description}</p>}
                    <div className="mt-3 flex items-center gap-3 text-xs text-gray-400">
                      <span>
                        Tim: <strong className="text-gray-700">{p.team?.name}</strong>
                      </span>
                      <span>•</span>
                      <span>Oleh: {p.createdBy?.name}</span>
                    </div>
                    {p.rejectionReason && (
                      <p className="mt-2 rounded bg-red-50 p-2 text-xs text-red-600">
                        Alasan penolakan: {p.rejectionReason}
                      </p>
                    )}
                  </div>

                  {p.status === 'APPROVED' && p.approvedProject?.id && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <button
                        onClick={() => navigate(`/projects/${p.approvedProject!.id}`)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-gray-50 py-1.5 text-xs font-semibold text-perrific-violet hover:bg-gray-100 cursor-pointer"
                      >
                        <span>Buka Project</span>
                        <ChevronRight size={14} strokeWidth={1.8} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Konten Tab 2: Task Terkirim */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-givonic text-base font-bold text-perrific-graphite">Daftar Task Terkirim</h2>
              <p className="text-xs text-gray-400">Task yang dikirimkan ke dalam project binaan</p>
            </div>
            <button
              onClick={() => setSendTaskOpen(true)}
              className="rounded-lg bg-emerald-50 px-3 py-1.5 font-givonic text-xs font-semibold text-emerald-600 hover:bg-emerald-100 cursor-pointer"
            >
              + Kirim Task Baru
            </button>
          </div>

          {(org.tasks ?? []).length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-500">
                <CheckCircle2 size={24} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-perrific-graphite">Belum ada task terkirim</p>
              <p className="mt-1 text-xs text-gray-400">
                Kirim task pertama Anda langsung ke dalam project di tim binaan.
              </p>
              <button
                onClick={() => setSendTaskOpen(true)}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 font-givonic text-xs font-semibold text-white hover:bg-emerald-700"
              >
                Kirim Task Pertama
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-gray-100 bg-gray-50 font-givonic text-gray-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Judul Task</th>
                    <th className="px-4 py-3 font-semibold">Project & Tim</th>
                    <th className="px-4 py-3 font-semibold">Prioritas</th>
                    <th className="px-4 py-3 font-semibold">Status Persetujuan</th>
                    <th className="px-4 py-3 font-semibold">Pengusul</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {org.tasks!.map((t) => (
                    <tr key={t.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3">
                        <strong className="text-perrific-graphite">{t.title}</strong>
                        {t.description && <p className="mt-0.5 text-gray-400 truncate max-w-xs">{t.description}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-700">{t.project?.name}</span>
                        <p className="text-[10px] text-gray-400">{t.project?.team?.name}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-1.5 py-0.5 font-semibold text-[10px] ${
                            t.priority === 'URGENT'
                              ? 'bg-red-100 text-red-600'
                              : t.priority === 'HIGH'
                                ? 'bg-orange-100 text-orange-600'
                                : t.priority === 'MEDIUM'
                                  ? 'bg-yellow-100 text-yellow-600'
                                  : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {t.priority}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                            (t.approval ?? 'APPROVED') === 'APPROVED'
                              ? 'bg-emerald-100 text-emerald-700'
                              : t.approval === 'REJECTED'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {(t.approval ?? 'APPROVED') === 'APPROVED'
                            ? 'Disetujui (Di Kanban)'
                            : t.approval === 'REJECTED'
                              ? 'Ditolak'
                              : 'Menunggu Persetujuan'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t.createdBy?.name || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Konten Tab 3: Tim Terhubung */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-givonic text-base font-bold text-perrific-graphite">Tim yang Terhubung</h2>
              <p className="text-xs text-gray-400">Tim binaan yang dapat menerima usulan project & task</p>
            </div>
            {isOrgAdmin && (
              <button
                onClick={() => setConnectTeamOpen(true)}
                className="rounded-lg bg-perrific-violet/10 px-3 py-1.5 font-givonic text-xs font-semibold text-perrific-violet hover:bg-perrific-violet/20"
              >
                + Hubungkan Tim
              </button>
            )}
          </div>

          {visibleConnectedTeams.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-xs text-gray-400">
              Belum ada tim yang terhubung. Hubungkan tim agar Anda dapat mengusulkan project dan mengirim task.
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {visibleConnectedTeams.map((ct) => {
                const teamName = ct.team?.name ?? 'Tim';
                const teamInitial = teamName[0]?.toUpperCase() ?? 'T';
                const projectCount = ct.team?.projects?.length ?? 0;
                return (
                  <div key={ct.teamId} className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm">
                    <div className="flex items-center gap-3 truncate">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-perrific-violet/10 font-bold text-perrific-violet">
                        {teamInitial}
                      </span>
                      <div className="truncate">
                        <p className="truncate font-givonic text-xs font-bold text-perrific-graphite">{teamName}</p>
                        <p className="text-[11px] text-gray-400">{projectCount} Project Aktif</p>
                      </div>
                    </div>
                    {isOrgAdmin && (
                      <button
                        onClick={() => handleDisconnectTeam(ct.teamId, teamName)}
                        title="Putuskan tim"
                        className="ml-2 rounded p-1 text-gray-300 hover:bg-red-50 hover:text-red-500 cursor-pointer"
                      >
                        <X size={14} strokeWidth={1.6} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Konten Tab 4: Anggota */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-givonic text-base font-bold text-perrific-graphite">Anggota Organisasi</h2>
              <p className="text-xs text-gray-400">Pengguna yang memiliki akses mengusulkan project & task</p>
            </div>
          </div>

          {isOrgAdmin && (
            <form onSubmit={handleAddMember} className="flex gap-2 rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
              <input
                type="email"
                required
                value={addMemberEmail}
                onChange={(e) => setAddMemberEmail(e.target.value)}
                placeholder="Masukkan email anggota baru..."
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
              />
              <button
                type="submit"
                disabled={addingMember || !addMemberEmail.trim()}
                className="rounded-lg bg-perrific-violet px-4 py-1.5 font-givonic text-xs font-semibold text-white disabled:opacity-50"
              >
                {addingMember ? 'Menambah...' : 'Tambah Anggota'}
              </button>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="divide-y divide-gray-100">
              {org.members?.map((m) => (
                <div key={m.id} className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.user?.name ?? 'Anggota'} src={m.user?.avatarUrl} size={32} />
                    <div>
                      <p className="font-givonic text-xs font-bold text-perrific-graphite">{m.user?.name}</p>
                      <p className="text-[11px] text-gray-400">{m.user?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded px-2 py-0.5 text-[10px] font-semibold ${
                        m.role === 'ADMIN' ? 'bg-perrific-violet/10 text-perrific-violet' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m.role}
                    </span>
                    {isOrgAdmin && m.userId !== org.createdById && (
                      <button
                        onClick={() => handleRemoveMember(m.userId, m.user?.name ?? 'Anggota')}
                        className="rounded p-1 text-gray-300 hover:text-red-500 cursor-pointer"
                        title="Keluarkan anggota"
                      >
                        <X size={14} strokeWidth={1.6} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Usulkan Project */}
      {proposeOpen && (
        <ProposeProjectModal
          organizationId={org.id}
          connectedTeams={connectedTeamOptions}
          onClose={() => setProposeOpen(false)}
          onProposed={() => {
            setProposeOpen(false);
            void reload();
          }}
        />
      )}

      {/* Modal Kirim Task */}
      {sendTaskOpen && (
        <SendTaskModal
          organizationId={org.id}
          connectedTeams={connectedTeamOptions}
          onClose={() => setSendTaskOpen(false)}
          onTaskSent={() => {
            setSendTaskOpen(false);
            void reload();
          }}
        />
      )}

      {/* Modal Hubungkan Tim */}
      {connectTeamOpen && (
        <ModalShell label="Hubungkan Tim" onClose={() => setConnectTeamOpen(false)}>
          <form onSubmit={handleConnectTeam} className="w-full max-w-sm space-y-4">
            <h2 className="font-givonic text-base font-bold text-perrific-graphite">Hubungkan Tim ke Organisasi</h2>
            <p className="text-xs text-gray-400">Pilih tim yang akan menerima usulan project & task dari organisasi ini.</p>
            {loadingConnectTeams ? (
              <p className="text-xs text-gray-400">Memuat tim...</p>
            ) : myTeams.length === 0 ? (
              <p className="text-xs text-gray-400">Tidak ada tim yang tersedia untuk dihubungkan.</p>
            ) : (
              <select
                value={connectingTeamId}
                onChange={(e) => setConnectingTeamId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-perrific-graphite focus:outline-none"
              >
                {myTeams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConnectTeamOpen(false)}
                className="rounded-lg px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!connectingTeamId}
                className="rounded-lg bg-perrific-violet px-3 py-1.5 text-xs font-semibold text-white hover:bg-perrific-violet/90"
              >
                Hubungkan
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}
