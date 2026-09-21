import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';
import ApprovalLists from '@/components/team/ApprovalLists';
import { useAuth } from '@/store/auth';
import type { Project } from '@/types';

export default function ProjectPersetujuanPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    projectApi
      .getProject(projectId)
      .then(async (p) => {
        setProject(p);
        const team = await teamApi.getTeam(p.teamId).catch(() => null);
        setIsAdmin(team?.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false);
      })
      .catch(() => {
        setProject(null);
        setIsAdmin(false);
      })
      .finally(() => setLoading(false));
  }, [projectId, user?.id]);

  if (loading) return <p className="text-gray-500">Memuat…</p>;
  if (!project) return <p className="text-gray-500">Project tidak ditemukan.</p>;
  if (!isAdmin) return <p className="text-gray-500">Hanya admin tim yang bisa membuka halaman ini.</p>;

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Persetujuan</h1>
        <p className="mt-0.5 text-sm text-gray-500">Usulan task di {project.name} dan permintaan anggota tim</p>
      </div>
      <ApprovalLists teamId={project.teamId} projectId={project.id} />
    </div>
  );
}
