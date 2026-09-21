import { useCallback, useEffect, useState } from 'react';
import { projectApi } from '@/api/projects';
import { SettingsBlock } from '@/components/ui/SettingsShell';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ModalShell from '@/components/ui/ModalShell';
import Avatar from '@/components/ui/Avatar';
import { showToast } from '@/components/ui/Toast';
import { PERMISSION_META, type ProjectMember, type ProjectRole } from '@/types';

// Tab Role khusus admin: role custom per project (Approver, Front, Back,
// Design, buatan sendiri), centang permission, dan atur jabatan anggota.
export default function RoleTab({ projectId }: { projectId: string }) {
  const [roles, setRoles] = useState<ProjectRole[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ProjectRole | null>(null);
  const [moveTarget, setMoveTarget] = useState<ProjectRole | null>(null);
  const [targetId, setTargetId] = useState('');
  // Kartu role yang sedang dibuka (dropdown permission).
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [r, m] = await Promise.all([
        projectApi.listRoles(projectId),
        projectApi.listProjectMembers(projectId),
      ]);
      setRoles(r);
      setMembers(m);
    } catch {
      showToast('Gagal memuat role.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const created = await projectApi.createRole(projectId, { name });
      setRoles((prev) => [...prev, created]);
      setNewName('');
    } catch {
      showToast('Gagal menambah role. Nama mungkin sudah dipakai.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRename(role: ProjectRole) {
    const name = editDraft.trim();
    if (!name || name === role.name) {
      setEditingId(null);
      return;
    }
    setBusy(true);
    try {
      const updated = await projectApi.updateRole(projectId, role.id, { name });
      setRoles((prev) => prev.map((r) => (r.id === role.id ? updated : r)));
      setEditingId(null);
    } catch {
      showToast('Gagal mengubah nama role.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePermission(role: ProjectRole, key: string, on: boolean) {
    const permissions = on
      ? [...role.permissions, key]
      : role.permissions.filter((p) => p !== key);
    const prev = roles;
    setRoles((rs) => rs.map((r) => (r.id === role.id ? { ...r, permissions: permissions as ProjectRole['permissions'] } : r)));
    try {
      const updated = await projectApi.updateRole(projectId, role.id, { permissions });
      setRoles((rs) => rs.map((r) => (r.id === role.id ? updated : r)));
    } catch {
      setRoles(prev);
      showToast('Gagal menyimpan permission.');
    }
  }

  function askDelete(role: ProjectRole) {
    const assigned = members.filter((m) => m.roleId === role.id).length;
    if (assigned > 0) {
      const others = roles.filter((r) => r.id !== role.id);
      setTargetId(others[0]?.id ?? '');
      setMoveTarget(role);
    } else {
      setConfirmDelete(role);
    }
  }

  async function confirmDeleteMove() {
    if (!moveTarget || !targetId) return;
    setBusy(true);
    try {
      const res = await projectApi.deleteRole(projectId, moveTarget.id, targetId);
      setRoles((prev) => prev.filter((r) => r.id !== moveTarget.id));
      setMembers((prev) => {
        const target = roles.find((r) => r.id === targetId);
        return prev.map((m) =>
          m.roleId === moveTarget.id && target ? { ...m, roleId: target.id, role: target } : m,
        );
      });
      setMoveTarget(null);
      showToast(`${res.movedCount} anggota dipindahkan.`);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        'Gagal menghapus role.';
      showToast(msg);
    } finally {
      setBusy(false);
    }
  }

  async function handleSetRole(member: ProjectMember, roleId: string) {
    if (roleId === member.roleId) return;
    try {
      const updated = await projectApi.setMemberRole(projectId, member.userId, roleId);
      setMembers((prev) => prev.map((m) => (m.id === member.id ? updated : m)));
      showToast('Jabatan diperbarui.');
    } catch {
      showToast('Gagal memperbarui jabatan.');
    }
  }

  if (loading) return <p className="font-givonic text-sm text-gray-500">Memuat role…</p>;

  return (
    <div className="space-y-5">
      <SettingsBlock title="Role project" desc="Approver, divisi, dan custom — centang izinnya">
        <ul className="space-y-3">
          {roles.map((r) => {
            const open = !!expanded[r.id];
            const permCount = r.system === 'ADMIN' ? PERMISSION_META.length : r.permissions.length;
            return (
            <li key={r.id} className="overflow-hidden rounded-[10px] border border-perrific-line">
              <div className="flex items-center gap-2 bg-gray-50 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleExpand(r.id)}
                  aria-expanded={open}
                  aria-label={`${open ? 'Tutup' : 'Buka'} permission ${r.name}`}
                  title={`${open ? 'Tutup' : 'Lihat'} permission`}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-200 hover:text-perrific-graphite"
                >
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true" className={`transition-transform duration-200 ${open ? '' : '-rotate-90'}`}>
                    <path d="M4.5 6.5L8 10l3.5-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div className="min-w-0 flex-1">
                  {editingId === r.id ? (
                    <input
                      autoFocus
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      onBlur={() => void handleRename(r)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void handleRename(r);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      maxLength={30}
                      aria-label="Nama role"
                      className="w-full rounded-md border border-perrific-violet/40 px-2 py-1 font-givonic text-sm font-semibold focus:outline-none"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (r.system) {
                          toggleExpand(r.id);
                          return;
                        }
                        setEditingId(r.id);
                        setEditDraft(r.name);
                      }}
                      title={r.system ? 'Klik untuk buka/tutup permission' : 'Ubah nama (klik chevron untuk permission)'}
                      className="block w-full truncate text-left font-givonic text-sm font-semibold text-perrific-graphite hover:underline"
                    >
                      {r.name}
                      {r.system && (
                        <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 font-givonic text-[10px] font-bold text-gray-500">
                          BAWAAN
                        </span>
                      )}
                    </button>
                  )}
                  <p className="font-givonic text-xs text-gray-400">
                    {members.filter((m) => m.roleId === r.id).length} anggota · {permCount} izin
                  </p>
                </div>
                {!r.system && (
                  <button
                    type="button"
                    onClick={() => askDelete(r)}
                    aria-label={`Hapus role ${r.name}`}
                    className="shrink-0 rounded-lg px-2 py-1 font-givonic text-xs font-semibold text-red-600 transition hover:bg-red-50"
                  >
                    Hapus
                  </button>
                )}
              </div>
              {open && (
              <div className="grid gap-1 p-2 sm:grid-cols-2">
                {PERMISSION_META.map((p) => {
                  const locked = r.system === 'ADMIN';
                  const checked = locked || r.permissions.includes(p.key);
                  return (
                    <label
                      key={p.key}
                      title={locked ? 'Admin selalu punya semua izin' : p.desc}
                      className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 transition ${locked ? 'opacity-60' : 'hover:bg-gray-50'}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={locked}
                        onChange={(e) => void togglePermission(r, p.key, e.target.checked)}
                        className="mt-0.5 h-4 w-4 shrink-0 accent-perrific-violet"
                        aria-label={`${p.label} untuk ${r.name}`}
                      />
                      <span>
                        <span className="block font-givonic text-xs font-semibold text-perrific-graphite">{p.label}</span>
                        <span className="block font-givonic text-[11px] text-gray-400">{p.desc}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              )}
            </li>
            );
          })}
        </ul>
        <form onSubmit={handleCreate} className="mt-3 flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nama role baru (mis. QA)"
            maxLength={30}
            className="min-w-0 flex-1 rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm text-perrific-graphite placeholder:text-perrific-graphite/40 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="shrink-0 rounded-full bg-perrific-violet px-5 py-2.5 font-givonic text-sm font-semibold text-white transition hover:bg-[#E64D0A] disabled:opacity-50"
          >
            {creating ? 'Menambah…' : 'Tambah'}
          </button>
        </form>
      </SettingsBlock>

      <SettingsBlock title="Jabatan anggota" desc="Satu user satu role per project">
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-[10px] border border-perrific-line">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-3 py-2.5">
              <Avatar src={m.user?.avatarUrl ?? undefined} name={m.user?.name ?? '?'} size={32} alt={m.user?.name ?? 'anggota'} className="h-8 w-8 text-xs" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-givonic text-sm font-semibold text-perrific-graphite">{m.user?.name}</p>
                <p className="truncate font-givonic text-xs text-gray-500">{m.user?.email}</p>
              </div>
              <select
                value={m.roleId}
                onChange={(e) => void handleSetRole(m, e.target.value)}
                aria-label={`Role ${m.user?.name}`}
                className="shrink-0 rounded-lg border border-perrific-line bg-white px-2 py-1.5 font-givonic text-xs font-semibold text-perrific-graphite focus:border-perrific-violet focus:outline-none"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </SettingsBlock>

      <ConfirmModal
        open={confirmDelete !== null}
        title="Hapus role?"
        message={`"${confirmDelete?.name}" tidak dipakai siapa pun dan akan dihapus permanen.`}
        confirmLabel="Hapus"
        busy={busy}
        onCancel={() => !busy && setConfirmDelete(null)}
        onConfirm={() => {
          if (!confirmDelete) return;
          setBusy(true);
          projectApi
            .deleteRole(projectId, confirmDelete.id)
            .then(() => {
              setRoles((prev) => prev.filter((r) => r.id !== confirmDelete.id));
              setConfirmDelete(null);
            })
            .catch(() => showToast('Gagal menghapus role.'))
            .finally(() => setBusy(false));
        }}
      />
      {moveTarget && (
        <ModalShell label="Pindahkan anggota" onClose={() => !busy && setMoveTarget(null)}>
          <div className="p-6">
            <h2 className="font-givonic text-base font-extrabold text-perrific-graphite">Role dipakai anggota</h2>
            <p className="mt-1 font-givonic text-sm leading-relaxed text-perrific-graphite/60">
              “{moveTarget.name}” dipakai {members.filter((m) => m.roleId === moveTarget.id).length} anggota. Pilih
              role pengganti sebelum menghapus.
            </p>
            <label htmlFor="role-target" className="mt-4 block font-givonic text-xs font-semibold text-perrific-graphite">
              Pindahkan ke
            </label>
            <select
              id="role-target"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="mt-1.5 w-full rounded-[10px] border border-perrific-line bg-white px-3 py-2.5 font-givonic text-sm focus:border-perrific-violet focus:outline-none"
            >
              {roles
                .filter((r) => r.id !== moveTarget.id)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMoveTarget(null)}
                disabled={busy}
                className="rounded-full px-4 py-2 font-givonic text-sm font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => void confirmDeleteMove()}
                disabled={busy || !targetId}
                className="rounded-full bg-red-600 px-4 py-2 font-givonic text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {busy ? 'Memindahkan…' : 'Pindahkan & hapus'}
              </button>
            </div>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
