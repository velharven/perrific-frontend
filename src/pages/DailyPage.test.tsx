// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyActivity } from '@/types';
import DailyPage from './DailyPage';

const mockListMine = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockListColumns = vi.fn();

let mockCalendarChange: { action?: string; activity?: DailyActivity; activityId?: string } | null = null;
const syncListeners = new Set<() => void>();

vi.mock('@/api/activities', () => ({
  activityApi: {
    listMine: (...args: unknown[]) => mockListMine(...args),
    create: (...args: unknown[]) => mockCreate(...args),
    update: (...args: unknown[]) => mockUpdate(...args),
    remove: vi.fn(),
    duplicate: vi.fn(),
    reorder: vi.fn(),
    listColumns: (...args: unknown[]) => mockListColumns(...args),
    createColumn: vi.fn(),
    updateColumn: vi.fn(),
    deleteColumn: vi.fn(),
    reorderColumns: vi.fn(),
    setCellValue: vi.fn(),
  },
}));

vi.mock('@/store/calendarSync', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const React = require('react') as typeof import('react');
  return {
    useCalendarSync: () => {
      const [, forceRender] = React.useReducer((x: number) => x + 1, 0);
      React.useEffect(() => {
        syncListeners.add(forceRender);
        return () => {
          syncListeners.delete(forceRender);
        };
      }, []);
      return {
        revision: 0,
        status: { connected: false },
        change: mockCalendarChange,
      };
    },
  };
});

vi.mock('@/components/daily/CalendarView', () => ({
  default: () => <div data-testid="calendar-view" />,
}));
vi.mock('@/components/daily/TeamTaskView', () => ({
  default: () => <div data-testid="team-task-view" />,
}));
vi.mock('@/components/daily/PersonalProjectKanbanView', () => ({
  default: () => <div data-testid="personal-project-view" />,
}));

describe('DailyPage table item creation & title editing', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCalendarChange = null;
    syncListeners.clear();
    Element.prototype.scrollIntoView = vi.fn();
    mockListMine.mockResolvedValue([]);
    mockListColumns.mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  it('hanya membuat 1 baris saat klik "+ Baru Item" meskipun calendarChange memancarkan aktivitas yang sama, serta judulnya langsung bisa diedit', async () => {
    const nowIso = new Date().toISOString();
    const createdActivity: DailyActivity = {
      id: 'act-new-1',
      userId: 'user-1',
      title: 'Tanpa judul',
      description: null,
      date: nowIso,
      startTime: null,
      endTime: null,
      type: 'CUSTOM',
      status: 'PENDING',
      order: 1,
      icon: 'note',
      checklistItems: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    mockCreate.mockImplementation(async () => {
      // Simulasikan interceptor axios (calendar:mutation) yang mengupdate calendarChange
      // tepat sebelum promise activityApi.create selesai di komponen.
      mockCalendarChange = { action: 'update', activity: createdActivity };
      syncListeners.forEach((fn) => fn());
      return createdActivity;
    });

    mockUpdate.mockImplementation(async (_id: string, body: { title?: string }) => ({
      ...createdActivity,
      title: body.title ?? createdActivity.title,
    }));

    render(
      <MemoryRouter>
        <DailyPage />
      </MemoryRouter>,
    );

    const addButton = await screen.findByRole('button', { name: /^Baru Item$/i });
    fireEvent.click(addButton);

    // Pastikan hanya ada 1 input judul yang muncul (bukan 2 baris kembar yang saling blur)
    const titleInputs = await screen.findAllByDisplayValue('Tanpa judul');
    expect(titleInputs).toHaveLength(1);

    const rows = document.querySelectorAll('tr[id^="activity-"]');
    expect(rows).toHaveLength(1);

    // Pastikan nama item bisa diketik dan disimpan
    const titleInput = titleInputs[0] as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: 'Rapat Sprint Pagi' } });
    fireEvent.keyDown(titleInput, { key: 'Enter' });

    await waitFor(() => {
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate).toHaveBeenCalledWith('act-new-1', { title: 'Rapat Sprint Pagi' });
    });

    expect(await screen.findByRole('button', { name: 'Rapat Sprint Pagi' })).toBeTruthy();
  });
});
