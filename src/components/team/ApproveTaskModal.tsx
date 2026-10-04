import { useState, useMemo } from 'react';
import ModalShell from '@/components/ui/ModalShell';
import Avatar from '@/components/ui/Avatar';
import { CheckCircle2, Search, X, Check } from 'lucide-react';
import type { PendingTask, TeamMember } from '@/types';

interface ApproveTaskModalProps {
  task: PendingTask | null;
  teamMembers: TeamMember[];
  onClose: () => void;
  onConfirm: (assigneeIds?: string[]) => Promise<void> | void;
  submitting?: boolean;
}

export default function ApproveTaskModal({
  task,
  teamMembers,
  onClose,
  onConfirm,
  submitting = false,
}: ApproveTaskModalProps) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>(() =>
    task?.assignees ? task.assignees.map((a) => a.id) : [],
  );
  const [search, setSearch] = useState('');

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teamMembers;
    return teamMembers.filter((m) => (m.user?.name ?? '').toLowerCase().includes(q));
  }, [teamMembers, search]);

  if (!task) return null;

  function toggleUser(userId: string) {
    if (submitting) return;
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  }

  return (
    <ModalShell
      label="Setujui dan Tugaskan Task"
      onClose={submitting ? () => {} : onClose}
      maxWidthClass="max-w-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
            <CheckCircle2 size={20} strokeWidth={2} aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-manrope text-base font-bold text-gray-900">
              Setujui Usulan Task
            </h2>
            <p className="font-manrope text-xs text-gray-500">
              Tugaskan task ini ke anggota tim atau atur nanti
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Tutup modal"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50 cursor-pointer"
        >
          <X size={18} strokeWidth={1.8} />
        </button>
      </div>

      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/70 p-3 text-xs">
        <p className="font-manrope font-semibold text-gray-900">{task.title}</p>
        <p className="mt-1 text-gray-500">
          {task.project.name} · diajukan oleh{' '}
          <span className="font-medium text-gray-700">{task.createdBy?.name ?? 'Anggota'}</span>
        </p>
      </div>

      <div className="mt-4 space-y-2">
        <label className="block font-manrope text-xs font-semibold text-gray-700">
          Tugaskan kepada (Opsional):
        </label>
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari anggota tim…"
            aria-label="Cari anggota tim"
            className="w-full rounded-lg border border-gray-200 bg-white py-1.5 pl-8 pr-3 font-manrope text-xs text-gray-800 placeholder-gray-400 focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div className="nice-scroll max-h-48 overflow-y-auto rounded-xl border border-gray-100 bg-white divide-y divide-gray-50">
          {filteredMembers.length === 0 ? (
            <p className="py-4 text-center font-manrope text-xs text-gray-400">
              Tidak ada anggota tim yang cocok.
            </p>
          ) : (
            filteredMembers.map((m) => {
              const isSelected = selectedUserIds.includes(m.userId);
              const label = m.user?.name ?? 'Anggota';
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleUser(m.userId)}
                  disabled={submitting}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left transition hover:bg-gray-50 ${
                    isSelected ? 'bg-perrific-violet/5' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Avatar
                      src={m.user?.avatarUrl ?? undefined}
                      name={label}
                      size={28}
                      alt={label}
                      className="h-7 w-7 text-[10px]"
                    />
                    <div className="min-w-0 truncate">
                      <p className="truncate font-manrope text-xs font-medium text-gray-800">
                        {label}
                      </p>
                      <p className="font-manrope text-[10px] text-gray-400">
                        {m.role === 'ADMIN' ? 'Admin Tim' : 'Anggota'}
                      </p>
                    </div>
                  </div>
                  <div
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                      isSelected
                        ? 'border-perrific-graphite bg-perrific-graphite text-white'
                        : 'border-gray-300 bg-white'
                    }`}
                  >
                    {isSelected && <Check size={12} strokeWidth={3} />}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          disabled={submitting}
          onClick={() => void onConfirm([])}
          className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-manrope text-xs font-semibold text-gray-700 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 cursor-pointer"
        >
          Atur nanti
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={submitting}
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 font-manrope text-xs font-semibold text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void onConfirm(selectedUserIds)}
            className="rounded-lg bg-perrific-graphite px-3 py-1.5 font-manrope text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {submitting
              ? 'Menyetujui…'
              : selectedUserIds.length > 0
                ? `Tugaskan (${selectedUserIds.length}) & Setujui`
                : 'Setujui'}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}
