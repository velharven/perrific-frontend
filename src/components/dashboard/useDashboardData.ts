import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/store/auth';
import { teamApi } from '@/api/teams';
import { activityApi } from '@/api/activities';
import type { DailyActivity, Team } from '@/types';

export function toISODate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function greetingFor(hour: number): string {
  if (hour < 11) return 'Selamat pagi';
  if (hour < 15) return 'Selamat siang';
  if (hour < 19) return 'Selamat sore';
  return 'Selamat malam';
}

export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// Warna di-hash dari ID tim (stabil) — konsisten dengan sidebar,
// agar rename tidak mengubah warna background.
export function avatarColor(key: string): string {
  const palette = [
    'bg-perrific-violet',
    'bg-perrific-wood',
    'bg-green-600',
    'bg-sky-600',
    'bg-rose-500',
    'bg-amber-500',
  ];
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

export interface DashboardStats {
  total: number;
  completed: number;
  pending: number;
  progress: number;
}

export interface DashboardData {
  userName: string;
  now: Date;
  todayLabel: string;
  teams: Team[];
  today: DailyActivity[];
  loading: boolean;
  stats: DashboardStats;
  nextUp: DailyActivity | null;
  togglingId: string | null;
  handleToggle: (activity: DailyActivity) => void;
  showTeamForm: boolean;
  teamName: string;
  creating: boolean;
  createError: string | null;
  setShowTeamForm: (v: boolean | ((prev: boolean) => boolean)) => void;
  setTeamName: (v: string) => void;
  setCreateError: (v: string | null) => void;
  handleCreateTeam: (e: React.FormEvent) => void;
}

// Seluruh state + fetch dashboard lama, dipindah utuh agar blok dan
// halaman instance berbagi logika yang sama persis.
export function useDashboardData(): DashboardData {
  const { user } = useAuth();
  const [teams, setTeams] = useState<Team[]>([]);
  const [today, setToday] = useState<DailyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const todayLabel = now.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([teamApi.listMyTeams(), activityApi.listMine({ date: toISODate(new Date()) })])
      .then(([teamList, activities]) => {
        if (cancelled) return;
        setTeams(teamList);
        setToday(activities);
      })
      .catch(() => {
        if (cancelled) return;
        setTeams([]);
        setToday([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => {
    const total = today.length;
    const completed = today.filter((a) => a.status === 'COMPLETED').length;
    const pending = total - completed;
    const progress = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { total, completed, pending, progress };
  }, [today]);

  const nextUp = useMemo(() => today.find((a) => a.status !== 'COMPLETED') ?? null, [today]);

  async function handleToggle(activity: DailyActivity) {
    if (togglingId) return;
    setTogglingId(activity.id);
    const next = activity.status === 'COMPLETED' ? 'PENDING' : 'COMPLETED';
    try {
      const updated = await activityApi.update(activity.id, { status: next });
      setToday((prev) => prev.map((a) => (a.id === activity.id ? updated : a)));
    } catch {
      // diam — state lokal tidak berubah
    } finally {
      setTogglingId(null);
    }
  }

  async function handleCreateTeam(e: React.FormEvent) {
    e.preventDefault();
    if (!teamName.trim() || creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      const team = await teamApi.createTeam({ name: teamName.trim() });
      setTeams((prev) => [...prev, team]);
      setTeamName('');
      setShowTeamForm(false);
    } catch {
      setCreateError('Gagal membuat tim. Coba lagi.');
    } finally {
      setCreating(false);
    }
  }

  return {
    userName: user?.name?.split(' ')[0] ?? 'di sana',
    now,
    todayLabel,
    teams,
    today,
    loading,
    stats,
    nextUp,
    togglingId,
    handleToggle,
    showTeamForm,
    teamName,
    creating,
    createError,
    setShowTeamForm,
    setTeamName,
    setCreateError,
    handleCreateTeam,
  };
}
