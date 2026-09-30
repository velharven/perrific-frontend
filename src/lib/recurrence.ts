import type { DailyActivity, RecurrenceConfig } from '@/types';

export const DAY_NAMES_ID = [
  'Minggu',
  'Senin',
  'Selasa',
  'Rabu',
  'Kamis',
  'Jumat',
  'Sabtu',
] as const;

export const DAY_SHORT_NAMES_ID = [
  'Min',
  'Sen',
  'Sel',
  'Rab',
  'Kam',
  'Jum',
  'Sab',
] as const;

export const DAY_PILLS_ID = [
  { day: 0, short: 'M', label: 'Minggu' },
  { day: 1, short: 'S', label: 'Senin' },
  { day: 2, short: 'S', label: 'Selasa' },
  { day: 3, short: 'R', label: 'Rabu' },
  { day: 4, short: 'K', label: 'Kamis' },
  { day: 5, short: 'J', label: 'Jumat' },
  { day: 6, short: 'S', label: 'Sabtu' },
] as const;

export const MONTH_NAMES_ID = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const;

export function toLocalMidnight(input: Date | string): Date {
  if (input instanceof Date) {
    return new Date(input.getFullYear(), input.getMonth(), input.getDate(), 0, 0, 0, 0);
  }
  const trimmed = input.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    return new Date(y, m - 1, d, 0, 0, 0, 0);
  }
  const parsed = new Date(trimmed);
  if (isNaN(parsed.getTime())) {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  }
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 0, 0, 0, 0);
}

export function getNthWeekdayInfo(date: Date): {
  week: number;
  dayOfWeek: number;
  ordinalLabel: string;
} {
  const dayOfWeek = date.getDay();
  const nth = Math.ceil(date.getDate() / 7);
  const nextSameWeekday = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7);
  const isLastInMonth = nextSameWeekday.getMonth() !== date.getMonth();

  // Gunakan -1 jika minggu ke-5 (terakhir), atau gunakan 1..4 sesuai Google Calendar
  const week = nth >= 5 && isLastInMonth ? -1 : nth;

  const ordinalMap: Record<number, string> = {
    1: 'pertama',
    2: 'ke-2',
    3: 'ke-3',
    4: 'ke-4',
    5: 'ke-5',
    [-1]: 'terakhir',
  };

  return {
    week,
    dayOfWeek,
    ordinalLabel: ordinalMap[week] ?? `ke-${nth}`,
  };
}

export interface RecurrencePresetOption {
  id: string;
  label: string;
  config: RecurrenceConfig | null;
}

export function getRecurrencePresets(anchorDateInput: Date | string): RecurrencePresetOption[] {
  const anchor = toLocalMidnight(anchorDateInput);
  const dayName = DAY_NAMES_ID[anchor.getDay()];
  const monthName = MONTH_NAMES_ID[anchor.getMonth()];
  const dateNum = anchor.getDate();
  const { week, dayOfWeek, ordinalLabel } = getNthWeekdayInfo(anchor);

  return [
    {
      id: 'NONE',
      label: 'Tidak berulang',
      config: null,
    },
    {
      id: 'DAILY',
      label: 'Setiap hari',
      config: {
        freq: 'DAILY',
        interval: 1,
        endType: 'NEVER',
      },
    },
    {
      id: 'WEEKLY_DAY',
      label: `Setiap minggu pada hari ${dayName}`,
      config: {
        freq: 'WEEKLY',
        interval: 1,
        byDays: [dayOfWeek],
        endType: 'NEVER',
      },
    },
    {
      id: 'MONTHLY_NTH_DAY',
      label: `Setiap bulan pada hari ${dayName} ${ordinalLabel}`,
      config: {
        freq: 'MONTHLY',
        interval: 1,
        byWeekOfMonth: { week, dayOfWeek },
        endType: 'NEVER',
      },
    },
    {
      id: 'YEARLY_DATE',
      label: `Setiap tahun pada ${dateNum} ${monthName}`,
      config: {
        freq: 'YEARLY',
        interval: 1,
        endType: 'NEVER',
      },
    },
    {
      id: 'WEEKDAYS',
      label: 'Setiap hari kerja (Senin hingga Jumat)',
      config: {
        freq: 'WEEKLY',
        interval: 1,
        byDays: [1, 2, 3, 4, 5],
        endType: 'NEVER',
      },
    },
  ];
}

function normalizeDays(days?: number[]): string {
  if (!days || days.length === 0) return '';
  return [...new Set(days)].sort((a, b) => a - b).join(',');
}

export function isSameRecurrence(
  a: RecurrenceConfig | null | undefined,
  b: RecurrenceConfig | null | undefined,
): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;

  if (a.freq !== b.freq) return false;
  if ((a.interval || 1) !== (b.interval || 1)) return false;
  if ((a.endType || 'NEVER') !== (b.endType || 'NEVER')) return false;

  if (a.endType === 'ON_DATE' && (a.untilDate || '') !== (b.untilDate || '')) return false;
  if (a.endType === 'AFTER' && (a.count || 0) !== (b.count || 0)) return false;

  if (a.freq === 'WEEKLY') {
    if (normalizeDays(a.byDays) !== normalizeDays(b.byDays)) return false;
    if ((a.weekStartsOn ?? 0) !== (b.weekStartsOn ?? 0)) return false;
  }

  if (a.freq === 'MONTHLY') {
    const aHasWeek = Boolean(a.byWeekOfMonth);
    const bHasWeek = Boolean(b.byWeekOfMonth);
    if (aHasWeek !== bHasWeek) return false;
    if (a.byWeekOfMonth && b.byWeekOfMonth) {
      if (
        a.byWeekOfMonth.week !== b.byWeekOfMonth.week ||
        a.byWeekOfMonth.dayOfWeek !== b.byWeekOfMonth.dayOfWeek
      ) {
        return false;
      }
    } else if ((a.byMonthDay || 0) !== (b.byMonthDay || 0)) {
      return false;
    }
  }

  return true;
}

export function formatRecurrenceLabel(
  config: RecurrenceConfig | null | undefined,
  anchorDateInput: Date | string,
): string {
  if (!config) return 'Tidak berulang';

  const presets = getRecurrencePresets(anchorDateInput);
  const matchedPreset = presets.find((p) => p.config && isSameRecurrence(p.config, config));
  if (matchedPreset) return matchedPreset.label;

  const anchor = toLocalMidnight(anchorDateInput);
  const interval = Math.max(1, config.interval || 1);

  let base = '';
  if (config.freq === 'DAILY') {
    base = interval === 1 ? 'Setiap hari' : `Setiap ${interval} hari`;
  } else if (config.freq === 'WEEKLY') {
    const prefix = interval === 1 ? 'Setiap minggu' : `Setiap ${interval} minggu`;
    const days = config.byDays && config.byDays.length > 0 ? [...config.byDays].sort((a, b) => a - b) : [anchor.getDay()];
    const dayLabels = days.map((d) => DAY_SHORT_NAMES_ID[d]).join(', ');
    base = `${prefix} pada ${dayLabels}`;
  } else if (config.freq === 'MONTHLY') {
    const prefix = interval === 1 ? 'Setiap bulan' : `Setiap ${interval} bulan`;
    if (config.byWeekOfMonth) {
      const { week, dayOfWeek } = config.byWeekOfMonth;
      const ord =
        week === 1
          ? 'pertama'
          : week === -1
            ? 'terakhir'
            : `ke-${week}`;
      base = `${prefix} pada hari ${DAY_NAMES_ID[dayOfWeek]} ${ord}`;
    } else {
      const dom = config.byMonthDay || anchor.getDate();
      base = `${prefix} pada tanggal ${dom}`;
    }
  } else if (config.freq === 'YEARLY') {
    const prefix = interval === 1 ? 'Setiap tahun' : `Setiap ${interval} tahun`;
    base = `${prefix} pada ${anchor.getDate()} ${MONTH_NAMES_ID[anchor.getMonth()]}`;
  }

  if (config.endType === 'AFTER' && config.count) {
    base += `, ${config.count} kali`;
  } else if (config.endType === 'ON_DATE' && config.untilDate) {
    const until = toLocalMidnight(config.untilDate);
    base += `, hingga ${until.getDate()} ${MONTH_NAMES_ID[until.getMonth()]} ${until.getFullYear()}`;
  }

  return base;
}

function startOfSundayWeek(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay(), 0, 0, 0, 0);
}

function matchesRecurrencePattern(
  startDate: Date,
  candidate: Date,
  recurrence: RecurrenceConfig,
): boolean {
  const diffDays = Math.round((candidate.getTime() - startDate.getTime()) / 86400000);
  if (diffDays < 0) return false;

  const interval = Math.max(1, recurrence.interval || 1);

  switch (recurrence.freq) {
    case 'DAILY': {
      return diffDays % interval === 0;
    }
    case 'WEEKLY': {
      const startWeek = startOfSundayWeek(startDate);
      const candWeek = startOfSundayWeek(candidate);
      if (recurrence.weekStartsOn !== undefined) {
        startWeek.setTime(startDate.getTime());
        startWeek.setDate(startDate.getDate() - (startDate.getDay() - recurrence.weekStartsOn + 7) % 7);
        candWeek.setTime(candidate.getTime());
        candWeek.setDate(candidate.getDate() - (candidate.getDay() - recurrence.weekStartsOn + 7) % 7);
      }
      const diffWeeks = Math.round((candWeek.getTime() - startWeek.getTime()) / (7 * 86400000));
      if (diffWeeks < 0 || diffWeeks % interval !== 0) return false;
      const activeDays =
        recurrence.byDays && recurrence.byDays.length > 0
          ? recurrence.byDays
          : [startDate.getDay()];
      return activeDays.includes(candidate.getDay());
    }
    case 'MONTHLY': {
      const diffMonths =
        (candidate.getFullYear() - startDate.getFullYear()) * 12 +
        (candidate.getMonth() - startDate.getMonth());
      if (diffMonths < 0 || diffMonths % interval !== 0) return false;

      if (recurrence.byWeekOfMonth) {
        const { week, dayOfWeek } = recurrence.byWeekOfMonth;
        if (candidate.getDay() !== dayOfWeek) return false;
        if (week === -1) {
          const nextSameWeekday = new Date(
            candidate.getFullYear(),
            candidate.getMonth(),
            candidate.getDate() + 7,
          );
          return nextSameWeekday.getMonth() !== candidate.getMonth();
        }
        const candNth = Math.ceil(candidate.getDate() / 7);
        return candNth === week;
      }

      const targetDom = recurrence.byMonthDay || startDate.getDate();
      return candidate.getDate() === targetDom;
    }
    case 'YEARLY': {
      const diffYears = candidate.getFullYear() - startDate.getFullYear();
      if (diffYears < 0 || diffYears % interval !== 0) return false;
      return (
        candidate.getMonth() === startDate.getMonth() &&
        candidate.getDate() === startDate.getDate()
      );
    }
    default:
      return false;
  }
}

export function doesActivityOccurOnDate(
  activityDateInput: Date | string,
  recurrence: RecurrenceConfig | null | undefined,
  targetDateInput: Date | string,
): boolean {
  const startDate = toLocalMidnight(activityDateInput);
  const target = toLocalMidnight(targetDateInput);
  const diffDays = Math.round((target.getTime() - startDate.getTime()) / 86400000);

  if (diffDays < 0) return false;
  if (!recurrence) return diffDays === 0;
  if (recurrence.excludeDates && recurrence.excludeDates.length > 0) {
    const pad = (n: number) => String(n).padStart(2, '0');
    const targetStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
    if (recurrence.excludeDates.includes(targetStr)) return false;
  }

  if (recurrence.endType === 'ON_DATE' && recurrence.untilDate) {
    const until = toLocalMidnight(recurrence.untilDate);
    if (target.getTime() > until.getTime()) return false;
  }

  if (!matchesRecurrencePattern(startDate, target, recurrence)) {
    return false;
  }

  if (recurrence.endType === 'AFTER' && recurrence.count && recurrence.count > 0) {
    const maxDays = Math.min(diffDays, 3650);
    let countSoFar = 0;
    for (let i = 0; i <= maxDays; i++) {
      const cursor = new Date(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate() + i,
        0,
        0,
        0,
        0,
      );
      if (matchesRecurrencePattern(startDate, cursor, recurrence)) {
        countSoFar += 1;
        if (countSoFar > recurrence.count) return false;
      }
    }
    return countSoFar <= recurrence.count;
  }

  return true;
}

export function projectActivityOntoDate(
  act: DailyActivity,
  targetDateInput: Date,
): DailyActivity {
  const startDate = toLocalMidnight(act.date);
  const target = toLocalMidnight(targetDateInput);
  if (startDate.getTime() === target.getTime()) {
    return act;
  }

  const pad = (n: number) => String(n).padStart(2, '0');
  const targetDateStr = `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;

  let projectedStartTime = act.startTime;
  let projectedEndTime = act.endTime;

  if (act.startTime) {
    const origStart = new Date(act.startTime);
    if (!isNaN(origStart.getTime())) {
      const newStart = new Date(
        target.getFullYear(),
        target.getMonth(),
        target.getDate(),
        origStart.getHours(),
        origStart.getMinutes(),
        origStart.getSeconds(),
        origStart.getMilliseconds(),
      );
      projectedStartTime = newStart.toISOString();

      if (act.endTime) {
        const origEnd = new Date(act.endTime);
        if (!isNaN(origEnd.getTime())) {
          const durationMs = Math.max(0, origEnd.getTime() - origStart.getTime());
          const newEnd = new Date(newStart.getTime() + durationMs);
          projectedEndTime = newEnd.toISOString();
        }
      }
    }
  }

  return {
    ...act,
    date: targetDateStr,
    startTime: projectedStartTime,
    endTime: projectedEndTime,
  };
}

export function formatFollowingScopeLabel(
  targetDateInput: Date | string,
  recurrence?: RecurrenceConfig | null,
): string {
  const d = toLocalMidnight(targetDateInput);
  const dayName = DAY_NAMES_ID[d.getDay()]; // 'Senin', 'Selasa', dst.
  if (!recurrence || recurrence.freq === 'DAILY') {
    return 'Event ini dan hari seterusnya';
  }
  if (recurrence.freq === 'WEEKLY') {
    return `Event ini dan hari ${dayName} seterusnya`;
  }
  if (recurrence.freq === 'MONTHLY') {
    return `Event ini dan tanggal ${d.getDate()} seterusnya`;
  }
  if (recurrence.freq === 'YEARLY') {
    return 'Event ini dan tahun seterusnya';
  }
  return 'Event ini dan hari seterusnya';
}

export function getDayBefore(dateInput: Date | string): string {
  const d = toLocalMidnight(dateInput);
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

