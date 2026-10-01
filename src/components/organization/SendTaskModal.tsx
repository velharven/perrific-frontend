import { useEffect, useMemo, useState } from 'react';
import { organizationApi } from '@/api/organizations';
import ModalShell from '@/components/ui/ModalShell';
import { showToast } from '@/components/ui/Toast';
import type { Task } from '@/types';

interface ConnectedTeamOption {
  id: string;
  name: string;
  projects?: { id: string; name: string }[];
}

export default function SendTaskModal({
  organizationId,
  connectedTeams,
  onClose,
  onTaskSent,
}: {
  organizationId: string;
  connectedTeams: ConnectedTeamOption[];
  onClose: () => void;
  onTaskSent: (task: Task) => void;
}) {
  const [selectedTeamId, setSelectedTeamId] = useState(connectedTeams[0]?.id || '');

  const availableProjects = useMemo(() => {
    const team = connectedTeams.find((t) => t.id === selectedTeamId);
    return team?.projects || [];
  }, [connectedTeams, selectedTeamId]);

  const [projectId, setProjectId] = useState(availableProjects[0]?.id || '');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update projectId whenever availableProjects changes
  useEffect(() => {
    if (availableProjects.length > 0 && !availableProjects.some((p) => p.id === projectId)) {
      setProjectId(availableProjects[0].id);
    } else if (availableProjects.length === 0) {
      setProjectId('');
    }
  }, [availableProjects, projectId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) {
      setError('Pilih project tujuan terlebih dahulu.');
      return;
    }
    if (!title.trim()) {
      setError('Judul task wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const task = await organizationApi.sendTask(organizationId, {
        projectId,
        title: title.trim(),
        description: description.trim() || undefined,
        priority,
        dueDate: dueDate || undefined,
      });
      showToast('Task berhasil dikirim!');
      onTaskSent(task);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal mengirim task ke project.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell label="Kirim Task ke Project" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </span>
            <div>
              <h2 className="font-givonic text-base font-bold text-perrific-graphite">Kirim Task ke Project</h2>
              <p className="text-xs text-gray-400">Kirim task ke project tim terhubung</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-givonic text-xs font-semibold text-perrific-graphite">
              Tim Terhubung <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
            >
              {connectedTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block font-givonic text-xs font-semibold text-perrific-graphite">
              Project Tujuan <span className="text-red-500">*</span>
            </label>
            {availableProjects.length === 0 ? (
              <p className="py-2 text-[11px] text-gray-400">Tidak ada project aktif di tim ini.</p>
            ) : (
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
              >
                {availableProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block font-givonic text-xs font-semibold text-perrific-graphite">
            Judul Task <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            type="text"
            required
            maxLength={120}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Contoh: Buat desain poster pendaftaran, Finalisasi MoU"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-perrific-graphite focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block font-givonic text-xs font-semibold text-perrific-graphite">
              Prioritas
            </label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT')}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
            >
              <option value="LOW">Rendah (Low)</option>
              <option value="MEDIUM">Sedang (Medium)</option>
              <option value="HIGH">Tinggi (High)</option>
              <option value="URGENT">Mendesak (Urgent)</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block font-givonic text-xs font-semibold text-perrific-graphite">
              Tenggat Waktu (Opsional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block font-givonic text-xs font-semibold text-perrific-graphite">
            Deskripsi Task (Opsional)
          </label>
          <textarea
            rows={3}
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Rincian instruksi atau kebutuhan task..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-perrific-graphite focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 font-givonic text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting || !title.trim() || !projectId}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-givonic text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? 'Mengirim...' : 'Kirim Task'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
