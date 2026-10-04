import { useCallback, useEffect, useState } from 'react';
import { teamApi } from '@/api/teams';
import { taskApi } from '@/api/tasks';
import { SettingsBlock } from '@/components/ui/SettingsShell';
import Avatar from '@/components/ui/Avatar';
import { showToast } from '@/components/ui/Toast';
import ApproveTaskModal from './ApproveTaskModal';
import type { JoinRequest, PendingTask, TeamMember } from '@/types';

// Event jendela saat antrean persetujuan berubah (setujui/tolak), agar badge
// sidebar ikut refresh. Pola yang sama dipakai TEAMS_CHANGED_EVENT.
export const APPROVALS_CHANGED_EVENT = 'approvals-changed';

export function dispatchApprovalsChanged() {
  window.dispatchEvent(new Event(APPROVALS_CHANGED_EVENT));
}

// Tab Persetujuan khusus admin: usulan task baru + permintaan anggota baru.
// Dipakai di dalam project; bila projectId diisi, daftar task dibatasi ke
// project tersebut (permintaan anggota tetap level tim).
export type ApprovalTab = 'task' | 'anggota';

export default function ApprovalLists({
  teamId,
  projectId,
  activeTab,
  onCountsChange,
}: {
  teamId: string;
  projectId?: string;
  activeTab?: ApprovalTab;
  onCountsChange?: (counts: { taskCount: number; requestCount: number }) => void;
}) {
  const [tasks, setTasks] = useState<PendingTask[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [approvingTask, setApprovingTask] = useState<PendingTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [t, r, teamData] = await Promise.all([
        teamApi.listPendingTasks(teamId),
        teamApi.listJoinRequests(teamId),
        teamApi.getTeam(teamId).catch(() => null),
      ]);
      setTasks(t);
      setRequests(r);
      if (teamData?.members) setTeamMembers(teamData.members);
    } catch {
      showToast('Gagal memuat daftar persetujuan.');
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const visibleTasks = projectId ? tasks.filter((t) => t.project.id === projectId) : tasks;

  useEffect(() => {
    onCountsChange?.({ taskCount: visibleTasks.length, requestCount: requests.length });
  }, [visibleTasks.length, requests.length, onCountsChange]);

  async function handleApproveTask(task: PendingTask, assigneeIds?: string[]) {
    setBusy(task.id);
    try {
      await taskApi.approve(task.id, { assigneeIds });
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      dispatchApprovalsChanged();
      setApprovingTask(null);
      showToast('Task disetujui.');
    } catch {
      showToast('Gagal memproses task.');
    } finally {
      setBusy(null);
    }
  }

  async function decideTask(task: PendingTask, approve: boolean) {
    if (approve) {
      setApprovingTask(task);
      return;
    }
    setBusy(task.id);
    try {
      await taskApi.reject(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      dispatchApprovalsChanged();
      showToast('Task ditolak.');
    } catch {
      showToast('Gagal memproses task.');
    } finally {
      setBusy(null);
    }
  }

  async function decideRequest(req: JoinRequest, approve: boolean) {
    setBusy(req.id);
    try {
      if (approve) await teamApi.approveJoinRequest(teamId, req.id);
      else await teamApi.rejectJoinRequest(teamId, req.id);
      setRequests((prev) => prev.filter((r) => r.id !== req.id));
      dispatchApprovalsChanged();
      showToast(approve ? 'Anggota diterima.' : 'Permintaan ditolak.');
    } catch {
      showToast('Gagal memproses permintaan.');
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <p className="font-manrope text-sm text-gray-500">Memuat persetujuan…</p>;

  const showTask = !activeTab || activeTab === 'task';
  const showAnggota = !activeTab || activeTab === 'anggota';

  return (
    <div className="space-y-5">
      {showTask && (
      <SettingsBlock
        title={projectId ? 'Task menunggu di project ini' : 'Task menunggu'}
        desc={`${visibleTasks.length} usulan task`}
      >
        {visibleTasks.length === 0 ? (
          <p className="font-manrope text-sm text-gray-500">Tidak ada usulan task.</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-[10px] border border-perrific-line">
            {visibleTasks.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar
                  src={t.createdBy?.avatarUrl ?? undefined}
                  name={t.createdBy?.name ?? 'Pengaju'}
                  size={36}
                  alt={t.createdBy?.name ?? 'Pengaju'}
                  className="h-9 w-9 shrink-0 text-xs shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-manrope text-sm font-semibold text-perrific-graphite">{t.title}</p>
                  <p className="truncate font-manrope text-xs text-gray-500">
                    {t.project.name} · diajukan oleh <span className="font-medium text-gray-700">{t.createdBy?.name ?? 'Anggota'}</span>
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => void decideTask(t, false)}
                  className="shrink-0 rounded-full px-3 py-1.5 font-manrope text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  disabled={busy === t.id}
                  onClick={() => void decideTask(t, true)}
                  className="shrink-0 rounded-full bg-perrific-graphite px-3 py-1.5 font-manrope text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  Setujui
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsBlock>
      )}
      {showAnggota && (
      <SettingsBlock title="Anggota menunggu" desc={`${requests.length} permintaan bergabung ke tim`}>
        {requests.length === 0 ? (
          <p className="font-manrope text-sm text-gray-500">Tidak ada permintaan bergabung.</p>
        ) : (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-[10px] border border-perrific-line">
            {requests.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar
                  src={r.user?.avatarUrl ?? undefined}
                  name={r.user?.name ?? '?'}
                  size={36}
                  alt={r.user?.name ?? 'calon anggota'}
                  className="h-9 w-9 shrink-0 text-xs shadow-xs"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-manrope text-sm font-semibold text-perrific-graphite">{r.user?.name ?? 'Calon Anggota'}</p>
                  <p className="truncate font-manrope text-xs text-gray-500">Ingin bergabung ke tim</p>
                </div>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void decideRequest(r, false)}
                  className="shrink-0 rounded-full px-3 py-1.5 font-manrope text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  Tolak
                </button>
                <button
                  type="button"
                  disabled={busy === r.id}
                  onClick={() => void decideRequest(r, true)}
                  className="shrink-0 rounded-full bg-perrific-graphite px-3 py-1.5 font-manrope text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                >
                  Terima
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsBlock>
      )}

      {approvingTask && (
        <ApproveTaskModal
          task={approvingTask}
          teamMembers={teamMembers}
          submitting={busy === approvingTask.id}
          onClose={() => setApprovingTask(null)}
          onConfirm={(assigneeIds) => handleApproveTask(approvingTask, assigneeIds)}
        />
      )}
    </div>
  );
}
