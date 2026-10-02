import type { TableColumnType } from '@/types';
import {
  FileText,
  Target,
  Lightbulb,
  Pin,
  CheckSquare,
  Flame,
  BookOpen,
  Briefcase,
  Users,
  Sun,
  Moon,
  Zap,
  Home,
  Star,
  Heart,
  Flag,
  Tag,
  Globe,
  Calendar,
  Clock,
  Folder,
  BarChart2,
  Bell,
  Music,
  Inbox,
  Columns3,
  Settings,
  Trash2,
  Pencil,
  CheckCircle2,
  Sliders,
  Copy,
  Check,
  Search,
  X,
  Type,
  Hash,
  CircleDot,
  PlayCircle,
  StopCircle,
  User,
  Paperclip,
  Link,
  Phone,
  Mail,
  ChevronDown,
  type LucideIcon,
} from 'lucide-react';

// Ikon aktivitas: key string (<=8 char, sesuai validasi backend) + label Indonesia.
// Nilai lama berupa emoji di DB otomatis jatuh ke ikon default 'note'.

export type ActivityIconName =
  | 'note'
  | 'target'
  | 'idea'
  | 'pin'
  | 'check'
  | 'fire'
  | 'book'
  | 'work'
  | 'meet'
  | 'sun'
  | 'moon'
  | 'bolt'
  | 'home'
  | 'star'
  | 'heart'
  | 'flag'
  | 'tag'
  | 'globe'
  | 'cal'
  | 'clock'
  | 'users'
  | 'folder'
  | 'chart'
  | 'bell'
  | 'music'
  | 'inbox'
  | 'kanban'
  | 'gear';

export const ACTIVITY_ICONS: { key: ActivityIconName; label: string }[] = [
  { key: 'note', label: 'Catatan' },
  { key: 'target', label: 'Target' },
  { key: 'idea', label: 'Ide' },
  { key: 'pin', label: 'Penanda' },
  { key: 'check', label: 'Tugas' },
  { key: 'fire', label: 'Penting' },
  { key: 'book', label: 'Belajar' },
  { key: 'work', label: 'Kerja' },
  { key: 'meet', label: 'Rapat' },
  { key: 'sun', label: 'Pagi' },
  { key: 'moon', label: 'Malam' },
  { key: 'bolt', label: 'Cepat' },
];

/** Set lengkap untuk picker ikon tab sidebar (aktivitas + generik). */
export const TAB_ICONS: { key: ActivityIconName; label: string }[] = [
  ...ACTIVITY_ICONS,
  { key: 'home', label: 'Beranda' },
  { key: 'star', label: 'Favorit' },
  { key: 'heart', label: 'Suka' },
  { key: 'flag', label: 'Tandai' },
  { key: 'tag', label: 'Label' },
  { key: 'globe', label: 'Global' },
  { key: 'cal', label: 'Kalender' },
  { key: 'clock', label: 'Jam' },
  { key: 'users', label: 'Tim' },
  { key: 'folder', label: 'Folder' },
  { key: 'chart', label: 'Statistik' },
  { key: 'bell', label: 'Lonceng' },
  { key: 'music', label: 'Musik' },
  { key: 'inbox', label: 'Kotak' },
];

export const ACTIVITY_LUCIDE_MAP: Record<ActivityIconName, LucideIcon> = {
  note: FileText,
  target: Target,
  idea: Lightbulb,
  pin: Pin,
  check: CheckSquare,
  fire: Flame,
  book: BookOpen,
  work: Briefcase,
  meet: Users,
  sun: Sun,
  moon: Moon,
  bolt: Zap,
  home: Home,
  star: Star,
  heart: Heart,
  flag: Flag,
  tag: Tag,
  globe: Globe,
  cal: Calendar,
  clock: Clock,
  users: Users,
  folder: Folder,
  chart: BarChart2,
  bell: Bell,
  music: Music,
  inbox: Inbox,
  kanban: Columns3,
  gear: Settings,
};

function isActivityIconName(value: unknown): value is ActivityIconName {
  return typeof value === 'string' && ACTIVITY_LUCIDE_MAP[value as ActivityIconName] !== undefined;
}

export function ActivityIcon({ name, className = 'h-4 w-4' }: { name?: string | null; className?: string }) {
  const key: ActivityIconName = isActivityIconName(name) ? name : 'note';
  const Icon = ACTIVITY_LUCIDE_MAP[key];
  return <Icon className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <Trash2 className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function PencilIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <Pencil className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function CheckCircleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <CheckCircle2 className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function CalendarIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <Calendar className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export const TABLE_COLUMN_LABELS: Record<TableColumnType, string> = {
  TEXT: 'Teks',
  NUMBER: 'Angka',
  STATUS: 'Status',
  CATEGORY: 'Kategori',
  DATE: 'Tanggal',
  START_TIME: 'Waktu mulai',
  END_TIME: 'Waktu selesai',
  PERSON: 'Orang',
  FILES: 'File & media',
  URL: 'URL',
  PHONE: 'Telepon',
  EMAIL: 'Email',
  SELECT: 'Pilih',
  CHECKBOX: 'Kotak centang',
};

export const TABLE_COLUMN_LUCIDE_MAP: Record<TableColumnType, LucideIcon> = {
  TEXT: Type,
  NUMBER: Hash,
  STATUS: CircleDot,
  CATEGORY: Folder,
  DATE: Calendar,
  START_TIME: PlayCircle,
  END_TIME: StopCircle,
  PERSON: User,
  FILES: Paperclip,
  URL: Link,
  PHONE: Phone,
  EMAIL: Mail,
  SELECT: ChevronDown,
  CHECKBOX: CheckSquare,
};

// Ikon jenis properti tabel (tampil di kiri nama properti).
export function TableColumnIcon({ type, className = 'h-4 w-4' }: { type: TableColumnType; className?: string }) {
  const Icon = TABLE_COLUMN_LUCIDE_MAP[type] || Type;
  return <Icon className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function SlidersIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <Sliders className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export const PROPERTY_COLUMNS_LEFT: { type: TableColumnType; label: string }[] = [
  { type: 'TEXT', label: 'Teks' },
  { type: 'STATUS', label: 'Status' },
  { type: 'CATEGORY', label: 'Kategori' },
  { type: 'PERSON', label: 'Orang' },
  { type: 'PHONE', label: 'Telepon' },
  { type: 'EMAIL', label: 'Email' },
];

export const PROPERTY_COLUMNS_RIGHT: { type: TableColumnType; label: string }[] = [
  { type: 'NUMBER', label: 'Angka' },
  { type: 'DATE', label: 'Tanggal' },
  { type: 'START_TIME', label: 'Waktu mulai' },
  { type: 'END_TIME', label: 'Waktu selesai' },
  { type: 'URL', label: 'URL' },
  { type: 'FILES', label: 'File & media' },
];

export const DEFAULT_STATUS_OPTIONS = ['Belum Mulai', 'Sedang Dikerjakan', 'Selesai'] as const;
export const DEFAULT_CATEGORY_OPTIONS = ['Task tim', 'Breakdown', 'Pribadi'] as const;

export function getCategoryBadgeStyle(cat: string | null | undefined): { bg: string; text: string } {
  const c = (cat || '').toLowerCase().trim();
  if (c === 'task tim' || c === 'task' || c === 'tim') {
    return { bg: 'bg-orange-100 text-orange-700', text: 'text-orange-700' };
  }
  if (c === 'breakdown' || c === 'proyek' || c === 'project') {
    return { bg: 'bg-blue-100 text-blue-700', text: 'text-blue-700' };
  }
  if (c === 'pribadi' || c === 'personal' || c === 'custom') {
    return { bg: 'bg-gray-100 text-gray-600', text: 'text-gray-600' };
  }
  if (c === 'kerja' || c === 'work') {
    return { bg: 'bg-emerald-100 text-emerald-700', text: 'text-emerald-700' };
  }
  return { bg: 'bg-amber-100 text-amber-800', text: 'text-amber-800' };
}

export function getStatusBadgeStyle(status: string | null | undefined): { bg: string; text: string; dot: string } {
  const s = (status || '').toLowerCase().trim();
  if (!s || s === 'belum mulai' || s === 'not started' || s === 'to do') {
    return { bg: 'bg-gray-100 hover:bg-gray-200/80', text: 'text-gray-700', dot: 'bg-gray-400' };
  }
  if (s === 'sedang dikerjakan' || s === 'in progress' || s === 'doing') {
    return { bg: 'bg-blue-50 hover:bg-blue-100/80 border border-blue-200/60', text: 'text-blue-700', dot: 'bg-blue-500' };
  }
  if (s === 'selesai' || s === 'done' || s === 'completed') {
    return { bg: 'bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200/60', text: 'text-emerald-700', dot: 'bg-emerald-500' };
  }
  return { bg: 'bg-orange-50 hover:bg-orange-100/80 border border-orange-200/60', text: 'text-orange-700', dot: 'bg-orange-500' };
}

export function CopyIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <Copy className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <Check className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <Search className={className} strokeWidth={1.6} aria-hidden="true" />;
}

export function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return <X className={className} strokeWidth={1.6} aria-hidden="true" />;
}
