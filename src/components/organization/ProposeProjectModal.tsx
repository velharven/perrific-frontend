import { useState } from 'react';
import { organizationApi } from '@/api/organizations';
import ModalShell from '@/components/ui/ModalShell';
import { showToast } from '@/components/ui/Toast';
import { Briefcase, X } from 'lucide-react';
import type { ProjectProposal } from '@/types';

export default function ProposeProjectModal({
  organizationId,
  connectedTeams,
  onClose,
  onProposed,
}: {
  organizationId: string;
  connectedTeams: { id: string; name: string }[];
  onClose: () => void;
  onProposed: (proposal: ProjectProposal) => void;
}) {
  const [teamId, setTeamId] = useState(connectedTeams[0]?.id || '');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!teamId) {
      setError('Pilih tim target terlebih dahulu.');
      return;
    }
    if (!name.trim()) {
      setError('Nama project wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const proposal = await organizationApi.proposeProject(organizationId, {
        teamId,
        name: name.trim(),
        description: description.trim() || undefined,
      });
      showToast('Usulan project berhasil dikirim.');
      onProposed(proposal);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal mengirim usulan project.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell label="Usulkan Project Baru" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <Briefcase size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-manrope text-base font-bold text-perrific-graphite">Usulkan Project Baru</h2>
              <p className="text-xs text-gray-400">Buat project baru untuk tim terhubung</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-600 cursor-pointer"
          >
            <X size={14} strokeWidth={1.6} aria-hidden="true" />
          </button>
        </div>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600">
            {error}
          </div>
        )}

        <div>
          <label className="mb-1 block font-manrope text-xs font-semibold text-perrific-graphite">
            Tim Tujuan <span className="text-red-500">*</span>
          </label>
          {connectedTeams.length === 0 ? (
            <p className="rounded-lg border border-dashed border-red-200 bg-red-50/50 p-2 text-xs text-red-600">
              Belum ada tim yang terhubung. Hubungkan minimal satu tim di halaman organisasi ini terlebih dahulu.
            </p>
          ) : (
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-perrific-graphite focus:border-perrific-violet focus:outline-none"
            >
              {connectedTeams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="mb-1 block font-manrope text-xs font-semibold text-perrific-graphite">
            Nama Project <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            type="text"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Pekan Olahraga, Redesain UI, Sponsorship"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-perrific-graphite focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block font-manrope text-xs font-semibold text-perrific-graphite">
            Deskripsi Project (Opsional)
          </label>
          <textarea
            rows={3}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan tujuan, ruang lingkup, atau luaran dari project ini..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-perrific-graphite focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg px-4 py-2 font-manrope text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !teamId}
            className="rounded-lg bg-blue-600 px-4 py-2 font-manrope text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? 'Mengirim...' : 'Kirim Usulan Project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
