import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BoardPage from './BoardPage';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('@/store/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
  }),
}));

vi.mock('@/api/projects', () => ({
  projectApi: {
    getProject: vi.fn(),
    listTasks: vi.fn(),
    listColumns: vi.fn(),
    createTask: vi.fn(),
    moveTask: vi.fn(),
    reorderColumn: vi.fn(),
  },
}));

vi.mock('@/api/teams', () => ({
  teamApi: {
    getTeam: vi.fn(),
    listPendingTasks: vi.fn().mockResolvedValue([]),
    listJoinRequests: vi.fn().mockResolvedValue([]),
  },
}));

describe('BoardPage Kanban card open behavior (Desktop vs Mobile)', () => {
  const mockProject = {
    id: 'proj-1',
    name: 'Test Project',
    teamId: 'team-1',
    columns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTeam = {
    id: 'team-1',
    name: 'Test Team',
    members: [{ userId: 'user-1', role: 'ADMIN' }],
  };

  const mockColumns = [
    { id: 'col-1', name: 'To Do', order: 1, projectId: 'proj-1' },
  ];

  const mockTasks = [
    {
      id: 'task-101',
      number: 1,
      title: 'Desain Sistem Responsif',
      priority: 'MEDIUM',
      approval: 'APPROVED',
      columnId: 'col-1',
      column: { id: 'col-1', name: 'To Do', order: 1 },
      projectId: 'proj-1',
      order: 1,
      assignees: [],
      attachments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];

  beforeEach(() => {
    mockNavigate.mockReset();
    vi.mocked(projectApi.getProject).mockResolvedValue(mockProject as any);
    vi.mocked(teamApi.getTeam).mockResolvedValue(mockTeam as any);
    vi.mocked(projectApi.listColumns).mockResolvedValue(mockColumns as any);
    vi.mocked(projectApi.listTasks).mockResolvedValue(mockTasks as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('navigates directly to task settings when card is clicked on desktop (>= 768px)', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

    render(
      <MemoryRouter initialEntries={['/project/proj-1/board']}>
        <Routes>
          <Route path="/project/:projectId/board" element={<BoardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Desain Sistem Responsif')).toBeTruthy();
    });

    const card = screen.getByText('Desain Sistem Responsif');
    fireEvent.click(card);

    // On desktop, navigates immediately and does NOT show floating button
    expect(mockNavigate).toHaveBeenCalledWith('task-101');
    expect(screen.queryByRole('button', { name: /Buka Pengaturan Card/i })).toBeNull();
  });

  it('shows floating button "Buka Pengaturan Card" when card is clicked on mobile (< 768px)', async () => {
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 500 });

    render(
      <MemoryRouter initialEntries={['/project/proj-1/board']}>
        <Routes>
          <Route path="/project/:projectId/board" element={<BoardPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Desain Sistem Responsif')).toBeTruthy();
    });

    const card = screen.getByText('Desain Sistem Responsif');
    fireEvent.click(card);

    // On mobile, does not navigate immediately; renders KanbanFloatingCardAction
    expect(mockNavigate).not.toHaveBeenCalled();
    const floatingBtn = screen.getByRole('button', { name: /Buka Pengaturan Card/i });
    expect(floatingBtn).toBeTruthy();

    // Clicking the floating button triggers navigation
    fireEvent.click(floatingBtn);
    expect(mockNavigate).toHaveBeenCalledWith('task-101');
  });
});
