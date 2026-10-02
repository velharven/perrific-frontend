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
import EditOrganizationModal from '@/components/organization/EditOrganizationModal';
import ModalShell from '@/components/ui/ModalShell';
import {
  Building2,
  Plus,
  Briefcase,
  ChevronRight,
  CheckCircle2,
  X,
  Search,
  Settings,
  Users,
  ExternalLink,
  Mail,
  UserPlus,
} from 'lucide-react';
import { ListCardsSkeleton } from '@/components/ui/loading';
import type { Organization, Team } from '@/types';

type ProposalStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';
type TaskStatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED';

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

  // Filter & Search States
  const [proposalSearch, setProposalSearch] = useState('');
  const [proposalFilter, setProposalFilter] = useState<ProposalStatusFilter>('ALL');

  const [taskSearch, setTaskSearch] = useState('');
  const [taskFilter, setTaskFilter] = useState<TaskStatusFilter>('ALL');

  const [teamSearch, setTeamSearch] = useState('');
  const [memberSearch, setMemberSearch] = useState('');

  // Modals
  const [proposeOpen, setProposeOpen] = useState(false);
  const [sendTaskOpen, setSendTaskOpen] = useState(false);
  const [editOrgOpen, setEditOrgOpen] = useState(false);
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

  const isOrgAdmin = Boolean(
    org && (org.createdById === user?.id || org.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN')),
  );

  const pendingProposalsCount = useMemo(
    () => (org?.projectProposals ?? []).filter((p) => p.status === 'PENDING').length,
    [org?.projectProposals],
  );

  const pendingTasksCount = useMemo(
    () => (org?.tasks ?? []).filter((t) => (t.approval ?? 'APPROVED') === 'PENDING').length,
    [org?.tasks],
  );

  // Filtered Proposals
  const filteredProposals = useMemo(() => {
    const list = org?.projectProposals ?? [];
    return list.filter((p) => {
      const matchStatus = proposalFilter === 'ALL' || p.status === proposalFilter;
      const query = proposalSearch.toLowerCase().trim();
      const matchQuery =
        !query ||
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.team?.name && p.team.name.toLowerCase().includes(query)) ||
        (p.createdBy?.name && p.createdBy.name.toLowerCase().includes(query));
      return matchStatus && matchQuery;
    });
  }, [org?.projectProposals, proposalFilter, proposalSearch]);

  // Filtered Tasks
  const filteredTasks = useMemo(() => {
    const list = org?.tasks ?? [];
    return list.filter((t) => {
      const currentApproval = t.approval ?? 'APPROVED';
      const matchStatus = taskFilter === 'ALL' || currentApproval === taskFilter;
      const query = taskSearch.toLowerCase().trim();
      const matchQuery =
        !query ||
        t.title.toLowerCase().includes(query) ||
        (t.description && t.description.toLowerCase().includes(query)) ||
        (t.project?.name && t.project.name.toLowerCase().includes(query)) ||
        (t.project?.team?.name && t.project.team.name.toLowerCase().includes(query)) ||
        (t.createdBy?.name && t.createdBy.name.toLowerCase().includes(query));
      return matchStatus && matchQuery;
    });
  }, [org?.tasks, taskFilter, taskSearch]);

  // Filtered Teams
  const filteredTeams = useMemo(() => {
    const query = teamSearch.toLowerCase().trim();
    if (!query) return visibleConnectedTeams;
    return visibleConnectedTeams.filter((ct) => (ct.team?.name ?? '').toLowerCase().includes(query));
  }, [visibleConnectedTeams, teamSearch]);

  // Filtered Members
  const filteredMembers = useMemo(() => {
    const list = org?.members ?? [];
    const query = memberSearch.toLowerCase().trim();
    if (!query) return list;
    return list.filter(
      (m) =>
        (m.user?.name ?? '').toLowerCase().includes(query) ||
        (m.user?.email ?? '').toLowerCase().includes(query) ||
        m.role.toLowerCase().includes(query),
    );
  }, [org?.members, memberSearch]);

  if (loading) {
    return <ListCardsSkeleton />;
  }

  if (!org) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-base font-semibold text-gray-700">Organisasi tidak ditemukan atau akses terbatas.</p>
        <button
          onClick={() => navigate('/')}
          className="rounded-xl bg-perrific-violet px-4 py-2 font-manrope text-xs font-semibold text-white shadow-sm hover:bg-perrific-violet/90"
        >
          Kembali ke Beranda
        </button>
      </div>
    );
  }

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
      <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-perrific-violet/10 text-perrific-violet shadow-inner">
              <Building2 size={28} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate font-manrope text-2xl font-bold text-perrific-graphite">{org.name}</h1>
                <span className="rounded-full bg-perrific-violet/10 px-2.5 py-0.5 font-manrope text-[11px] font-semibold text-perrific-violet">
                  Organisasi
                </span>
                {isOrgAdmin && (
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 font-manrope text-[11px] font-semibold text-emerald-700">
                    Admin
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500 leading-relaxed max-w-2xl">
                {org.description || 'Tidak ada deskripsi organisasi.'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isOrgAdmin && (
              <button
                type="button"
                onClick={() => setEditOrgOpen(true)}
                title="Edit Profil Organisasi"
                className="flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 font-manrope text-xs font-semibold text-gray-700 shadow-sm transition hover:bg-gray-50 active:scale-95 cursor-pointer"
              >
                <Settings size={14} strokeWidth={1.8} aria-hidden="true" />
                <span>Pengaturan</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setProposeOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-manrope text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 active:scale-95 cursor-pointer"
            >
              <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Usulkan Project</span>
            </button>
            <button
              type="button"
              onClick={() => setSendTaskOpen(true)}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 font-manrope text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 cursor-pointer"
            >
              <Plus size={15} strokeWidth={1.8} aria-hidden="true" />
              <span>Kirim Task</span>
            </button>
          </div>
        </div>

        {/* Quick Stats Grid Interaktif */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <button
            type="button"
            aria-label="Lihat Usulan Project"
            onClick={() => setActiveTab('proposals')}
            className={`group rounded-xl border p-3.5 text-left transition cursor-pointer ${
              activeTab === 'proposals'
                ? 'border-blue-200 bg-blue-50/50 shadow-sm ring-1 ring-blue-200'
                : 'border-gray-100 bg-gray-50/60 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-500">Usulan Project</p>
              <Briefcase size={14} className="text-gray-400 group-hover:text-blue-500 transition" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-manrope text-2xl font-bold text-perrific-graphite">
                {org.projectProposals?.length ?? 0}
              </span>
              {pendingProposalsCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {pendingProposalsCount} Menunggu
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            aria-label="Lihat Task Terkirim"
            onClick={() => setActiveTab('tasks')}
            className={`group rounded-xl border p-3.5 text-left transition cursor-pointer ${
              activeTab === 'tasks'
                ? 'border-emerald-200 bg-emerald-50/50 shadow-sm ring-1 ring-emerald-200'
                : 'border-gray-100 bg-gray-50/60 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-500">Task Terkirim</p>
              <CheckCircle2 size={14} className="text-gray-400 group-hover:text-emerald-500 transition" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-manrope text-2xl font-bold text-perrific-graphite">
                {org.tasks?.length ?? 0}
              </span>
              {pendingTasksCount > 0 && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                  {pendingTasksCount} Pending
                </span>
              )}
            </div>
          </button>

          <button
            type="button"
            aria-label="Lihat Tim Terhubung"
            onClick={() => setActiveTab('teams')}
            className={`group rounded-xl border p-3.5 text-left transition cursor-pointer ${
              activeTab === 'teams'
                ? 'border-perrific-violet/40 bg-perrific-violet/5 shadow-sm ring-1 ring-perrific-violet/30'
                : 'border-gray-100 bg-gray-50/60 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-500">Tim Terhubung</p>
              <Building2 size={14} className="text-gray-400 group-hover:text-perrific-violet transition" />
            </div>
            <p className="mt-2 font-manrope text-2xl font-bold text-perrific-graphite">
              {visibleConnectedTeams.length}
            </p>
          </button>

          <button
            type="button"
            aria-label="Lihat Anggota Organisasi"
            onClick={() => setActiveTab('members')}
            className={`group rounded-xl border p-3.5 text-left transition cursor-pointer ${
              activeTab === 'members'
                ? 'border-purple-200 bg-purple-50/50 shadow-sm ring-1 ring-purple-200'
                : 'border-gray-100 bg-gray-50/60 hover:bg-gray-50 hover:border-gray-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold text-gray-500">Anggota Organisasi</p>
              <Users size={14} className="text-gray-400 group-hover:text-purple-500 transition" />
            </div>
            <p className="mt-2 font-manrope text-2xl font-bold text-perrific-graphite">
              {org.members?.length ?? 0}
            </p>
          </button>
        </div>
      </div>

      {/* Tabs Navigasi Modern */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-2 sm:space-x-6 overflow-x-auto pb-px" role="tablist" aria-label="Tab Organisasi">
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'proposals'}
            aria-controls="panel-proposals"
            id="tab-proposals"
            onClick={() => setActiveTab('proposals')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 font-manrope text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'proposals'
                ? 'border-perrific-violet text-perrific-violet'
                : 'border-transparent text-gray-500 hover:text-perrific-graphite'
            }`}
          >
            <span>Usulan Project</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'proposals'
                  ? 'bg-perrific-violet/10 text-perrific-violet'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {org.projectProposals?.length ?? 0}
            </span>
            {pendingProposalsCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {pendingProposalsCount} Menunggu
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'tasks'}
            aria-controls="panel-tasks"
            id="tab-tasks"
            onClick={() => setActiveTab('tasks')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 font-manrope text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'tasks'
                ? 'border-perrific-violet text-perrific-violet'
                : 'border-transparent text-gray-500 hover:text-perrific-graphite'
            }`}
          >
            <span>Task Terkirim</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'tasks'
                  ? 'bg-perrific-violet/10 text-perrific-violet'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {org.tasks?.length ?? 0}
            </span>
            {pendingTasksCount > 0 && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                {pendingTasksCount} Pending
              </span>
            )}
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'teams'}
            aria-controls="panel-teams"
            id="tab-teams"
            onClick={() => setActiveTab('teams')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 font-manrope text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'teams'
                ? 'border-perrific-violet text-perrific-violet'
                : 'border-transparent text-gray-500 hover:text-perrific-graphite'
            }`}
          >
            <span>Tim Terhubung</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'teams'
                  ? 'bg-perrific-violet/10 text-perrific-violet'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {visibleConnectedTeams.length}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'members'}
            aria-controls="panel-members"
            id="tab-members"
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 border-b-2 py-3 px-1 font-manrope text-sm font-semibold transition cursor-pointer whitespace-nowrap ${
              activeTab === 'members'
                ? 'border-perrific-violet text-perrific-violet'
                : 'border-transparent text-gray-500 hover:text-perrific-graphite'
            }`}
          >
            <span>Anggota</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                activeTab === 'members'
                  ? 'bg-perrific-violet/10 text-perrific-violet'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {org.members?.length ?? 0}
            </span>
          </button>
        </nav>
      </div>

      {/* Konten Tab 1: Usulan Project */}
      {activeTab === 'proposals' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-manrope text-base font-bold text-perrific-graphite">Daftar Usulan Project</h2>
              <p className="text-xs text-gray-400">Usulan project dari organisasi yang diajukan ke tim binaan</p>
            </div>
            <button
              type="button"
              onClick={() => setProposeOpen(true)}
              className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-blue-50 px-3.5 py-2 font-manrope text-xs font-semibold text-blue-600 hover:bg-blue-100 transition cursor-pointer"
            >
              <Plus size={14} strokeWidth={2} />
              <span>Usulkan Project Baru</span>
            </button>
          </div>

          {/* Toolbar: Search & Filter Chips */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={proposalSearch}
                onChange={(e) => setProposalSearch(e.target.value)}
                placeholder="Cari nama project, deskripsi, tim, atau pengusul..."
                className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
              />
              {proposalSearch && (
                <button
                  type="button"
                  onClick={() => setProposalSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'PENDING', label: 'Menunggu' },
                  { id: 'APPROVED', label: 'Disetujui' },
                  { id: 'REJECTED', label: 'Ditolak' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setProposalFilter(chip.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    proposalFilter === chip.id
                      ? 'bg-perrific-violet text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cards Usulan */}
          {filteredProposals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
                <Briefcase size={24} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-perrific-graphite">
                {proposalSearch || proposalFilter !== 'ALL'
                  ? 'Tidak ada usulan yang sesuai filter pencarian'
                  : 'Belum ada usulan project'}
              </p>
              <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto">
                {proposalSearch || proposalFilter !== 'ALL'
                  ? 'Coba ubah kata kunci pencarian atau bersihkan filter status.'
                  : 'Mulai dengan mengusulkan project baru untuk tim yang terhubung dengan organisasi ini.'}
              </p>
              {(!proposalSearch && proposalFilter === 'ALL') && (
                <button
                  type="button"
                  onClick={() => setProposeOpen(true)}
                  className="mt-4 rounded-xl bg-blue-600 px-4 py-2 font-manrope text-xs font-semibold text-white hover:bg-blue-700 transition cursor-pointer"
                >
                  Usulkan Project Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredProposals.map((p) => (
                <div
                  key={p.id}
                  className="flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-manrope text-sm font-bold text-perrific-graphite leading-snug">{p.name}</h3>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
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

                    {p.description && (
                      <p className="mt-2 text-xs text-gray-500 line-clamp-2 leading-relaxed">{p.description}</p>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-gray-400 border-t border-gray-50 pt-2.5">
                      <span>
                        Tim target: <strong className="text-gray-700 font-semibold">{p.team?.name || '-'}</strong>
                      </span>
                      <span>•</span>
                      <span>Pengusul: <span className="text-gray-600">{p.createdBy?.name || '-'}</span></span>
                    </div>

                    {p.rejectionReason && (
                      <div className="mt-2.5 rounded-xl bg-red-50 p-2.5 text-xs text-red-600 border border-red-100">
                        <span className="font-semibold">Alasan penolakan:</span> {p.rejectionReason}
                      </div>
                    )}
                  </div>

                  {p.status === 'APPROVED' && p.approvedProject?.id && (
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <button
                        type="button"
                        onClick={() => navigate(`/projects/${p.approvedProject!.id}`)}
                        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gray-50 py-2 text-xs font-semibold text-perrific-violet hover:bg-gray-100 transition cursor-pointer"
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-manrope text-base font-bold text-perrific-graphite">Daftar Task Terkirim</h2>
              <p className="text-xs text-gray-400">Task yang dikirimkan ke proyek dalam tim binaan</p>
            </div>
            <button
              type="button"
              onClick={() => setSendTaskOpen(true)}
              className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-emerald-50 px-3.5 py-2 font-manrope text-xs font-semibold text-emerald-600 hover:bg-emerald-100 transition cursor-pointer"
            >
              <Plus size={14} strokeWidth={2} />
              <span>Kirim Task Baru</span>
            </button>
          </div>

          {/* Toolbar: Search & Filter Chips */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-100 bg-white p-3 shadow-sm">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
                placeholder="Cari judul task, deskripsi, project, atau pengusul..."
                className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
              />
              {taskSearch && (
                <button
                  type="button"
                  onClick={() => setTaskSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'ALL', label: 'Semua' },
                  { id: 'PENDING', label: 'Menunggu' },
                  { id: 'APPROVED', label: 'Disetujui' },
                  { id: 'REJECTED', label: 'Ditolak' },
                ] as const
              ).map((chip) => (
                <button
                  key={chip.id}
                  type="button"
                  onClick={() => setTaskFilter(chip.id)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition cursor-pointer ${
                    taskFilter === chip.id
                      ? 'bg-perrific-violet text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabel Task Terkirim */}
          {filteredTasks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500">
                <CheckCircle2 size={24} strokeWidth={1.8} aria-hidden="true" />
              </span>
              <p className="mt-3 text-sm font-semibold text-perrific-graphite">
                {taskSearch || taskFilter !== 'ALL'
                  ? 'Tidak ada task yang cocok dengan filter'
                  : 'Belum ada task terkirim'}
              </p>
              <p className="mt-1 text-xs text-gray-400 max-w-sm mx-auto">
                {taskSearch || taskFilter !== 'ALL'
                  ? 'Coba ganti filter atau hapus kata kunci pencarian.'
                  : 'Kirim task pertama Anda langsung ke dalam project di tim binaan.'}
              </p>
              {(!taskSearch && taskFilter === 'ALL') && (
                <button
                  type="button"
                  onClick={() => setSendTaskOpen(true)}
                  className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 font-manrope text-xs font-semibold text-white hover:bg-emerald-700 transition cursor-pointer"
                >
                  Kirim Task Pertama
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-gray-100 bg-gray-50/80 font-manrope text-gray-500">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Judul Task</th>
                      <th className="px-4 py-3 font-semibold">Project & Tim</th>
                      <th className="px-4 py-3 font-semibold">Prioritas</th>
                      <th className="px-4 py-3 font-semibold">Status Persetujuan</th>
                      <th className="px-4 py-3 font-semibold">Pengusul</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredTasks.map((t) => (
                      <tr key={t.id} className="transition hover:bg-gray-50/60">
                        <td className="px-4 py-3.5">
                          <strong className="font-manrope text-xs font-bold text-perrific-graphite block">{t.title}</strong>
                          {t.description && <p className="mt-0.5 text-gray-400 truncate max-w-xs">{t.description}</p>}
                        </td>
                        <td className="px-4 py-3.5">
                          {t.project ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/projects/${t.project!.id}`)}
                              className="text-left font-medium text-perrific-violet hover:underline cursor-pointer flex items-center gap-1"
                            >
                              <span>{t.project.name}</span>
                              <ExternalLink size={11} className="opacity-70" />
                            </button>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                          <p className="text-[10px] text-gray-400">{t.project?.team?.name}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded-md px-2 py-0.5 font-semibold text-[10px] ${
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
                        <td className="px-4 py-3.5">
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
                        <td className="px-4 py-3.5 text-gray-500">{t.createdBy?.name || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Konten Tab 3: Tim Terhubung */}
      {activeTab === 'teams' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-manrope text-base font-bold text-perrific-graphite">Tim yang Terhubung</h2>
              <p className="text-xs text-gray-400">Tim binaan yang dapat menerima usulan project & task dari organisasi ini</p>
            </div>
            {isOrgAdmin && (
              <button
                type="button"
                onClick={() => setConnectTeamOpen(true)}
                className="flex items-center gap-1.5 self-start sm:self-auto rounded-xl bg-perrific-violet/10 px-3.5 py-2 font-manrope text-xs font-semibold text-perrific-violet hover:bg-perrific-violet/20 transition cursor-pointer"
              >
                <Plus size={14} strokeWidth={2} />
                <span>Hubungkan Tim</span>
              </button>
            )}
          </div>

          {/* Search Tim */}
          {visibleConnectedTeams.length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={teamSearch}
                onChange={(e) => setTeamSearch(e.target.value)}
                placeholder="Cari tim terhubung..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs text-perrific-graphite shadow-sm focus:border-perrific-violet focus:outline-none"
              />
              {teamSearch && (
                <button
                  type="button"
                  onClick={() => setTeamSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          {filteredTeams.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center text-xs text-gray-400">
              {teamSearch
                ? 'Tidak ada tim yang sesuai pencarian.'
                : 'Belum ada tim yang terhubung. Hubungkan tim agar Anda dapat mengusulkan project dan mengirim task.'}
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((ct) => {
                const teamName = ct.team?.name ?? 'Tim';
                const teamInitial = teamName[0]?.toUpperCase() ?? 'T';
                const projectCount = ct.team?.projects?.length ?? 0;
                return (
                  <div
                    key={ct.teamId}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/team/${ct.teamId}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        navigate(`/team/${ct.teamId}`);
                      }
                    }}
                    className="group flex items-center justify-between rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition hover:border-perrific-violet/40 hover:shadow-md cursor-pointer"
                  >
                    <div className="flex items-center gap-3 truncate">
                      {ct.team?.avatarUrl ? (
                        <img
                          src={ct.team.avatarUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-sm"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-perrific-violet/10 font-manrope text-sm font-bold text-perrific-violet">
                          {teamInitial}
                        </span>
                      )}
                      <div className="truncate">
                        <p className="truncate font-manrope text-xs font-bold text-perrific-graphite group-hover:text-perrific-violet transition">
                          {teamName}
                        </p>
                        <p className="text-[11px] text-gray-400">{projectCount} Project Aktif</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 ml-2">
                      <ChevronRight size={15} className="text-gray-300 group-hover:text-perrific-violet transition" />
                      {isOrgAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleDisconnectTeam(ct.teamId, teamName);
                          }}
                          title="Putuskan hubungan tim"
                          className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition cursor-pointer"
                        >
                          <X size={15} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      )}
                    </div>
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
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-manrope text-base font-bold text-perrific-graphite">Anggota Organisasi</h2>
              <p className="text-xs text-gray-400">Pengguna yang memiliki hak akses mengusulkan project & task</p>
            </div>
          </div>

          {/* Form Tambah Anggota Khusus Admin */}
          {isOrgAdmin && (
            <form
              onSubmit={handleAddMember}
              className="flex flex-col sm:flex-row gap-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm"
            >
              <div className="relative flex-1">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="email"
                  required
                  value={addMemberEmail}
                  onChange={(e) => setAddMemberEmail(e.target.value)}
                  placeholder="Masukkan email pengguna untuk diundang ke organisasi..."
                  className="w-full rounded-xl border border-gray-200 py-2 pl-8 pr-3 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={addingMember || !addMemberEmail.trim()}
                className="flex items-center justify-center gap-1.5 rounded-xl bg-perrific-violet px-4 py-2 font-manrope text-xs font-semibold text-white shadow-sm hover:bg-perrific-violet/90 disabled:opacity-50 transition cursor-pointer"
              >
                <UserPlus size={14} />
                <span>{addingMember ? 'Menambahkan...' : 'Tambah Anggota'}</span>
              </button>
            </form>
          )}

          {/* Toolbar Pencarian Anggota */}
          {(org.members ?? []).length > 0 && (
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={memberSearch}
                onChange={(e) => setMemberSearch(e.target.value)}
                placeholder="Cari anggota berdasarkan nama, email, atau role..."
                className="w-full rounded-xl border border-gray-200 bg-white py-2 pl-8 pr-3 text-xs text-perrific-graphite shadow-sm focus:border-perrific-violet focus:outline-none"
              />
              {memberSearch && (
                <button
                  type="button"
                  onClick={() => setMemberSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {filteredMembers.length === 0 ? (
              <div className="p-8 text-center text-xs text-gray-400">
                Tidak ada anggota yang cocok dengan pencarian.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredMembers.map((m) => (
                  <div key={m.id} className="flex items-center justify-between px-4 py-3.5 transition hover:bg-gray-50/50">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.user?.name ?? 'Anggota'} src={m.user?.avatarUrl} size={36} />
                      <div>
                        <p className="font-manrope text-xs font-bold text-perrific-graphite">{m.user?.name}</p>
                        <p className="text-[11px] text-gray-400">{m.user?.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${
                          m.role === 'ADMIN'
                            ? 'bg-perrific-violet/10 text-perrific-violet'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {m.role === 'ADMIN' ? 'Admin' : 'Anggota'}
                      </span>
                      {isOrgAdmin && m.userId !== org.createdById && m.userId !== user?.id && (
                        <button
                          type="button"
                          onClick={() => void handleRemoveMember(m.userId, m.user?.name ?? 'Anggota')}
                          className="rounded-lg p-1.5 text-gray-300 hover:bg-red-50 hover:text-red-500 transition cursor-pointer"
                          title="Keluarkan anggota"
                        >
                          <X size={14} strokeWidth={1.8} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Edit Profil Organisasi */}
      {editOrgOpen && (
        <EditOrganizationModal
          org={org}
          onClose={() => setEditOrgOpen(false)}
          onUpdated={(updated) => {
            setOrg((prev) => (prev ? { ...prev, ...updated } : updated));
            setEditOrgOpen(false);
          }}
        />
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
            <h2 className="font-manrope text-base font-bold text-perrific-graphite">Hubungkan Tim ke Organisasi</h2>
            <p className="text-xs text-gray-400">Pilih tim yang akan menerima usulan project & task dari organisasi ini.</p>
            {loadingConnectTeams ? (
              <p className="text-xs text-gray-400">Memuat tim...</p>
            ) : myTeams.length === 0 ? (
              <p className="text-xs text-gray-400">Tidak ada tim yang tersedia untuk dihubungkan.</p>
            ) : (
              <select
                value={connectingTeamId}
                onChange={(e) => setConnectingTeamId(e.target.value)}
                className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-perrific-graphite focus:outline-none"
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
                className="rounded-xl px-3.5 py-1.5 text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!connectingTeamId}
                className="rounded-xl bg-perrific-violet px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-perrific-violet/90 disabled:opacity-50 cursor-pointer"
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
