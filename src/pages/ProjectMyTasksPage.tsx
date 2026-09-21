import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { projectApi } from '@/api/projects';
import SwipeRow from '@/components/ui/SwipeRow';
import { useAuth } from '@/store/auth';
import type { Task } from '@/types';

export default function ProjectMyTasksPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    setLoading(true);
    projectApi
      .listTasks(projectId)
      .then(setTasks)
      .catch(() => setTasks([]))
      .finally(() => setLoading(false));
  }, [projectId]);

  const myTasks = useMemo(
    () => tasks.filter((t) => t.assignees.some((a) => a.id === user?.id)),
    [tasks, user?.id],
  );

  function openTask(taskId: string) {
    navigate(`/projects/${projectId}/kanban/${taskId}`);
  }

  if (loading) return <p className="text-gray-500">Memuat…</p>;

  return (
    <div className="w-full space-y-4">
      <h1 className="text-2xl font-bold text-gray-800">Tugas Saya</h1>
      {myTasks.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-3 py-6 font-givonic text-sm text-gray-400">
          Belum ada task yang di-assign ke kamu di project ini.
        </p>
      ) : (
        <ul className="space-y-2">
          {myTasks.map((t) => {
            const to = `/projects/${projectId}/kanban/${t.id}`;
            return (
              <SwipeRow
                key={t.id}
                actions={[{ label: 'Buka', onClick: () => openTask(t.id) }]}
                contentClassName="flex items-center justify-between gap-2 px-3 py-2.5"
              >
                <span className="flex min-w-0 flex-1 items-baseline gap-1.5">
                  <Link
                    to={to}
                    title={`Buka ${t.title}`}
                    className="shrink-0 font-givonic text-xs font-bold text-perrific-violet hover:underline"
                  >
                    #{t.number}
                  </Link>
                  <Link
                    to={to}
                    title={`Buka ${t.title}`}
                    className="min-w-0 flex-1 truncate text-sm font-medium text-gray-800 hover:underline"
                  >
                    {t.title}
                  </Link>
                </span>
                <span className="shrink-0 font-givonic text-[11px] text-gray-400">{t.column?.name ?? ''}</span>
              </SwipeRow>
            );
          })}
        </ul>
      )}
    </div>
  );
}
