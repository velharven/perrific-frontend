import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { DailyActivity, AssignedTeamTask, Task } from '@/types';
import { taskApi } from '@/api/tasks';
import { projectApi } from '@/api/projects';
import { ActivityIcon } from '@/components/icons';
import { useSocket } from '@/store/socket';
import { useCalendarSync } from '@/store/calendarSync';

interface CalendarSidebarProps {
  activities: DailyActivity[];
  onRefresh?: () => void;
}

const TYPE_META: Record<DailyActivity['type'], { label: string; className: string }> = {
  TASK: { label: 'Task tim', className: 'bg-violet-100 text-violet-700' },
  BREAKDOWN: { label: 'Breakdown', className: 'bg-blue-100 text-blue-700' },
  CUSTOM: { label: 'Pribadi', className: 'bg-gray-100 text-gray-600' },
};

const PRIORITY_META: Record<string, { label: string; className: string }> = {
  URGENT: { label: 'Urgent', className: 'bg-red-100 text-red-700 border-red-200' },
  HIGH: { label: 'Tinggi', className: 'bg-orange-100 text-orange-700 border-orange-200' },
  MEDIUM: { label: 'Sedang', className: 'bg-amber-100 text-amber-700 border-amber-200' },
  LOW: { label: 'Rendah', className: 'bg-gray-100 text-gray-600 border-gray-200' },
};

function formatShortDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

export default function CalendarSidebar({
  activities,
}: CalendarSidebarProps) {
  const { status: calendarStatus } = useCalendarSync();
  const [activeTab, setActiveTab] = useState<'item' | 'teamTask' | 'personalProject'>('item');
  const [teamTasks, setTeamTasks] = useState<AssignedTeamTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [personalTasks, setPersonalTasks] = useState<Task[]>([]);
  const [loadingPersonalTasks, setLoadingPersonalTasks] = useState(false);
  const [search, setSearch] = useState('');
  const hasLoadedRef = useRef(false);

  // Muat tugas tim yang di-assign ke user (silent = true tidak mengganti tampilan menjadi spinner memuat)
  const fetchAssignedTasks = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoadingTasks(true);
      }
      const data = await taskApi.listMyAssigned();
      setTeamTasks(data);
    } catch (err) {
      console.error('[CalendarSidebar] Gagal memuat tugas tim:', err);
      if (!silent) {
        setTeamTasks([]);
      }
    } finally {
      if (!silent) {
        setLoadingTasks(false);
      }
    }
  }, []);

  // Muat tugas dari project pribadi milik user
  const fetchPersonalTasks = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoadingPersonalTasks(true);
      }
      const proj = await projectApi.getMyPersonalProject();
      if (proj?.id) {
        const data = await projectApi.listTasks(proj.id);
        setPersonalTasks(data);
      } else {
        setPersonalTasks([]);
      }
    } catch (err) {
      console.error('[CalendarSidebar] Gagal memuat tugas project pribadi:', err);
      if (!silent) {
        setPersonalTasks([]);
      }
    } finally {
      if (!silent) {
        setLoadingPersonalTasks(false);
      }
    }
  }, []);

  // Muat awal saat komponen pertama kali dipasang
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      void fetchAssignedTasks(false);
      void fetchPersonalTasks(false);
    }
  }, [fetchAssignedTasks, fetchPersonalTasks]);

  // Polling latar belakang berkala (silent) setiap 60 detik saat tab teamTask dibuka
  useEffect(() => {
    if (activeTab !== 'teamTask') return;
    const interval = setInterval(() => {
      void fetchAssignedTasks(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [activeTab, fetchAssignedTasks]);

  // Polling latar belakang berkala (silent) setiap 60 detik saat tab personalProject dibuka
  useEffect(() => {
    if (activeTab !== 'personalProject') return;
    const interval = setInterval(() => {
      void fetchPersonalTasks(true);
    }, 60000);
    return () => clearInterval(interval);
  }, [activeTab, fetchPersonalTasks]);

  // Dengarkan event socket 'task:assigned' secara real-time (assign, unassign, atau update task)
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket) return;

    const handleTaskAssigned = () => {
      // Perbarui daftar tugas tim di latar belakang secara mulus tanpa mengganggu pengguna
      void fetchAssignedTasks(true);
      void fetchPersonalTasks(true);
    };

    socket.on('task:assigned', handleTaskAssigned);
    socket.on('task:updated', handleTaskAssigned);
    socket.on('calendar:synced', handleTaskAssigned);

    return () => {
      socket.off('task:assigned', handleTaskAssigned);
      socket.off('task:updated', handleTaskAssigned);
      socket.off('calendar:synced', handleTaskAssigned);
    };
  }, [socket, fetchAssignedTasks, fetchPersonalTasks]);

  // Item kegiatan personal yang belum memiliki jam (belum ditambahkan ke kalender)
  const unscheduledItems = useMemo(() => {
    return activities.filter((a) => {
      const isUnscheduled = !a.allDay && !a.startTime && !a.endTime && !a.taskId;
      if (!isUnscheduled) return false;
      if (!search.trim()) return true;
      return a.title.toLowerCase().includes(search.toLowerCase());
    });
  }, [activities, search]);

  // Tugas tim yang belum dimasukkan ke kegiatan berwaktu di kalender
  const unscheduledTeamTasks = useMemo(() => {
    return teamTasks.filter((t) => {
      // Periksa apakah task ini sudah memiliki dailyActivity yang terjadwal dengan jam (baik di server maupun di activities lokal)
      const isScheduledInTask = t.dailyActivities && t.dailyActivities.some((da) => ((da.calendarConnectionId ? da.calendarConnectionId === calendarStatus.connectionId : !da.googleEventId) && (da.allDay || da.startTime || da.endTime)));
      const isScheduledInActivities = activities.some((a) => a.taskId === t.id && (a.allDay || a.startTime || a.endTime));
      if (isScheduledInTask || isScheduledInActivities) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        (t.project?.name && t.project.name.toLowerCase().includes(q))
      );
    });
  }, [teamTasks, activities, search, calendarStatus.connectionId]);

  // Tugas project pribadi yang belum dimasukkan ke kegiatan berwaktu di kalender
  const unscheduledPersonalTasks = useMemo(() => {
    return personalTasks.filter((t) => {
      const isScheduledInTask = t.dailyActivities && t.dailyActivities.some((da) => ((da.calendarConnectionId ? da.calendarConnectionId === calendarStatus.connectionId : !da.googleEventId) && (da.allDay || da.startTime || da.endTime)));
      const isScheduledInActivities = activities.some((a) => a.taskId === t.id && (a.allDay || a.startTime || a.endTime));
      if (isScheduledInTask || isScheduledInActivities) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return t.title.toLowerCase().includes(q);
    });
  }, [personalTasks, activities, search, calendarStatus.connectionId]);

  const totalUnscheduled = unscheduledItems.length + unscheduledTeamTasks.length + unscheduledPersonalTasks.length;

  return (
    <aside
      aria-label="Panel item belum terjadwal"
      className="flex w-full shrink-0 flex-col rounded-2xl border border-gray-200 bg-white shadow-sm"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 p-3 bg-gray-50/80 rounded-t-2xl">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
            <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
              <path d="M7.938 2.016a.13.13 0 0 1 .125 0l6.857 11.856c.026.045.026.1 0 .145a.14.14 0 0 1-.125.073H1.205a.14.14 0 0 1-.125-.073.17.17 0 0 1 0-.145L7.938 2.016zm.854 4.484a.5.5 0 0 0-.992 0l-.3 3.5a.5.5 0 0 0 .992.08l.3-3.58zm-.496 5.5a.65.65 0 1 0 0 1.3.65.65 0 0 0 0-1.3z" />
            </svg>
          </div>

          <div>
            <h2 className="text-xs font-bold text-gray-900 leading-tight">Belum di Kalender</h2>
            <p className="text-[10px] text-gray-500">{totalUnscheduled} item tertunda</p>
          </div>
        </div>
      </div>

      {/* Tab Navigasi: Item, Team Task, & Project Pribadi */}
      <div className="flex border-b border-gray-200 bg-gray-50/50 p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('item')}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold transition ${
            activeTab === 'item'
              ? 'bg-white text-gray-900 shadow-2xs'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span>Item</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              activeTab === 'item' ? 'bg-gray-100 text-gray-800' : 'bg-gray-200/60 text-gray-600'
            }`}
          >
            {unscheduledItems.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('teamTask')}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold transition ${
            activeTab === 'teamTask'
              ? 'bg-white text-gray-900 shadow-2xs'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="truncate">Team Task</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              activeTab === 'teamTask' ? 'bg-violet-100 text-violet-800' : 'bg-gray-200/60 text-gray-600'
            }`}
          >
            {unscheduledTeamTasks.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('personalProject')}
          className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-semibold transition ${
            activeTab === 'personalProject'
              ? 'bg-white text-gray-900 shadow-2xs'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <span className="truncate">Project Pribadi</span>
          <span
            className={`rounded-full px-1.5 py-0.2 text-[10px] ${
              activeTab === 'personalProject' ? 'bg-amber-100 text-amber-800' : 'bg-gray-200/60 text-gray-600'
            }`}
          >
            {unscheduledPersonalTasks.length}
          </span>
        </button>
      </div>

      {/* Input Pencarian & Tombol Segarkan */}
      <div className="flex items-center gap-1.5 border-b border-gray-100 p-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Cari ${activeTab === 'item' ? 'item' : activeTab === 'teamTask' ? 'tugas tim' : 'project pribadi'}…`}
            className="w-full rounded-md border border-gray-200 bg-gray-50/60 px-2.5 py-1 text-xs text-gray-800 placeholder:text-gray-400 focus:border-violet-400 focus:bg-white focus:outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>

        {(activeTab === 'teamTask' || activeTab === 'personalProject') && (
          <button
            type="button"
            onClick={() => {
              if (activeTab === 'teamTask') void fetchAssignedTasks(false);
              else void fetchPersonalTasks(false);
            }}
            disabled={activeTab === 'teamTask' ? loadingTasks : loadingPersonalTasks}
            title={`Segarkan ${activeTab === 'teamTask' ? 'daftar tugas tim' : 'daftar project pribadi'}`}
            aria-label={`Segarkan ${activeTab === 'teamTask' ? 'daftar tugas tim' : 'daftar project pribadi'}`}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100 hover:text-gray-800 transition disabled:opacity-50"
          >
            <svg
              className={`h-3.5 w-3.5 ${(activeTab === 'teamTask' ? loadingTasks : loadingPersonalTasks) ? 'animate-spin text-violet-600' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        )}
      </div>

      {/* Daftar Kartu (Draggable - dibatasi maks 2 kartu, selebihnya di-scroll) */}
      <div
        className={`min-h-0 overflow-y-auto nice-scroll p-2.5 space-y-2 ${
          activeTab === 'item' ? 'max-h-[160px]' : 'max-h-[190px]'
        }`}
      >
        {activeTab === 'item' && (
          <>
            {unscheduledItems.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                <p>Tidak ada item tertunda.</p>
                <p className="mt-1 text-[11px] text-gray-400">Semua item sudah memiliki waktu di kalender.</p>
              </div>
            ) : (
              unscheduledItems.map((a) => {
                const typeInfo = TYPE_META[a.type] ?? TYPE_META.CUSTOM;
                return (
                  <div
                    key={a.id}
                    draggable
                    onDragStart={(e) => {
                      const jsonPayload = JSON.stringify({
                        source: 'item',
                        id: a.id,
                        title: a.title,
                        type: a.type,
                        date: a.date,
                      });
                      e.dataTransfer.setData('application/json', jsonPayload);
                      e.dataTransfer.setData('text/plain', jsonPayload);
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    className="group relative cursor-grab rounded-lg border border-amber-200/80 bg-amber-50/40 p-2.5 shadow-2xs transition hover:border-amber-300 hover:bg-amber-50 hover:shadow-xs active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-amber-500">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M7.938 2.016a.13.13 0 0 1 .125 0l6.857 11.856c.026.045.026.1 0 .145a.14.14 0 0 1-.125.073H1.205a.14.14 0 0 1-.125-.073.17.17 0 0 1 0-.145L7.938 2.016zm.854 4.484a.5.5 0 0 0-.992 0l-.3 3.5a.5.5 0 0 0 .992.08l.3-3.58zm-.496 5.5a.65.65 0 1 0 0 1.3.65.65 0 0 0 0-1.3z" />
                        </svg>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <h3 className="truncate text-xs font-semibold text-gray-900 group-hover:text-amber-900">
                            {a.title || 'Tanpa judul'}
                          </h3>
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
                          <span className={`rounded px-1.5 py-0.2 font-medium ${typeInfo.className}`}>
                            {typeInfo.label}
                          </span>

                          {a.date && (
                            <span className="rounded bg-white px-1.5 py-0.2 font-medium text-gray-600 border border-gray-200">
                              {formatShortDate(a.date)}
                            </span>
                          )}

                          <span className="text-[10px] text-amber-600 font-medium ml-auto">
                            Seret ke kalender ⤳
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === 'teamTask' && (
          <>
            {loadingTasks && teamTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-gray-400">
                <svg className="mb-2 h-5 w-5 animate-spin text-violet-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p>Memuat tugas tim…</p>
              </div>
            ) : unscheduledTeamTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                <p>Tidak ada tugas tim yang tertunda.</p>
                <p className="mt-1 text-[11px] text-gray-400">Semua tugas yang di-assign sudah masuk ke kalender.</p>
              </div>
            ) : (
              unscheduledTeamTasks.map((task) => {
                const priorityInfo = PRIORITY_META[task.priority] ?? PRIORITY_META.MEDIUM;
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      const jsonPayload = JSON.stringify({
                        source: 'team-task',
                        id: task.id,
                        taskId: task.id,
                        title: task.title,
                        type: 'TASK',
                      });
                      e.dataTransfer.setData('application/json', jsonPayload);
                      e.dataTransfer.setData('text/plain', jsonPayload);
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    className="group relative cursor-grab rounded-lg border border-violet-200/80 bg-violet-50/30 p-2.5 shadow-2xs transition hover:border-violet-300 hover:bg-violet-50/70 hover:shadow-xs active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-violet-600">
                        <ActivityIcon name="check" className="h-3.5 w-3.5" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <span className="font-mono font-bold text-violet-700">#{task.number}</span>
                          {task.project?.name && (
                            <span className="truncate max-w-[120px] font-medium text-gray-600">
                              {task.project.name}
                            </span>
                          )}
                        </div>

                        <h3 className="mt-0.5 truncate text-xs font-semibold text-gray-900 group-hover:text-violet-900">
                          {task.title}
                        </h3>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
                          <span className={`rounded border px-1.5 py-0.2 font-medium ${priorityInfo.className}`}>
                            {priorityInfo.label}
                          </span>

                          {task.dueDate && (
                            <span className="rounded bg-white px-1.5 py-0.2 font-medium text-gray-600 border border-gray-200">
                              Batas: {formatShortDate(task.dueDate)}
                            </span>
                          )}

                          <span className="text-[10px] text-violet-600 font-medium ml-auto">
                            Seret ke kalender ⤳
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {activeTab === 'personalProject' && (
          <>
            {loadingPersonalTasks && personalTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center text-xs text-gray-400">
                <svg className="mb-2 h-5 w-5 animate-spin text-amber-500" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <p>Memuat tugas project pribadi…</p>
              </div>
            ) : unscheduledPersonalTasks.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">
                <p>Tidak ada tugas project pribadi yang tertunda.</p>
                <p className="mt-1 text-[11px] text-gray-400">Semua tugas project pribadi sudah masuk ke kalender.</p>
              </div>
            ) : (
              unscheduledPersonalTasks.map((task) => {
                const priorityInfo = PRIORITY_META[task.priority] ?? PRIORITY_META.MEDIUM;
                return (
                  <div
                    key={task.id}
                    draggable
                    onDragStart={(e) => {
                      const jsonPayload = JSON.stringify({
                        source: 'personal-task',
                        id: task.id,
                        taskId: task.id,
                        title: task.title,
                        type: 'TASK',
                      });
                      e.dataTransfer.setData('application/json', jsonPayload);
                      e.dataTransfer.setData('text/plain', jsonPayload);
                      e.dataTransfer.effectAllowed = 'copyMove';
                    }}
                    className="group relative cursor-grab rounded-lg border border-amber-200/80 bg-amber-50/30 p-2.5 shadow-2xs transition hover:border-amber-300 hover:bg-amber-50/70 hover:shadow-xs active:cursor-grabbing"
                  >
                    <div className="flex items-start gap-2">
                      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-amber-500" title="Belum diatur di kalender">
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M7.938 2.016a.13.13 0 0 1 .125 0l6.857 11.856c.026.045.026.1 0 .145a.14.14 0 0 1-.125.073H1.205a.14.14 0 0 1-.125-.073.17.17 0 0 1 0-.145L7.938 2.016zm.854 4.484a.5.5 0 0 0-.992 0l-.3 3.5a.5.5 0 0 0 .992.08l.3-3.58zm-.496 5.5a.65.65 0 1 0 0 1.3.65.65 0 0 0 0-1.3z" />
                        </svg>
                      </span>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                          <span className="font-mono font-bold text-amber-700">#{task.number}</span>
                          <span className="truncate max-w-[120px] font-medium text-gray-600">
                            Project Pribadi
                          </span>
                        </div>

                        <h3 className="mt-0.5 truncate text-xs font-semibold text-gray-900 group-hover:text-amber-900">
                          {task.title}
                        </h3>

                        <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[10px]">
                          <span className={`rounded border px-1.5 py-0.2 font-medium ${priorityInfo.className}`}>
                            {priorityInfo.label}
                          </span>

                          {task.dueDate && (
                            <span className="rounded bg-white px-1.5 py-0.2 font-medium text-gray-600 border border-gray-200">
                              Batas: {formatShortDate(task.dueDate)}
                            </span>
                          )}

                          <span className="text-[10px] text-amber-600 font-medium ml-auto">
                            Seret ke kalender ⤳
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}
      </div>
    </aside>
  );
}
