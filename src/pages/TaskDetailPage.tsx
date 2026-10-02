import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';
import TaskDetailView from '@/components/task/TaskDetailView';
import { useAuth } from '@/store/auth';
import type { Project, Task, Team } from '@/types';

export default function TaskDetailPage() {
  const { projectId, taskId } = useParams<{ projectId: string; taskId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [taskTitle, setTaskTitle] = useState<string | null>(null);

  // BoardPage dipakai di dua layout: /board/:projectId dan
  // /projects/:projectId/kanban — breadcrumb kembali ke kanban asal.
  const backTo = location.pathname.startsWith('/board/') && projectId
    ? `/board/${projectId}`
    : projectId
      ? `/projects/${projectId}/kanban`
      : '/notes';

  useEffect(() => {
    if (!projectId) return;
    projectApi
      .getProject(projectId)
      .then((p) => {
        setProject(p);
        if (p.teamId) {
          teamApi
            .getTeam(p.teamId)
            .then(setTeam)
            .catch(() => setTeam(null));
        }
      })
      .catch(() => setProject(null));
  }, [projectId]);

  if (!projectId || !taskId) {
    return (
      <div className="mx-auto max-w-4xl">
        <p className="font-manrope text-sm text-gray-500">Task tidak ditemukan.</p>
        <Link to="/notes" className="mt-2 inline-block font-manrope text-xs font-semibold text-perrific-violet hover:underline">
          Kembali
        </Link>
      </div>
    );
  }

  const isAdmin = team?.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false;

  return (
    <div className="w-full space-y-4">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 font-manrope text-sm">
        <Link to={backTo} className="shrink-0 font-semibold text-perrific-violet hover:underline">
          Kanban
        </Link>
        <span aria-hidden="true" className="shrink-0 text-gray-400">&gt;</span>
        <span className="min-w-0 truncate font-medium text-gray-700">{taskTitle ?? '…'}</span>
      </nav>

      <TaskDetailView
        taskId={taskId}
        project={project}
        team={team}
        currentUserId={user?.id}
        isAdmin={isAdmin}
        onClose={() => navigate(backTo)}
        onUpdated={(updated: Task) => setTaskTitle(updated.title)}
        onDeleted={() => navigate(backTo)}
        onTaskLoaded={(t: Task) => setTaskTitle(t.title)}
      />
    </div>
  );
}
