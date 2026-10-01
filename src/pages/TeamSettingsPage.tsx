import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { teamApi } from '@/api/teams';
import { showToast } from '@/components/ui/Toast';
import ConfirmModal from '@/components/ui/ConfirmModal';
import { SettingsBlock } from '@/components/ui/SettingsShell';
import { buildJoinLink, formatExpiryText, INVITE_PRESETS, matchPreset } from '@/lib/invite';
import { useAuth } from '@/store/auth';
import { APP_SIDEBAR_EVENT, isAppSidebarCollapsed } from '@/components/layout/AppLayout';
import type { Team } from '@/types';

export default function TeamSettingsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const [team, setTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'undang' | 'anggota'>('undang');
  const [email, setEmail] = useState('');
  const [savingInvite, setSavingInvite] = useState(false);
  const [confirmRegen, setConfirmRegen] = useState(false);
  // Offset pill fixed agar center ke area konten (di luar sidebar utama).
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(isAppSidebarCollapsed);

  useEffect(() => {
    const sync = () => setSbCollapsed(isAppSidebarCollapsed());
    window.addEventListener(APP_SIDEBAR_EVENT, sync);
    return () => window.removeEventListener(APP_SIDEBAR_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    teamApi
      .getTeam(teamId)
      .then(setTeam)
      .catch(() => setTeam(null))
      .finally(() => setLoading(false));
  }, [teamId]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId || !email.trim()) return;
    await teamApi.addMember(teamId, { email });
    setEmail('');
    const updated = await teamApi.getTeam(teamId).catch(() => null);
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
    if (!teamId) return;
    setSavingInvite(true);
    try {
      const updated = await teamApi.updateInvite(teamId, { expiresInHours: hours });
      setTeam(updated);
      showToast('Masa berlaku invite diperbarui.');
    } catch {
      showToast('Gagal memperbarui masa berlaku.');
    } finally {
      setSavingInvite(false);
    }
  }

  async function handleDeactivate() {
    if (!teamId) return;
    setSavingInvite(true);
    try {
      const updated = await teamApi.updateInvite(teamId, { expiresInHours: 0 });
      setTeam(updated);
      showToast('Invite dinonaktifkan. Kode dan link tidak berlaku.');
    } catch {
      showToast('Gagal menonaktifkan invite.');
    } finally {
      setSavingInvite(false);
    }
  }

  async function handleRegenerate() {
    if (!teamId) return;
    const remaining =
      team?.inviteExpiresAt == null
        ? null
        : Math.max(0, Math.ceil((new Date(team.inviteExpiresAt).getTime() - Date.now()) / 3600_000));
    try {
      const updated = await teamApi.updateInvite(teamId, { expiresInHours: remaining, regenerate: true });
      setTeam(updated);
      setConfirmRegen(false);
      showToast('Kode invite baru dibuat. Link lama tidak berlaku.');
    } catch {
      showToast('Gagal membuat kode baru.');
    }
  }

  if (loading) return <p className="text-gray-500">Memuat…</p>;
  if (!team) return <p className="text-gray-500">Tim tidak ditemukan.</p>;

  const isAdmin = team.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false;
  const showCode = (isAdmin || team.canManageInvite) && !!team.inviteCode;
  const activePreset = matchPreset(team.inviteExpiresAt);
  const isExpired =
    team.inviteExpiresAt != null && new Date(team.inviteExpiresAt).getTime() <= Date.now();
  const joinLink = team.inviteCode ? buildJoinLink(team.inviteCode) : '';

  return (
    <div className="flex min-h-full w-full flex-col space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Kelola tim {team.name}</p>
      </div>
      <div className="flex-1 space-y-5">
        {section === 'undang' ? (
        <SettingsBlock title="Undang anggota" desc="Kode tim atau email langsung">
          {showCode && (
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
              className="min-w-0 flex-1 rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
            />
            <button className="shrink-0 rounded-full bg-perrific-violet px-5 py-2.5 font-givonic text-sm font-semibold text-white transition hover:bg-[#E64D0A]">
              Undang
            </button>
          </form>
        </SettingsBlock>
        ) : (
        <SettingsBlock title="Anggota" desc={`${team.members?.length ?? 0} anggota tim`}>
          <div className="overflow-hidden rounded-[10px] border border-perrific-line">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-3 py-2">Nama</th>
                  <th className="px-3 py-2">Email</th>
                  <th className="px-3 py-2">Role</th>
                </tr>
              </thead>
              <tbody>
                {team.members?.map((member) => (
                  <tr key={member.id} className="border-t border-gray-100">
                    <td className="px-3 py-2">{member.user?.name}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 text-gray-500">{member.user?.email}</td>
                    <td className="px-3 py-2">{member.role}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
        </SettingsBlock>
        )}
      </div>
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center transition-[left] duration-200 ${
          sbCollapsed ? 'md:left-0' : 'md:left-64'
        }`}
      >
        <div
          className="pointer-events-auto nice-scroll flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-200 bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(26,26,30,0.14)] backdrop-blur"
          role="tablist"
          aria-label="Settings tim"
        >
          {(
            [
              { id: 'undang', label: 'Undang' },
              { id: 'anggota', label: 'Anggota' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={section === t.id}
              onClick={() => setSection(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 font-givonic text-xs font-semibold transition ${
                section === t.id
                  ? 'bg-perrific-graphite text-white'
                  : 'text-gray-500 hover:bg-gray-100 hover:text-perrific-graphite'
              }`}
            >
              {t.label}
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
    </div>
  );
}
