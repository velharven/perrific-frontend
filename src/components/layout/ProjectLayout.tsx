import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useParams } from 'react-router-dom';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';
import { APPROVALS_CHANGED_EVENT } from '@/components/team/ApprovalLists';
import { ActivityIcon } from '@/components/icons';
import { PROJECT_UPDATED_EVENT } from '@/pages/ProjectSettingsPage';
import { useAuth } from '@/store/auth';
import type { Project } from '@/types';

const tabs = [
  { to: '.', label: 'Overview', end: true, icon: 'clock' },
  { to: 'kanban', label: 'Kanban', end: false, icon: 'kanban' },
  { to: 'tugas-saya', label: 'Tugas Saya', end: false, icon: 'check' },
] as const;

export const PROJECT_SIDEBAR_EVENT = 'project-sidebar-changed';

export function isProjectSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem('purrific:project-sidebar-collapsed') === '1';
  } catch {
    return false;
  }
}

export default function ProjectLayout() {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const { user } = useAuth();
  const [project, setProject] = useState<Project | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [approvalCount, setApprovalCount] = useState(0);
  const [collapsed, setCollapsed] = useState<boolean>(isProjectSidebarCollapsed);
  // Layar loading singkat tiap pindah tab agar transisi terasa halus.
  const [switching, setSwitching] = useState(false);
  const firstRender = useRef(true);
  const switchTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!projectId) return;
    projectApi
      .getProject(projectId)
      .then((p) => {
        setProject(p);
        return teamApi.getTeam(p.teamId).catch(() => null);
      })
      .then((team) => {
        setIsAdmin(team?.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false);
      })
      .catch(() => {
        setProject(null);
        setIsAdmin(false);
      });
  }, [projectId, user?.id]);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    setSwitching(true);
    if (switchTimer.current !== null) window.clearTimeout(switchTimer.current);
    switchTimer.current = window.setTimeout(() => setSwitching(false), 350);
    return () => {
      if (switchTimer.current !== null) window.clearTimeout(switchTimer.current);
    };
  }, [location.pathname]);

  useEffect(() => {
    const onUpdated = (e: Event) => setProject((e as CustomEvent<Project>).detail);
    window.addEventListener(PROJECT_UPDATED_EVENT, onUpdated);
    return () => window.removeEventListener(PROJECT_UPDATED_EVENT, onUpdated);
  }, []);

  // Badge antrean persetujuan: task PENDING di project ini + permintaan
  // anggota di tim induk. Refresh tiap ada keputusan approve/tolak.
  useEffect(() => {
    if (!project || !isAdmin) {
      setApprovalCount(0);
      return;
    }
    let cancelled = false;
    const fetchCount = () => {
      Promise.all([teamApi.listPendingTasks(project.teamId), teamApi.listJoinRequests(project.teamId)])
        .then(([tasks, requests]) => {
          if (cancelled) return;
          setApprovalCount(tasks.filter((t) => t.project.id === project.id).length + requests.length);
        })
        .catch(() => {
          if (!cancelled) setApprovalCount(0);
        });
    };
    fetchCount();
    window.addEventListener(APPROVALS_CHANGED_EVENT, fetchCount);
    return () => {
      cancelled = true;
      window.removeEventListener(APPROVALS_CHANGED_EVENT, fetchCount);
    };
  }, [project, isAdmin]);

  const name = project?.name ?? '…';

  return (
    <div className="flex min-h-screen bg-perrific-paper">
      <aside
        className={`hidden shrink-0 flex-col bg-perrific-graphite p-4 text-white md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto ${
          collapsed ? 'w-[68px]' : 'w-56'
        }`}
      >
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={() => {
              setCollapsed((v) => {
                const next = !v;
                try {
                  localStorage.setItem('purrific:project-sidebar-collapsed', next ? '1' : '0');
                } catch {
                  // abaikan
                }
                window.dispatchEvent(new Event(PROJECT_SIDEBAR_EVENT));
                return next;
              });
            }}
            title={collapsed ? 'Buka sidebar project' : 'Tutup sidebar project'}
            aria-label={collapsed ? 'Buka sidebar project' : 'Tutup sidebar project'}
            aria-expanded={!collapsed}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-white/80 transition hover:bg-white/10 hover:text-white"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="2.5" y="2.5" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.5" />
              <path d="M6.5 2.5v11" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </button>
        </div>
        <nav className="mt-4 space-y-1" aria-label="Navigasi project">
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              title={t.label}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 font-givonic text-sm transition ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive ? 'bg-white/10 font-semibold text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <ActivityIcon name={t.icon} className="h-4 w-4 shrink-0" />
              {!collapsed && t.label}
            </NavLink>
          ))}
          {isAdmin && (
            <NavLink
              to="persetujuan"
              title="Persetujuan"
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 font-givonic text-sm transition ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive ? 'bg-white/10 font-semibold text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <ActivityIcon name="flag" className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="min-w-0 flex-1 truncate">Persetujuan</span>}
              {!collapsed && approvalCount > 0 && (
                <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-perrific-violet px-1.5 font-givonic text-[11px] font-bold text-white">
                  {approvalCount}
                </span>
              )}
            </NavLink>
          )}
        </nav>
        <div className="mt-auto space-y-1 pt-4">
          {isAdmin && (
            <NavLink
              to="settings"
              title="Settings"
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 font-givonic text-sm transition ${
                  collapsed ? 'justify-center' : ''
                } ${
                  isActive ? 'bg-white/10 font-semibold text-white' : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <ActivityIcon name="gear" className="h-4 w-4 shrink-0" />
              {!collapsed && 'Settings'}
            </NavLink>
          )}
          <Link
            to="/dashboard"
            title="Kembali"
            aria-label="Kembali"
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 font-givonic text-sm text-white/60 transition hover:bg-white/5 hover:text-white ${
              collapsed ? 'justify-center' : ''
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="shrink-0">
              <path d="M3 10.5 12 3l9 7.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M5 9.5V21h14V9.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!collapsed && 'Kembali'}
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 border-b border-gray-200 bg-white/90 px-4 py-3 backdrop-blur md:hidden">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-givonic text-sm font-bold text-perrific-graphite">{name}</p>
            <div className="flex shrink-0 items-center gap-1">
              {isAdmin && (
                <Link
                  to="settings"
                  title="Settings"
                  aria-label="Settings"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              )}
              {project && (
                <Link
                  to={`/team/${project.teamId}`}
                  className="font-givonic text-xs font-semibold text-perrific-violet hover:underline"
                >
                  ← Tim
                </Link>
              )}
            </div>
          </div>
          <nav className="mt-2 flex gap-1 overflow-x-auto" aria-label="Navigasi project">
            {tabs.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `shrink-0 rounded-full px-3 py-1.5 font-givonic text-xs font-semibold transition ${
                    isActive ? 'bg-perrific-graphite text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`
                }
              >
                {t.label}
              </NavLink>
            ))}
            {isAdmin && (
              <NavLink
                to="persetujuan"
                className={({ isActive }) =>
                  `flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 font-givonic text-xs font-semibold transition ${
                    isActive ? 'bg-perrific-graphite text-white' : 'text-gray-500 hover:bg-gray-100'
                  }`
                }
              >
                Persetujuan
                {approvalCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-perrific-violet px-1 text-[10px] font-bold text-white">
                    {approvalCount}
                  </span>
                )}
              </NavLink>
            )}
          </nav>
        </header>
        <main className="relative flex-1 overflow-auto p-4 sm:p-6">
          <Outlet />
          {switching && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-perrific-paper/80 backdrop-blur-[1px]">
              <p className="flex items-center gap-2 font-givonic text-sm text-gray-500">
                <span
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-perrific-violet"
                />
                Memuat…
              </p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
