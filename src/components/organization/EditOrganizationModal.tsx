import { useState } from 'react';
import { organizationApi } from '@/api/organizations';
import ModalShell from '@/components/ui/ModalShell';
import { showToast } from '@/components/ui/Toast';
import { Building2, X } from 'lucide-react';
import type { Organization } from '@/types';

export default function EditOrganizationModal({
  org,
  onClose,
  onUpdated,
}: {
  org: Organization;
  onClose: () => void;
  onUpdated: (org: Organization) => void;
}) {
  const [name, setName] = useState(org.name);
  const [description, setDescription] = useState(org.description || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Nama organisasi wajib diisi.');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const updated = await organizationApi.update(org.id, {
        name: name.trim(),
        description: description.trim() || undefined,
      });
      showToast('Informasi organisasi berhasil diperbarui.');
      onUpdated(updated);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg || 'Gagal memperbarui organisasi.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ModalShell label="Edit Organisasi" onClose={onClose}>
      <form onSubmit={handleSubmit} className="w-full max-w-md space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-perrific-violet/10 text-perrific-violet">
              <Building2 size={18} strokeWidth={1.8} aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-manrope text-base font-bold text-perrific-graphite">Edit Profil Organisasi</h2>
              <p className="text-xs text-gray-400">Perbarui nama dan deskripsi ruang lingkup organisasi</p>
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
          <p className="rounded-lg bg-red-50 p-2.5 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="edit-org-name" className="text-xs font-semibold text-gray-600">
            Nama Organisasi <span className="text-red-500">*</span>
          </label>
          <input
            id="edit-org-name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Contoh: Himpunan Mahasiswa Informatika"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="edit-org-desc" className="text-xs font-semibold text-gray-600">
            Deskripsi (opsional)
          </label>
          <textarea
            id="edit-org-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Jelaskan peran atau divisi kerja organisasi ini..."
            className="w-full resize-none rounded-xl border border-gray-200 px-3 py-2 text-xs text-perrific-graphite focus:border-perrific-violet focus:outline-none"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2 font-manrope text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded-xl bg-perrific-violet px-4 py-2 font-manrope text-xs font-semibold text-white shadow-sm hover:bg-perrific-violet/90 disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
