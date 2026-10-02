import { useEffect, useRef } from 'react';
import { NavLink } from 'react-router-dom';
import {
  X,
  Archive,
  ArchiveRestore,
  MoreHorizontal,
  Star,
  FileText,
} from 'lucide-react';
import { ActivityIcon } from '@/components/icons';
import type { Team, Note } from '@/types';

interface ArchivePanelProps {
  open: boolean;
  onClose: () => void;
  archivedNav: string[];
  archivedTeams: Team[];
  notes: Note[];
  navIcons: Record<string, string>;
  starred: string[];
  onUnarchiveAll: () => void;
  onUnarchiveNav?: (to: string) => void;
  onUnarchiveTeam?: (teamId: string) => void;
  onOpenCtxMenu?: (
    e: React.MouseEvent,
    target:
      | { kind: 'nav'; to: string; label: string }
      | { kind: 'team'; team: Team }
  ) => void;
  renderTeamBadge: (team: Team, draftName?: string) => React.ReactNode;
}

function findNoteByPath(notes: Note[], path: string): Note | undefined {
  const notePrefix = '/notes/';
  const dailyPrefix = '/daily/';
  const tablePrefix = '/tables/';

  let id = '';
  if (path.startsWith(notePrefix)) id = path.slice(notePrefix.length);
  else if (path.startsWith(dailyPrefix)) id = path.slice(dailyPrefix.length);
  else if (path.startsWith(tablePrefix)) id = path.slice(tablePrefix.length);

  return notes.find((n) => n.id === id);
}

export default function ArchivePanel({
  open,
  onClose,
  archivedNav,
  archivedTeams,
  notes,
  navIcons,
  starred,
  onUnarchiveAll,
  onUnarchiveNav,
  onUnarchiveTeam,
  onOpenCtxMenu,
  renderTeamBadge,
}: ArchivePanelProps) {

  const panelRef = useRef<HTMLDivElement>(null);

  // Listener tombol Escape
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onClose]);

  const totalArchived = archivedNav.length + archivedTeams.length;

  return (
    <div
      ref={panelRef}
      role="region"
      aria-label="Panel Arsip"
      className={`fixed inset-y-0 left-0 z-50 flex w-full max-w-[340px] flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out sm:w-[360px] ${
        open ? 'translate-x-0' : '-translate-x-full pointer-events-none'
      }`}
    >
      {/* Header Panel */}
      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 px-4 py-3.5">
        <div className="flex items-center gap-2">
          {/* Tombol X di pojok kiri atas */}
          <button
            type="button"
            onClick={onClose}
            title="Tutup arsip"
            aria-label="Tutup arsip"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-perrific-graphite"
          >
            <X size={16} strokeWidth={1.8} aria-hidden="true" />
          </button>
          <div className="flex items-center gap-2">
            <h2 className="font-manrope text-sm font-bold text-perrific-graphite">
              Arsip
            </h2>
            {totalArchived > 0 && (
              <span className="flex h-5 items-center justify-center rounded-full bg-perrific-violet/10 px-2 font-mono text-[10px] font-bold text-perrific-violet">
                {totalArchived}
              </span>
            )}
          </div>
        </div>

        {/* Tombol Keluarkan semua di pojok kanan atas */}
        <button
          type="button"
          onClick={onUnarchiveAll}
          disabled={totalArchived === 0}
          title="Keluarkan semua dari arsip"
          aria-label="Keluarkan semua dari arsip"
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-manrope text-xs font-semibold text-perrific-violet transition hover:bg-perrific-violet/10 disabled:opacity-40 disabled:hover:bg-transparent"
        >
          <ArchiveRestore size={14} strokeWidth={1.8} aria-hidden="true" />
          <span>Keluarkan semua</span>
        </button>
      </div>

      {/* Konten Daftar Item Terarsip */}
      <div className="nice-scroll flex-1 overflow-y-auto p-3">
        {totalArchived === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">
              <Archive size={22} strokeWidth={1.6} />
            </div>
            <p className="mt-3 font-manrope text-sm font-semibold text-perrific-graphite">
              Tidak ada arsip
            </p>
            <p className="mt-1 font-manrope text-xs leading-relaxed text-perrific-graphite/50">
              Arsipkan tab privat atau tim melalui menu ⋮ atau klik kanan pada sidebar.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {archivedNav.length > 0 && (
              <div>
                <p className="px-2 pb-1.5 font-mono text-[10px] tracking-widest text-perrific-wood">
                  PRIVAT
                </p>
                <ul className="space-y-1">
                  {archivedNav.map((to) => {
                    const note = findNoteByPath(notes, to);
                    if (!note) return null;
                    const displayLabel = note.title || 'Tanpa judul';
                    const customIcon = navIcons[to];

                    return (
                      <li key={to} className="group relative">
                        <NavLink
                          to={to}
                          onClick={onClose}
                          className={({ isActive }) =>
                            `flex items-center rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-200 ${
                              isActive
                                ? 'bg-perrific-violet/10 font-semibold text-perrific-violet'
                                : 'text-perrific-graphite hover:bg-gray-100'
                            } pr-8`
                          }
                          onContextMenu={(e) =>
                            onOpenCtxMenu?.(e, { kind: 'nav', to, label: displayLabel })
                          }
                          title="Klik kanan untuk opsi"
                        >
                          {customIcon ? (
                            <ActivityIcon name={customIcon} className="h-4 w-4 shrink-0" />
                          ) : (
                            <FileText size={15} strokeWidth={1.6} className="shrink-0 text-gray-400" />
                          )}
                          <span className="ml-2.5 min-w-0 flex-1 truncate font-manrope text-sm">
                            {displayLabel}
                          </span>
                          {starred.includes(to) && (
                            <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />
                          )}
                        </NavLink>
                        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          {onUnarchiveNav && (
                            <button
                              type="button"
                              title="Keluarkan dari arsip"
                              aria-label={`Keluarkan ${displayLabel} dari arsip`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnarchiveNav(to);
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-gray-500 shadow-sm backdrop-blur transition hover:bg-perrific-violet/10 hover:text-perrific-violet"
                            >
                              <ArchiveRestore size={13} strokeWidth={1.8} />
                            </button>
                          )}
                          {onOpenCtxMenu && (
                            <button
                              type="button"
                              aria-label={`Opsi untuk ${displayLabel}`}
                              aria-haspopup="menu"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCtxMenu(e, { kind: 'nav', to, label: displayLabel });
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-gray-500 shadow-sm backdrop-blur transition hover:bg-gray-100 hover:text-perrific-graphite"
                            >
                              <MoreHorizontal size={13} strokeWidth={1.8} />
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {archivedTeams.length > 0 && (
              <div>
                <p className="px-2 pb-1.5 font-mono text-[10px] tracking-widest text-perrific-graphite/40">
                  TIM
                </p>
                <ul className="space-y-1">
                  {archivedTeams.map((team) => (
                    <li key={team.id} className="group relative">
                      <NavLink
                        to={`/team/${team.id}`}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `flex items-center rounded-lg px-2.5 py-1.5 text-sm transition-colors duration-200 ${
                            isActive
                              ? 'bg-perrific-violet/10 font-semibold text-perrific-violet'
                              : 'text-perrific-graphite hover:bg-gray-100'
                          } pr-8`
                        }
                        onContextMenu={(e) => onOpenCtxMenu?.(e, { kind: 'team', team })}
                        title="Klik kanan untuk opsi"
                      >
                        {renderTeamBadge(team)}
                        <span className="ml-2.5 min-w-0 flex-1 truncate font-manrope text-sm">
                          {team.name}
                        </span>
                        {starred.includes(team.id) && (
                          <Star size={12} className="shrink-0 fill-amber-400 text-amber-400" />
                        )}
                      </NavLink>
                        <div className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                          {onUnarchiveTeam && (
                            <button
                              type="button"
                              title="Keluarkan dari arsip"
                              aria-label={`Keluarkan tim ${team.name} dari arsip`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onUnarchiveTeam(team.id);
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-gray-500 shadow-sm backdrop-blur transition hover:bg-perrific-violet/10 hover:text-perrific-violet"
                            >
                              <ArchiveRestore size={13} strokeWidth={1.8} />
                            </button>
                          )}
                          {onOpenCtxMenu && (
                            <button
                              type="button"
                              aria-label={`Opsi untuk ${team.name}`}
                              aria-haspopup="menu"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenCtxMenu(e, { kind: 'team', team });
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-gray-500 shadow-sm backdrop-blur transition hover:bg-gray-100 hover:text-perrific-graphite"
                            >
                              <MoreHorizontal size={13} strokeWidth={1.8} />
                            </button>
                          )}
                        </div>
                      </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
