import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { SettingsBlock } from '@/components/ui/SettingsShell';
import Avatar from '@/components/ui/Avatar';
import { fileToAvatarDataUrl } from '@/lib/avatar';
import { ActivityIcon, TrashIcon } from '@/components/icons';
import { loadBoardView, saveBoardView, type BoardView } from '@/components/kanban/KanbanBoard';
import BoardColumnEditor from '@/components/project/BoardColumnEditor';
import { buildJoinLink, formatExpiryText, INVITE_PRESETS, matchPreset } from '@/lib/invite';
import { BOARD_VIEW_EVENT } from '@/pages/BoardPage';
import { useAuth } from '@/store/auth';
import { showToast } from '@/components/ui/Toast';
import type { Project, Team } from '@/types';

type Section = 'umum' | 'board' | 'undang' | 'danger';

// Event jendela saat project berubah dari halaman settings (nama/deskripsi/
// status/foto), agar halaman induk (overview, kanban, daftar) ikut refresh.
// Pola yang sama dipakai BOARD_VIEW_EVENT untuk preferensi board.
export const PROJECT_UPDATED_EVENT = 'project-updated';

export function dispatchProjectUpdated(project: Project) {
  window.dispatchEvent(new CustomEvent<Project>(PROJECT_UPDATED_EVENT, { detail: project }));
}

const sections: { id: Section; label: string; adminOnly?: boolean; icon: ReactNode }[] = [
  { id: 'umum', label: 'Umum', icon: <ActivityIcon name="note" className="h-[15px] w-[15px] shrink-0" /> },
  { id: 'board', label: 'Tampilan board', icon: <ActivityIcon name="kanban" className="h-[15px] w-[15px] shrink-0" /> },
  { id: 'undang', label: 'Undang', adminOnly: true, icon: <ActivityIcon name="users" className="h-[15px] w-[15px] shrink-0" /> },
  { id: 'danger', label: 'Zona berbahaya', adminOnly: true, icon: <TrashIcon className="h-[15px] w-[15px] shrink-0" /> },
];

const inputClass =
  'w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20';

export default function ProjectSettingsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<Section>('umum');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<Project['status']>('ACTIVE');
  // Draft foto: undefined = belum disentuh, string = foto baru, null = dihapus.
  // Baru dikirim ke server saat Simpan ditekan (satu PATCH dengan field lain).
  const [photo, setPhoto] = useState<string | null | undefined>(undefined);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [view, setView] = useState<BoardView>(() => loadBoardView(projectId ?? ''));
  const [email, setEmail] = useState('');
  const [savingInvite, setSavingInvite] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    projectApi
      .getProject(projectId)
      .then(async (p) => {
        setProject(p);
        setName(p.name);
        setDescription(p.description ?? '');
        setPhoto(undefined);
        setStatus(p.status);
        const team = await teamApi.getTeam(p.teamId);
        setTeam(team);
        setIsAdmin(team.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false);
      })
      .finally(() => setLoading(false));
  }, [projectId, user?.id]);

  function updateView(patch: Partial<BoardView>) {
    if (!projectId) return;
    setView((prev) => {
      const next = { ...prev, ...patch };
      saveBoardView(projectId, next);
      window.dispatchEvent(new Event(BOARD_VIEW_EVENT));
      return next;
    });
  }

  function applyUpdated(updated: Project) {
    setProject(updated);
    dispatchProjectUpdated(updated);
  }

  async function handlePhotoFile(file: File | undefined) {
    if (!file || photoBusy || !project) return;
    setPhotoError(null);
    if (!file.type.startsWith('image/')) {
      setPhotoError('File harus berupa gambar.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Ukuran maksimal 5 MB.');
      return;
    }
    setPhotoBusy(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setPhoto(dataUrl);
    } catch {
      setPhotoError('Gagal memproses foto. Coba lagi.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function handleRemovePhoto() {
    if (photoBusy || !project) return;
    setPhotoError(null);
    setPhoto(null);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!project || !name.trim()) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await projectApi.updateProject(project.id, {
        ...(name.trim() !== project.name ? { name: name.trim() } : {}),
        ...(description.trim() !== (project.description ?? '') ? { description: description.trim() || null } : {}),
        ...(status !== project.status ? { status } : {}),
        ...(photo !== undefined ? { avatarUrl: photo } : {}),
      });
      setPhoto(undefined);
      applyUpdated(updated);
    } catch {
      setSaveError('Gagal menyimpan. Coba lagi.');
    } finally {
      setSaving(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!team || !email.trim()) return;
    await teamApi.addMember(team.id, { email });
    setEmail('');
    const updated = await teamApi.getTeam(team.id).catch(() => null);
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

  async function handleCopyLink() {
    if (!team?.inviteCode) return;
    try {
      await navigator.clipboard.writeText(buildJoinLink(team.inviteCode));
      showToast('Link invite disalin.');
    } catch {
      showToast('Gagal menyalin. Salin manual dari layar.');
    }
  }

  async function handlePreset(hours: number | null) {
    if (!team) return;
    setSavingInvite(true);
    try {
      const updated = await teamApi.updateInvite(team.id, { expiresInHours: hours });
      setTeam(updated);
      showToast('Masa berlaku invite diperbarui.');
    } catch {
      showToast('Gagal memperbarui masa berlaku.');
    } finally {
      setSavingInvite(false);
    }
  }

  async function handleDeactivate() {
    if (!team) return;
    setSavingInvite(true);
    try {
      const updated = await teamApi.updateInvite(team.id, { expiresInHours: 0 });
      setTeam(updated);
      showToast('Invite dinonaktifkan. Kode dan link tidak berlaku.');
    } catch {
      showToast('Gagal menonaktifkan invite.');
    } finally {
      setSavingInvite(false);
    }
  }

  async function handleRegenerate() {
    if (!team) return;
    const remaining =
      team.inviteExpiresAt == null
        ? null
        : Math.max(0, Math.ceil((new Date(team.inviteExpiresAt).getTime() - Date.now()) / 3600_000));
    try {
      const updated = await teamApi.updateInvite(team.id, { expiresInHours: remaining, regenerate: true });
      setTeam(updated);
      setConfirmRegen(false);
      showToast('Kode invite baru dibuat. Link lama tidak berlaku.');
    } catch {
      showToast('Gagal membuat kode baru.');
    }
  }

  async function handleDelete() {
    if (!project) return;
    setDeleting(true);
    try {
      await projectApi.removeProject(project.id);
      navigate(`/team/${project.teamId}/projects`);
    } finally {
      setDeleting(false);
    }
  }

  const dirty =
    !!project &&
    (photo !== undefined ||
      (name.trim() !== '' && name.trim() !== project.name) ||
      description.trim() !== (project.description ?? '') ||
      status !== project.status);

  const visible = sections.filter((s) => !s.adminOnly || isAdmin);

  // Foto yang ditampilkan: draft bila sudah disentuh, kalau tidak foto server.
  const effectiveAvatar = photo !== undefined ? (photo ?? '') : (project?.avatarUrl ?? '');

  const activePreset = matchPreset(team?.inviteExpiresAt);
  const isExpired =
    team?.inviteExpiresAt != null && new Date(team.inviteExpiresAt).getTime() <= Date.now();
  const joinLink = team?.inviteCode ? buildJoinLink(team.inviteCode) : '';

  if (loading) return <p className="text-gray-500">Memuat…</p>;
  if (!project) return <p className="text-gray-500">Project tidak ditemukan.</p>;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Kelola pengaturan project {project.name}</p>
      </div>
      <div className="flex-1 space-y-5">
        {section === 'umum' &&
          (isAdmin ? (
            <form onSubmit={handleSave} className="space-y-5">
              <SettingsBlock title="Foto" desc="JPG/PNG/WebP · maks 5 MB">
                <div className="flex items-center gap-4">
                  <Avatar src={effectiveAvatar || undefined} name={project.name} size={64} alt="Foto project" className="h-16 w-16 text-xl" />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <label
                        htmlFor="ps-photo"
                        className={`inline-flex cursor-pointer items-center rounded-full border border-perrific-line bg-white px-4 py-2 font-givonic text-xs font-semibold text-perrific-graphite transition hover:bg-perrific-paper ${
                          photoBusy ? 'pointer-events-none opacity-60' : ''
                        }`}
                      >
                        {photoBusy ? 'Memproses…' : effectiveAvatar ? 'Ubah foto' : 'Tambah foto'}
                      </label>
                      <input
                        id="ps-photo"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={photoBusy}
                        onChange={(e) => {
                          void handlePhotoFile(e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                      {effectiveAvatar && (
                        <button
                          type="button"
                          onClick={handleRemovePhoto}
                          disabled={photoBusy}
                          className="rounded-full px-3 py-2 font-givonic text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                        >
                          Hapus
                        </button>
                      )}
                    </div>
                    {photoError && (
                      <p role="alert" className="mt-1.5 font-givonic text-xs text-red-600">{photoError}</p>
                    )}
                  </div>
                </div>
              </SettingsBlock>
              <SettingsBlock title="Nama" desc="Nama project">
                <input
                  id="ps-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className={inputClass}
                />
              </SettingsBlock>
              <SettingsBlock title="Deskripsi" desc="Deskripsi (opsional)">
                <input
                  id="ps-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={500}
                  placeholder="Deskripsi (opsional)"
                  className={inputClass}
                />
              </SettingsBlock>
              <SettingsBlock title="Status" desc="Arsip menyembunyikan dari daftar aktif">
                <select
                  id="ps-status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as Project['status'])}
                  className={inputClass}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="ARCHIVED">Arsip</option>
                </select>
              </SettingsBlock>
              <div>
                {saveError && (
                  <p role="alert" className="mb-2 font-givonic text-xs text-red-600">{saveError}</p>
                )}
                <button
                  type="submit"
                  disabled={!dirty || saving}
                  className="rounded-full bg-perrific-violet px-5 py-2.5 font-givonic text-sm font-semibold text-white hover:bg-[#E64D0A] disabled:cursor-not-allowed disabled:opacity-60 transition"
                >
                  {saving ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          ) : (
            <SettingsBlock title="Project" desc={project.status === 'ARCHIVED' ? 'Arsip' : 'Aktif'}>
              <div className="flex items-center gap-3">
                <Avatar src={project.avatarUrl ?? undefined} name={project.name} size={48} alt="Foto project" className="h-12 w-12 text-lg" />
                <div className="min-w-0">
                  <p className="truncate font-givonic text-sm font-bold text-perrific-graphite">{project.name}</p>
                  {project.description && (
                    <p className="truncate font-givonic text-sm text-perrific-graphite/60">{project.description}</p>
                  )}
                </div>
              </div>
            </SettingsBlock>
          ))}
        {section === 'board' && (
          <div className="space-y-5">
            {isAdmin && project && <BoardColumnEditor projectId={project.id} />}
            <SettingsBlock title="Tampilan board" desc={`Tersimpan di perangkat ini, khusus project ${project.name}`}>
              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[10px] px-2 py-2.5 transition hover:bg-gray-50">
                <span>
                  <span className="block font-givonic text-sm font-semibold text-perrific-graphite">Mode ringkas</span>
                  <span className="block font-givonic text-xs text-perrific-graphite/50">Kartu tanpa baris prioritas & assignees</span>
                </span>
                <input
                  type="checkbox"
                  checked={view.modeRingkas}
                  onChange={(e) => updateView({ modeRingkas: e.target.checked })}
                  className="h-4 w-4 shrink-0 accent-perrific-violet"
                  aria-label="Mode ringkas"
                />
              </label>
            </SettingsBlock>
          </div>
        )}
        {section === 'undang' && isAdmin && (
          <SettingsBlock title="Undang anggota" desc="Kode tim atau email langsung">
            {team?.inviteCode && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
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
                <div className="space-y-1.5">
                  <p className="font-mono text-[11px] tracking-widest text-perrific-graphite/40">LINK INVITE</p>
                  <div className="flex items-center gap-2">
                    <input
                      readOnly
                      value={joinLink}
                      onFocus={(e) => e.target.select()}
                      className="min-w-0 flex-1 truncate rounded-[10px] border border-perrific-line bg-gray-50 px-3 py-2 font-givonic text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void handleCopyLink()}
                      className="shrink-0 rounded-lg px-2 py-2 font-givonic text-xs font-semibold text-perrific-violet transition hover:bg-perrific-violet/10"
                    >
                      Salin link
                    </button>
                  </div>
                  <p
                    className={`font-givonic text-xs ${
                      isExpired ? 'font-semibold text-red-600' : 'text-gray-500'
                    }`}
                  >
                    {formatExpiryText(team.inviteExpiresAt)}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <p className="font-mono text-[11px] tracking-widest text-perrific-graphite/40">
                    MASA BERLAKU
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {INVITE_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        disabled={savingInvite}
                        onClick={() => void handlePreset(p.hours)}
                        className={`rounded-full px-3 py-1.5 font-givonic text-xs font-semibold transition disabled:opacity-50 ${
                          activePreset === p.hours
                            ? 'bg-perrific-graphite text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={savingInvite || isExpired}
                      onClick={() => void handleDeactivate()}
                      className="rounded-full bg-red-50 px-3 py-1.5 font-givonic text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      Nonaktifkan
                    </button>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
                  <p className="font-givonic text-xs text-gray-500">
                    Kode baru membuat kode dan link lama tidak berlaku.
                  </p>
                  <button
                    type="button"
                    onClick={() => setConfirmRegen(true)}
                    className="shrink-0 rounded-full border border-perrific-line px-3 py-1.5 font-givonic text-xs font-semibold text-perrific-graphite transition hover:bg-gray-50"
                  >
                    Buat kode baru
                  </button>
                </div>
              </div>
            )}
            <form onSubmit={handleInvite} className="mt-3 flex gap-2">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email anggota"
                className={`min-w-0 flex-1 ${inputClass}`}
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-perrific-violet px-5 py-2.5 font-givonic text-sm font-semibold text-white transition hover:bg-[#E64D0A]"
              >
                Undang
              </button>
            </form>
          </SettingsBlock>
        )}
        {section === 'danger' && isAdmin && (
          <SettingsBlock title="Zona berbahaya" desc="Menghapus project ikut menghapus semua task di dalamnya">
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="rounded-full bg-red-600 px-5 py-2.5 font-givonic text-sm font-semibold text-white transition hover:bg-red-700"
            >
              Hapus project
            </button>
          </SettingsBlock>
        )}
      </div>
      <div className="sticky bottom-4 z-10 flex justify-center">
        <div
          className="nice-scroll flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-200 bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(26,26,30,0.14)] backdrop-blur"
          role="tablist"
          aria-label="Settings project"
        >
          {visible.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={section === s.id}
              onClick={() => setSection(s.id)}
              className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 font-givonic text-xs font-semibold transition ${
                section === s.id
                  ? 'bg-perrific-graphite text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-perrific-graphite'
              }`}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <ConfirmModal
        open={confirmRegen}
        title="Buat kode invite baru?"
        message="Kode dan link lama langsung tidak berlaku. Anggota yang sudah bergabung tidak terpengaruh."
        confirmLabel="Buat baru"
        onCancel={() => setConfirmRegen(false)}
        onConfirm={() => void handleRegenerate()}
      />
      <ConfirmModal
        open={confirmDelete}
        title="Hapus project?"
        message={`"${project.name}" dan semua task di dalamnya ikut terhapus. Lanjutkan?`}
        confirmLabel="Hapus"
        busy={deleting}
        onCancel={() => !deleting && setConfirmDelete(false)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}
