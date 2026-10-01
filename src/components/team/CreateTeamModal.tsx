import { useEffect, useMemo, useRef, useState } from 'react';
import { teamApi } from '@/api/teams';
import { fileToAvatarDataUrl } from '@/lib/avatar';
import ModalShell from '@/components/ui/ModalShell';
import Avatar from '@/components/ui/Avatar';
import { showToast } from '@/components/ui/Toast';
import { X, Camera } from 'lucide-react';
import type { Team } from '@/types';

interface CrossTeamMember {
  userId: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  teams: { id: string; name: string }[];
}

export default function CreateTeamModal({
  existingTeams,
  currentUserId,
  onBack,
  onClose,
  onCreated,
}: {
  existingTeams: Team[];
  currentUserId?: string;
  onBack?: () => void;
  onClose: () => void;
  onCreated: (team: Team) => void;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [teamFilter, setTeamFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Kumpulkan seluruh anggota unik (selain diri sendiri) dari tim-tim yang ada
  const { allMembers, teamsWithMembers } = useMemo(() => {
    const memberMap = new Map<string, CrossTeamMember>();
    const teamCounts: { id: string; name: string; avatarUrl?: string | null; count: number }[] = [];

    for (const t of existingTeams) {
      let otherCount = 0;
      for (const m of t.members ?? []) {
        if (!m.userId || m.userId === currentUserId) continue;
        otherCount += 1;
        const existing = memberMap.get(m.userId);
        if (existing) {
          if (!existing.teams.some((et) => et.id === t.id)) {
            existing.teams.push({ id: t.id, name: t.name });
          }
          if (!existing.name && m.user?.name) existing.name = m.user.name;
          if (!existing.email && m.user?.email) existing.email = m.user.email;
          if (!existing.avatarUrl && m.user?.avatarUrl) existing.avatarUrl = m.user.avatarUrl;
        } else {
          memberMap.set(m.userId, {
            userId: m.userId,
            name: m.user?.name ?? 'Anggota',
            email: m.user?.email ?? '',
            avatarUrl: m.user?.avatarUrl ?? null,
            teams: [{ id: t.id, name: t.name }],
          });
        }
      }
      if (otherCount > 0) {
        teamCounts.push({ id: t.id, name: t.name, avatarUrl: t.avatarUrl, count: otherCount });
      }
    }

    return {
      allMembers: Array.from(memberMap.values()),
      teamsWithMembers: teamCounts,
    };
  }, [existingTeams, currentUserId]);

  const filteredMembers = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allMembers.filter((m) => {
      if (teamFilter !== 'ALL' && !m.teams.some((t) => t.id === teamFilter)) {
        return false;
      }
      if (!q) return true;
      const matchName = m.name.toLowerCase().includes(q);
      const matchEmail = m.email.toLowerCase().includes(q);
      const matchTeam = m.teams.some((t) => t.name.toLowerCase().includes(q));
      return matchName || matchEmail || matchTeam;
    });
  }, [allMembers, teamFilter, query]);

  const filteredIds = useMemo(() => filteredMembers.map((m) => m.userId), [filteredMembers]);
  const allFilteredChecked =
    filteredIds.length > 0 && filteredIds.every((id) => Boolean(checked[id]));

  function toggleAllFiltered(on: boolean) {
    setChecked((prev) => {
      const next = { ...prev };
      for (const id of filteredIds) {
        if (on) next[id] = true;
        else delete next[id];
      }
      return next;
    });
  }

  const selectedIds = useMemo(
    () => allMembers.map((m) => m.userId).filter((id) => Boolean(checked[id])),
    [allMembers, checked],
  );

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Pilih file gambar (PNG, JPG, atau WebP).');
      return;
    }
    setUploadingAvatar(true);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      setAvatarUrl(dataUrl);
    } catch {
      showToast('Gagal memuat gambar. Coba gambar lain.');
    } finally {
      setUploadingAvatar(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || creating) return;
    setCreating(true);
    setError(null);
    try {
      const created = await teamApi.createTeam({
        name: trimmed,
        description: description.trim() || undefined,
        avatarUrl: avatarUrl ?? undefined,
        memberUserIds: selectedIds.length > 0 ? selectedIds : undefined,
      });
      onCreated(created);
    } catch (err: unknown) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal membuat tim. Coba lagi.',
      );
    } finally {
      setCreating(false);
    }
  }

  const trimmedInitial = name.trim().slice(0, 2).toUpperCase();

  return (
    <ModalShell label="Buat tim baru" onClose={() => !creating && onClose()} maxWidthClass="max-w-md">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              disabled={creating}
              className="mb-1 inline-flex items-center gap-1 font-givonic text-xs font-semibold text-perrific-violet hover:underline disabled:opacity-50"
            >
              ← Kembali
            </button>
          )}
          <h2 className="font-givonic text-base font-extrabold text-perrific-graphite">
            Buat tim baru
          </h2>
          <p className="mt-0.5 font-givonic text-xs text-perrific-graphite/50">
            Atur identitas tim dan tambahkan rekan dari tim lain.
          </p>
        </div>
        <button
          type="button"
          onClick={() => !creating && onClose()}
          title="Tutup"
          aria-label="Tutup"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-perrific-graphite/60 transition hover:bg-gray-100 hover:text-perrific-graphite cursor-pointer"
        >
          <X size={15} strokeWidth={1.6} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
        {/* Baris Foto Tim (di samping kiri) + Nama Tim (di samping kanan) */}
        <div>
          <label
            htmlFor="ctm-name"
            className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite"
          >
            Foto &amp; Nama Tim
          </label>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <div className="relative shrink-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || creating}
                title={avatarUrl ? 'Ganti foto tim (opsional)' : 'Unggah foto tim (opsional)'}
                aria-label="Unggah foto tim"
                className={`group relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border transition cursor-pointer ${
                  avatarUrl
                    ? 'border-gray-200 bg-white shadow-2xs'
                    : trimmedInitial
                      ? 'border-perrific-violet/20 bg-perrific-violet/10 hover:border-perrific-violet'
                      : 'border-dashed border-gray-300 bg-gray-50 hover:border-perrific-violet hover:bg-perrific-violet/5'
                }`}
              >
                {avatarUrl ? (
                  <>
                    <img
                      src={avatarUrl}
                      alt="Preview foto tim"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition group-hover:opacity-100">
                      <Camera size={14} strokeWidth={1.6} className="text-white" />
                    </span>
                  </>
                ) : trimmedInitial ? (
                  <>
                    <span className="font-givonic text-xs font-bold text-perrific-violet">
                      {trimmedInitial}
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center bg-perrific-violet/90 text-white opacity-0 transition group-hover:opacity-100">
                      <Camera size={14} strokeWidth={1.6} />
                    </span>
                  </>
                ) : (
                  <span className="flex flex-col items-center justify-center text-gray-400 transition group-hover:text-perrific-violet">
                    <Camera size={16} strokeWidth={1.5} />
                  </span>
                )}
              </button>
              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  title="Hapus foto tim"
                  aria-label="Hapus foto tim"
                  className="absolute -right-1.5 -top-1.5 flex h-4.5 w-4.5 items-center justify-center rounded-full bg-gray-800 text-white shadow-xs transition hover:bg-red-600 cursor-pointer"
                >
                  <X size={8} strokeWidth={2.2} />
                </button>
              )}
            </div>

            <input
              id="ctm-name"
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="cth. Tim Produk & Desain"
              maxLength={60}
              className="h-11 min-w-0 flex-1 rounded-[10px] border border-perrific-line bg-white px-3.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
            />
          </div>
          <p className="mt-1 font-givonic text-[11px] text-gray-400">
            Klik kotak di kiri untuk mengunggah foto tim (opsional).
          </p>
        </div>

        {/* Deskripsi Tim (opsional) */}
        <div>
          <label
            htmlFor="ctm-desc"
            className="mb-1.5 block font-givonic text-xs font-medium text-perrific-graphite"
          >
            Deskripsi <span className="font-normal text-perrific-graphite/40">(opsional)</span>
          </label>
          <input
            id="ctm-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Deskripsi singkat tim"
            maxLength={500}
            className="w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
          />
        </div>

        {/* Pemilih Anggota dari Tim Lain */}
        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <p className="font-givonic text-xs font-medium text-perrific-graphite">
              Tambah anggota dari tim lain{' '}
              <span className="font-normal text-gray-400">
                ({selectedIds.length} dipilih)
              </span>
            </p>
            {filteredIds.length > 0 && (
              <label className="flex cursor-pointer items-center gap-1.5 font-givonic text-xs font-semibold text-perrific-violet">
                <input
                  type="checkbox"
                  checked={allFilteredChecked}
                  onChange={(e) => toggleAllFiltered(e.target.checked)}
                  aria-label="Pilih semua anggota"
                  className="h-4 w-4 accent-perrific-violet"
                />
                Pilih semua
              </label>
            )}
          </div>

          {allMembers.length === 0 ? (
            <div className="rounded-[10px] border border-dashed border-gray-200 bg-gray-50/70 px-3 py-3.5 text-center">
              <p className="font-givonic text-xs text-gray-500">
                Belum ada anggota dari tim lain.
              </p>
              <p className="mt-0.5 font-givonic text-[11px] text-gray-400">
                Kamu bisa mengundang anggota lewat kode tim atau email setelah tim dibuat.
              </p>
            </div>
          ) : (
            <>
              {/* Deretan Chip Filter Tim */}
              {teamsWithMembers.length > 0 && (
                <div
                  className="nice-scroll mb-2 flex items-center gap-1.5 overflow-x-auto pb-1"
                  role="tablist"
                  aria-label="Filter berdasarkan tim asal"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={teamFilter === 'ALL'}
                    onClick={() => setTeamFilter('ALL')}
                    className={`shrink-0 rounded-full px-2.5 py-1 font-givonic text-[11px] font-semibold transition cursor-pointer ${
                      teamFilter === 'ALL'
                        ? 'bg-perrific-graphite text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-perrific-graphite'
                    }`}
                  >
                    Semua · {allMembers.length}
                  </button>
                  {teamsWithMembers.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      role="tab"
                      aria-selected={teamFilter === t.id}
                      onClick={() => setTeamFilter(t.id)}
                      className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-givonic text-[11px] font-semibold transition cursor-pointer ${
                        teamFilter === t.id
                          ? 'bg-perrific-violet text-white'
                          : 'bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-perrific-graphite'
                      }`}
                    >
                      <span className="max-w-[120px] truncate">{t.name}</span>
                      <span
                        className={
                          teamFilter === t.id ? 'text-white/80' : 'text-gray-400'
                        }
                      >
                        · {t.count}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {/* Pencarian Anggota */}
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari nama, email, atau tim asal…"
                aria-label="Cari anggota"
                className="mb-1.5 w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2 font-givonic text-xs placeholder:text-gray-400 focus:border-perrific-violet focus:outline-none"
              />

              {/* Daftar Anggota Gabungan dengan Badge Tim Asal */}
              <div className="nice-scroll max-h-44 divide-y divide-gray-100 overflow-y-auto rounded-[10px] border border-perrific-line bg-white">
                {filteredMembers.length === 0 ? (
                  <p className="px-3 py-3 text-center font-givonic text-xs text-gray-400">
                    Tidak ada anggota yang cocok.
                  </p>
                ) : (
                  filteredMembers.map((m) => {
                    const primaryTeam =
                      teamFilter !== 'ALL'
                        ? m.teams.find((t) => t.id === teamFilter) ?? m.teams[0]
                        : m.teams[0];
                    const extraCount = m.teams.length - 1;

                    return (
                      <label
                        key={m.userId}
                        className="flex cursor-pointer items-center gap-2.5 px-3 py-2 transition hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(checked[m.userId])}
                          onChange={(e) =>
                            setChecked((prev) => {
                              const next = { ...prev };
                              if (e.target.checked) next[m.userId] = true;
                              else delete next[m.userId];
                              return next;
                            })
                          }
                          aria-label={m.name || m.email || m.userId}
                          className="h-4 w-4 shrink-0 accent-perrific-violet"
                        />
                        <Avatar
                          src={m.avatarUrl ?? undefined}
                          name={m.name || '?'}
                          size={26}
                          alt={m.name || 'anggota'}
                          className="h-6.5 w-6.5 shrink-0 text-[10px]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-givonic text-xs font-semibold text-perrific-graphite">
                            {m.name || m.email}
                          </span>
                          {m.email && (
                            <span className="block truncate font-givonic text-[11px] text-gray-400">
                              {m.email}
                            </span>
                          )}
                        </span>
                        {primaryTeam && (
                          <span
                            title={m.teams.map((t) => t.name).join(', ')}
                            className="flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 font-givonic text-[10px] font-medium text-gray-600"
                          >
                            <span className="max-w-[90px] truncate">{primaryTeam.name}</span>
                            {extraCount > 0 && (
                              <span className="font-bold text-perrific-violet">+{extraCount}</span>
                            )}
                          </span>
                        )}
                      </label>
                    );
                  })
                )}
              </div>
            </>
          )}
        </div>

        {error && (
          <p role="alert" className="font-givonic text-xs text-red-600">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={() => !creating && onClose()}
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
            {creating ? 'Membuat…' : 'Buat tim'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}
