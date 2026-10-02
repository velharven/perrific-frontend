import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';
import ApprovalLists, { type ApprovalTab } from '@/components/team/ApprovalLists';
import { PROJECT_SIDEBAR_EVENT, isProjectSidebarCollapsed } from '@/components/layout/ProjectLayout';
import { useAuth } from '@/store/auth';
import { ListCardsSkeleton } from '@/components/ui/loading';
import type { Project } from '@/types';

export default function ProjectApprovalPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ApprovalTab>('task');
  const [taskCount, setTaskCount] = useState(0);
  const [requestCount, setRequestCount] = useState(0);
  // Offset pill fixed agar center ke area konten (di luar sidebar project).
  const [sbCollapsed, setSbCollapsed] = useState<boolean>(isProjectSidebarCollapsed);

  useEffect(() => {
    const sync = () => setSbCollapsed(isProjectSidebarCollapsed());
    window.addEventListener(PROJECT_SIDEBAR_EVENT, sync);
    return () => window.removeEventListener(PROJECT_SIDEBAR_EVENT, sync);
  }, []);

  const handleCounts = useCallback(({ taskCount, requestCount }: { taskCount: number; requestCount: number }) => {
    setTaskCount(taskCount);
    setRequestCount(requestCount);
  }, []);

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

  if (loading) return <ListCardsSkeleton />;
  if (!project) return <p className="text-gray-500">Project tidak ditemukan.</p>;
  if (!isAdmin) return <p className="text-gray-500">Hanya admin tim yang bisa membuka halaman ini.</p>;

  return (
    <div className="flex min-h-full w-full flex-col space-y-5 pb-20">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Persetujuan</h1>
        <p className="mt-0.5 text-sm text-gray-500">Usulan task di {project.name} dan permintaan anggota tim</p>
      </div>
      <ApprovalLists
        teamId={project.teamId}
        projectId={project.id}
        activeTab={activeTab}
        onCountsChange={handleCounts}
      />
      <div
        className={`pointer-events-none fixed inset-x-0 bottom-4 z-30 flex justify-center transition-[left] duration-200 ${
          sbCollapsed ? 'md:left-0' : 'md:left-56'
        }`}
      >
        <div
          className="pointer-events-auto nice-scroll flex max-w-full gap-1 overflow-x-auto rounded-full border border-gray-300 bg-white/95 p-1.5 shadow-[0_8px_24px_rgba(26,26,30,0.14)] backdrop-blur"
          role="tablist"
          aria-label="Navigasi persetujuan"
        >
          {(
            [
              { id: 'task', label: `Task · ${taskCount}` },
              { id: 'anggota', label: `Approve Anggota · ${requestCount}` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={activeTab === t.id}
              onClick={() => setActiveTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 font-manrope text-xs font-semibold transition ${
                activeTab === t.id
                  ? 'bg-perrific-graphite text-white'
                  : 'text-gray-800 hover:bg-gray-200 hover:text-black'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
