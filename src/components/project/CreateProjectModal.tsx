import { useEffect, useMemo, useRef, useState } from 'react';
import { teamApi } from '@/api/teams';
import { projectApi } from '@/api/projects';
import ModalShell from '@/components/ui/ModalShell';
import Avatar from '@/components/ui/Avatar';
import { showToast } from '@/components/ui/Toast';
import type { Project } from '@/types';

export interface MemberOption {
  userId: string;
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

// Modal buat project: baru kosong atau duplikat struktur project lain
// (kolom + role + jabatan, tanpa task) + pilih anggota via checkbox.
export default function CreateProjectModal({
  teamId,
  projects,
  members,
  onClose,
  onCreated,
}: {
  teamId: string;
  projects: Project[];
  members: MemberOption[];
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [mode, setMode] = useState<'baru' | 'duplikat'>('baru');
  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [sourceMemberIds, setSourceMemberIds] = useState<string[]>([]);
  const [creating, setCreating] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Default nama + centang awal mengikuti mode/sumber.
  useEffect(() => {
    if (mode === 'duplikat') {
      const src = projects.find((p) => p.id === sourceId) ?? projects[0] ?? null;
      if (src && !sourceId) setSourceId(src.id);
      if (src) {
        setName((prev) => (prev === '' ? `Salinan ${src.name}` : prev));
        projectApi
          .listProjectMembers(src.id)
          .then((ms) => setSourceMemberIds(ms.map((m) => m.userId)))
          .catch(() => setSourceMemberIds([]));
      }
    } else {
      setSourceMemberIds([]);
    }
  }, [mode, sourceId, projects]);

  // Centang awal: anggota project sumber (duplikat) atau semua (baru).
  useEffect(() => {
    if (mode === 'duplikat') {
      if (sourceMemberIds.length > 0) {
        setChecked(Object.fromEntries(sourceMemberIds.map((id) => [id, true])));
      }
    } else {
      setChecked(Object.fromEntries(members.map((m) => [m.userId, true])));
    }
  }, [mode, sourceMemberIds, members]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const seen = new Set<string>();
    return members.filter((m) => {
      if (seen.has(m.userId)) return false;
      seen.add(m.userId);
      if (!q) return true;
      return (
        (m.name ?? '').toLowerCase().includes(q) || (m.email ?? '').toLowerCase().includes(q)
      );
    });
  }, [members, query]);

  const filteredIds = filtered.map((m) => m.userId);
  const allFilteredChecked = filteredIds.length > 0 && filteredIds.every((id) => checked[id]);

  function toggleAll(on: boolean) {
    setChecked((prev) => {
      const next = { ...prev };
      for (const id of filteredIds) {
        if (on) next[id] = true;
        else delete next[id];
      }
      return next;
    });
  }

  const selectedIds = useMemo(() => members.map((m) => m.userId).filter((id) => checked[id]), [members, checked]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    if (mode === 'duplikat' && !sourceId) {
      showToast('Pilih project sumber dulu.');
      return;
    }
    setCreating(true);
    try {
      const created = await teamApi.createProject(teamId, {
        name: trimmed,
        description: description.trim() || undefined,
        ...(mode === 'duplikat' ? { sourceProjectId: sourceId } : {}),
        memberUserIds: selectedIds,
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
          <p className="mt-0.5 font-givonic text-xs text-perrific-graphite/50">
            Kosong atau duplikat struktur project lain (tanpa task).
          </p>
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
        <div className="flex gap-1 rounded-full border border-gray-200 bg-gray-50 p-1" role="radiogroup" aria-label="Jenis project">
          {(
            [
              { id: 'baru', label: 'Project baru' },
              { id: 'duplikat', label: 'Duplikat project' },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={mode === o.id}
              onClick={() => setMode(o.id)}
              className={`flex-1 rounded-full px-3 py-1.5 font-givonic text-xs font-semibold transition ${
                mode === o.id ? 'bg-perrific-graphite text-white' : 'text-gray-500 hover:text-perrific-graphite'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        {mode === 'duplikat' && (
          <div>
            <label htmlFor="cpm-source" className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite">
              Project sumber
            </label>
            <select
              id="cpm-source"
              value={sourceId}
              onChange={(e) => {
                setSourceId(e.target.value);
                setName('');
                setChecked({});
              }}
              className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm focus:border-perrific-violet focus:outline-none"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <p className="mt-1 font-givonic text-[11px] text-gray-400">
              Menyalin kolom, role, dan jabatan anggota. Task tidak ikut.
            </p>
          </div>
        )}

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

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="font-givonic text-xs font-medium text-perrific-graphite">
              Anggota <span className="font-normal text-gray-400">({selectedIds.length} dipilih)</span>
            </p>
            <label className="flex cursor-pointer items-center gap-1.5 font-givonic text-xs font-semibold text-perrific-violet">
              <input
                type="checkbox"
                checked={allFilteredChecked}
                onChange={(e) => toggleAll(e.target.checked)}
                aria-label="Pilih semua anggota"
                className="h-4 w-4 accent-perrific-violet"
              />
              Pilih semua
            </label>
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari anggota…"
            aria-label="Cari anggota"
            className="mb-1.5 w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2 font-givonic text-xs placeholder:text-gray-400 focus:border-perrific-violet focus:outline-none"
          />
          <div className="nice-scroll max-h-44 overflow-y-auto rounded-[10px] border border-perrific-line">
            {filtered.length === 0 ? (
              <p className="px-3 py-3 font-givonic text-xs text-gray-400">Tidak ditemukan.</p>
            ) : (
              filtered.map((m) => (
                <label
                  key={m.userId}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={!!checked[m.userId]}
                    onChange={(e) =>
                      setChecked((prev) => {
                        const next = { ...prev };
                        if (e.target.checked) next[m.userId] = true;
                        else delete next[m.userId];
                        return next;
                      })
                    }
                    aria-label={m.name ?? m.email ?? m.userId}
                    className="h-4 w-4 shrink-0 accent-perrific-violet"
                  />
                  <Avatar src={m.avatarUrl ?? undefined} name={m.name ?? '?'} size={24} alt={m.name ?? 'anggota'} className="h-6 w-6 shrink-0 text-[10px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-givonic text-xs font-semibold text-perrific-graphite">
                      {m.name ?? m.email ?? m.userId}
                    </span>
                    {m.name && m.email && (
                      <span className="block truncate font-givonic text-[11px] text-gray-400">{m.email}</span>
                    )}
                  </span>
                </label>
              ))
            )}
          </div>
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
            {creating ? 'Membuat…' : mode === 'duplikat' ? 'Duplikat project' : 'Buat project'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
