import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { teamApi } from '@/api/teams';
import { projectApi } from '@/api/projects';
import ConfirmModal from '@/components/ui/ConfirmModal';
import CreateProjectModal from '@/components/project/CreateProjectModal';
import { PROJECT_UPDATED_EVENT } from '@/pages/ProjectSettingsPage';
import { useAuth } from '@/store/auth';
import type { Project, Team } from '@/types';

export default function TeamProjectsPage() {
  const { teamId } = useParams<{ teamId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [team, setTeam] = useState<Team | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, { name: string; description: string; status: Project['status'] }>>({});
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; mode: 'rename' | 'full' } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh(tid: string) {
    const [t, ps] = await Promise.all([teamApi.getTeam(tid), teamApi.listProjects(tid)]);
    setTeam(t);
    setProjects(ps);
    setDrafts(Object.fromEntries(ps.map((p) => [p.id, { name: p.name, description: p.description ?? '', status: p.status }])));
  }

  useEffect(() => {
    if (!teamId) return;
    setLoading(true);
    refresh(teamId).finally(() => setLoading(false));
  }, [teamId]);

  useEffect(() => {
    const onUpdated = (e: Event) => {
      const updated = (e as CustomEvent<Project>).detail;
      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setDrafts((prev) => ({
        ...prev,
        [updated.id]: { name: updated.name, description: updated.description ?? '', status: updated.status },
      }));
    };
    window.addEventListener(PROJECT_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROJECT_UPDATED_EVENT, onUpdated);
  }, []);

  async function handleCreated() {
    if (!teamId) return;
    setCreateOpen(false);
    await refresh(teamId);
  }

  async function handleSave(p: Project) {
    const d = drafts[p.id];
    if (!d) return;
    setSavingId(p.id);
    try {
      const updated = await projectApi.updateProject(p.id, {
        ...(d.name.trim() !== '' && d.name.trim() !== p.name ? { name: d.name.trim() } : {}),
        ...(d.description.trim() !== (p.description ?? '') ? { description: d.description.trim() || null } : {}),
        ...(d.status !== p.status ? { status: d.status } : {}),
      });
      setProjects((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      setDrafts((prev) => ({ ...prev, [p.id]: { name: updated.name, description: updated.description ?? '', status: updated.status } }));
      setEditing(null);
    } finally {
      setSavingId(null);
    }
  }

  async function handleDelete() {
    if (!deleteTarget || !teamId) return;
    setDeleting(true);
    try {
      await projectApi.removeProject(deleteTarget.id);
      setDeleteTarget(null);
      await refresh(teamId);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <p className="text-gray-500">Memuat…</p>;
  if (!team) return <p className="text-gray-500">Tim tidak ditemukan.</p>;

  const isAdmin = team.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link
        to={`/team/${team.id}`}
        className="inline-block font-givonic text-xs font-semibold text-perrific-violet hover:underline"
      >
        ← Kembali ke board
      </Link>
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
        <p className="mt-0.5 text-sm text-gray-500">{team.name}</p>
      </div>

      <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white p-3">
        <p className="font-givonic text-sm text-perrific-graphite/60">
          {projects.length} projects · {projects.filter((p) => p.status === 'ACTIVE').length} aktif
        </p>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            aria-haspopup="dialog"
            className="shrink-0 rounded-full bg-perrific-violet px-4 py-2 font-givonic text-xs font-semibold text-white transition hover:brightness-110"
          >
            + Project baru
          </button>
        )}
      </div>

      <div className="space-y-2">
        {projects.length === 0 && <p className="text-sm text-gray-400">Belum ada project di tim ini.</p>}
        {projects.map((p) => {
          const d = drafts[p.id] ?? { name: p.name, description: p.description ?? '', status: p.status };
          const dirty =
            (d.name.trim() !== '' && d.name.trim() !== p.name) ||
            d.description.trim() !== (p.description ?? '') ||
            d.status !== p.status;
          const menuOpen = openMenuId === p.id;
          const editMode = editing?.id === p.id ? editing.mode : null;
          return (
            <div key={p.id} className="relative rounded-xl border border-gray-200 bg-white p-3">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/projects/${p.id}`)}
                  className="block min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-givonic text-sm font-bold text-perrific-graphite hover:text-perrific-violet">
                    {p.name}
                  </p>
                  {p.description && (
                    <p className="mt-0.5 truncate font-givonic text-xs text-perrific-graphite/50">{p.description}</p>
                  )}
                <p className="mt-1.5 font-mono text-[11px] text-perrific-graphite/50">
                  {p.status === 'ARCHIVED' ? 'Arsip' : 'Aktif'}
                </p>
                </button>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setOpenMenuId(menuOpen ? null : p.id)}
                    title="Opsi project"
                    aria-label={`Opsi ${p.name}`}
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <circle cx="8" cy="3" r="1.3" fill="currentColor" />
                      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
                      <circle cx="8" cy="13" r="1.3" fill="currentColor" />
                    </svg>
                  </button>
                )}
              </div>
              {isAdmin && menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} aria-hidden="true" />
                  <div role="menu" aria-label={`Opsi ${p.name}`} className="absolute right-2 top-10 z-20 min-w-[160px] rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)]">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEditing({ id: p.id, mode: 'rename' });
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center px-3 py-2 font-givonic text-sm text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      Rename
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setEditing({ id: p.id, mode: 'full' });
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center px-3 py-2 font-givonic text-sm text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setDeleteTarget(p);
                        setOpenMenuId(null);
                      }}
                      className="flex w-full items-center px-3 py-2 font-givonic text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      Hapus
                    </button>
                  </div>
                </>
              )}
              {isAdmin && editMode && (
                <div className="mt-2 border-t border-gray-100 pt-2">
                  <div className="space-y-2">
                    <input
                      value={d.name}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: { ...d, name: e.target.value } }))}
                      maxLength={60}
                      aria-label={`Nama ${p.name}`}
                      autoFocus={editMode === 'rename'}
                      className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-givonic text-sm focus:border-perrific-violet focus:outline-none"
                    />
                    {editMode === 'full' && (
                      <>
                        <input
                          value={d.description}
                          onChange={(e) => setDrafts((prev) => ({ ...prev, [p.id]: { ...d, description: e.target.value } }))}
                          maxLength={500}
                          placeholder="Deskripsi (opsional)"
                          aria-label="Deskripsi project"
                          className="w-full rounded-lg border border-gray-200 px-2.5 py-1.5 font-givonic text-sm focus:border-perrific-violet focus:outline-none"
                        />
                        <select
                          value={d.status}
                          onChange={(e) =>
                            setDrafts((prev) => ({ ...prev, [p.id]: { ...d, status: e.target.value as Project['status'] } }))
                          }
                          aria-label="Status project"
                          className="w-full rounded-lg border border-gray-200 bg-white px-2 py-1.5 font-givonic text-xs focus:border-perrific-violet focus:outline-none"
                        >
                          <option value="ACTIVE">Aktif</option>
                          <option value="ARCHIVED">Arsip</option>
                        </select>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditing(null)}
                      className="rounded-full px-3 py-1.5 font-givonic text-xs font-semibold text-gray-600 transition hover:bg-gray-100"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      disabled={!dirty || savingId === p.id}
                      onClick={() => void handleSave(p)}
                      className="rounded-full bg-perrific-graphite px-3 py-1.5 font-givonic text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-40"
                    >
                      {savingId === p.id ? 'Menyimpan…' : 'Simpan'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <ConfirmModal
        open={deleteTarget !== null}
        title="Hapus project?"
        message={`"${deleteTarget?.name}" dan semua task di dalamnya ikut terhapus. Lanjutkan?`}
        confirmLabel="Hapus"
        busy={deleting}
        onCancel={() => !deleting && setDeleteTarget(null)}
        onConfirm={() => void handleDelete()}
      />

      {createOpen && teamId && (
        <CreateProjectModal
          teamId={teamId}
          onClose={() => setCreateOpen(false)}
          onCreated={() => void handleCreated()}
        />
      )}
    </div>
  );
}
