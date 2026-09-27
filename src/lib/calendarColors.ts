export interface CalendarColorOption {
  id: string | null;
  googleId: string | null;
  name: string;
  googleName: string;
  solidHex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  dotClass: string;
  accentClass: string;
  isDarkText?: boolean;
}

export const CALENDAR_COLORS: CalendarColorOption[] = [
  {
    id: null,
    googleId: null,
    name: 'Biru (Bawaan)',
    googleName: 'Default',
    solidHex: '#3b82f6',
    bgClass: 'bg-blue-50/90 hover:bg-blue-100',
    borderClass: 'border-blue-600 border-r border-t border-b border-blue-200/60',
    textClass: 'text-blue-950',
    dotClass: 'bg-blue-500',
    accentClass: 'text-blue-600',
  },
  {
    id: '11',
    googleId: '11',
    name: 'Merah',
    googleName: 'Tomato',
    solidHex: '#d50000',
    bgClass: 'bg-red-50/90 hover:bg-red-100',
    borderClass: 'border-red-600 border-r border-t border-b border-red-200/60',
    textClass: 'text-red-950',
    dotClass: 'bg-red-600',
    accentClass: 'text-red-600',
  },
  {
    id: '6',
    googleId: '6',
    name: 'Oranye',
    googleName: 'Tangerine',
    solidHex: '#f4511e',
    bgClass: 'bg-orange-50/90 hover:bg-orange-100',
    borderClass: 'border-orange-600 border-r border-t border-b border-orange-200/60',
    textClass: 'text-orange-950',
    dotClass: 'bg-orange-500',
    accentClass: 'text-orange-600',
  },
  {
    id: '5',
    googleId: '5',
    name: 'Kuning',
    googleName: 'Banana',
    solidHex: '#f6bf26',
    bgClass: 'bg-amber-50/95 hover:bg-amber-100',
    borderClass: 'border-amber-500 border-r border-t border-b border-amber-200/70',
    textClass: 'text-amber-950',
    dotClass: 'bg-amber-400',
    accentClass: 'text-amber-600',
    isDarkText: true,
  },
  {
    id: '10',
    googleId: '10',
    name: 'Hijau',
    googleName: 'Basil',
    solidHex: '#0b8043',
    bgClass: 'bg-green-50/90 hover:bg-green-100',
    borderClass: 'border-green-600 border-r border-t border-b border-green-200/60',
    textClass: 'text-green-950',
    dotClass: 'bg-green-600',
    accentClass: 'text-green-600',
  },
  {
    id: '2',
    googleId: '2',
    name: 'Hijau Mint',
    googleName: 'Sage',
    solidHex: '#33b679',
    bgClass: 'bg-emerald-50/90 hover:bg-emerald-100',
    borderClass: 'border-emerald-500 border-r border-t border-b border-emerald-200/60',
    textClass: 'text-emerald-950',
    dotClass: 'bg-emerald-500',
    accentClass: 'text-emerald-600',
  },
  {
    id: '7',
    googleId: '7',
    name: 'Biru Muda',
    googleName: 'Peacock',
    solidHex: '#039be5',
    bgClass: 'bg-sky-50/90 hover:bg-sky-100',
    borderClass: 'border-sky-500 border-r border-t border-b border-sky-200/60',
    textClass: 'text-sky-950',
    dotClass: 'bg-sky-500',
    accentClass: 'text-sky-600',
  },
  {
    id: '9',
    googleId: '9',
    name: 'Biru Tua',
    googleName: 'Blueberry',
    solidHex: '#3f51b5',
    bgClass: 'bg-blue-100/70 hover:bg-blue-100',
    borderClass: 'border-blue-700 border-r border-t border-b border-blue-200/70',
    textClass: 'text-blue-950',
    dotClass: 'bg-blue-600',
    accentClass: 'text-blue-700',
  },
  {
    id: '1',
    googleId: '1',
    name: 'Ungu Muda',
    googleName: 'Lavender',
    solidHex: '#7986cb',
    bgClass: 'bg-indigo-50/90 hover:bg-indigo-100',
    borderClass: 'border-indigo-500 border-r border-t border-b border-indigo-200/60',
    textClass: 'text-indigo-950',
    dotClass: 'bg-indigo-400',
    accentClass: 'text-indigo-600',
  },
  {
    id: '3',
    googleId: '3',
    name: 'Ungu',
    googleName: 'Grape',
    solidHex: '#8e24aa',
    bgClass: 'bg-purple-50/90 hover:bg-purple-100',
    borderClass: 'border-purple-600 border-r border-t border-b border-purple-200/60',
    textClass: 'text-purple-950',
    dotClass: 'bg-purple-600',
    accentClass: 'text-purple-600',
  },
  {
    id: '4',
    googleId: '4',
    name: 'Merah Muda',
    googleName: 'Flamingo',
    solidHex: '#e67c73',
    bgClass: 'bg-rose-50/90 hover:bg-rose-100',
    borderClass: 'border-rose-500 border-r border-t border-b border-rose-200/60',
    textClass: 'text-rose-950',
    dotClass: 'bg-rose-400',
    accentClass: 'text-rose-600',
  },
  {
    id: '8',
    googleId: '8',
    name: 'Abu-abu',
    googleName: 'Graphite',
    solidHex: '#616161',
    bgClass: 'bg-zinc-100/90 hover:bg-zinc-200/80',
    borderClass: 'border-zinc-500 border-r border-t border-b border-zinc-200/70',
    textClass: 'text-zinc-900',
    dotClass: 'bg-zinc-500',
    accentClass: 'text-zinc-600',
  },
];

const DEFAULT_COLOR = CALENDAR_COLORS[0];

export function getCalendarColorMeta(colorId?: string | null): CalendarColorOption {
  if (!colorId) return DEFAULT_COLOR;
  const match = CALENDAR_COLORS.find((c) => c.id === colorId);
  return match || DEFAULT_COLOR;
}
