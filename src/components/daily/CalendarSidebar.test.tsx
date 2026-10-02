import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyActivity } from '@/types';
import CalendarSidebar from './CalendarSidebar';

vi.mock('@/api/tasks', () => ({
  taskApi: {
    listMyAssigned: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/api/projects', () => ({
  projectApi: {
    getMyPersonalProject: vi.fn().mockResolvedValue(null),
    listTasks: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/api/teams', () => ({
  teamApi: {
    listProjects: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/store/socket', () => ({
  useSocket: () => ({ socket: null }),
}));

vi.mock('@/store/calendarSync', () => ({
  useCalendarSync: () => ({ status: { isConnected: false } }),
}));

vi.mock('@/components/ui/TimePickerInput', () => ({
  default: ({ value, onChange, placeholder }: any) => (
    <input
      data-testid="time-picker"
      placeholder={placeholder}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
    />
  ),
}));

describe('CalendarSidebar (Mobile Tap-to-Schedule)', () => {
  const onRefresh = vi.fn();
  const onClose = vi.fn();
  const onScheduleItem = vi.fn();

  const unscheduledAct: DailyActivity = {
    id: 'unscheduled-1',
    userId: 'user-a',
    title: 'Tugas Belum Terjadwal',
    date: '2026-09-29T00:00:00.000Z',
    startTime: null,
    endTime: null,
    type: 'TASK',
    status: 'PENDING',
    order: 0,
    checklistItems: [],
  };

  beforeEach(() => {
    onRefresh.mockReset();
    onClose.mockReset();
    onScheduleItem.mockReset();
  });

  afterEach(cleanup);

  it('renders unscheduled items with Jadwalkan button and opens QuickScheduleModal on click', async () => {
    render(
      <CalendarSidebar
        activities={[unscheduledAct]}
        onRefresh={onRefresh}
        onClose={onClose}
        onScheduleItem={onScheduleItem}
        activeCalendarDate={new Date('2026-09-29T12:00:00')}
      />,
    );

    // Pastikan tombol Jadwalkan muncul di kartu
    const jadwalkanBtn = screen.getByRole('button', { name: 'Jadwalkan' });
    expect(jadwalkanBtn).toBeTruthy();

    // Klik tombol Jadwalkan
    fireEvent.click(jadwalkanBtn);

    // Modal Quick Schedule harus terbuka
    expect(screen.getByText('Jadwalkan ke Kalender')).toBeTruthy();
    expect(screen.getByText('Pilih Tanggal')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Simpan ke Kalender' })).toBeTruthy();
  });

  it('allows picking quick date pills and submits scheduling to onScheduleItem', async () => {
    render(
      <CalendarSidebar
        activities={[unscheduledAct]}
        onRefresh={onRefresh}
        onClose={onClose}
        onScheduleItem={onScheduleItem}
        activeCalendarDate={new Date('2026-09-29T12:00:00')}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Jadwalkan' }));

    // Klik tombol quick pill "Besok"
    const besokPill = screen.getByRole('button', { name: 'Besok' });
    fireEvent.click(besokPill);

    // Klik Simpan ke Kalender
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Simpan ke Kalender' }));
    });

    await waitFor(() => {
      expect(onScheduleItem).toHaveBeenCalledWith(
        expect.objectContaining({
          source: 'item',
          id: 'unscheduled-1',
          title: 'Tugas Belum Terjadwal',
          targetDate: expect.any(Date),
        }),
      );
      expect(onClose).toHaveBeenCalled();
    });
  });
});
