import { describe, it, expect } from 'vitest';
import { findFirstMatchingRecurrenceDate, applyTaskDeadlineRecurrence } from './recurrence';
import type { RecurrenceConfig } from '@/types';

describe('findFirstMatchingRecurrenceDate', () => {
  it('shifts Sunday anchor to Monday when recurring on Mon, Tue, Thu, Fri (byDays: [1, 2, 4, 5])', () => {
    // 2026-10-04 is Sunday
    const sunday = new Date(2026, 9, 4); // Month is 0-indexed: 9 = October
    expect(sunday.getDay()).toBe(0);

    const recurrence: RecurrenceConfig = {
      freq: 'WEEKLY',
      interval: 1,
      byDays: [1, 2, 4, 5],
      endType: 'NEVER',
    };

    const result = findFirstMatchingRecurrenceDate(sunday, recurrence);
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(9);
    expect(result.getDate()).toBe(5); // 2026-10-05 is Monday
    expect(result.getDay()).toBe(1);
  });

  it('shifts Sunday anchor to Monday when recurring on weekdays [1, 2, 3, 4, 5]', () => {
    const sunday = '2026-10-04';
    const recurrence: RecurrenceConfig = {
      freq: 'WEEKLY',
      interval: 1,
      byDays: [1, 2, 3, 4, 5],
      endType: 'NEVER',
    };

    const result = findFirstMatchingRecurrenceDate(sunday, recurrence);
    expect(result.getDate()).toBe(5);
    expect(result.getDay()).toBe(1);
  });

  it('shifts Thursday anchor to Friday when recurring on Tue, Fri [2, 5]', () => {
    // 2026-10-08 is Thursday (day 4)
    const thursday = new Date(2026, 9, 8);
    expect(thursday.getDay()).toBe(4);

    const recurrence: RecurrenceConfig = {
      freq: 'WEEKLY',
      interval: 1,
      byDays: [2, 5],
      endType: 'NEVER',
    };

    const result = findFirstMatchingRecurrenceDate(thursday, recurrence);
    expect(result.getDate()).toBe(9); // 2026-10-09 is Friday (day 5)
    expect(result.getDay()).toBe(5);
  });

  it('shifts Saturday anchor to Monday of next week when recurring on Mon, Tue [1, 2]', () => {
    // 2026-10-10 is Saturday (day 6)
    const saturday = new Date(2026, 9, 10);
    expect(saturday.getDay()).toBe(6);

    const recurrence: RecurrenceConfig = {
      freq: 'WEEKLY',
      interval: 1,
      byDays: [1, 2],
      endType: 'NEVER',
    };

    const result = findFirstMatchingRecurrenceDate(saturday, recurrence);
    expect(result.getDate()).toBe(12); // 2026-10-12 is Monday (day 1)
    expect(result.getDay()).toBe(1);
  });

  it('keeps Monday anchor unchanged when Monday is already in byDays [1, 2, 4, 5]', () => {
    // 2026-10-05 is Monday
    const monday = new Date(2026, 9, 5);
    const recurrence: RecurrenceConfig = {
      freq: 'WEEKLY',
      interval: 1,
      byDays: [1, 2, 4, 5],
      endType: 'NEVER',
    };

    const result = findFirstMatchingRecurrenceDate(monday, recurrence);
    expect(result.getDate()).toBe(5);
    expect(result.getDay()).toBe(1);
  });

  it('returns anchor unchanged if recurrence is null or isException', () => {
    const sunday = new Date(2026, 9, 4);
    expect(findFirstMatchingRecurrenceDate(sunday, null).getDate()).toBe(4);
    expect(
      findFirstMatchingRecurrenceDate(sunday, {
        freq: 'WEEKLY',
        isException: true,
      } as unknown as RecurrenceConfig).getDate(),
    ).toBe(4);
  });
});

describe('applyTaskDeadlineRecurrence', () => {
  it('sets endType to ON_DATE and untilDate to deadline when taskDueDate is >= anchorDate', () => {
    const config: RecurrenceConfig = {
      freq: 'WEEKLY',
      interval: 1,
      byDays: [1, 3, 5],
      endType: 'NEVER',
    };

    const result = applyTaskDeadlineRecurrence(config, '2026-10-10', '2026-10-25T00:00:00.000Z');
    expect(result?.endType).toBe('ON_DATE');
    expect(result?.untilDate).toBe('2026-10-25');
  });

  it('keeps original config when taskDueDate is earlier than anchorDate (overdue)', () => {
    const config: RecurrenceConfig = {
      freq: 'DAILY',
      interval: 1,
      endType: 'NEVER',
    };

    const result = applyTaskDeadlineRecurrence(config, '2026-10-26', '2026-10-25T00:00:00.000Z');
    expect(result?.endType).toBe('NEVER');
    expect(result?.untilDate).toBeUndefined();
  });

  it('keeps original config when taskDueDate is null or undefined', () => {
    const config: RecurrenceConfig = {
      freq: 'DAILY',
      interval: 1,
      endType: 'NEVER',
    };

    expect(applyTaskDeadlineRecurrence(config, '2026-10-10', null)).toEqual(config);
    expect(applyTaskDeadlineRecurrence(config, '2026-10-10', undefined)).toEqual(config);
  });

  it('handles null or exception recurrence gracefully', () => {
    expect(applyTaskDeadlineRecurrence(null, '2026-10-10', '2026-10-25')).toBeNull();
    const exceptionConfig: RecurrenceConfig = { freq: 'DAILY', isException: true };
    expect(applyTaskDeadlineRecurrence(exceptionConfig, '2026-10-10', '2026-10-25')).toEqual(exceptionConfig);
  });
});

