import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { useSocket } from '@/store/socket';
import { teamApi } from '@/api/teams';
import { noteApi } from '@/api/notes';
import { NOTES_CHANGED_EVENT, notifyNotesChanged } from '@/pages/NotePage';
import UsernameModal from '@/components/auth/UsernameModal';
import SortableTabRow from './SortableTabRow';
import DropIndicator from './DropIndicator';
import FloatingMobileBurger from './FloatingMobileBurger';
import { useDisplayScale } from '@/hooks/useDisplayScale';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  closestCenter,
  useSensor,
  useSensors,
  type Modifier,
  type CollisionDetection,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';

const restrictToVerticalAxis: Modifier = ({ transform }) => ({
  ...transform,
  x: 0,
});
import {
  useNavLabels,
  useSyncedMap,
  useHiddenNav,
  useHiddenTeams,
  useSectionOrder,
  usePresetSections,
  useFavorites,
  useTrash,
  useShortcuts,
  isTrashExpired,
  trashDaysLeft,
  type SidebarSection,
  type TrashedItem,
  useCollapsedSections,
  useTabOrder,
  migrateTabOrder,
  notifyTeamsChanged,
  TEAMS_CHANGED_EVENT,
  notifyOrganizationsChanged,
  ORGANIZATIONS_CHANGED_EVENT,
} from '@/hooks/useNavLabels';
import { TAB_ICONS, ActivityIcon } from '@/components/icons';
import {
  PanelLeftOpen,
  ChevronRight,
  ChevronDown,
  FileText,
  Plus,
  X,
  Archive,
  Star,
  MoreHorizontal,
  Building2,
  Link2,
  Pencil,
  Settings,
  Trash2,
  LogOut,
  ArrowUp,
  ArrowDown,
  AlignLeft,
  Image as ImageIcon,
  Smile,
  Eye,
  KeyRound,
  Calendar,
  Loader2,
  Bell,
} from 'lucide-react';
import NotificationPanel from '@/components/notification/NotificationPanel';
import ArchivePanel from './ArchivePanel';
import EditSidebarPanel from './EditSidebarPanel';
import { notificationApi } from '@/api/notifications';
import Avatar from '@/components/ui/Avatar';
import ConfirmModal from '@/components/ui/ConfirmModal';
import ModalShell from '@/components/ui/ModalShell';
import CreateTeamModal from '@/components/team/CreateTeamModal';
import CreateOrganizationModal from '@/components/organization/CreateOrganizationModal';
import { organizationApi } from '@/api/organizations';
import { fileToAvatarDataUrl } from '@/lib/avatar';
import { ToastHost, showToast } from '@/components/ui/Toast';
import type { Team, Note, Organization } from '@/types';

const notePath = (id: string) => `/notes/${id}`;
const dailyPath = (id: string) => `/daily/${id}`;
const tablePath = (id: string) => `/tables/${id}`;
// ID di balik path tab privat (/notes/:id, /daily/:id, /tables/:id).
// Path polos (/notes, /daily) adalah pintu redirect, bukan tab → null.
function privatIdFromPath(to: string): string | null {
  for (const prefix of ['/notes/', '/daily/', '/tables/'] as const) {
    if (to.startsWith(prefix)) {
      const id = to.slice(prefix.length);
      if (id && !id.includes('/')) return id;
    }
  }
  return null;
}
function findNoteByPath(list: Note[], to: string): Note | undefined {
  const id = privatIdFromPath(to);
  return id ? list.find((n) => n.id === id) : undefined;
}
function privatKindOf(n: Note): 'daily' | 'table' | 'note' {
  return (n.kind ?? 'NOTE') === 'DAILY' ? 'daily' : (n.kind ?? 'NOTE') === 'TABLE' ? 'table' : 'note';
}
function privatPathOf(n: Note): string {
  const k = privatKindOf(n);
  return k === 'daily' ? dailyPath(n.id) : k === 'table' ? tablePath(n.id) : notePath(n.id);
}
// Bersihkan sisa tampilan lokal untuk satu tab privat (berlaku untuk
// semua varian path karena ID-nya sama).
function privatPathsOfId(id: string): string[] {
  return [notePath(id), dailyPath(id), tablePath(id)];
}
// 404 = baris sudah tidak ada di server (mis. ikut terhapus cascade saat
// induk cabangnya di-purge duluan, atau dihapus dari device lain).
// Untuk purge, 404 dianggap sukses: tampilan lokal tetap dibersihkan agar
// tidak jadi entri sampah abadi yang menaut ke halaman 404.
function isNotFound(err: unknown): boolean {
  return (err as { response?: { status?: number } })?.response?.status === 404;
}

// Pintas halaman app yang bisa dipin sebagai shortcut.
const ROUTE_SHORTCUTS = [
  { kind: 'route', ref: '/notes', label: 'Selamat Datang' },
  { kind: 'route', ref: '/daily', label: 'Aktivitas Harian' },
] as const;

const defaultNoteIcon = <FileText size={16} strokeWidth={1.6} aria-hidden="true" />;

// Garis indikator oranye penanda posisi drop saat drag berlangsung.
function DropLine() {
  return <DropIndicator />;
}

export function sectionLabel(s: string): string {
  if (s === 'privat') return 'PRIVAT';
  if (s === 'teams') return 'TIM SAYA';
  if (s === 'organisasi') return 'ORGANISASI';
  if (s === 'favorit') return 'FAVORIT';
  if (s === 'shortcut') return 'SHORTCUT';
  return s.toUpperCase();
}

export function renderTeamBadgeHelper(
  team: Team,
  teamIcons?: Record<string, string>,
  draftName?: string,
) {
  if (teamIcons && teamIcons[team.id]) {
    return (
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-perrific-violet/20 bg-perrific-violet/10 text-perrific-violet"
        aria-hidden="true"
      >
        <ActivityIcon name={teamIcons[team.id]} className="h-3.5 w-3.5" />
      </span>
    );
  }
  if (team.avatarUrl) {
    return (
      <img
        src={team.avatarUrl}
        alt=""
        aria-hidden="true"
        className="h-6 w-6 shrink-0 rounded-md object-cover"
      />
    );
  }
  const ch = ((draftName ?? team.name).trim().slice(0, 2) || '?').toUpperCase();
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-perrific-violet/20 bg-perrific-violet/10 font-manrope text-[10px] font-bold text-perrific-violet"
      aria-hidden="true"
    >
      {ch}
    </span>
  );
}
export { renderTeamBadgeHelper as renderTeamBadge };



function SidebarContent({
  collapsed,
  onRequestExpand,
  onToggleCollapse,
  onClose,
  onOpenNotifications,
  onOpenArchive,
  onOpenEdit,
  unreadCount = 0,
}: {
  collapsed: boolean;
  onRequestExpand?: () => void;
  onToggleCollapse?: () => void;
  onClose?: () => void;
  onOpenNotifications?: () => void;
  onOpenArchive?: () => void;
  onOpenEdit?: () => void;
  unreadCount?: number;
}) {
  const { user, logout } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const location = useLocation();
  const [teams, setTeams] = useState<Team[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [teamDialog, setTeamDialog] = useState<null | 'pilih' | 'kode' | 'buat' | 'buat-langsung'>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [editingNav, setEditingNav] = useState<string | null>(null);
  const [navDraft, setNavDraft] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [editingTeam, setEditingTeam] = useState<string | null>(null);
  const [teamDraft, setTeamDraft] = useState('');
  const [teamError, setTeamError] = useState<string | null>(null);
  // Rename hanya di satu lokasi dalam satu waktu: input di baris Shortcut,
  // Favorit, atau Home/Arsip. Mencegah dua input autofocus berebut fokus
  // lalu saling menutup lewat commit-on-blur.
  const [editFromShortcut, setEditFromShortcut] = useState(false);
  const [editFromFavorit, setEditFromFavorit] = useState(false);
  // Asal menu konteks terakhir (untuk "Ubah nama" dari baris Favorit agar
  // input muncul di Favorit, bukan di Home). Selalu di-reset tiap menu dibuka.
  const favCtxEntryRef = useRef<PrivatEntry | { kind: 'team'; key: string; team: Team } | null>(null);

  useEffect(() => {
    if (editingTeam === null && editingNoteId === null && editingNav === null) {
      setEditFromShortcut(false);
      setEditFromFavorit(false);
    }
  }, [editingTeam, editingNoteId, editingNav]);
  const [pendingDelete, setPendingDelete] = useState<
    | { kind: 'trash-team'; team: Team }
    | { kind: 'trash-note'; note: Note }
    | { kind: 'purge-team'; team: Team }
    | { kind: 'purge-note'; note: Note }
    | null
  >(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  // Id target drop yang sedang dilewati pointer (untuk indikator oranye).
  const [overId, setOverId] = useState<string | null>(null);
  const [ctxMenu, setCtxMenu] = useState<
    | { x: number; y: number; view: 'menu' | 'icons'; kind: 'nav'; to: string; label: string }
    | { x: number; y: number; view: 'menu' | 'icons'; kind: 'team'; team: Team }
    | { x: number; y: number; view: 'menu'; kind: 'shortcut'; shortcutId: string }
    | null
  >(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const ctxMenuRef = useRef<HTMLDivElement>(null);
  // Posisi final menu klik-kanan setelah diukur (flip atas/bawah).
  const [ctxMenuPos, setCtxMenuPos] = useState<{ x: number; y: number } | null>(null);
  const { labels: navLabels, setLabel: setNavLabel } = useNavLabels(user?.id);
  const { map: navIcons, setEntry: setNavIcon } = useSyncedMap('purrific:navIcons', user?.id);
  const { map: teamIcons, setEntry: setTeamIcon } = useSyncedMap('purrific:teamIcons', user?.id);
  const { hidden: hiddenNav, hide: hideNav, show: showNav } = useHiddenNav(user?.id);
  const { hidden: hiddenTeams, hide: hideTeam, show: showTeam } = useHiddenTeams(user?.id);
  const { isOpen: isSectionOpen, toggle: toggleSection } = useCollapsedSections(user?.id);
  const { sortItems, move, reorder } = useTabOrder(user?.id);
  const { order: sectionOrder, reorder: reorderSections } = useSectionOrder(user?.id);
  const { active: presetSections } = usePresetSections(user?.id);
  const { starred, toggle: toggleStar } = useFavorites(user?.id);
  const { items: trashItems, trash: trashTab, restore: restoreTrash } = useTrash(user?.id);
  const { items: shortcuts, add: addShortcut, remove: removeShortcut } = useShortcuts(user?.id);
  const [shortcutPickerOpen, setShortcutPickerOpen] = useState(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const privatOpen = isSectionOpen('privat');
  const teamsOpen = isSectionOpen('teams');
  const organisasiOpen = isSectionOpen('organisasi');
  const favoritOpen = isSectionOpen('favorit');
  const shortcutOpen = isSectionOpen('shortcut');

  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [createOrgOpen, setCreateOrgOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const fetchTeams = () => {
      teamApi
        .listMyTeams()
        .then((list) => {
          if (!cancelled) setTeams(list);
        })
        .catch(() => {
          if (!cancelled) setTeams([]);
        });
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === TEAMS_CHANGED_EVENT) {
        fetchTeams();
      }
    };
    fetchTeams();
    window.addEventListener(TEAMS_CHANGED_EVENT, fetchTeams);
    window.addEventListener('storage', onStorage);
    if (socket) {
      socket.on('team:updated', fetchTeams);
    }
    return () => {
      cancelled = true;
      window.removeEventListener(TEAMS_CHANGED_EVENT, fetchTeams);
      window.removeEventListener('storage', onStorage);
      if (socket) {
        socket.off('team:updated', fetchTeams);
      }
    };
  }, [socket]);

  useEffect(() => {
    let cancelled = false;
    const fetchNotes = () => {
      noteApi
        .listMine()
        .then((list) => {
          if (!cancelled) setNotes(list);
        })
        .catch(() => {
          if (!cancelled) setNotes([]);
        });
    };
    fetchNotes();
    window.addEventListener(NOTES_CHANGED_EVENT, fetchNotes);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTES_CHANGED_EVENT, fetchNotes);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchOrgs = () => {
      organizationApi
        .listMine()
        .then((list) => {
          if (!cancelled) setOrganizations(list);
        })
        .catch(() => {
          if (!cancelled) setOrganizations([]);
        });
    };
    fetchOrgs();
    window.addEventListener(ORGANIZATIONS_CHANGED_EVENT, fetchOrgs);
    return () => {
      cancelled = true;
      window.removeEventListener(ORGANIZATIONS_CHANGED_EVENT, fetchOrgs);
    };
  }, []);

  useEffect(() => {
    setMenuOpen(false);
    setCtxMenu(null);
    setTemplatePickerOpen(false);
    setTrashOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!ctxMenu) return;
    function onPointerDown(e: PointerEvent) {
      const el = document.getElementById('sidebar-ctx-menu');
      if (el && !el.contains(e.target as Node)) setCtxMenu(null);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setCtxMenu(null);
    }
    function onScroll() {
      setCtxMenu(null);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('scroll', onScroll, true);
    };
  }, [ctxMenu]);

  // Posisikan menu dari ukuran aslinya: muat di bawah kursor → ke bawah,
  // tidak muat → flip ke atas, dua-duanya sempit → tempel + scroll.
  // Jalan ulang tiap ctxMenu ganti karena tiap isi/tampilan beda tinggi.
  useLayoutEffect(() => {
    if (!ctxMenu) {
      setCtxMenuPos(null);
      return;
    }
    const el = ctxMenuRef.current;
    if (!el) return;
    const margin = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = Math.max(margin, Math.min(ctxMenu.x, window.innerWidth - w - margin));
    let y: number;
    if (ctxMenu.y + h + margin <= window.innerHeight) {
      y = Math.max(margin, ctxMenu.y);
    } else if (ctxMenu.y - h - margin >= margin) {
      y = ctxMenu.y - h;
    } else {
      y = Math.max(margin, window.innerHeight - h - margin);
    }
    setCtxMenuPos((prev) => (prev && prev.x === x && prev.y === y ? prev : { x, y }));
  }, [ctxMenu]);

  useEffect(() => {
    if (!menuOpen) return;
    function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (collapsed) {
      setTemplatePickerOpen(false);
    }
  }, [collapsed]);


  function handleLogout() {
    logout();
    navigate('/login');
  }

  function openCtxMenu(
    e: React.MouseEvent,
    target:
      | { kind: 'nav'; to: string; label: string }
      | { kind: 'team'; team: Team }
      | { kind: 'shortcut'; shortcutId: string },
  ) {
    e.preventDefault();
    e.stopPropagation();
    favCtxEntryRef.current = null;
    let x = e.clientX;
    let y = e.clientY;
    if (x === 0 && y === 0 && e.currentTarget instanceof HTMLElement) {
      const r = e.currentTarget.getBoundingClientRect();
      x = r.left;
      y = r.bottom + 4;
    }
    // Simpan titik klik mentah; posisi final dihitung setelah menu terukur
    // (ukur-dulu vs tebak-tinggi: tebak 60px dulu yang bikin menu tenggelam).
    // Perkiraan awal konservatif agar frame pertama tidak loncat jauh.
    const pos = {
      x: Math.max(8, Math.min(x, window.innerWidth - 208)),
      y: Math.max(8, Math.min(y, window.innerHeight - 328)),
    };
    if (target.kind === 'nav') {
      setCtxMenu({ ...pos, view: 'menu', kind: 'nav', to: target.to, label: target.label });
    } else if (target.kind === 'team') {
      setCtxMenu({ ...pos, view: 'menu', kind: 'team', team: target.team });
    } else {
      setCtxMenu({ ...pos, view: 'menu', kind: 'shortcut', shortcutId: target.shortcutId });
    }
  }

  // Menu konteks dari baris Favorit: ingat entri asalnya agar "Ubah nama"
  // membuka input di Favorit (bukan di Home).
  function openFavoritCtxMenu(
    e: React.MouseEvent,
    target: { kind: 'nav'; to: string; label: string } | { kind: 'team'; team: Team },
    entry: PrivatEntry | { kind: 'team'; key: string; team: Team },
  ) {
    openCtxMenu(e, target);
    favCtxEntryRef.current = entry;
  }

  function isTeamAdmin(team: Team) {
    return team.members?.some((m) => m.userId === user?.id && m.role === 'ADMIN') ?? false;
  }

  async function handleDeleteTeam(team: Team) {
    setCtxMenu(null);
    setPendingDelete({ kind: 'trash-team', team });
  }

  // Hapus permanen satu item dari Sampah: panggil API lalu keluarkan dari trash.
  async function handlePurgeItem(kind: 'team' | 'note', id: string, title: string) {
    setCtxMenu(null);
    if (kind === 'team') {
      const team = teams.find((t) => t.id === id);
      setPendingDelete({ kind: 'purge-team', team: team ?? ({ id, name: title } as Team) });
    } else {
      const note = notes.find((n) => n.id === id);
      setPendingDelete({ kind: 'purge-note', note: note ?? ({ id, title } as Note) });
    }
  }

  async function confirmPendingDelete() {
    if (!pendingDelete || deleting) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === 'trash-team') {
        const team = pendingDelete.team;
        trashTab({ kind: 'team', id: team.id, title: team.name });
        showToast(`Tim "${team.name}" dipindahkan ke Sampah`, {
          label: 'Urungkan',
          onAction: () => restoreTrash('team', team.id),
        });
        if (location.pathname === `/team/${team.id}`) navigate('/notes');
      } else if (pendingDelete.kind === 'trash-note') {
        const note = pendingDelete.note;
        const branch = noteBranch(note.id);
        for (const item of branch) trashTab({ kind: 'note', id: item.id, title: item.title });
        showToast(`Tab "${note.title}" dipindahkan ke Sampah`, {
          label: 'Urungkan',
          onAction: () => branch.forEach((item) => restoreTrash('note', item.id)),
        });
        if (privatIdFromPath(location.pathname) === note.id) navigate('/notes');
      } else if (pendingDelete.kind === 'purge-team') {
        const team = pendingDelete.team;
        try {
          await teamApi.remove(team.id);
        } catch (e) {
          if (!isNotFound(e)) throw e;
        }
        restoreTrash('team', team.id);
        setTeams((prev) => prev.filter((t) => t.id !== team.id));
        notifyTeamsChanged();
        if (location.pathname === `/team/${team.id}`) navigate('/notes');
      } else {
        const note = pendingDelete.note;
        try {
          await noteApi.remove(note.id);
        } catch (e) {
          if (!isNotFound(e)) throw e;
        }
        restoreTrash('note', note.id);
        setNotes((prev) => prev.filter((n) => n.id !== note.id));
        for (const to of privatPathsOfId(note.id)) {
          showNav(to);
          setNavLabel(to, '');
          setNavIcon(to, null);
        }
        if (editingNoteId === note.id) {
          setEditingNoteId(null);
          setNoteDraft('');
        }
        notifyNotesChanged();
        if (privatIdFromPath(location.pathname) === note.id) navigate('/notes');
      }
      setPendingDelete(null);
    } catch {
      if (pendingDelete.kind === 'trash-team' || pendingDelete.kind === 'purge-team') {
        setTeamError('Gagal menghapus tim. Coba lagi.');
      } else {
        setCreateError('Gagal menghapus tab. Coba lagi.');
      }
    } finally {
      setDeleting(false);
    }
  }

  // Hapus permanen sekumpulan item sampah (dipakai Kosongkan manual dan
  // kedaluwarsa otomatis). 404 antar-device ditoleransi per item.
  async function purgeItems(items: TrashedItem[]) {
    for (const item of items) {
      try {
        if (item.kind === 'team') await teamApi.remove(item.id);
        else await noteApi.remove(item.id);
      } catch (e) {
        // Error beneran (jaringan/500): biarkan di sampah, lanjut.
        // 404 lanjut ke bersih-bersih di bawah (baris sudah tidak ada).
        if (!isNotFound(e)) continue;
      }
      if (item.kind === 'team') {
        setTeams((prev) => prev.filter((t) => t.id !== item.id));
      } else {
        setNotes((prev) => prev.filter((n) => n.id !== item.id));
        for (const to of privatPathsOfId(item.id)) {
          showNav(to);
          setNavLabel(to, '');
          setNavIcon(to, null);
        }
      }
      restoreTrash(item.kind, item.id);
    }
    notifyTeamsChanged();
    notifyNotesChanged();
  }

  async function purgeEmptyTrash() {
    if (deleting) return;
    setDeleting(true);
    try {
      await purgeItems(trashItems);
      setConfirmEmptyTrash(false);
    } finally {
      setDeleting(false);
    }
  }

  // Kedaluwarsa otomatis: item sampah berumur > 30 hari dihapus permanen
  // saat app dibuka. Berhenti sendiri (daftar berubah → expired kosong).
  const expiredTrash = useMemo(() => trashItems.filter((t) => isTrashExpired(t)), [trashItems]);
  useEffect(() => {
    if (expiredTrash.length === 0 || deleting) return;
    setDeleting(true);
    purgeItems(expiredTrash).finally(() => setDeleting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiredTrash]);

  function handleArchiveTeam(team: Team) {
    hideTeam(team.id);
    setCtxMenu(null);
    if (location.pathname === `/team/${team.id}`) navigate('/notes');
  }

  function handleUnarchiveTeam(team: Team) {
    showTeam(team.id);
    setCtxMenu(null);
  }

  async function handleDeleteNote(note: Note) {
    setCtxMenu(null);
    setPendingDelete({ kind: 'trash-note', note });
  }

  function noteBranch(rootId: string): Note[] {
    const out: Note[] = [];
    const visit = (parentId: string) => {
      for (const child of notes.filter((n) => n.parentId === parentId)) {
        out.push(child);
        visit(child.id);
      }
    };
    const root = notes.find((n) => n.id === rootId);
    if (root) out.push(root);
    visit(rootId);
    return out;
  }

  // Kakak-kandung terurut (induk sama) untuk tombol Naik/Turun menu.
  function privatSiblings(path: string): Note[] {
    const note = findNoteByPath(notes, path);
    if (!note) return [];
    const parent = note.parentId ?? null;
    return notes
      .filter((n) => (n.parentId ?? null) === parent)
      .sort((a, b) => a.order - b.order);
  }

  // Naik/Turun privat via server (bukan tulis lokal yang tak dibaca).
  async function movePrivatMenu(path: string, dir: -1 | 1) {
    const note = findNoteByPath(notes, path);
    if (!note) return;
    const parent = note.parentId ?? null;
    const sibs = notes
      .filter((n) => (n.parentId ?? null) === parent)
      .sort((a, b) => a.order - b.order);
    const idx = sibs.findIndex((n) => n.id === note.id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sibs.length) return;
    setCtxMenu(null);

    const snapshot = notes;
    const beforeId = dir === -1 ? sibs[j].id : (sibs[j + 1]?.id ?? null);

    // Optimistik seketika (0ms)
    setNotes((currentNotes) => {
      const nextSibs = [...sibs];
      const [moved] = nextSibs.splice(idx, 1);
      nextSibs.splice(j, 0, moved);
      const orderMap = new Map<string, number>();
      nextSibs.forEach((item, o) => orderMap.set(item.id, o));
      return currentNotes.map((n) => (orderMap.has(n.id) ? { ...n, order: orderMap.get(n.id)! } : n));
    });

    try {
      await noteApi.move(note.id, {
        parentId: parent,
        beforeId,
      });
      notifyNotesChanged();
    } catch {
      setNotes(snapshot);
      showToast('Gagal memindahkan tab.');
    }
  }

  // Kamar baru berkunci: note / aktivitas, masing-masing
  // dapat URL acak sendiri (/notes/:id, /daily/:id).
  async function handleCreateFromTemplate(kind: 'note' | 'activity') {
    if (creating) return;
    setCreating(true);
    setCreateError(null);
    try {
      if (kind === 'activity') {
        const created = await noteApi.create({ title: 'Aktivitas Harian', kind: 'DAILY' });
        setNotes((prev) => [...prev, created]);
        setTemplatePickerOpen(false);
        notifyNotesChanged();
        navigate(dailyPath(created.id));
        return;
      }
      const created = await noteApi.create({ title: 'Tanpa judul', kind: 'NOTE' });
      setNotes((prev) => [...prev, created]);
      setTemplatePickerOpen(false);
      notifyNotesChanged();
      navigate(notePath(created.id));
    } catch {
      setCreateError('Gagal membuat tab baru. Coba lagi.');
    } finally {
      setCreating(false);
    }
  }

  function handleQuickAddTeam() {
    setTeamError(null);
    setTeamDialog('buat-langsung');
  }

  function openTeamDialog() {
    setJoinCode('');
    setJoinError(null);
    setJoining(false);
    setTeamDialog('pilih');
  }

  function closeTeamDialog() {
    if (!joining) setTeamDialog(null);
  }

  function openJoinForm() {
    setJoinCode('');
    setJoinError(null);
    setJoining(false);
    setTeamDialog('kode');
  }

  async function handleJoinTeam() {
    const code = joinCode.trim().toUpperCase();
    if (code.length === 0 || joining) return;
    setJoining(true);
    setJoinError(null);
    try {
      const req = await teamApi.joinTeam(code);
      notifyTeamsChanged();
      setTeamDialog(null);
      showToast(`Permintaan terkirim. Menunggu persetujuan admin "${req.team?.name ?? 'tim'}".`);
    } catch (err: unknown) {
      setJoinError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          'Gagal masuk tim. Coba lagi.',
      );
    } finally {
      setJoining(false);
    }
  }

  function startNavEdit(to: string, currentLabel: string) {
    onRequestExpand?.();
    setEditFromShortcut(false);
    setEditFromFavorit(false);
    setEditingNav(to);
    setNavDraft(currentLabel);
  }

  function commitNavEdit() {
    if (!editingNav) return;
    setNavLabel(editingNav, navDraft);
    setEditingNav(null);
    setNavDraft('');
  }

  function startNoteEdit(note: Note) {
    onRequestExpand?.();
    setEditFromShortcut(false);
    setEditFromFavorit(false);
    setEditingNoteId(note.id);
    setNoteDraft(note.title);
  }

  async function commitNoteEdit(note: Note) {
    if (editingNoteId !== note.id) return;
    const next = noteDraft.trim();
    setEditingNoteId(null);
    setNoteDraft('');
    if (!next || next === note.title) return;
    const snapshot = notes;
    setNotes((prev) => prev.map((n) => (n.id === note.id ? { ...n, title: next } : n)));
    try {
      const updated = await noteApi.update(note.id, { title: next });
      setNotes((prev) => prev.map((n) => (n.id === note.id ? updated : n)));
    } catch {
      setNotes(snapshot);
    }
  }

  function startTeamEdit(team: Team) {
    onRequestExpand?.();
    setEditFromShortcut(false);
    setEditFromFavorit(false);
    setEditingTeam(team.id);
    setTeamDraft(team.name);
    setTeamError(null);
  }

  async function commitTeamEdit(team: Team) {
    if (editingTeam !== team.id) return;
    const next = teamDraft.trim();
    setEditingTeam(null);
    setTeamDraft('');
    if (!next || next === team.name) return;
    const snapshot = teams;
    setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, name: next } : t)));
    try {
      const updated = await teamApi.update(team.id, { name: next });
      setTeams((prev) => prev.map((t) => (t.id === team.id ? { ...t, ...updated } : t)));
      notifyTeamsChanged();
    } catch {
      setTeams(snapshot);
      setTeamError('Gagal mengganti nama tim. Coba lagi.');
    }
  }

  const teamAvatarInputRef = useRef<HTMLInputElement>(null);
  const teamAvatarTargetRef = useRef<Team | null>(null);

  async function handleChangeTeamAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = teamAvatarTargetRef.current;
    teamAvatarTargetRef.current = null;
    if (!file || !target) return;
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      const snapshot = teams;
      setTeamIcon(target.id, null);
      setTeams((prev) => prev.map((t) => (t.id === target.id ? { ...t, avatarUrl: dataUrl } : t)));
      try {
        const updated = await teamApi.update(target.id, { avatarUrl: dataUrl });
        setTeams((prev) => prev.map((t) => (t.id === target.id ? { ...t, ...updated } : t)));
        notifyTeamsChanged();
        showToast('Gambar tim diperbarui.');
      } catch {
        setTeams(snapshot);
        showToast('Gagal mengganti gambar tim. Coba lagi.');
      }
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Gagal memproses gambar.');
    }
  }

  async function handleRemoveTeamAvatar(target: Team) {
    const snapshot = teams;
    setTeamIcon(target.id, null);
    setTeams((prev) => prev.map((t) => (t.id === target.id ? { ...t, avatarUrl: null } : t)));
    try {
      const updated = await teamApi.update(target.id, { avatarUrl: null });
      setTeams((prev) => prev.map((t) => (t.id === target.id ? { ...t, ...updated } : t)));
      notifyTeamsChanged();
      showToast('Gambar tim dihapus.');
    } catch {
      setTeams(snapshot);
      showToast('Gagal menghapus gambar tim.');
    }
  }

  const [editingDescTeam, setEditingDescTeam] = useState<Team | null>(null);
  const [teamDescDraft, setTeamDescDraft] = useState('');
  const [savingTeamDesc, setSavingTeamDesc] = useState(false);

  function openEditTeamDesc(team: Team) {
    const fresh = teams.find((t) => t.id === team.id) ?? team;
    setEditingDescTeam(fresh);
    setTeamDescDraft(fresh.description ?? '');
  }

  async function handleSaveTeamDesc(e: React.FormEvent) {
    e.preventDefault();
    if (!editingDescTeam || savingTeamDesc) return;
    const target = editingDescTeam;
    const nextDesc = teamDescDraft.trim() || null;
    if ((target.description ?? null) === nextDesc) {
      setEditingDescTeam(null);
      return;
    }
    setSavingTeamDesc(true);
    const snapshot = teams;
    setTeams((prev) =>
      prev.map((t) => (t.id === target.id ? { ...t, description: nextDesc } : t)),
    );
    try {
      const updated = await teamApi.update(target.id, { description: nextDesc });
      setTeams((prev) =>
        prev.map((t) => (t.id === target.id ? { ...t, ...updated } : t)),
      );
      notifyTeamsChanged();
      setEditingDescTeam(null);
      showToast('Deskripsi tim diperbarui.');
    } catch {
      setTeams(snapshot);
      showToast('Gagal menyimpan deskripsi tim. Coba lagi.');
    } finally {
      setSavingTeamDesc(false);
    }
  }

  // Migrasi satu kali: urutan lama privat-nav + privat-notes digabung ke privat.
  useEffect(() => {
    migrateTabOrder(user?.id, 'privat', ['privat-nav', 'privat-notes']);
  }, [user?.id]);

  // PRIVAT = satu daftar gabungan kamar berkunci (daily, table, note).
  // Semua diperlakukan sama (drag, rename, ikon, bintang, arsip). User baru
  // otomatis dapat 1 catatan "Selamat Datang" + 1 daily dari backend.
  type PrivatEntry = { kind: 'daily' | 'table' | 'note'; key: string; note: Note };
  // Kunci tab yang ada di Sampah (path privat atau id tim): disembunyikan
  // dari semua daftar sampai dikembalikan atau dihapus permanen.
  const trashedKeys = useMemo(
    () => new Set(trashItems.flatMap((t) => (t.kind === 'note' ? privatPathsOfId(t.id) : [t.id]))),
    [trashItems],
  );
  const privatEntries = useMemo(() => {
    const visible = notes
      .filter((n) => {
        const to = privatPathOf(n);
        return !hiddenNav.includes(to) && !trashedKeys.has(to);
      });
    const byParent = new Map<string | null, Note[]>();
    for (const note of visible) {
      const parent = note.parentId ?? null;
      byParent.set(parent, [...(byParent.get(parent) ?? []), note]);
    }
    // Sidebar datar: anak dari induk terlihat HIDUP di daftar inline induk,
    // bukan di sini. Tampilkan hanya akar + yatim (induk tak terlihat).
    const entries: PrivatEntry[] = [];
    const seen = new Set<string>();
    const walk = (parentId: string | null, show: boolean) => {
      for (const note of (byParent.get(parentId) ?? []).sort((a, b) => a.order - b.order)) {
        if (seen.has(note.id)) continue;
        seen.add(note.id);
        if (show) entries.push({ kind: privatKindOf(note), key: privatPathOf(note), note });
        walk(note.id, false);
      }
    };
    walk(null, true);
    // Pengaman yatim: induknya tak terlihat (diarsip di device lain, data lama)
    // tapi anaknya terlihat → tampilkan di akar agar tak ada yang hilang.
    // Siklus parentId yang rusak juga berhenti di sini via seen.
    for (const note of [...visible].sort((a, b) => a.order - b.order)) {
      if (seen.has(note.id)) continue;
      seen.add(note.id);
      entries.push({ kind: privatKindOf(note), key: privatPathOf(note), note });
      walk(note.id, false);
    }
    return entries;
  }, [hiddenNav, notes, trashedKeys]);
  const orderedTeams = useMemo(() => sortItems('teams', teams, (t) => t.id), [sortItems, teams]);
  const visibleTeams = useMemo(
    () => orderedTeams.filter((t) => !hiddenTeams.includes(t.id) && !trashedKeys.has(t.id)),
    [orderedTeams, hiddenTeams, trashedKeys],
  );
  const archivedTeams = useMemo(
    () => orderedTeams.filter((t) => hiddenTeams.includes(t.id) && !trashedKeys.has(t.id)),
    [orderedTeams, hiddenTeams, trashedKeys],
  );
  // Favorit = tab berbintang (campuran privat + tim), urutan ikut home.
  // Tab arsip dan tab sampah tidak tampil di sini.
  const favoritEntries = useMemo(
    () => privatEntries.filter((e) => starred.includes(e.key)),
    [privatEntries, starred],
  );
  const favoritTeams = useMemo(
    () => visibleTeams.filter((t) => starred.includes(t.id)),
    [visibleTeams, starred],
  );
  // Arsip privat tanpa yang sudah masuk Sampah. Path polos lawas
  // (/notes, /dashboard, /daily) bukan tab lagi jadi disembunyikan dari arsip.
  // Label shortcut live dari target; target hilang -> "Tidak tersedia".
  const shortcutRows = useMemo(
    () =>
      shortcuts.map((s) => {
        if (s.kind === 'route') {
          // /settings tidak lagi punya route (pengaturan dibuka via modal).
          if (s.ref !== '/notes' && s.ref !== '/dashboard' && s.ref !== '/daily') {
            return { ...s, to: '', label: 'Tidak tersedia', missing: true };
          }
          const to = s.ref === '/dashboard' ? '/notes' : s.ref;
          const fallback = to === '/notes' ? 'Selamat Datang' : 'Aktivitas Harian';
          return { ...s, to, label: navLabels[s.ref] ?? fallback, missing: false };
        }
        if (s.kind === 'team') {
          const t = teams.find((x) => x.id === s.ref && !trashedKeys.has(x.id));
          return t
            ? { ...s, to: `/team/${t.id}`, label: t.name, missing: false }
            : { ...s, to: '', label: 'Tidak tersedia', missing: true };
        }
        const n = notes.find((x) => x.id === s.ref && !trashedKeys.has(privatPathOf(x)));
        return n
          ? { ...s, to: privatPathOf(n), label: n.title || 'Tanpa judul', missing: false }
          : { ...s, to: '', label: 'Tidak tersedia', missing: true };
      }),
    [shortcuts, teams, notes, navLabels, trashedKeys],
  );
  // Pin shortcut: cek, lepas, dan mulai rename dari baris mana pun.
  const isPinned = (kind: string, ref: string) =>
    shortcuts.some((s) => s.kind === kind && s.ref === ref);
  const unpinShortcut = (kind: string, ref: string) => {
    const found = shortcuts.find((s) => s.kind === kind && s.ref === ref);
    if (found) removeShortcut(found.id);
  };
  const beginShortcutRename = (row: { kind: string; ref: string; label: string }) => {
    if (row.kind === 'team') {
      const t = teams.find((x) => x.id === row.ref);
      if (t) startTeamEdit(t);
    } else if (row.kind === 'note') {
      const n = notes.find((x) => x.id === row.ref);
      if (n) startNoteEdit(n);
    } else if (row.kind === 'route') {
      startNavEdit(row.ref, row.label);
    }
    // start*Edit mematikan flag; nyalakan lagi setelahnya.
    setEditFromShortcut(true);
  };
  const beginFavoritRename = (entry: PrivatEntry | { kind: 'team'; key: string; team: Team }) => {
    if (entry.kind === 'team') {
      const t = teams.find((x) => x.id === entry.team.id);
      if (t) startTeamEdit(t);
    } else {
      const n = notes.find((x) => x.id === entry.note.id);
      if (n) startNoteEdit(n);
    }
    // start*Edit mematikan flag; nyalakan lagi setelahnya.
    setEditFromShortcut(false);
    setEditFromFavorit(true);
  };

  const shortcutDragDisabled = collapsed || !shortcutOpen;

  const privatKeys = privatEntries.map((e) => e.key);
  const teamKeys = visibleTeams.map((t) => t.id);
  const orderedOrganizations = useMemo(
    () => sortItems('organizations', organizations, (o) => o.id),
    [sortItems, organizations],
  );
  const orgKeys = orderedOrganizations.map((o) => o.id);
  // Kunci alias baris Favorit, seurutan dengan render di bawah.
  const favKeys = useMemo(
    () => [
      ...favoritEntries.map((e) => `fav:${e.key}`),
      ...favoritTeams.map((t) => `fav:${t.id}`),
    ],
    [favoritEntries, favoritTeams],
  );
  // Urutan shortcut tersimpan per-user (key 'shortcut'); baris tanpa urutan
  // tersimpan menempel di akhir sesuai urutan bawaan.
  const orderedShortcutRows = useMemo(
    () => sortItems('shortcut', shortcutRows, (r) => r.id),
    [sortItems, shortcutRows],
  );
  const shortcutKeys = orderedShortcutRows.map((r) => r.id);
  // Drag dimatikan saat rail collapse atau section dilipat.
  const privatDragDisabled = collapsed || !privatOpen;
  const teamsDragDisabled = collapsed || !teamsOpen;
  const orgDragDisabled = collapsed || !organisasiOpen;

  // Garis indikator oranye: 'before' = di atas target, 'after' = di bawah target.
  // Section: bandingkan urutan di sectionOrder. Item: bandingkan index dalam
  // daftarnya (hanya dalam list yang sama; antar-list tidak ada indikator).
  // Baris Favorit memakai alias `fav:<key>` agar ID sortable unik (tab yang
  // sama juga terdaftar di home); baseKey mengembalikannya ke kunci asli.
  type DropHint = 'before' | 'after' | null;
  const baseKey = (id: string) => (id.startsWith('fav:') ? id.slice(4) : id);
  const homeListOf = (base: string): 'privat' | 'teams' | 'organizations' | null =>
    privatKeys.includes(base)
      ? 'privat'
      : teamKeys.includes(base)
        ? 'teams'
        : orgKeys.includes(base)
          ? 'organizations'
          : null;
  const itemLists: Record<string, string[]> = {
    privat: privatKeys,
    teams: teamKeys,
    organizations: orgKeys,
    shortcut: shortcutKeys,
  };
  const draggingItemList =
    activeDragId && !activeDragId.startsWith('section:')
      ? (homeListOf(baseKey(activeDragId)) ?? (shortcutKeys.includes(activeDragId) ? 'shortcut' : null))
      : null;

  // Informasi tab yang sedang diseret untuk floating preview DragOverlay
  const draggedTabInfo = useMemo(() => {
    if (!activeDragId || activeDragId.startsWith('section:')) return null;
    const b = baseKey(activeDragId);
    const note = findNoteByPath(notes, b);
    if (note) {
      const customIcon = navIcons[b];
      return {
        title: note.title,
        icon: customIcon ? (
          <ActivityIcon name={customIcon} className="h-4 w-4 shrink-0 text-gray-400" />
        ) : (
          <span className="shrink-0 text-gray-400">{defaultNoteIcon}</span>
        ),
      };
    }
    const team = teams.find((t) => t.id === b);
    if (team) {
      return {
        title: team.name,
        icon: renderTeamBadge(team),
      };
    }
    const org = organizations.find((o) => o.id === b);
    if (org) {
      return {
        title: org.name,
        icon: (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-perrific-violet/20 bg-perrific-violet/10 text-perrific-violet">
            <Building2 size={14} strokeWidth={1.6} />
          </span>
        ),
      };
    }
    const shortcut = shortcutRows.find((s) => s.id === activeDragId);
    if (shortcut) {
      return {
        title: shortcut.label,
        icon: (
          <Link2 size={14} strokeWidth={1.6} className="shrink-0 text-gray-400" />
        ),
      };
    }
    return null;
  }, [activeDragId, notes, teams, organizations, shortcutRows, navIcons]);
  function itemDropHint(list: string, key: string): DropHint {
    if (!activeDragId || !overId || draggingItemList !== list) return null;
    if (overId !== key || activeDragId === key) return null;
    const keys = itemLists[list] ?? [];
    const from = keys.indexOf(activeDragId);
    const to = keys.indexOf(overId);
    if (from < 0 || to < 0) return null;
    return from < to ? 'after' : 'before';
  }
  // Hint untuk baris Favorit: bandingkan kunci asli dalam daftar home yang sama.
  // Berlaku baik saat menyeret dari Favorit (id alias `fav:`) maupun dari home.
  function favHint(realKey: string): DropHint {
    if (!activeDragId || !overId) return null;
    const ab = baseKey(activeDragId);
    const ob = baseKey(overId);
    if (ob !== realKey || ab === realKey) return null;
    const al = homeListOf(ab);
    if (!al || homeListOf(ob) !== al) return null;
    const keys = al === 'privat' ? privatKeys : teamKeys;
    const from = keys.indexOf(ab);
    const to = keys.indexOf(ob);
    if (from < 0 || to < 0) return null;
    return from < to ? 'after' : 'before';
  }

  // Stempel drop terakhir: klik sintetis yang dilepas browser tepat setelah
  // drop harus diabaikan, kalau tidak ia mengaktifkan NavLink di bawah kursor
  // dan halaman pindah sendiri ke tab yang baru di-drop.
  const lastDragEndRef = useRef(0);
  const POST_DRAG_CLICK_WINDOW_MS = 300;
  function markDragEnd() {
    lastDragEndRef.current = Date.now();
  }
  // Abaikan klik yang dilepas browser tepat setelah drop (klik sintetis).
  // Tanpa ini, pointerup di atas baris akan mengaktifkan NavLink di bawah
  // kursor dan halaman pindah sendiri ke tab yang baru di-drop.
  function suppressPostDragClick(e: React.SyntheticEvent) {
    if (Date.now() - lastDragEndRef.current < POST_DRAG_CLICK_WINDOW_MS) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  // Animasi mendarat chip section dimatikan (dropAnimation null): chip hilang
  // seketika saat drop dan section asli langsung terlihat meluncur ke slot.
  // Tabrakan dipisah by jenis: drag section hanya melawan container
  // section, drag item hanya melawan item. Tanpa ini, target `over` berpindah
  // cepat antara container section dan item di dalamnya sehingga tampilan kedip.
  const sidebarCollision: CollisionDetection = (args) => {
    const wantSection = String(args.active.id).startsWith('section:');
    const filtered = args.droppableContainers.filter((c) =>
      wantSection ? String(c.id).startsWith('section:') : !String(c.id).startsWith('section:'),
    );
    if (filtered.length === 0) return [];
    return closestCenter({ ...args, droppableContainers: filtered });
  };

  function handleSidebarDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id));
    setOverId(null);
  }

  function handleSidebarDragOver(event: DragOverEvent) {
    setOverId(event.over ? String(event.over.id) : null);
  }

  function handleSidebarDragCancel() {
    markDragEnd();
    setActiveDragId(null);
    setOverId(null);
  }

  function handleSidebarDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    markDragEnd();
    setActiveDragId(null);
    setOverId(null);
    if (!over) return;
    const a = String(active.id);
    const o = String(over.id);
    // Petakan tiap id ke section pemiliknya: id section berprefix,
    // id item ikut section daftarnya. Drop di luar daftar yang sama diabaikan.
    // Id alias Favorit (`fav:`) dipetakan ke kunci aslinya dulu.
    const sectionOf = (id: string): string | null => {
      if (id.startsWith('section:')) return id.slice('section:'.length);
      const b = baseKey(id);
      if (privatKeys.includes(b)) return 'privat';
      if (teamKeys.includes(b)) return 'teams';
      if (orgKeys.includes(b)) return 'organisasi';
      return null;
    };
    if (a.startsWith('section:')) {
      const from = a.slice('section:'.length);
      const to = sectionOf(o);
      if (!to || !sectionOrder.includes(from as SidebarSection) || !sectionOrder.includes(to as SidebarSection)) return;
      if (to === from) return;
      reorderSections(from as SidebarSection, to as SidebarSection);
      return;
    }
    // Drop item: shortcut punya daftar sendiri; baris Favorit (alias `fav:`)
    // diterjemahkan ke kunci home lalu menyusun ulang daftar home tersebut.
    if (shortcutKeys.includes(a) && shortcutKeys.includes(o)) {
      reorder('shortcut', shortcutKeys, a, o);
      return;
    }
    const ab = baseKey(a);
    const ob = baseKey(o);
    if (ab === ob) return;
    const al = homeListOf(ab);
    if (al && homeListOf(ob) === al) {
      if (al === 'privat') {
        // Sidebar datar: seret hanya menyusun ulang sesama level.
        // Nesting dibuat via '/' di halaman (anak tak tampil di sidebar).
        const moving = findNoteByPath(notes, ab);
        const target = findNoteByPath(notes, ob);
        if (moving && target && moving.parentId === target.parentId) {
          const parent = moving.parentId ?? null;
          const sibs = notes
            .filter((n) => (n.parentId ?? null) === parent)
            .sort((a, b) => a.order - b.order);
          const from = sibs.findIndex((n) => n.id === moving.id);
          const to = sibs.findIndex((n) => n.id === target.id);
          if (from === -1 || to === -1 || from === to) return;

          const remaining = sibs.filter((n) => n.id !== moving.id);
          // remaining[to] adalah note yang akan berada persis setelah posisi drop.
          // Jika drop di paling akhir (to >= remaining.length), remaining[to] undefined -> beforeId = null (sisipkan di akhir)
          const beforeId = remaining[to]?.id ?? null;

          const snapshot = notes;

          // Pembaruan optimistik seketika (0ms) di UI sidebar
          setNotes((currentNotes) => {
            const nextSibs = [...sibs];
            const [movedItem] = nextSibs.splice(from, 1);
            nextSibs.splice(to, 0, movedItem);

            const orderMap = new Map<string, number>();
            nextSibs.forEach((item, idx) => orderMap.set(item.id, idx));

            return currentNotes.map((n) => (orderMap.has(n.id) ? { ...n, order: orderMap.get(n.id)! } : n));
          });

          noteApi
            .move(moving.id, { parentId: moving.parentId, beforeId })
            .then(() => {
              notifyNotesChanged();
            })
            .catch((err) => {
              console.error('[AppLayout] Gagal memindahkan tab privat:', err);
              setNotes(snapshot);
              showToast('Gagal memindahkan tab.');
            });
        }
      } else if (al === 'teams') {
        reorder('teams', teamKeys, ab, ob);
      } else if (al === 'organizations') {
        reorder('organizations', orgKeys, ab, ob);
      }
    }
  }

  // Target pindah untuk menu konteks (dihitung ulang tiap render agar
  // tombol Naik/Turun selalu benar meski menu tetap terbuka).
  // Key yang diklik dijamin ada di daftar (fallback: tempel di akhir) sehingga
  // idx tidak pernah -1 untuk baris yang sedang diklik user.
  const withClickedKey = (listKeys: string[], key: string) =>
    listKeys.includes(key) ? listKeys : [...listKeys, key];
  const menuMoveTarget =
    ctxMenu && ctxMenu.view === 'menu'
      ? ctxMenu.kind === 'team'
        ? {
            section: 'teams',
            listKeys: withClickedKey(
              visibleTeams.map((t) => t.id),
              ctxMenu.team.id,
            ),
            key: ctxMenu.team.id,
          }
        : ctxMenu.kind === 'shortcut'
          ? {
              section: 'shortcut',
              listKeys: withClickedKey(
                shortcutKeys,
                ctxMenu.shortcutId,
              ),
              key: ctxMenu.shortcutId,
            }
          : {
              // Naik/Turun privat sesama kakak (server), bukan se-daftar datar:
              // urutan tampil kini milik server, tulis lokal tak dibaca lagi.
              section: 'privat',
              listKeys: withClickedKey(
                privatSiblings(ctxMenu.to).map((n) => privatPathOf(n)),
                ctxMenu.to,
              ),
              key: ctxMenu.to,
            }
      : null;
  const menuMoveIdx = menuMoveTarget ? menuMoveTarget.listKeys.indexOf(menuMoveTarget.key) : -1;
  const isArchivedTeamMenu = ctxMenu?.kind === 'team' && hiddenTeams.includes(ctxMenu.team.id);
  const menuCanUp = menuMoveIdx > 0 && !isArchivedTeamMenu;
  const menuCanDown =
    menuMoveTarget !== null &&
    menuMoveIdx >= 0 &&
    menuMoveIdx < menuMoveTarget.listKeys.length - 1 &&
    !isArchivedTeamMenu;

  // Baris tab PRIVAT — dipakai di nav utama & daftar arsip (fitur identik:
  // klik navigasi, ⋮, double-click rename, klik kanan).
  const navRowClass = (isActive: boolean) =>
    `flex items-center justify-center rounded-lg px-3 py-2 font-manrope text-sm transition-colors duration-200 ${
      isActive
        ? 'bg-perrific-violet/10 font-semibold text-perrific-red'
        : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-perrific-graphite'
    }`;

  // Baris tab privat (dashboard / daily / note berkunci acak).
  const renderNoteEntry = (note: Note) => {
    const to = privatPathOf(note);
    const customIcon = navIcons[to];
    const hint = itemDropHint('privat', to);
                if (!editFromShortcut && !editFromFavorit && editingNoteId === note.id) {
      return (
        <Fragment key={to}>
          {hint === 'before' && <DropLine />}
        <SortableTabRow id={to} disabled className={navRowClass(false)}>
          {customIcon ? (
            <ActivityIcon name={customIcon} className="h-4 w-4 shrink-0 text-gray-400" />
          ) : (
            <span className="shrink-0 text-gray-400">{defaultNoteIcon}</span>
          )}
          <input
            autoFocus
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            onBlur={() => commitNoteEdit(note)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitNoteEdit(note);
              if (e.key === 'Escape') {
                setEditingNoteId(null);
                setNoteDraft('');
              }
            }}
            maxLength={120}
                  aria-label={`Ubah nama tab ${note.title}`}
                  className="ml-2.5 min-w-0 flex-1 rounded-md border border-perrific-violet/40 bg-white px-1.5 py-0.5 text-sm focus:outline-none"
                />
              </SortableTabRow>
              {hint === 'after' && <DropLine />}
            </Fragment>
            );
          }
          return (
            <Fragment key={to}>
              {hint === 'before' && <DropLine />}
            <SortableTabRow
              id={to}
              disabled={privatDragDisabled}
              className="group relative"
            >
        <NavLink
          to={to}
          className={({ isActive }) => `${navRowClass(isActive)} ${collapsed ? '' : 'pr-8'}`}
          onDoubleClick={() => startNoteEdit(note)}
          onContextMenu={(e) => openCtxMenu(e, { kind: 'nav', to, label: note.title })}
                title={collapsed ? note.title : 'Seret untuk memindahkan • Klik kanan untuk opsi'}
        >
          {customIcon ? (
            <ActivityIcon name={customIcon} className="h-4 w-4 shrink-0" />
          ) : (
            <span className="shrink-0">{defaultNoteIcon}</span>
          )}
          <span
            className={`min-w-0 flex-1 truncate transition-[max-width,opacity,margin] duration-200 ease-in-out ${
              collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2.5 max-w-[220px] opacity-100'
            }`}
          >
            {note.title}
          </span>
          {!collapsed && starred.includes(to) && (
            <Star size={12} className="shrink-0 text-amber-400 fill-amber-400" aria-hidden="true" />
          )}
        </NavLink>
        {!collapsed && (
          <button
            type="button"
            aria-label={`Opsi untuk ${note.title}`}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              openCtxMenu(e, { kind: 'nav', to, label: note.title });
            }}
            className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-white/80 text-gray-400 opacity-0 shadow-sm backdrop-blur transition hover:bg-gray-100 hover:text-perrific-graphite focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <MoreHorizontal size={14} strokeWidth={1.6} aria-hidden="true" />
          </button>
        )}
            </SortableTabRow>
              {hint === 'after' && <DropLine />}
            </Fragment>
          );
        };

  const renderTeamBadge = (team: Team, draftName?: string) =>
    renderTeamBadgeHelper(team, teamIcons, draftName);


  // Baris tim.
  const renderTeamRow = (team: Team) => {
    const hint = itemDropHint('teams', team.id);
    const teamRowClass = (isActive: boolean) =>
      `flex items-center justify-center rounded-lg px-3 py-2 font-manrope text-sm transition-colors duration-200 ${
        isActive
          ? 'bg-gray-100 font-semibold text-perrific-graphite'
          : 'font-medium text-gray-600 hover:bg-gray-100 hover:text-perrific-graphite'
      }`;
                if (!editFromShortcut && !editFromFavorit && editingTeam === team.id) {
      return (
        <Fragment key={team.id}>
          {hint === 'before' && <DropLine />}
        <SortableTabRow id={team.id} as="li" disabled>
          <div className={teamRowClass(false)}>
            {renderTeamBadge(team, teamDraft)}
            <input
              autoFocus
              value={teamDraft}
              onChange={(e) => setTeamDraft(e.target.value)}
              onBlur={() => commitTeamEdit(team)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTeamEdit(team);
                if (e.key === 'Escape') {
                  setEditingTeam(null);
                  setTeamDraft('');
                }
              }}
              maxLength={60}
              aria-label={`Ubah nama tim ${team.name}`}
              className="ml-2.5 min-w-0 flex-1 rounded-md border border-perrific-violet/40 bg-white px-1.5 py-0.5 text-sm focus:outline-none"
            />
          </div>
        </SortableTabRow>
          {hint === 'after' && <DropLine />}
        </Fragment>
      );
    }
    return (
      <Fragment key={team.id}>
        {hint === 'before' && <DropLine />}
      <SortableTabRow
        id={team.id}
        as="li"
        disabled={teamsDragDisabled}
        className="group relative"
      >
        <NavLink
          to={`/team/${team.id}`}
          className={({ isActive }) => `${teamRowClass(isActive)} ${collapsed ? '' : 'pr-8'}`}
          onDoubleClick={() => startTeamEdit(team)}
          onContextMenu={(e) => openCtxMenu(e, { kind: 'team', team })}
          title={collapsed ? team.name : 'Seret untuk memindahkan • Klik kanan untuk opsi'}
        >
          {renderTeamBadge(team)}
          <span
            className={`min-w-0 flex-1 truncate transition-[max-width,opacity,margin] duration-200 ease-in-out ${
              collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2.5 max-w-[220px] opacity-100'
            }`}
          >
            {team.name}
          </span>
          {!collapsed && starred.includes(team.id) && (
            <Star size={12} className="shrink-0 text-amber-400 fill-amber-400" aria-hidden="true" />
          )}
        </NavLink>
        {!collapsed && (
          <button
            type="button"
            aria-label={`Opsi untuk ${team.name}`}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              openCtxMenu(e, { kind: 'team', team });
            }}
            className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-white/80 text-gray-400 opacity-0 shadow-sm backdrop-blur transition hover:bg-gray-100 hover:text-perrific-graphite focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <MoreHorizontal size={14} strokeWidth={1.6} aria-hidden="true" />
          </button>
        )}
      </SortableTabRow>
        {hint === 'after' && <DropLine />}
      </Fragment>
    );
  };

  const renderOrgRow = (org: Organization) => {
    const to = `/org/${org.id}`;
    const hint = itemDropHint('organizations', org.id);
    return (
      <Fragment key={org.id}>
        {hint === 'before' && <DropLine />}
        <SortableTabRow
          id={org.id}
          as="li"
          disabled={orgDragDisabled}
          className="group relative"
        >
          <NavLink
            to={to}
            className={({ isActive }) => `${navRowClass(isActive)} ${collapsed ? '' : 'pr-8'}`}
            title={collapsed ? org.name : 'Seret untuk memindahkan'}
          >
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-perrific-violet/20 bg-perrific-violet/10 text-perrific-violet"
              aria-hidden="true"
            >
              <Building2 size={14} strokeWidth={1.6} />
            </span>
            <span
              className={`min-w-0 flex-1 truncate transition-[max-width,opacity,margin] duration-200 ease-in-out ${
                collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2.5 max-w-[220px] opacity-100'
              }`}
            >
              {org.name}
            </span>
          </NavLink>
        </SortableTabRow>
        {hint === 'after' && <DropLine />}
      </Fragment>
    );
  };

  // Baris Favorit: sortable dengan id alias `fav:<key>` (unik, tidak bentrok
  // dengan baris home yang sama). Drop diterjemahkan ke urutan home.
  // Rename inline di sini seperti Shortcut (double-click atau menu Ubah nama).
  const renderFavoritRow = (entry: PrivatEntry | { kind: 'team'; key: string; team: Team }) => {
    const key = entry.kind === 'team' ? entry.team.id : entry.key;
    const favKey = `fav:${key}`;
    const hint = favHint(key);
    const navTo = entry.kind === 'team' ? `/team/${entry.team.id}` : entry.key;
    const label = entry.kind === 'team' ? entry.team.name : entry.note.title;
    const icon =
      entry.kind === 'team' ? (
        renderTeamBadge(entry.team)
      ) : navIcons[navTo] ? (
        <ActivityIcon name={navIcons[navTo]} className="h-4 w-4 shrink-0" />
      ) : (
        <span className="shrink-0">{defaultNoteIcon}</span>
      );
    const menuTarget =
      entry.kind === 'team'
        ? ({ kind: 'team', team: entry.team } as const)
        : ({ kind: 'nav', to: navTo, label } as const);
    const favTargetTeam = entry.kind === 'team' ? teams.find((t) => t.id === entry.team.id) : undefined;
    const favTargetNote =
      entry.kind === 'team' ? undefined : notes.find((n) => n.id === entry.note.id);
    const isFavEditing =
      ((entry.kind === 'team' && editingTeam === entry.team.id && !!favTargetTeam) ||
        (entry.kind !== 'team' && editingNoteId === entry.note.id && !!favTargetNote)) &&
      editFromFavorit &&
      !editFromShortcut;
    const cancelFavEdit = () => {
      setEditingTeam(null);
      setTeamDraft('');
      setEditingNoteId(null);
      setNoteDraft('');
      setEditingNav(null);
      setNavDraft('');
    };
    if (isFavEditing) {
      return (
        <Fragment key={favKey}>
          {hint === 'before' && <DropLine />}
          <SortableTabRow id={favKey} disabled className={navRowClass(false)}>
            {icon}
            <input
              autoFocus
              value={entry.kind === 'team' ? teamDraft : noteDraft}
              onChange={(e) =>
                entry.kind === 'team' ? setTeamDraft(e.target.value) : setNoteDraft(e.target.value)
              }
              onBlur={() => {
                if (entry.kind === 'team' && favTargetTeam) commitTeamEdit(favTargetTeam);
                else if (entry.kind !== 'team' && favTargetNote) commitNoteEdit(favTargetNote);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (entry.kind === 'team' && favTargetTeam) commitTeamEdit(favTargetTeam);
                  else if (entry.kind !== 'team' && favTargetNote) commitNoteEdit(favTargetNote);
                }
                if (e.key === 'Escape') cancelFavEdit();
              }}
              maxLength={entry.kind === 'team' ? 60 : 120}
              aria-label={`Ubah nama ${label}`}
              className="ml-2.5 min-w-0 flex-1 rounded-md border border-perrific-violet/40 bg-white px-1.5 py-0.5 text-sm focus:outline-none"
            />
          </SortableTabRow>
          {hint === 'after' && <DropLine />}
        </Fragment>
      );
    }
    return (
      <Fragment key={favKey}>
        {hint === 'before' && <DropLine />}
      <SortableTabRow
        id={favKey}
        disabled={collapsed || !favoritOpen}
        className="group relative"
      >
        <NavLink
          to={navTo}
          className={({ isActive }) => `${navRowClass(isActive)} ${collapsed ? '' : 'pr-14'}`}
          onDoubleClick={() => beginFavoritRename(entry)}
          onContextMenu={(e) => openFavoritCtxMenu(e, menuTarget, entry)}
          title={label}
        >
          {icon}
          <span
            className={`min-w-0 flex-1 truncate transition-[max-width,opacity,margin] duration-200 ease-in-out ${
              collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2.5 max-w-[220px] opacity-100'
            }`}
          >
            {label}
          </span>
        </NavLink>
        {!collapsed && (
          <button
            type="button"
            aria-label={`Hapus dari Favorit: ${label}`}
            title="Hapus dari Favorit"
            onClick={(e) => {
              e.stopPropagation();
              toggleStar(key);
            }}
            className="absolute right-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-amber-400 transition hover:bg-gray-100 hover:text-red-500"
          >
            <Star size={14} className="fill-amber-400 text-amber-400" aria-hidden="true" />
          </button>
        )}
        {!collapsed && (
          <button
            type="button"
            aria-label={`Opsi untuk ${label}`}
            aria-haspopup="menu"
            onClick={(e) => {
              e.stopPropagation();
              openFavoritCtxMenu(e, menuTarget, entry);
            }}
            className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-white/80 text-gray-400 opacity-0 shadow-sm backdrop-blur transition hover:bg-gray-100 hover:text-perrific-graphite focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
          >
            <MoreHorizontal size={14} strokeWidth={1.6} aria-hidden="true" />
          </button>
        )}
      </SortableTabRow>
        {hint === 'after' && <DropLine />}
      </Fragment>
    );
  };

  return (
    <div className="relative flex h-full w-64 min-w-[16rem] flex-col bg-white">
      {onClose && (
        <div className="relative flex shrink-0 items-center justify-between px-3 pt-3 lg:hidden">
          <div className="flex items-center gap-1">
            {onOpenArchive && (
              <button
                type="button"
                onClick={onOpenArchive}
                title="Arsip"
                aria-label="Arsip"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-perrific-graphite/60 transition hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <Archive size={16} strokeWidth={1.6} aria-hidden="true" />
              </button>
            )}
            {onOpenNotifications && (
              <button
                type="button"
                onClick={onOpenNotifications}
                title="Notifikasi"
                aria-label="Notifikasi"
                className="relative flex h-8 w-8 items-center justify-center rounded-lg text-perrific-graphite/60 transition hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <Bell size={16} strokeWidth={1.6} aria-hidden="true" />
                {unreadCount > 0 && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                )}
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            title="Tutup sidebar"
            aria-label="Tutup sidebar"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-perrific-graphite/60 transition hover:bg-gray-100 hover:text-perrific-graphite"
          >
            <X size={15} strokeWidth={1.6} aria-hidden="true" />
          </button>

        </div>
      )}
      {onToggleCollapse && (
        <div className="relative shrink-0 px-3 pt-4">
          <div className="flex h-7 items-center justify-center rounded-lg px-3">
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Tutup sidebar"
              aria-label="Tutup sidebar"
              aria-expanded={!collapsed}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-perrific-violet"
            >
              <PanelLeftOpen size={16} strokeWidth={1.6} aria-hidden="true" />
            </button>
            <span
              aria-hidden="true"
              className={`min-w-0 flex-1 transition-[max-width,opacity,margin] duration-200 ease-in-out ${
                collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2.5 max-w-[220px] opacity-100'
              }`}
            />
            <span
              className={`flex shrink-0 items-center justify-center gap-1 overflow-hidden transition-[max-width,opacity] duration-200 ease-in-out ${
                collapsed ? 'max-w-0 opacity-0' : 'max-w-[64px] opacity-100'
              }`}
            >
              {onOpenArchive && (
                <button
                  type="button"
                  onClick={onOpenArchive}
                  title="Arsip"
                  aria-label="Arsip"
                  tabIndex={collapsed ? -1 : 0}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-perrific-graphite"
                >
                  <Archive size={16} strokeWidth={1.6} aria-hidden="true" />
                </button>
              )}
              {onOpenNotifications && (
                <button
                  type="button"
                  onClick={onOpenNotifications}
                  title="Notifikasi"
                  aria-label="Notifikasi"
                  tabIndex={collapsed ? -1 : 0}
                  className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors duration-200 hover:bg-gray-100 hover:text-perrific-graphite"
                >
                  <Bell size={16} strokeWidth={1.6} aria-hidden="true" />
                  {unreadCount > 0 && (
                    <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white" />
                  )}
                </button>
              )}
            </span>
          </div>

        </div>
      )}
      <div className={`nice-scroll flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-clip pb-2 pt-2 ${collapsed ? 'no-bar' : ''}`}>
      <DndContext
        sensors={sensors}
        collisionDetection={sidebarCollision}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleSidebarDragStart}
        onDragOver={handleSidebarDragOver}
        onDragEnd={handleSidebarDragEnd}
        onDragCancel={handleSidebarDragCancel}
      >
      {presetSections.includes('privat') && (
        <div style={{ order: sectionOrder.indexOf('privat') }} className={sectionOrder[0] === 'privat' ? '' : 'mt-6'}>
          <div
            className={`flex items-center justify-between overflow-hidden px-3 transition-[max-height,opacity] duration-200 ease-in-out ${
              collapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'
            }`}
          >
            <span className="flex min-w-0 items-center pl-3">
              <p className="whitespace-nowrap font-mono text-[11px] tracking-widest text-perrific-wood">PRIVAT</p>
              <button
                type="button"
                onClick={() => toggleSection('privat')}
                title={privatOpen ? 'Tutup bagian Privat' : 'Buka bagian Privat'}
                aria-label={privatOpen ? 'Tutup bagian Privat' : 'Buka bagian Privat'}
                aria-expanded={privatOpen}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-perrific-wood/70 transition hover:bg-gray-100 hover:text-perrific-violet"
              >
                <ChevronDown size={10} strokeWidth={1.6} aria-hidden="true" className={`transition-transform duration-200 ${privatOpen ? '' : '-rotate-90'}`} />
              </button>
            </span>
        <button
          type="button"
          onClick={() => {
            onRequestExpand?.();
            setTemplatePickerOpen(true);
          }}
          disabled={creating}
          title="Buat baru"
          aria-label="Buat baru"
          aria-haspopup="dialog"
          aria-expanded={templatePickerOpen}
          className="flex h-6 w-6 items-center justify-center rounded-md text-perrific-graphite/40 transition hover:bg-gray-100 hover:text-perrific-violet disabled:opacity-50"
        >
          {creating ? (
            <Loader2 size={13} className="animate-spin text-perrific-violet" aria-hidden="true" />
          ) : (
            <Plus size={13} strokeWidth={1.6} aria-hidden="true" />
          )}
        </button>
      </div>
      {!collapsed && createError && (
        <p role="alert" className="px-6 pt-1 font-manrope text-[11px] text-red-600">
          {createError}
        </p>
      )}
      <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${privatOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
      <div className="overflow-hidden">
      <SortableContext items={privatKeys} strategy={verticalListSortingStrategy}>
      <nav className="mt-2 space-y-1 px-3" aria-label="Navigasi utama" onClickCapture={suppressPostDragClick}>
        {privatEntries.map((entry) => renderNoteEntry(entry.note))}
      </nav>
      </SortableContext>
      </div>
      </div>
      </div>
      )}
      {presetSections.includes('teams') && (
        <div style={{ order: sectionOrder.indexOf('teams') }} className={sectionOrder[0] === 'teams' ? '' : 'mt-6'}>
          <div
            className={`flex items-center justify-between overflow-hidden px-3 transition-[max-height,opacity] duration-200 ease-in-out ${
              collapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'
            }`}
          >
            <span className="flex min-w-0 items-center pl-3">
              <p className="whitespace-nowrap font-mono text-[11px] tracking-widest text-perrific-wood">TIM SAYA</p>
              <button
                type="button"
                onClick={() => toggleSection('teams')}
                title={teamsOpen ? 'Tutup bagian Tim Saya' : 'Buka bagian Tim Saya'}
                aria-label={teamsOpen ? 'Tutup bagian Tim Saya' : 'Buka bagian Tim Saya'}
                aria-expanded={teamsOpen}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-perrific-wood/70 transition hover:bg-gray-100 hover:text-perrific-violet"
              >
                <ChevronDown size={10} strokeWidth={1.6} aria-hidden="true" className={`transition-transform duration-200 ${teamsOpen ? '' : '-rotate-90'}`} />
              </button>
            </span>
            <button
              type="button"
              onClick={openTeamDialog}
              title="Tim baru"
              aria-label="Tim baru"
              aria-haspopup="dialog"
              className="flex h-6 w-6 items-center justify-center rounded-md text-perrific-graphite/40 transition hover:bg-gray-100 hover:text-perrific-violet"
            >
              <Plus size={13} strokeWidth={1.6} aria-hidden="true" />
            </button>
        </div>
        <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${teamsOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden px-3">
        {visibleTeams.length === 0 ? (
          !collapsed && (
            <div className="mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center">
              <p className="font-manrope text-xs text-perrific-graphite/50">
                {archivedTeams.length > 0 ? 'Semua tim diarsipkan' : 'Belum ada tim'}
              </p>
              {archivedTeams.length === 0 ? (
                <button
                  type="button"
                  onClick={handleQuickAddTeam}
                  className="mt-1 inline-flex items-center justify-center font-manrope text-xs font-semibold text-perrific-violet hover:underline"
                >
                  + Buat tim
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onOpenArchive}
                  className="mt-1 inline-flex items-center justify-center font-manrope text-xs font-semibold text-perrific-violet hover:underline"
                >
                  Lihat arsip
                </button>
              )}
              {teamError && (
                <p role="alert" className="mt-2 font-manrope text-[11px] text-red-600">
                  {teamError}
                </p>
              )}
            </div>
          )
        ) : (
          <>
          {!collapsed && teamError && (
            <p role="alert" className="mt-1 px-3 font-manrope text-[11px] text-red-600">
              {teamError}
            </p>
          )}
          <SortableContext items={teamKeys} strategy={verticalListSortingStrategy}>
          <ul className="mt-2 space-y-0.5" onClickCapture={suppressPostDragClick}>
            {visibleTeams.map((team) => renderTeamRow(team))}
          </ul>
          </SortableContext>
          </>
        )}
        </div>
        </div>
        </div>
        )}
      {presetSections.includes('organisasi') && (
        <div style={{ order: sectionOrder.indexOf('organisasi') }} className={sectionOrder[0] === 'organisasi' ? '' : 'mt-6'}>
          <div
            className={`flex items-center justify-between overflow-hidden px-3 transition-[max-height,opacity] duration-200 ease-in-out ${
              collapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'
            }`}
          >
            <span className="flex min-w-0 items-center pl-3">
              <p className="whitespace-nowrap font-mono text-[11px] tracking-widest text-perrific-wood">ORGANISASI</p>
              <button
                type="button"
                onClick={() => toggleSection('organisasi')}
                title={organisasiOpen ? 'Tutup bagian Organisasi' : 'Buka bagian Organisasi'}
                aria-label={organisasiOpen ? 'Tutup bagian Organisasi' : 'Buka bagian Organisasi'}
                aria-expanded={organisasiOpen}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-perrific-wood/70 transition hover:bg-gray-100 hover:text-perrific-violet"
              >
                <ChevronDown size={10} strokeWidth={1.6} aria-hidden="true" className={`transition-transform duration-200 ${organisasiOpen ? '' : '-rotate-90'}`} />
              </button>
            </span>
            <button
              type="button"
              onClick={() => setCreateOrgOpen(true)}
              title="Organisasi baru"
              aria-label="Organisasi baru"
              className="flex h-6 w-6 items-center justify-center rounded-md text-perrific-graphite/40 transition hover:bg-gray-100 hover:text-perrific-violet"
            >
              <Plus size={13} strokeWidth={1.6} aria-hidden="true" />
            </button>
          </div>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${organisasiOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden px-3">
          {organizations.length === 0 ? (
            !collapsed && (
              <div className="mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center">
                <p className="font-manrope text-xs text-perrific-graphite/50">Belum ada organisasi</p>
                <button
                  type="button"
                  onClick={() => setCreateOrgOpen(true)}
                  className="mt-1 inline-flex items-center justify-center font-manrope text-xs font-semibold text-perrific-violet hover:underline"
                >
                  + Buat organisasi
                </button>
              </div>
            )
          ) : (
            <SortableContext items={orgKeys} strategy={verticalListSortingStrategy}>
              <ul className="mt-2 space-y-0.5" onClickCapture={suppressPostDragClick}>
                {orderedOrganizations.map((org) => renderOrgRow(org))}
              </ul>
            </SortableContext>
          )}
          </div>
          </div>
          </div>
        )}
      {createOrgOpen && (
        <CreateOrganizationModal
          onClose={() => setCreateOrgOpen(false)}
          onCreated={(created) => {
            setOrganizations((prev) => [...prev, created]);
            notifyOrganizationsChanged();
            setCreateOrgOpen(false);
            navigate(`/org/${created.id}`);
          }}
        />
      )}
      {(teamDialog === 'buat' || teamDialog === 'buat-langsung') && (
        <CreateTeamModal
          existingTeams={teams.filter((t) => !trashedKeys.has(t.id))}
          currentUserId={user?.id}
          onBack={teamDialog === 'buat' ? () => setTeamDialog('pilih') : undefined}
          onClose={closeTeamDialog}
          onCreated={(created) => {
            setTeams((prev) =>
              prev.some((t) => t.id === created.id)
                ? prev.map((t) => (t.id === created.id ? created : t))
                : [...prev, created],
            );
            notifyTeamsChanged();
            setTeamDialog(null);
            navigate(`/team/${created.id}`);
          }}
        />
      )}
      {(teamDialog === 'pilih' || teamDialog === 'kode') && (
        <ModalShell
          label={teamDialog === 'pilih' ? 'Tim baru' : 'Masuk tim'}
          onClose={closeTeamDialog}
        >
          {teamDialog === 'pilih' ? (
            <div>
              <div className="mb-1 flex items-center justify-between px-1">
                <p className="font-manrope text-sm font-bold text-perrific-graphite">Tim baru</p>
                <button
                  type="button"
                  onClick={closeTeamDialog}
                  aria-label="Tutup"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
                >
                  <X size={14} strokeWidth={1.6} aria-hidden="true" />
                </button>
              </div>
              <p className="px-1 pb-2 font-manrope text-xs text-perrific-graphite/50">Pilih cara membuat atau gabung tim.</p>
              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => setTeamDialog('buat')}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition hover:border-perrific-violet hover:bg-perrific-violet/5"
                >
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-perrific-violet/10 text-perrific-violet">
                    <Plus size={15} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-manrope text-sm font-semibold text-perrific-graphite">
                      Buat tim baru
                    </span>
                    <span className="block truncate font-manrope text-xs text-perrific-graphite/50">
                      Atur nama, foto, dan anggota tim
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={openJoinForm}
                  className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition hover:border-perrific-violet hover:bg-perrific-violet/5"
                >
                  <span aria-hidden="true" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                    <KeyRound size={15} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-manrope text-sm font-semibold text-perrific-graphite">
                      Masuk tim dengan kode
                    </span>
                    <span className="block truncate font-manrope text-xs text-perrific-graphite/50">
                      Gabung pakai kode 8 karakter
                    </span>
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={openTeamDialog}
                  className="font-manrope text-xs font-semibold text-perrific-violet hover:underline"
                >
                  ← Kembali
                </button>
                <button
                  type="button"
                  onClick={closeTeamDialog}
                  aria-label="Tutup"
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
                >
                  <X size={14} strokeWidth={1.6} aria-hidden="true" />
                </button>
              </div>
              <p className="px-1 font-manrope text-sm font-bold text-perrific-graphite">Masuk tim</p>
              <p className="px-1 pb-2 font-manrope text-xs text-perrific-graphite/50">
                Minta kode 8 karakter ke admin tim, lalu masukkan di bawah ini.
              </p>
              <form
                className="mt-3 space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  void handleJoinTeam();
                }}
              >
                <input
                  autoFocus
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8))}
                  placeholder="CONTOH01"
                  maxLength={8}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label="Kode tim"
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5 text-center font-mono text-lg tracking-[0.2em] text-perrific-graphite placeholder:text-gray-300 focus:border-perrific-violet focus:bg-white focus:outline-none"
                />
                {joinError && (
                  <p role="alert" className="font-manrope text-xs text-red-600">
                    {joinError}
                  </p>
                )}
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => !joining && setTeamDialog(null)}
                    disabled={joining}
                    className="rounded-full px-4 py-2 font-manrope text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={joining || joinCode.trim().length === 0}
                    className="rounded-full bg-perrific-violet px-4 py-2 font-manrope text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
                  >
                    {joining ? 'Masuk…' : 'Masuk'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </ModalShell>
      )}
      {presetSections.includes('favorit') && (
        <div style={{ order: sectionOrder.indexOf('favorit') }} className={sectionOrder[0] === 'favorit' ? '' : 'mt-6'}>
          <div
            className={`flex items-center justify-between overflow-hidden px-3 transition-[max-height,opacity] duration-200 ease-in-out ${
              collapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'
            }`}
          >
            <span className="flex min-w-0 items-center pl-3">
              <p className="whitespace-nowrap font-mono text-[11px] tracking-widest text-perrific-wood">FAVORIT</p>
              <button
                type="button"
                onClick={() => toggleSection('favorit')}
                title={favoritOpen ? 'Tutup bagian Favorit' : 'Buka bagian Favorit'}
                aria-label={favoritOpen ? 'Tutup bagian Favorit' : 'Buka bagian Favorit'}
                aria-expanded={favoritOpen}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-perrific-wood/70 transition hover:bg-gray-100 hover:text-perrific-violet"
              >
                <ChevronDown size={10} strokeWidth={1.6} aria-hidden="true" className={`transition-transform duration-200 ${favoritOpen ? '' : '-rotate-90'}`} />
              </button>
            </span>
          </div>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${favoritOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden px-3">
          {favoritEntries.length === 0 && favoritTeams.length === 0 ? (
            !collapsed && (
            <div className="mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center">
              <p className="font-manrope text-xs text-perrific-graphite/50">
                Belum ada favorit.<br />
                Tandai tab dengan bintang.
              </p>
            </div>
            )
          ) : (
            <SortableContext items={favKeys} strategy={verticalListSortingStrategy}>
            <div className="mt-2 space-y-1" onClickCapture={suppressPostDragClick}>
              {favoritEntries.map((entry) => renderFavoritRow(entry))}
              {favoritTeams.map((team) => renderFavoritRow({ kind: 'team', key: team.id, team }))}
            </div>
            </SortableContext>
          )}
          </div>
          </div>
        </div>
      )}
      {presetSections.includes('shortcut') && (
        <div style={{ order: sectionOrder.indexOf('shortcut') }} className={sectionOrder[0] === 'shortcut' ? '' : 'mt-6'}>
          <div
            className={`flex items-center justify-between overflow-hidden px-3 transition-[max-height,opacity] duration-200 ease-in-out ${
              collapsed ? 'max-h-0 opacity-0' : 'max-h-8 opacity-100'
            }`}
          >
            <span className="flex min-w-0 items-center pl-3">
              <p className="whitespace-nowrap font-mono text-[11px] tracking-widest text-perrific-wood">SHORTCUT</p>
              <button
                type="button"
                onClick={() => toggleSection('shortcut')}
                title={shortcutOpen ? 'Tutup bagian Shortcut' : 'Buka bagian Shortcut'}
                aria-label={shortcutOpen ? 'Tutup bagian Shortcut' : 'Buka bagian Shortcut'}
                aria-expanded={shortcutOpen}
                className="ml-1 flex h-6 w-6 items-center justify-center rounded-md text-perrific-wood/70 transition hover:bg-gray-100 hover:text-perrific-violet"
              >
                <ChevronDown size={10} strokeWidth={1.6} aria-hidden="true" className={`transition-transform duration-200 ${shortcutOpen ? '' : '-rotate-90'}`} />
              </button>
            </span>
            {!collapsed && (
              <button
                type="button"
                onClick={() => setShortcutPickerOpen(true)}
                title="Tambah shortcut"
                aria-label="Tambah shortcut"
                className="flex h-6 w-6 items-center justify-center rounded-md text-perrific-graphite/40 transition hover:bg-gray-100 hover:text-perrific-violet"
              >
                <Plus size={13} strokeWidth={1.6} aria-hidden="true" />
              </button>
            )}
          </div>
          <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${shortcutOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden px-3">
          {shortcutRows.length === 0 ? (
            !collapsed && (
            <div className="mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center">
              <p className="font-manrope text-xs text-perrific-graphite/50">Belum ada shortcut.</p>
            </div>
            )
          ) : (
            <SortableContext items={shortcutKeys} strategy={verticalListSortingStrategy}>
            <ul className="mt-2 space-y-0.5" onClickCapture={suppressPostDragClick}>
              {orderedShortcutRows.map((r) => {
                const hint = itemDropHint('shortcut', r.id);
                const targetTeam = r.kind === 'team' ? teams.find((t) => t.id === r.ref) : undefined;
                const targetNote = r.kind === 'note' ? notes.find((n) => n.id === r.ref) : undefined;
                const isEditing =
                  ((r.kind === 'team' && editingTeam === r.ref && !!targetTeam) ||
                    (r.kind === 'note' && editingNoteId === r.ref && !!targetNote) ||
                    (r.kind === 'route' && editingNav === r.ref)) &&
                  editFromShortcut &&
                  !editFromFavorit;
                const startRowEdit = () => beginShortcutRename(r);
                const cancelRowEdit = () => {
                  setEditingTeam(null);
                  setTeamDraft('');
                  setEditingNoteId(null);
                  setNoteDraft('');
                  setEditingNav(null);
                  setNavDraft('');
                };
                return (
                <Fragment key={r.id}>
                  {hint === 'before' && <DropLine />}
                <SortableTabRow
                  id={r.id}
                  as="li"
                  disabled={r.missing || shortcutDragDisabled || isEditing}
                  className="group relative"
                >
                  {r.missing ? (
                    <span
                      className="flex items-center rounded-lg px-3 py-2 font-manrope text-sm text-perrific-graphite/40"
                      title="Target sudah tidak tersedia"
                    >
                      <span className="min-w-0 flex-1 truncate">{r.label}</span>
                    </span>
                  ) : isEditing ? (
                    <div className={navRowClass(false)}>
                      <Link2 size={14} strokeWidth={1.6} className="shrink-0 text-gray-400" aria-hidden="true" />
                      <input
                        autoFocus
                        value={r.kind === 'team' ? teamDraft : r.kind === 'note' ? noteDraft : navDraft}
                        onChange={(e) =>
                          r.kind === 'team'
                            ? setTeamDraft(e.target.value)
                            : r.kind === 'note'
                              ? setNoteDraft(e.target.value)
                              : setNavDraft(e.target.value)
                        }
                        onBlur={() => {
                          if (r.kind === 'team' && targetTeam) commitTeamEdit(targetTeam);
                          else if (r.kind === 'note' && targetNote) commitNoteEdit(targetNote);
                          else if (r.kind === 'route') commitNavEdit();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (r.kind === 'team' && targetTeam) commitTeamEdit(targetTeam);
                            else if (r.kind === 'note' && targetNote) commitNoteEdit(targetNote);
                            else if (r.kind === 'route') commitNavEdit();
                          }
                          if (e.key === 'Escape') cancelRowEdit();
                        }}
                        maxLength={r.kind === 'note' ? 120 : r.kind === 'team' ? 60 : 120}
                        aria-label={`Ubah nama ${r.label}`}
                        className="ml-2.5 min-w-0 flex-1 rounded-md border border-perrific-violet/40 bg-white px-1.5 py-0.5 text-sm focus:outline-none"
                      />
                    </div>
                  ) : (
                    <NavLink
                      to={r.to}
                      className={({ isActive }) => `${navRowClass(isActive)} ${collapsed ? '' : 'pr-8'}`}
                      title={r.label}
                      onDoubleClick={startRowEdit}
                      onContextMenu={(e) => openCtxMenu(e, { kind: 'shortcut', shortcutId: r.id })}
                    >
                      <Link2 size={14} strokeWidth={1.6} className="shrink-0 text-gray-400" aria-hidden="true" />
                      <span
                        className={`min-w-0 flex-1 truncate transition-[max-width,opacity,margin] duration-200 ease-in-out ${
                          collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2.5 max-w-[220px] opacity-100'
                        }`}
                      >
                        {r.label}
                      </span>
                    </NavLink>
                  )}
                  {!collapsed && !isEditing && (
                    <button
                      type="button"
                      aria-label={`Opsi untuk ${r.label}`}
                      aria-haspopup="menu"
                      onClick={(e) => {
                        e.stopPropagation();
                        openCtxMenu(e, { kind: 'shortcut', shortcutId: r.id });
                      }}
                      className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md bg-white/80 text-gray-400 opacity-0 shadow-sm backdrop-blur transition hover:bg-gray-100 hover:text-perrific-graphite focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                    >
                      <MoreHorizontal size={14} strokeWidth={1.6} aria-hidden="true" />
                    </button>
                  )}
                </SortableTabRow>
                  {hint === 'after' && <DropLine />}
                </Fragment>
                );
              })}
            </ul>
            </SortableContext>
          )}
          </div>
          </div>
        </div>
      )}
      {sectionOrder.length === 0 && !collapsed && (
        <div className="mx-3 mt-2 rounded-lg border border-dashed border-gray-300 px-3 py-4 text-center">
          <p className="font-manrope text-xs text-perrific-graphite/50">
            Semua bagian disembunyikan.<br />
            Tambahkan lagi lewat Edit sidebar.
          </p>
        </div>
      )}
      <DragOverlay adjustScale={false} dropAnimation={null} modifiers={[restrictToVerticalAxis]}>
        {draggedTabInfo ? (
          <div className="pointer-events-none flex w-[232px] items-center gap-2.5 rounded-lg border border-perrific-violet/40 bg-white px-3 py-2 text-sm text-perrific-graphite opacity-95 shadow-[0_8px_20px_rgba(0,0,0,0.12)] ring-1 ring-perrific-violet/20">
            {draggedTabInfo.icon}
            <span className="min-w-0 flex-1 truncate font-manrope text-sm font-medium">
              {draggedTabInfo.title}
            </span>
          </div>
        ) : null}
      </DragOverlay>
      </DndContext>
      </div>

      <div ref={menuRef} className="relative z-20 shrink-0 border-t border-gray-200 bg-white p-3">
        {!collapsed && onOpenEdit && (
          <button
            type="button"
            onClick={onOpenEdit}
            title="Edit sidebar"
            aria-label="Edit sidebar"
            className="mb-1 flex w-full items-center gap-2.5 rounded-lg px-3 py-2 font-manrope text-sm font-medium text-gray-600 transition-colors duration-200 hover:bg-gray-100 hover:text-perrific-graphite"
          >
            <Pencil size={16} strokeWidth={1.6} />
            <span>Edit sidebar</span>
          </button>
        )}
        {menuOpen && (
          <div role="menu" aria-label="Menu akun" className={`absolute bottom-full z-10 mb-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-[0_8px_24px_rgba(26,26,30,0.14)] ${collapsed ? 'left-2 w-60' : 'inset-x-3'}`}>
            <div className="flex items-center gap-2.5 px-3 py-3">
              <Avatar src={user?.avatarUrl} name={user?.name} size={36} className="h-9 w-9" alt={`${user?.name ?? 'User'} avatar`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-manrope text-sm font-semibold text-perrific-graphite">
                  {user?.name}
                </span>
                <span className="block truncate font-mono text-[11px] text-perrific-graphite/50">
                  {user?.email}
                </span>
              </span>
            </div>
            <div className="h-px bg-gray-100" />
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                navigate('/settings');
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <Settings size={16} strokeWidth={1.6} />
              Pengaturan
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setMenuOpen(false);
                setTrashOpen(true);
              }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <Trash2 size={16} strokeWidth={1.6} />
              <span className="min-w-0 flex-1 text-left">Sampah</span>
              {trashItems.length > 0 && (
                <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-medium text-perrific-graphite/60">
                  {trashItems.length}
                </span>
              )}
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={handleLogout}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={16} strokeWidth={1.6} />
              Keluar
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          title="Menu akun"
          className="flex w-full items-center justify-center rounded-lg px-3 py-2 text-left transition-colors duration-200 hover:bg-gray-100"
        >
          <Avatar src={user?.avatarUrl} name={user?.name} size={36} className="h-9 w-9" alt={`${user?.name ?? 'User'} avatar`} />
          <span
            className={`min-w-0 flex-1 overflow-hidden whitespace-nowrap transition-[max-width,opacity,margin] duration-200 ease-in-out ${
              collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2.5 max-w-[220px] opacity-100'
            }`}
          >
            <span className="block truncate font-manrope text-sm font-semibold text-perrific-graphite">
              {user?.name}
            </span>
            <span className="block truncate font-mono text-[11px] text-perrific-graphite/50">
              {user?.email}
            </span>
          </span>
          <ChevronDown
            size={14}
            strokeWidth={1.6}
            aria-hidden="true"
            className={`shrink-0 overflow-hidden text-perrific-graphite/40 transition-[max-width,opacity,margin,transform] duration-200 ease-in-out ${
              collapsed ? 'ml-0 max-w-0 opacity-0' : 'ml-2 max-w-[20px] opacity-100'
            } ${menuOpen ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {templatePickerOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Buat baru di Privat"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setTemplatePickerOpen(false);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setTemplatePickerOpen(false);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_48px_rgba(26,26,30,0.2)]">
            <div className="mb-1 flex items-center justify-between px-1">
              <p className="font-manrope text-sm font-bold text-perrific-graphite">Buat baru di Privat</p>
              <button
                type="button"
                onClick={() => setTemplatePickerOpen(false)}
                aria-label="Tutup"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <X size={14} strokeWidth={1.6} />
              </button>
            </div>
            <p className="px-1 pb-2 font-manrope text-xs text-perrific-graphite/50">Pilih template untuk tab privat barumu.</p>
            <div className="space-y-1">
              <button
                type="button"
                disabled={creating}
                onClick={() => handleCreateFromTemplate('note')}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition hover:border-perrific-violet hover:bg-perrific-violet/5 disabled:opacity-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <FileText size={15} strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-manrope text-sm font-semibold text-perrific-graphite">Note</span>
                  <span className="block truncate font-manrope text-xs text-perrific-graphite/50">Halaman kosong untuk catatan bebas</span>
                </span>
              </button>
              <button
                type="button"
                disabled={creating}
                onClick={() => handleCreateFromTemplate('activity')}
                className="flex w-full items-center gap-3 rounded-xl border border-gray-200 px-3 py-2.5 text-left transition hover:border-perrific-violet hover:bg-perrific-violet/5 disabled:opacity-50"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <Calendar size={15} strokeWidth={1.6} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-manrope text-sm font-semibold text-perrific-graphite">Aktivitas harian</span>
                  <span className="block truncate font-manrope text-xs text-perrific-graphite/50">Buat untuk hari ini, buka di Harian</span>
                </span>
              </button>
            </div>
            {createError && (
              <p role="alert" className="px-1 pt-2 font-manrope text-xs text-red-600">
                {createError}
              </p>
            )}
          </div>
          </div>,
          document.body,
        )}
      {shortcutPickerOpen &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Tambah shortcut"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShortcutPickerOpen(false);
          }}
        >
          <div className="nice-scroll max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_16px_48px_rgba(26,26,30,0.2)]">
            <div className="mb-2 flex items-center justify-between px-1">
              <p className="font-manrope text-sm font-bold text-perrific-graphite">Tambah shortcut</p>
              <button
                type="button"
                onClick={() => setShortcutPickerOpen(false)}
                aria-label="Tutup"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <X size={14} strokeWidth={1.6} />
              </button>
            </div>
            {(
              [
                { title: 'Halaman', opts: ROUTE_SHORTCUTS },
                {
                  title: 'Tim',
                  opts: orderedTeams
                    .filter((t) => !trashedKeys.has(t.id))
                    .map((t) => ({ kind: 'team' as const, ref: t.id, label: t.name })),
                },
                {
                  title: 'Catatan',
                  opts: notes
                    .filter((n) => !trashedKeys.has(notePath(n.id)))
                    .map((n) => ({ kind: 'note' as const, ref: n.id, label: n.title || 'Tanpa judul' })),
                },
              ] as const
            ).map((group) =>
              group.opts.length === 0 ? null : (
                <div key={group.title} className="mt-2">
                  <p className="px-2 pb-1 font-mono text-[10px] tracking-widest text-perrific-graphite/40">
                    {group.title.toUpperCase()}
                  </p>
                  {group.opts
                    .filter((o) => !shortcuts.some((s) => s.kind === o.kind && s.ref === o.ref))
                    .map((o) => (
                      <button
                        key={`${o.kind}:${o.ref}`}
                        type="button"
                        onClick={() => {
                          addShortcut({ kind: o.kind, ref: o.ref });
                          setShortcutPickerOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left font-manrope text-sm text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                      >
                        <Plus size={13} strokeWidth={1.6} className="shrink-0 text-gray-400" />
                        <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      </button>
                    ))}
                </div>
              ),
            )}
          </div>
          </div>,
          document.body,
        )}
      {ctxMenu && (
        <div
          id="sidebar-ctx-menu"
          ref={ctxMenuRef}
          role="menu"
          aria-label="Opsi tab"
          className="nice-scroll fixed z-50 min-w-[190px] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-[0_8px_24px_rgba(26,26,30,0.14)]"
          style={{
            left: ctxMenuPos?.x ?? ctxMenu.x,
            top: ctxMenuPos?.y ?? ctxMenu.y,
            maxHeight: 'calc(100vh - 16px)',
          }}
        >
          {ctxMenu.view === 'icons' ? (
            <div className="p-2">
              <p className="px-1 pb-1.5 font-mono text-[11px] tracking-widest text-perrific-wood">PILIH IKON</p>
              <div className="nice-scroll grid max-h-48 grid-cols-6 gap-1 overflow-y-auto" role="group" aria-label="Pilih ikon">
                {TAB_ICONS.map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    title={label}
                    aria-label={label}
                    onClick={() => {
                      if (ctxMenu.kind === 'nav') setNavIcon(ctxMenu.to, key);
                      else if (ctxMenu.kind === 'team') setTeamIcon(ctxMenu.team.id, key);
                      setCtxMenu(null);
                    }}
                    className="rounded-lg p-1.5 text-gray-600 transition hover:bg-gray-100 hover:text-perrific-violet"
                  >
                    <ActivityIcon name={key} className="h-4 w-4" />
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  if (ctxMenu.kind === 'nav') setNavIcon(ctxMenu.to, null);
                  else if (ctxMenu.kind === 'team') setTeamIcon(ctxMenu.team.id, null);
                  setCtxMenu(null);
                }}
                className="mt-1.5 w-full rounded-lg px-2 py-1.5 text-left font-manrope text-xs text-perrific-graphite/60 transition hover:bg-gray-100"
              >
                Kembalikan bawaan
              </button>
            </div>
          ) : (
            <>
              {(() => {
                const row =
                  ctxMenu.kind === 'shortcut'
                    ? shortcutRows.find((r) => r.id === ctxMenu.shortcutId)
                    : null;
                if (ctxMenu.kind === 'shortcut' && (!row || row.missing)) return null;
                return (
              <button
                type="button"
                role="menuitem"
                autoFocus
                onClick={() => {
                  const favEntry = favCtxEntryRef.current;
                  favCtxEntryRef.current = null;
                  if (favEntry) {
                    beginFavoritRename(favEntry);
                  } else if (ctxMenu.kind === 'nav') {
                    const note = findNoteByPath(notes, ctxMenu.to);
                    if (note) startNoteEdit(note);
                    else startNavEdit(ctxMenu.to, ctxMenu.label);
                  } else if (ctxMenu.kind === 'team') {
                    startTeamEdit(ctxMenu.team);
                  } else if (row) {
                    beginShortcutRename(row);
                  }
                  setCtxMenu(null);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <Pencil size={14} strokeWidth={1.6} />
                Ubah nama
              </button>
                );
              })()}
              {ctxMenu.kind === 'nav' && (
              <button
                type="button"
                role="menuitem"
                onClick={() => setCtxMenu({ ...ctxMenu, view: 'icons' })}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <Smile size={14} strokeWidth={1.6} />
                Ganti ikon
              </button>
              )}
              {ctxMenu.kind === 'team' && (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      const target = ctxMenu.team;
                      setCtxMenu(null);
                      openEditTeamDesc(target);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                  >
                    <AlignLeft size={14} strokeWidth={1.6} />
                    Edit deskripsi
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      teamAvatarTargetRef.current = ctxMenu.team;
                      setCtxMenu(null);
                      teamAvatarInputRef.current?.click();
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                  >
                    <ImageIcon size={14} strokeWidth={1.6} />
                    Ganti gambar
                  </button>
                  {(ctxMenu.team.avatarUrl || teamIcons[ctxMenu.team.id]) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        const target = ctxMenu.team;
                        setCtxMenu(null);
                        void handleRemoveTeamAvatar(target);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      <X size={14} strokeWidth={1.6} />
                      Hapus gambar
                    </button>
                  )}
                </>
              )}
              <button
                type="button"
                role="menuitem"
                disabled={!menuCanUp}
                title={menuMoveTarget?.section === 'privat' ? 'Naik sesama level' : 'Naik'}
                onClick={() => {
                  if (!menuMoveTarget) return;
                  if (menuMoveTarget.section === 'privat') movePrivatMenu(menuMoveTarget.key, -1);
                  else move(menuMoveTarget.section, menuMoveTarget.listKeys, menuMoveTarget.key, -1);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-600"
              >
                <ArrowUp size={14} strokeWidth={1.6} />
                Naik
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!menuCanDown}
                title={menuMoveTarget?.section === 'privat' ? 'Turun sesama level' : 'Turun'}
                onClick={() => {
                  if (!menuMoveTarget) return;
                  if (menuMoveTarget.section === 'privat') movePrivatMenu(menuMoveTarget.key, 1);
                  else move(menuMoveTarget.section, menuMoveTarget.listKeys, menuMoveTarget.key, 1);
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-gray-600"
              >
                <ArrowDown size={14} strokeWidth={1.6} />
                Turun
              </button>
              {ctxMenu.kind === 'nav' ? (
                <>
                  {hiddenNav.includes(ctxMenu.to) ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        // Keluarkan seisi cabang agar anak tak jadi yatim tak terlihat.
                        const target = findNoteByPath(notes, ctxMenu.to);
                        if (target) {
                          for (const item of noteBranch(target.id)) showNav(privatPathOf(item));
                        } else {
                          showNav(ctxMenu.to);
                        }
                        setCtxMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      <Eye size={14} strokeWidth={1.6} />
                      Keluarkan dari arsip
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        // Arsipkan seisi cabang agar anak tak jadi yatim tak terlihat.
                        // Sedang melihat salah satunya → pindah ke notes.
                        const target = findNoteByPath(notes, ctxMenu.to);
                        if (target) {
                          const branch = noteBranch(target.id);
                          for (const item of branch) hideNav(privatPathOf(item));
                          const viewing = privatIdFromPath(location.pathname);
                          if (viewing && branch.some((item) => item.id === viewing)) {
                            navigate('/notes');
                          }
                        } else {
                          hideNav(ctxMenu.to);
                        }
                        setCtxMenu(null);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      <Archive size={14} strokeWidth={1.6} />
                      Arsipkan
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggleStar(ctxMenu.to);
                      setCtxMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                  >
                    <Star
                      size={14}
                      strokeWidth={1.6}
                      className={starred.includes(ctxMenu.to) ? 'fill-amber-400 text-amber-400' : ''}
                    />
                    {starred.includes(ctxMenu.to) ? 'Hapus dari Favorit' : 'Favorit'}
                  </button>
                  {(() => {
                    const target: { kind: 'note' | 'route'; ref: string } = (() => {
                      const note = findNoteByPath(notes, ctxMenu.to);
                      return note
                        ? { kind: 'note', ref: note.id }
                        : { kind: 'route', ref: ctxMenu.to };
                    })();
                    const pinned = isPinned(target.kind, target.ref);
                    return (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          if (pinned) unpinShortcut(target.kind, target.ref);
                          else addShortcut(target);
                          setCtxMenu(null);
                        }}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                      >
                        <Link2 size={14} strokeWidth={1.6} />
                        {pinned ? 'Hapus shortcut' : 'Tambahkan ke shortcut'}
                      </button>
                    );
                  })()}
                  {(() => {
                    const note = findNoteByPath(notes, ctxMenu.to);
                    if (!note) return null;
                    return (
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => handleDeleteNote(note)}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-red-600 transition hover:bg-red-50"
                      >
                        <Trash2 size={14} strokeWidth={1.6} />
                        Hapus Tab
                      </button>
                    );
                  })()}
                </>
              ) : ctxMenu.kind === 'team' ? (
                <>
                  {hiddenTeams.includes(ctxMenu.team.id) ? (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleUnarchiveTeam(ctxMenu.team)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      <Eye size={14} strokeWidth={1.6} />
                      Keluarkan dari arsip
                    </button>
                  ) : (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleArchiveTeam(ctxMenu.team)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                    >
                      <Archive size={14} strokeWidth={1.6} />
                      Arsipkan
                    </button>
                  )}
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      toggleStar(ctxMenu.team.id);
                      setCtxMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                  >
                    <Star
                      size={14}
                      strokeWidth={1.6}
                      className={starred.includes(ctxMenu.team.id) ? 'fill-amber-400 text-amber-400' : ''}
                    />
                    {starred.includes(ctxMenu.team.id) ? 'Hapus dari Favorit' : 'Favorit'}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      if (isPinned('team', ctxMenu.team.id)) unpinShortcut('team', ctxMenu.team.id);
                      else addShortcut({ kind: 'team', ref: ctxMenu.team.id });
                      setCtxMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-gray-600 transition hover:bg-gray-100 hover:text-perrific-graphite"
                  >
                    <Link2 size={14} strokeWidth={1.6} />
                    {isPinned('team', ctxMenu.team.id) ? 'Hapus shortcut' : 'Tambahkan ke shortcut'}
                  </button>
                  {isTeamAdmin(ctxMenu.team) && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => handleDeleteTeam(ctxMenu.team)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-red-600 transition hover:bg-red-50"
                    >
                      <Trash2 size={14} strokeWidth={1.6} />
                      Hapus tim
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      removeShortcut(ctxMenu.shortcutId);
                      setCtxMenu(null);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 font-manrope text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <Trash2 size={14} strokeWidth={1.6} />
                    Hapus shortcut
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
      {trashOpen && (
        <ModalShell label="Sampah" zClass="z-40" onClose={() => setTrashOpen(false)}>
          <div className="mb-1 flex items-center justify-between px-1">
            <p className="font-manrope text-sm font-bold text-perrific-graphite">
              Sampah
              {trashItems.length > 0 && (
                <span className="ml-1.5 rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[11px] font-medium text-perrific-graphite/60">
                  {trashItems.length}
                </span>
              )}
            </p>
            <div className="flex items-center gap-1">
              {trashItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setConfirmEmptyTrash(true)}
                  className="rounded-lg px-2 py-1 font-manrope text-xs font-semibold text-red-500 hover:bg-red-50"
                >
                  Kosongkan
                </button>
              )}
              <button
                type="button"
                onClick={() => setTrashOpen(false)}
                aria-label="Tutup"
                autoFocus
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-perrific-graphite"
              >
                <X size={14} strokeWidth={1.6} />
              </button>
            </div>
          </div>
          {trashItems.length === 0 ? (
            <p className="px-1 py-6 text-center font-manrope text-xs text-perrific-graphite/50">
              Sampah kosong.
            </p>
          ) : (
            <ul className="space-y-1">
              {trashItems.map((item) => {
                const targetNote = item.kind === 'note' ? notes.find((n) => n.id === item.id) : undefined;
                const to =
                  item.kind === 'team'
                    ? `/team/${item.id}`
                    : targetNote
                      ? privatPathOf(targetNote)
                      : notePath(item.id);
                const left = trashDaysLeft(item);
                return (
                  <li
                    key={`${item.kind}:${item.id}`}
                    className="flex items-center gap-2 rounded-lg px-3 py-2 font-manrope text-sm text-gray-600"
                  >
                    <span className="min-w-0 flex-1 truncate">
                      <NavLink
                        to={to}
                        className="truncate font-medium hover:text-perrific-graphite hover:underline"
                        title={item.title}
                      >
                        {item.title}
                      </NavLink>
                      <span
                        className="block truncate font-mono text-[10px] text-perrific-graphite/40"
                        title="Dihapus permanen otomatis setelah 30 hari"
                      >
                        tersisa {left} hari
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => restoreTrash(item.kind, item.id)}
                      title="Kembalikan"
                      aria-label={`Kembalikan ${item.title}`}
                      className="shrink-0 font-manrope text-[11px] font-semibold text-perrific-violet hover:underline"
                    >
                      Kembalikan
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePurgeItem(item.kind, item.id, item.title)}
                      title="Hapus permanen"
                      aria-label={`Hapus permanen ${item.title}`}
                      className="shrink-0 font-manrope text-[11px] font-semibold text-red-500 hover:text-red-700 hover:underline"
                    >
                      Hapus
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </ModalShell>
      )}
      <ConfirmModal
        open={pendingDelete !== null}
        title={
          !pendingDelete
            ? 'Hapus?'
            : pendingDelete.kind === 'trash-team'
              ? `Pindahkan tim "${pendingDelete.team.name}" ke Sampah?`
              : pendingDelete.kind === 'trash-note'
                ? `Pindahkan tab "${pendingDelete.note.title}" ke Sampah?`
                : pendingDelete.kind === 'purge-team'
                  ? `Hapus permanen tim "${pendingDelete.team.name}"?`
                  : `Hapus permanen tab "${pendingDelete.note.title}"?`
        }
        message={
          !pendingDelete || pendingDelete.kind.startsWith('trash')
            ? 'Bisa dikembalikan lagi dari Sampah.'
            : 'Tidak bisa dikembalikan lagi.'
        }
        confirmLabel={
          !pendingDelete || pendingDelete.kind.startsWith('trash') ? 'Pindahkan' : 'Hapus permanen'
        }
        busy={deleting}
        onCancel={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={confirmPendingDelete}
      />
      <ConfirmModal
        open={confirmEmptyTrash}
        title="Kosongkan sampah?"
        message="Seluruh isi Sampah dihapus permanen dan tidak bisa dikembalikan."
        confirmLabel="Kosongkan"
        busy={deleting}
        onCancel={() => {
          if (!deleting) setConfirmEmptyTrash(false);
        }}
        onConfirm={purgeEmptyTrash}
      />
      <input
        ref={teamAvatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleChangeTeamAvatar}
        className="hidden"
      />
      {editingDescTeam && (
        <ModalShell
          label="Edit deskripsi tim"
          onClose={() => !savingTeamDesc && setEditingDescTeam(null)}
        >
          <div className="mb-1 flex items-center justify-between px-1">
            <div className="min-w-0">
              <p className="font-manrope text-sm font-bold text-perrific-graphite">
                Edit deskripsi tim
              </p>
              <p className="truncate font-manrope text-xs text-perrific-graphite/50">
                {editingDescTeam.name}
              </p>
            </div>
            <button
              type="button"
              onClick={() => !savingTeamDesc && setEditingDescTeam(null)}
              aria-label="Tutup"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-perrific-graphite"
            >
              <X size={14} strokeWidth={1.6} />
            </button>
          </div>
          <form onSubmit={handleSaveTeamDesc} className="mt-3 space-y-3">
            <div>
              <textarea
                autoFocus
                rows={3}
                value={teamDescDraft}
                onChange={(e) => setTeamDescDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleSaveTeamDesc(e);
                  }
                }}
                placeholder="Tulis deskripsi singkat tim (kosongkan untuk menghapus)…"
                maxLength={500}
                aria-label="Deskripsi tim"
                className="w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2.5 font-manrope text-sm text-perrific-graphite placeholder:text-gray-400 focus:border-perrific-violet focus:outline-none focus:ring-2 focus:ring-perrific-violet/20"
              />
              <p className="mt-1 text-right font-mono text-[11px] text-gray-400">
                {teamDescDraft.length}/500
              </p>
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !savingTeamDesc && setEditingDescTeam(null)}
                disabled={savingTeamDesc}
                className="rounded-full px-4 py-2 font-manrope text-xs font-semibold text-gray-600 transition hover:bg-gray-100 disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={savingTeamDesc}
                className="rounded-full bg-perrific-violet px-4 py-2 font-manrope text-xs font-semibold text-white transition hover:brightness-110 disabled:opacity-50"
              >
                {savingTeamDesc ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </form>
        </ModalShell>
      )}
    </div>
  );
}

export const APP_SIDEBAR_EVENT = 'app-sidebar-changed';

export function isAppSidebarCollapsed(): boolean {
  try {
    return localStorage.getItem('purrific:sidebar-collapsed') === '1';
  } catch {
    return false;
  }
}

export default function AppLayout() {
  useDisplayScale();
  const { user } = useAuth();
  const { socket } = useSocket();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('purrific:sidebar-collapsed') === '1';
    } catch {
      return false;
    }
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const [notes, setNotes] = useState<Note[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);

  const { hidden: hiddenNav, show: showNav, showAll: showAllNav } = useHiddenNav(user?.id);
  const { hidden: hiddenTeams, show: showTeam, showAll: showAllTeams } = useHiddenTeams(user?.id);
  const { starred } = useFavorites(user?.id);
  const { items: trashItems } = useTrash(user?.id);
  const { map: navIcons } = useSyncedMap('purrific:navIcons', user?.id);
  const { map: teamIcons } = useSyncedMap('purrific:teamIcons', user?.id);
  const { order: sectionOrder, reorder: reorderSections } = useSectionOrder(user?.id);
  const { active: presetSections, add: addPreset, remove: removePreset } = usePresetSections(user?.id);

  const refreshUnreadCount = useCallback(() => {
    notificationApi
      .list()
      .then((list) => {
        setUnreadCount((list || []).filter((n) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    refreshUnreadCount();
  }, [refreshUnreadCount]);

  useEffect(() => {
    let cancelled = false;
    const fetchTeams = () => {
      teamApi
        .listMyTeams()
        .then((list) => {
          if (!cancelled) setTeams(list);
        })
        .catch(() => {
          if (!cancelled) setTeams([]);
        });
    };
    const onStorage = (e: StorageEvent) => {
      if (!e.key || e.key === TEAMS_CHANGED_EVENT) {
        fetchTeams();
      }
    };
    fetchTeams();
    window.addEventListener(TEAMS_CHANGED_EVENT, fetchTeams);
    window.addEventListener('storage', onStorage);
    if (socket) {
      socket.on('team:updated', fetchTeams);
    }
    return () => {
      cancelled = true;
      window.removeEventListener(TEAMS_CHANGED_EVENT, fetchTeams);
      window.removeEventListener('storage', onStorage);
      if (socket) {
        socket.off('team:updated', fetchTeams);
      }
    };
  }, [socket]);

  useEffect(() => {
    let cancelled = false;
    const fetchNotes = () => {
      noteApi
        .listMine()
        .then((list) => {
          if (!cancelled) setNotes(list);
        })
        .catch(() => {
          if (!cancelled) setNotes([]);
        });
    };
    fetchNotes();
    window.addEventListener(NOTES_CHANGED_EVENT, fetchNotes);
    return () => {
      cancelled = true;
      window.removeEventListener(NOTES_CHANGED_EVENT, fetchNotes);
    };
  }, []);

  const trashedKeys = useMemo(() => new Set(trashItems.map((t: TrashedItem) => t.id)), [trashItems]);

  const archivedTeams = useMemo(
    () => teams.filter((t) => hiddenTeams.includes(t.id) && !trashedKeys.has(t.id)),
    [teams, hiddenTeams, trashedKeys],
  );

  const archivedNav = useMemo(
    () =>
      hiddenNav.filter(
        (to) =>
          to !== '/notes' &&
          to !== '/dashboard' &&
          to !== '/daily' &&
          !trashedKeys.has(to) &&
          findNoteByPath(notes, to) !== undefined,
      ),
    [hiddenNav, trashedKeys, notes],
  );

  useEffect(() => {
    if (!socket) return;

    const handleNew = (notif: any) => {
      setUnreadCount((prev) => prev + 1);
      const title = notif?.title || 'Notifikasi Baru';
      const msg = notif?.message ? `${title}: ${notif.message}` : title;
      showToast(msg, {
        label: 'Lihat',
        onAction: () => {
          setCollapsed(true);
          setOpen(false);
          setArchiveOpen(false);
          setEditOpen(false);
          setNotificationsOpen(true);
        },
      });
      window.dispatchEvent(new CustomEvent('purrific:notification-new', { detail: notif }));
    };

    const handleRead = (payload: { notificationId?: string }) => {
      refreshUnreadCount();
      window.dispatchEvent(new CustomEvent('purrific:notification-read', { detail: payload }));
    };

    const handleReadAll = () => {
      setUnreadCount(0);
      window.dispatchEvent(new CustomEvent('purrific:notification-read-all'));
    };

    socket.on('notification:new', handleNew);
    socket.on('notification:read', handleRead);
    socket.on('notification:read-all', handleReadAll);

    return () => {
      socket.off('notification:new', handleNew);
      socket.off('notification:read', handleRead);
      socket.off('notification:read-all', handleReadAll);
    };
  }, [socket, refreshUnreadCount]);

  function handleOpenNotifications() {
    setCollapsed(true);
    setOpen(false);
    setArchiveOpen(false);
    setEditOpen(false);
    setNotificationsOpen(true);
  }

  function handleCloseNotifications() {
    setNotificationsOpen(false);
    setCollapsed(false);
  }

  function handleOpenArchive() {
    setCollapsed(true);
    setOpen(false);
    setNotificationsOpen(false);
    setEditOpen(false);
    setArchiveOpen(true);
  }

  function handleCloseArchive() {
    setArchiveOpen(false);
    setCollapsed(false);
  }

  function handleOpenEdit() {
    setCollapsed(true);
    setOpen(false);
    setNotificationsOpen(false);
    setArchiveOpen(false);
    setEditOpen(true);
  }

  function handleCloseEdit() {
    setEditOpen(false);
    setCollapsed(false);
  }

  function handleCloseAnyPanel() {
    setNotificationsOpen(false);
    setArchiveOpen(false);
    setEditOpen(false);
    setCollapsed(false);
  }

  // Semua gerakan dikoordinasi via transisi CSS 200ms yang sama (lebar aside,
  // padding baris, label fade) sehingga ikon meluncur halus, bukan melompat.
  const location = useLocation();

  useEffect(() => {
    setOpen(false);
    setArchiveOpen(false);
    setEditOpen(false);
  }, [location.pathname]);

  function toggleCollapsed() {
    setCollapsed((v) => {
      try {
        localStorage.setItem('purrific:sidebar-collapsed', v ? '0' : '1');
      } catch {
        // abaikan — penyimpanan lokal tidak tersedia
      }
      window.dispatchEvent(new Event(APP_SIDEBAR_EVENT));
      return !v;
    });
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Overlay mobile */}
      <div
        role="button"
        tabIndex={open ? 0 : -1}
        aria-label="Tutup menu"
        onClick={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen(false);
          }
        }}
        className={`fixed inset-0 z-30 bg-black/30 transition-opacity duration-300 ease-in-out lg:hidden ${
          open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      />

      {/* Sidebar desktop */}
      <aside
        className={`hidden shrink-0 overflow-hidden border-gray-200 transition-[width,border-color] duration-300 ease-in-out lg:sticky lg:top-0 lg:self-start lg:block lg:h-screen ${
          collapsed ? 'lg:w-0 border-r-0' : 'lg:w-64 border-r'
        }`}
      >
        <div
          className={`h-full w-64 min-w-[16rem] transition-transform duration-300 ease-in-out ${
            collapsed ? '-translate-x-full' : 'translate-x-0'
          }`}
        >
          <SidebarContent
            collapsed={collapsed}
            onRequestExpand={() => setCollapsed(false)}
            onToggleCollapse={toggleCollapsed}
            onOpenNotifications={handleOpenNotifications}
            onOpenArchive={handleOpenArchive}
            onOpenEdit={handleOpenEdit}
            unreadCount={unreadCount}
          />
        </div>
      </aside>

      {/* Tombol buka sidebar saat tertutup penuh */}
      <button
        type="button"
        onClick={toggleCollapsed}
        title="Buka sidebar"
        aria-label="Buka sidebar"
        tabIndex={collapsed && !notificationsOpen && !archiveOpen && !editOpen ? 0 : -1}
        className={`fixed left-3 top-3 z-30 hidden h-8 w-8 items-center justify-center rounded-lg border border-gray-200/80 bg-white shadow-sm text-perrific-graphite transition-all duration-300 ease-in-out hover:bg-gray-100 hover:scale-105 active:scale-95 lg:flex ${
          collapsed && !notificationsOpen && !archiveOpen && !editOpen
            ? 'opacity-100 translate-x-0 pointer-events-auto'
            : 'opacity-0 -translate-x-2 pointer-events-none'
        }`}
      >
        <ChevronRight size={16} strokeWidth={1.6} />
      </button>

      {/* Sidebar mobile (geser) */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 border-r border-gray-200 transition-transform duration-300 ease-in-out lg:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <SidebarContent
          collapsed={false}
          onClose={() => setOpen(false)}
          onOpenNotifications={handleOpenNotifications}
          onOpenArchive={handleOpenArchive}
          onOpenEdit={handleOpenEdit}
          unreadCount={unreadCount}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Tombol burger floating draggable untuk layar ponsel */}
        <FloatingMobileBurger
          onOpen={() => setOpen(true)}
          hidden={open || notificationsOpen || archiveOpen || editOpen}
        />

        <main className="flex-1 min-w-0 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>

      {/* Backdrop saat notifikasi, arsip, atau edit sidebar terbuka */}
      {(notificationsOpen || archiveOpen || editOpen) && (
        <button
          type="button"
          aria-label="Tutup panel"
          onClick={handleCloseAnyPanel}
          className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[1px] transition-opacity"
        />
      )}

      {/* Drawer panel notifikasi dengan tombol X di pojok kiri atas */}
      <NotificationPanel
        open={notificationsOpen}
        onClose={handleCloseNotifications}
        onUnreadCountChange={setUnreadCount}
      />

      {/* Drawer panel arsip dengan tombol X di pojok kiri atas */}
      <ArchivePanel
        open={archiveOpen}
        onClose={handleCloseArchive}
        archivedNav={archivedNav}
        archivedTeams={archivedTeams}
        notes={notes}
        navIcons={navIcons}
        starred={starred}
        onUnarchiveAll={() => {
          showAllNav();
          showAllTeams();
        }}
        onUnarchiveNav={showNav}
        onUnarchiveTeam={showTeam}
        renderTeamBadge={(team) => renderTeamBadgeHelper(team, teamIcons)}
      />

      {/* Drawer panel edit sidebar dengan tombol X di pojok kiri atas */}
      <EditSidebarPanel
        open={editOpen}
        onClose={handleCloseEdit}
        sectionOrder={sectionOrder}
        presetSections={presetSections}
        onReorderSections={reorderSections}
        onAddPreset={addPreset}
        onRemovePreset={removePreset}
        sectionLabel={sectionLabel}
      />

      <UsernameModal />
      {/* Satu host untuk seluruh app (di luar SidebarContent yang mount ganda) */}
      <ToastHost />
    </div>
  );
}
