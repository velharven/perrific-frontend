import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyActivity } from '@/types';
import CalendarCardSettings, { type CombinedItem } from './CalendarCardSettings';

const mocks = vi.hoisted(() => ({
  updateActivity: vi.fn(),
  createActivity: vi.fn(),
  updateEvent: vi.fn(),
}));

vi.mock('@/api/calendar', () => ({
  calendarApi: {
    updateEvent: mocks.updateEvent,
  },
}));
vi.mock('@/api/activities', () => ({
  activityApi: {
    update: mocks.updateActivity,
    create: mocks.createActivity,
  },
}));
vi.mock('@/components/ui/Toast', () => ({ showToast: vi.fn() }));
vi.mock('@/components/ui/TimePickerInput', () => ({ default: () => null }));

describe('CalendarCardSettings Recurrence Deadline Alignment', () => {
  const onClose = vi.fn();
  const onRefresh = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    onRefresh.mockReset();
    mocks.updateActivity.mockReset().mockResolvedValue({});
    mocks.createActivity.mockReset().mockResolvedValue({});
    mocks.updateEvent.mockReset().mockResolvedValue({});
  });

  afterEach(cleanup);

  it('aligns preset recurrence untilDate to task dueDate when task has a deadline', async () => {
    const activityWithDeadline: DailyActivity = {
      id: 'act-task-due',
      userId: 'user-1',
      title: 'Kerjakan Modul A',
      date: '2026-10-10T00:00:00.000Z',
      startTime: '2026-10-10T09:00:00+07:00',
      endTime: '2026-10-10T10:00:00+07:00',
      type: 'TASK',
      status: 'PENDING',
      order: 0,
      checklistItems: [],
      recurrence: null,
      task: {
        id: 'task-1',
        title: 'Kerjakan Modul A',
        priority: 'HIGH',
        dueDate: '2026-10-25T00:00:00.000Z',
      },
    };

    const item: CombinedItem = {
      type: 'activity',
      id: 'act-task-due',
      act: activityWithDeadline,
      time: '2026-10-10T09:00:00+07:00',
    };

    render(
      <CalendarCardSettings
        selectedItem={item}
        onClose={onClose}
        onRefresh={onRefresh}
      />,
    );

    // Buka menu pengulangan
    const repeatBtn = screen.getByRole('button', { name: /Tidak berulang/i });
    fireEvent.click(repeatBtn);

    // Klik preset "Setiap hari"
    const dailyPresetBtn = screen.getByText('Setiap hari');
    fireEvent.click(dailyPresetBtn);

    await waitFor(() => {
      expect(mocks.updateActivity).toHaveBeenCalled();
    });

    const callPayload = mocks.updateActivity.mock.calls[0][1];
    expect(callPayload.recurrence).toBeTruthy();
    expect(callPayload.recurrence.freq).toBe('DAILY');
    expect(callPayload.recurrence.endType).toBe('ON_DATE');
    expect(callPayload.recurrence.untilDate).toBe('2026-10-25');
  });

  it('pre-fills custom modal untilDate with task deadline', async () => {
    const activityWithDeadline: DailyActivity = {
      id: 'act-task-due-2',
      userId: 'user-1',
      title: 'Tugas Proyek Pribadi',
      date: '2026-10-10T00:00:00.000Z',
      startTime: '2026-10-10T09:00:00+07:00',
      endTime: '2026-10-10T10:00:00+07:00',
      type: 'TASK',
      status: 'PENDING',
      order: 0,
      checklistItems: [],
      recurrence: null,
      task: {
        id: 'task-2',
        title: 'Tugas Proyek Pribadi',
        priority: 'MEDIUM',
        dueDate: '2026-10-28T00:00:00.000Z',
      },
    };

    const item: CombinedItem = {
      type: 'activity',
      id: 'act-task-due-2',
      act: activityWithDeadline,
      time: '2026-10-10T09:00:00+07:00',
    };

    render(
      <CalendarCardSettings
        selectedItem={item}
        onClose={onClose}
        onRefresh={onRefresh}
      />,
    );

    // Buka menu pengulangan
    fireEvent.click(screen.getByRole('button', { name: /Tidak berulang/i }));

    // Buka modal Kustom...
    fireEvent.click(screen.getByText('Kustom...'));

    expect(screen.getByText('Pengulangan kustom')).toBeTruthy();
    const untilDateInput = screen.getByDisplayValue('2026-10-28') as HTMLInputElement;
    expect(untilDateInput).toBeTruthy();

    // Simpan modal kustom
    fireEvent.click(screen.getByRole('button', { name: 'Selesai' }));

    await waitFor(() => {
      expect(mocks.updateActivity).toHaveBeenCalled();
    });

    const callPayload = mocks.updateActivity.mock.calls[0][1];
    expect(callPayload.recurrence.endType).toBe('ON_DATE');
    expect(callPayload.recurrence.untilDate).toBe('2026-10-28');
  });

  it('keeps normal recurrence (endType: NEVER) when task has NO deadline', async () => {
    const activityWithoutDeadline: DailyActivity = {
      id: 'act-no-due',
      userId: 'user-1',
      title: 'Tugas Tanpa Deadline',
      date: '2026-10-10T00:00:00.000Z',
      startTime: '2026-10-10T09:00:00+07:00',
      endTime: '2026-10-10T10:00:00+07:00',
      type: 'TASK',
      status: 'PENDING',
      order: 0,
      checklistItems: [],
      recurrence: null,
      task: {
        id: 'task-3',
        title: 'Tugas Tanpa Deadline',
        priority: 'LOW',
        dueDate: null,
      },
    };

    const item: CombinedItem = {
      type: 'activity',
      id: 'act-no-due',
      act: activityWithoutDeadline,
      time: '2026-10-10T09:00:00+07:00',
    };

    render(
      <CalendarCardSettings
        selectedItem={item}
        onClose={onClose}
        onRefresh={onRefresh}
      />,
    );

    // Buka menu pengulangan
    fireEvent.click(screen.getByRole('button', { name: /Tidak berulang/i }));

    // Klik preset "Setiap hari"
    fireEvent.click(screen.getByText('Setiap hari'));

    await waitFor(() => {
      expect(mocks.updateActivity).toHaveBeenCalled();
    });

    const callPayload = mocks.updateActivity.mock.calls[0][1];
    expect(callPayload.recurrence.freq).toBe('DAILY');
    expect(callPayload.recurrence.endType).toBe('NEVER');
    expect(callPayload.recurrence.untilDate).toBeFalsy();
  });
});
