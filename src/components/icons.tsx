import type { ReactNode } from 'react';
import type { TableColumnType } from '@/types';

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

const ACTIVITY_PATHS: Record<ActivityIconName, ReactNode> = {
  note: (
    <>
      <rect x="3.5" y="2.5" width="9" height="11" rx="1.5" />
      <path d="M6 6h4M6 8.5h4M6 11h2.5" />
    </>
  ),
  target: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
      <circle cx="8" cy="8" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  idea: (
    <>
      <path d="M8 2.5c-2.4 0-4 1.7-4 3.7 0 1.2.6 2 1.2 2.7.3.3.5.7.5 1.1v.5h4.6V10c0-.4.2-.8.5-1.1.6-.7 1.2-1.5 1.2-2.7 0-2-1.6-3.7-4-3.7z" />
      <path d="M6.7 13h2.6" />
    </>
  ),
  pin: (
    <>
      <path d="M8 14s-4.5-4.1-4.5-7.5a4.5 4.5 0 0 1 9 0C12.5 9.9 8 14 8 14z" />
      <circle cx="8" cy="6.5" r="1.5" />
    </>
  ),
  check: (
    <>
      <rect x="3" y="3" width="10" height="10" rx="2.5" />
      <path d="M6 8.2l1.8 1.8 3-3.5" />
    </>
  ),
  fire: (
    <path d="M8 13.5c-2.4 0-3.8-1.7-3.8-3.6 0-1.4.7-2.4 1.4-3.3.3.9.9 1.6 1.7 1.9-.3-1.4.2-3 1.1-4.1.2.9.7 1.5 1.4 2.2.9 1 1.7 2.1 1.7 3.9 0 1.9-1.1 3-3.5 3z" />
  ),
  book: (
    <path d="M8 5.3C6.6 4.4 5.1 4.1 3.2 4.1v8.1c1.9 0 3.4.3 4.8 1.2 1.4-.9 2.9-1.2 4.8-1.2V4.1c-1.9 0-3.4.3-4.8 1.2zm0 0v8.1" />
  ),
  work: (
    <>
      <rect x="2.5" y="5.5" width="11" height="7.5" rx="1.5" />
      <path d="M6 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M2.5 9h11" />
    </>
  ),
  meet: (
    <>
      <circle cx="5.8" cy="5.5" r="2.3" />
      <path d="M2 13.5c.7-2.5 2.4-3.7 4.3-3.7 1.2 0 2.3.5 3.1 1.4M10.5 3.6a2.3 2.3 0 0 1 0 4.4M11.5 10.2c1.1.5 1.9 1.5 2.3 3" />
    </>
  ),
  sun: (
    <>
      <circle cx="8" cy="8" r="2.8" />
      <path d="M8 2.2v1.4M8 12.4v1.4M2.2 8h1.4M12.4 8h1.4M3.9 3.9l1 1M11.1 11.1l1 1M12.1 3.9l-1 1M4.9 11.1l-1 1" />
    </>
  ),
  moon: <path d="M13 10.3A5.3 5.3 0 0 1 5.7 3 5.3 5.3 0 1 0 13 10.3z" />,
  bolt: <path d="M9 2L4.2 9h3.3L6.8 14l4.8-7H8.3z" />,
  home: (
    <>
      <path d="M3.5 7L8 3l4.5 4v5.5a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1z" />
      <path d="M6.5 13.5v-3h3v3" />
    </>
  ),
  star: <path d="M8 2.5l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.9l-3.6 1.9.7-4.1-3-2.9 4.1-.6z" />,
  heart: <path d="M8 13.5S3.5 10.4 3.5 7a2.5 2.5 0 0 1 4.5-1.5A2.5 2.5 0 0 1 12.5 7c0 3.4-4.5 6.5-4.5 6.5z" />,
  flag: (
    <>
      <path d="M4.5 14V2.5" />
      <path d="M4.5 3c2.5-1.5 4.5 1.5 7 0v4.5c-2.5 1.5-4.5-1.5-7 0" />
    </>
  ),
  tag: (
    <>
      <path d="M3 3h4.5L13 8.5a1 1 0 0 1 0 1.4l-3.1 3.1a1 1 0 0 1-1.4 0L3 7.5z" />
      <circle cx="6.5" cy="6.5" r="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  globe: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M2.5 8h11M8 2.5c-3.5 3.7-3.5 7.3 0 11 3.5-3.7 3.5-7.3 0-11z" />
    </>
  ),
  cal: (
    <>
      <rect x="3" y="4" width="10" height="9" rx="1.5" />
      <path d="M3 7h10M6 2.5V5M10 2.5V5" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M8 5v3.2l2.2 1.3" />
    </>
  ),
  users: (
    <>
      <circle cx="5.8" cy="5.3" r="2.2" />
      <path d="M2 13.5c.7-2.4 2.2-3.6 3.8-3.6s3.1 1.2 3.8 3.6" />
      <circle cx="11.3" cy="5.8" r="1.7" />
      <path d="M11.5 10.2c1 .5 1.7 1.5 2 3" />
    </>
  ),
  folder: <path d="M2.5 5.5a1 1 0 0 1 1-1h3L7.7 6h4.8a1 1 0 0 1 1 1v4.5a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />,
  chart: <path d="M2.5 13.5h11M4 13V9M8 13V5.5M12 13V3.5" />,
  bell: (
    <>
      <path d="M4.2 11.2c.9-1 1.3-2.3 1.3-3.7a2.5 2.5 0 0 1 5 0c0 1.4.4 2.7 1.3 3.7z" />
      <path d="M7 13.5a1 1 0 0 0 2 0" />
    </>
  ),
  music: (
    <>
      <circle cx="5" cy="11" r="2" />
      <circle cx="11.5" cy="9.5" r="2" />
      <path d="M7 11V4.5L13.5 3v6.5" />
    </>
  ),
  inbox: (
    <>
      <path d="M2.5 9.5l1.8-5h7.4l1.8 5v3a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1z" />
      <path d="M2.5 9.5h3.3l.7 1h3l.7-1h3.3" />
    </>
  ),
  kanban: (
    <>
      <rect x="2" y="3" width="3.2" height="10" rx="1" />
      <rect x="6.4" y="3" width="3.2" height="6.5" rx="1" />
      <rect x="10.8" y="3" width="3.2" height="8.5" rx="1" />
    </>
  ),
  gear: (
    <g transform="translate(8 8) scale(0.6) translate(-12 -12)">
      <circle cx="12" cy="12" r="3" strokeWidth={2} />
      <path
        d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
        strokeWidth={2}
      />
    </g>
  ),
};

function isActivityIconName(value: unknown): value is ActivityIconName {
  return typeof value === 'string' && (ACTIVITY_PATHS as Record<string, ReactNode>)[value] !== undefined;
}

function Base({ className = 'h-4 w-4', children }: { className?: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {children}
    </svg>
  );
}

export function ActivityIcon({ name, className = 'h-4 w-4' }: { name?: string | null; className?: string }) {
  const key: ActivityIconName = isActivityIconName(name) ? name : 'note';
  return <Base className={className}>{ACTIVITY_PATHS[key]}</Base>;
}

export function TrashIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M2.8 4.5h10.4M6.3 4.5V3.2a.7.7 0 0 1 .7-.7h2a.7.7 0 0 1 .7.7v1.3M4.3 4.5l.6 7.6a1 1 0 0 0 1 .9h3.9a1 1 0 0 0 1-.9l.6-7.6" />
      <path d="M6.5 7.3v3.9M9.5 7.3v3.9" />
    </Base>
  );
}

export function PencilIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M11.3 2.7l2 2L5.2 12.8l-2.7.7.7-2.7 8.1-8.1z" />
      <path d="M9.8 4.2l2 2" />
    </Base>
  );
}

export function CheckCircleIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M5.8 8.2l1.6 1.6 2.8-3.2" />
    </Base>
  );
}

export function CalendarIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Base className={className}>
      <rect x="2.8" y="3.8" width="10.4" height="9.4" rx="1.5" />
      <path d="M2.8 6.8h10.4M5.8 2.3v2.5M10.2 2.3v2.5" />
    </Base>
  );
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

// Ikon jenis properti tabel (tampil di kiri nama properti).
export function TableColumnIcon({ type, className = 'h-4 w-4' }: { type: TableColumnType; className?: string }) {
  return (
    <Base className={className}>
      {type === 'NUMBER' ? (
        <path d="M6 3v10M10 3v10M3.5 6h9M3.5 10h9" />
      ) : type === 'STATUS' ? (
        <path d="M8 2.5v2M8 11.5v2M2.5 8h2M11.5 8h2M4.1 4.1l1.4 1.4M10.5 10.5l1.4 1.4M4.1 11.9l1.4-1.4M10.5 5.5l1.4-1.4" />
      ) : type === 'CATEGORY' ? (
        <path d="M2 4.5a1.5 1.5 0 0 1 1.5-1.5h2.8a1.5 1.5 0 0 1 1.1.5l1.1 1.2h4a1.5 1.5 0 0 1 1.5 1.5v5.3a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 11.5v-7z" />
      ) : type === 'DATE' ? (
        <>
          <rect x="2.5" y="3.5" width="11" height="9.5" rx="1.5" />
          <path d="M2.5 6.5h11M5.5 2v3M10.5 2v3" />
        </>
      ) : type === 'START_TIME' ? (
        <>
          <circle cx="7.5" cy="8" r="5" />
          <path d="M7.5 5.5v2.8l2 1.2M13.5 6.5l1.5 1.5-1.5 1.5" />
        </>
      ) : type === 'END_TIME' ? (
        <>
          <circle cx="7.5" cy="8" r="5" />
          <path d="M7.5 5.5v2.8l-1.8 1.2M13.5 6v4" />
        </>
      ) : type === 'PERSON' ? (
        <>
          <circle cx="5.5" cy="5.2" r="2.2" />
          <path d="M1.5 13.5a4 4 0 0 1 8 0" />
          <circle cx="11" cy="4.8" r="1.8" />
          <path d="M10 9.8c1.6.3 3.5 1.5 3.5 3.7" />
        </>
      ) : type === 'FILES' ? (
        <path d="M12.5 6.5l-5.5 5.5a3.2 3.2 0 0 1-4.5-4.5l5.5-5.5a2.1 2.1 0 0 1 3 3L5.5 10.5a1 1 0 0 1-1.4-1.4l5-5" />
      ) : type === 'URL' ? (
        <path d="M6.8 9.2a3 3 0 0 1 0-4.2l1.8-1.8a3 3 0 0 1 4.2 4.2l-.9.9M9.2 6.8a3 3 0 0 1 0 4.2l-1.8 1.8a3 3 0 0 1-4.2-4.2l.9-.9" />
      ) : type === 'PHONE' ? (
        <path d="M3.2 3.2a1 1 0 0 1 1.1-.3l1.8.7a1 1 0 0 1 .6 1l-.5 1.4a8.5 8.5 0 0 0 4.5 4.5l1.4-.5a1 1 0 0 1 1 .6l.7 1.8a1 1 0 0 1-.3 1.1l-1.2 1.2c-.8.8-2 .9-3 .3a12.8 12.8 0 0 1-6.7-6.7c-.6-1-.5-2.2.3-3l1.2-1.2z" />
      ) : type === 'EMAIL' ? (
        <>
          <circle cx="8" cy="8" r="2.5" />
          <path d="M10.5 5.5v3a1.8 1.8 0 0 0 3.2 1.1A5.5 5.5 0 1 0 6 13.2" />
        </>
      ) : type === 'SELECT' ? (
        <>
          <circle cx="8" cy="8" r="5.5" />
          <path d="M6 7l2 2 2-2" />
        </>
      ) : type === 'CHECKBOX' ? (
        <>
          <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
          <path d="M5.5 8l2 2 3.5-4" />
        </>
      ) : (
        /* TEXT */
        <path d="M2.5 4.5h11M2.5 8h8M2.5 11.5h5" />
      )}
    </Base>
  );
}

export function SlidersIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M2.5 5.5h11M2.5 10.5h11" />
      <circle cx="9.5" cy="5.5" r="1.8" />
      <circle cx="6.5" cy="10.5" r="1.8" />
    </Base>
  );
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
  return (
    <Base className={className}>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M3.5 10.5h-1a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v1" />
    </Base>
  );
}

export function CheckIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M3.5 8.5l3 3 6-6" />
    </Base>
  );
}

export function SearchIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Base className={className}>
      <circle cx="7" cy="7" r="4.2" />
      <path d="M10.2 10.2l3.3 3.3" />
    </Base>
  );
}

export function CloseIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <Base className={className}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </Base>
  );
}


