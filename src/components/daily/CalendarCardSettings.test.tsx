import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyActivity, RecurrenceConfig } from '@/types';
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

const weekly: RecurrenceConfig = {
  freq: 'WEEKLY',
  interval: 1,
  byDays: [1], // Monday
  endType: 'NEVER',
};

const masterActivity: DailyActivity = {
  id: 'master-weekly',
  userId: 'user-a',
  title: 'Weekly Sync',
  date: '2026-09-21T00:00:00.000Z', // Monday, Sept 21 (anchor)
  startTime: '2026-09-21T09:00:00+07:00',
  endTime: '2026-09-21T10:00:00+07:00',
  type: 'CUSTOM',
  status: 'PENDING',
  order: 0,
  checklistItems: [],
  recurrence: weekly,
};

// Occurrence on Monday, Sept 28 (one week after anchor)
const secondOccurrenceItem: CombinedItem = {
  type: 'activity',
  id: 'act-master-weekly-2026-09-28',
  act: masterActivity,
  time: '2026-09-28T09:00:00+07:00',
  instanceDate: '2026-09-28',
};

describe('CalendarCardSettings (Notion-style recurring options)', () => {
  const onClose = vi.fn();
  const onRefresh = vi.fn();
  const onDelete = vi.fn();

  beforeEach(() => {
    onClose.mockReset();
    onRefresh.mockReset();
    onDelete.mockReset();
    mocks.updateActivity.mockReset().mockResolvedValue(masterActivity);
    mocks.createActivity.mockReset().mockResolvedValue({ id: 'created-instance' });
    mocks.updateEvent.mockReset().mockResolvedValue({});
  });

  afterEach(cleanup);

  it('keeps the repeat button enabled and allows changing recurrence options directly', () => {
    render(
      <CalendarCardSettings
        selectedItem={secondOccurrenceItem}
        onClose={onClose}
        onRefresh={onRefresh}
      />,
    );

    const repeatBtn = screen.getByRole('button', {
      name: 'Setiap minggu pada hari Senin',
    }) as HTMLButtonElement;
    expect(repeatBtn.disabled).toBe(false);

    fireEvent.click(repeatBtn);
    expect(screen.getByText('Setiap hari')).toBeTruthy();
    expect(screen.getByText('Tidak berulang')).toBeTruthy();
  });

  it('preserves the master anchor date when renaming a later occurrence with ALL_EVENTS', async () => {
    render(
      <CalendarCardSettings
        selectedItem={secondOccurrenceItem}
        onClose={onClose}
        onRefresh={onRefresh}
      />,
    );

    const titleInput = screen.getByPlaceholderText('Nama kegiatan…');
    fireEvent.change(titleInput, { target: { value: 'Weekly Sync Updated' } });
    fireEvent.blur(titleInput);

    // Scope modal should appear for the Sept 28 occurrence
    expect(await screen.findByText('Ganti Nama Kegiatan Berulang')).toBeTruthy();
    expect(screen.getByText('Event ini')).toBeTruthy();
    expect(screen.getByText('Event ini dan hari Senin seterusnya')).toBeTruthy();
    expect(screen.getByText('Semua event')).toBeTruthy();

    fireEvent.click(screen.getByText('Semua event'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }));
    });

    expect(mocks.updateActivity).toHaveBeenCalledTimes(1);
    const [updatedId, payload] = mocks.updateActivity.mock.calls[0];
    expect(updatedId).toBe('master-weekly');
    expect(payload.title).toBe('Weekly Sync Updated');
    // Master anchor date (Sept 21) must be preserved so Sept 21 does not disappear
    expect(new Date(payload.date).getDate()).toBe(21);
  });

  it('excludes only the clicked instanceDate and creates a detached activity when choosing THIS_EVENT', async () => {
    render(
      <CalendarCardSettings
        selectedItem={secondOccurrenceItem}
        onClose={onClose}
        onRefresh={onRefresh}
      />,
    );

    const titleInput = screen.getByPlaceholderText('Nama kegiatan…');
    fireEvent.change(titleInput, { target: { value: 'Special Sync' } });
    fireEvent.blur(titleInput);

    expect(await screen.findByText('Ganti Nama Kegiatan Berulang')).toBeTruthy();
    fireEvent.click(screen.getByText('Event ini'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }));
    });

    expect(mocks.updateActivity).toHaveBeenCalledWith('master-weekly', {
      recurrence: {
        ...weekly,
        excludeDates: ['2026-09-28'],
      },
    });
    expect(mocks.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Special Sync',
        recurrence: null,
      }),
    );
  });

  it('truncates the master series to H-1 and creates a new series when choosing THIS_AND_FOLLOWING', async () => {
    render(
      <CalendarCardSettings
        selectedItem={secondOccurrenceItem}
        onClose={onClose}
        onRefresh={onRefresh}
      />,
    );

    const titleInput = screen.getByPlaceholderText('Nama kegiatan…');
    fireEvent.change(titleInput, { target: { value: 'Future Sync' } });
    fireEvent.blur(titleInput);

    expect(await screen.findByText('Ganti Nama Kegiatan Berulang')).toBeTruthy();
    fireEvent.click(screen.getByText('Event ini dan hari Senin seterusnya'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Terapkan' }));
    });

    expect(mocks.updateActivity).toHaveBeenCalledWith('master-weekly', {
      recurrence: {
        ...weekly,
        endType: 'ON_DATE',
        untilDate: '2026-09-27',
      },
    });
    expect(mocks.createActivity).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Future Sync',
        recurrence: expect.objectContaining({
          freq: 'WEEKLY',
          byDays: [1],
        }),
      }),
    );
  });

  it('passes forceAll=true to onDelete when confirming ALL_EVENTS delete from settings', async () => {
    render(
      <CalendarCardSettings
        selectedItem={secondOccurrenceItem}
        onClose={onClose}
        onRefresh={onRefresh}
        onDelete={onDelete}
      />,
    );

    fireEvent.click(screen.getByTitle('Hapus kegiatan ini'));
    expect(await screen.findByText('Hapus Kegiatan Berulang')).toBeTruthy();

    fireEvent.click(screen.getByText('Semua event'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    });

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(secondOccurrenceItem, true);
    });
  });
});
