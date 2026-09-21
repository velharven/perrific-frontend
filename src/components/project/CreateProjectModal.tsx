import { useEffect, useRef, useState } from 'react';
import { teamApi } from '@/api/teams';
import ModalShell from '@/components/ui/ModalShell';
import { showToast } from '@/components/ui/Toast';
import type { Project } from '@/types';

export default function CreateProjectModal({
  teamId,
  onClose,
  onCreated,
}: {
  teamId: string;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    try {
      const created = await teamApi.createProject(teamId, {
        name: trimmed,
        description: description.trim() || undefined,
      });
      onCreated(created);
    } catch {
      showToast('Gagal membuat project. Coba lagi.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <ModalShell label="Buat project baru" onClose={onClose}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-givonic text-base font-extrabold text-perrific-graphite">Project baru</h2>
          <p className="mt-0.5 font-givonic text-xs text-perrific-graphite/50">Buat project di dalam tim ini.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          title="Tutup"
          aria-label="Tutup"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-perrific-graphite/60 transition hover:bg-gray-100 hover:text-perrific-graphite"
        >
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <div>
          <label htmlFor="cpm-name" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
            Nama project
          </label>
          <input
            id="cpm-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="cth. Website TA"
            maxLength={60}
            className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
          />
        </div>
        <div>
          <label htmlFor="cpm-desc" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
            Deskripsi <span className="font-normal text-perrific-graphite/40">(opsional)</span>
          </label>
          <input
            id="cpm-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi singkat"
            maxLength={500}
            className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
          />
        </div>
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            disabled={creating}
            className="rounded-full px-4 py-2 font-givonic text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="submit"
            disabled={creating || !name.trim()}
            className="rounded-full bg-perrific-violet px-5 py-2 font-givonic text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
          >
            {creating ? 'Membuat…' : 'Buat project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
