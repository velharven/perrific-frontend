import { useEffect, useMemo, useState } from 'react';
import { teamApi } from '@/api/teams';
import { organizationApi } from '@/api/organizations';
import { useAuth } from '@/store/auth';
import { useTrash } from '@/hooks/useNavLabels';
import ModalShell from '@/components/ui/ModalShell';
import { showToast } from '@/components/ui/Toast';
import { Building2, X } from 'lucide-react';
import type { Organization, Team } from '@/types';

export default function CreateOrganizationModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (org: Organization) => void;
}) {
  const { user } = useAuth();
  const { items: trashItems } = useTrash(user?.id);
  const trashedTeamIds = useMemo(
    () => new Set(trashItems.filter((t) => t.kind === 'team').map((t) => t.id)),
    [trashItems],
  );

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTeams = useMemo(
    () => teams.filter((t) => !trashedTeamIds.has(t.id)),
    [teams, trashedTeamIds],
  );

  useEffect(() => {
    teamApi
      .listMyTeams()
      .then((data) => setTeams(data))
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
  }, []);

  function toggleTeam(teamId: string) {
    setSelectedTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama organisasi wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError(null);
    const validTeamIds = selectedTeamIds.filter((id) => availableTeams.some((t) => t.id === id));
    try {
      const org = await organizationApi.create({
        name: name.trim(),
        description: description.trim() || undefined,
        teamIds: validTeamIds.length > 0 ? validTeamIds : undefined,
      });
      showToast(`Organisasi "${org.name}" berhasil dibuat!`);
      onCreated(org);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal membuat organisasi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell label="Buat Organisasi Baru" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-perrific-violet/10 text-perrific-violet">
              <Building2 size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-manrope text-base font-bold text-perrific-graphite">Buat Organisasi Baru</h2>
              <p className="text-xs text-gray-400">Ruang kerja terpadu untuk mengusulkan project & task</p>
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
            Nama Organisasi <span className="text-red-500">*</span>
          </label>
          <input
            autoFocus
            type="text"
            required
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: BEM Fakultas, Divisi Acara, OSIS"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-perrific-graphite focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block font-manrope text-xs font-semibold text-perrific-graphite">
            Deskripsi (Opsional)
          </label>
          <textarea
            rows={2}
            maxLength={500}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tujuan atau cakupan organisasi..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-perrific-graphite focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block font-manrope text-xs font-semibold text-perrific-graphite">
            Hubungkan Tim Binaan (Opsional)
          </label>
          <p className="mb-2 text-xs text-gray-400">
            Pilih tim yang akan menerima usulan project dan task dari organisasi ini.
          </p>

          {loadingTeams ? (
            <p className="text-xs text-gray-400">Memuat tim...</p>
          ) : availableTeams.length === 0 ? (
            <p className="rounded-lg border border-dashed border-gray-200 p-2.5 text-xs text-gray-400">
              Belum ada tim yang tersedia. Anda dapat menghubungkan tim nanti.
            </p>
          ) : (
            <div className="max-h-36 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-2">
              {availableTeams.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center justify-between rounded-md p-1.5 hover:bg-gray-50 text-sm"
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-perrific-violet/10 text-[10px] font-bold text-perrific-violet">
                      {t.name[0]?.toUpperCase()}
                    </span>
                    <span className="truncate text-xs font-medium text-perrific-graphite">{t.name}</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedTeamIds.includes(t.id)}
                    onChange={() => toggleTeam(t.id)}
                    className="h-4 w-4 rounded border-gray-300 text-perrific-violet focus:ring-perrific-violet"
                  />
                </label>
              ))}
            </div>
          )}
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
            disabled={submitting || !name.trim()}
            className="rounded-lg bg-perrific-violet px-4 py-2 font-manrope text-xs font-semibold text-white shadow-sm transition hover:bg-perrific-violet/90 disabled:opacity-50"
          >
            {submitting ? 'Membuat...' : 'Buat Organisasi'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
