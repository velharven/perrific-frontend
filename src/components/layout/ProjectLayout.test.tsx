import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProjectLayout from './ProjectLayout';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';

vi.mock('@/store/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
  }),
}));

vi.mock('@/hooks/useDisplayScale', () => ({
  useDisplayScale: () => {},
}));

vi.mock('@/api/projects', () => ({
  projectApi: {
    getProject: vi.fn(),
  },
}));

vi.mock('@/api/teams', () => ({
  teamApi: {
    getTeam: vi.fn(),
    listPendingTasks: vi.fn(),
    listJoinRequests: vi.fn(),
  },
}));

describe('ProjectLayout Component', () => {
  const mockProject = {
    id: 'proj-123',
    name: 'Super Project',
    teamId: 'team-456',
    columns: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockTeam = {
    id: 'team-456',
    name: 'Team Rocket',
    members: [
      { userId: 'user-1', role: 'ADMIN' },
    ],
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    (projectApi.getProject as any).mockResolvedValue(mockProject);
    (teamApi.getTeam as any).mockResolvedValue(mockTeam);
    (teamApi.listPendingTasks as any).mockResolvedValue([
      { id: 'task-1', title: 'Task 1', project: { id: 'proj-123' } },
    ]);
    (teamApi.listJoinRequests as any).mockResolvedValue([]);
    window.innerWidth = 1024;
    window.innerHeight = 768;
  });

  afterEach(() => {
    cleanup();
  });

  function renderProjectLayout(initialEntries = ['/projects/proj-123']) {
    return render(
      <MemoryRouter initialEntries={initialEntries}>
        <Routes>
          <Route path="/projects/:projectId" element={<ProjectLayout />}>
            <Route index element={<div>Project Overview Content</div>} />
            <Route path="kanban" element={<div>Kanban Content</div>} />
            <Route path="persetujuan" element={<div>Approval Content</div>} />
            <Route path="settings" element={<div>Settings Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders desktop sidebar with project title, tabs, and collapse toggle button', async () => {
    renderProjectLayout();

    await waitFor(() => {
      expect(screen.getAllByText('Super Project').length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(screen.getAllByText('1').length).toBeGreaterThan(0);
    });

    expect(screen.getAllByText('Overview').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kanban').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Persetujuan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kembali ke Tim').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);

    // Collapsible toggle button
    const collapseButton = screen.getByRole('button', { name: /Tutup sidebar project/i });
    expect(collapseButton).toBeTruthy();

    fireEvent.click(collapseButton);
    expect(localStorage.getItem('purrific:project-sidebar-collapsed')).toBe('1');
  });

  it('renders floating mobile burger and opens mobile drawer on mobile/tablet', async () => {
    window.innerWidth = 375;
    window.innerHeight = 667;

    renderProjectLayout();

    await waitFor(() => {
      expect(screen.getAllByText('Super Project').length).toBeGreaterThan(0);
    });

    const burgerButton = screen.getByRole('button', { name: /Buka menu navigasi/i });
    expect(burgerButton).toBeTruthy();

    // Click floating burger to open mobile drawer
    fireEvent.pointerDown(burgerButton, { clientX: 20, clientY: 20, button: 0, pointerId: 1 });
    fireEvent.pointerUp(burgerButton, { clientX: 20, clientY: 20, button: 0, pointerId: 1 });

    // Drawer should show close button (X)
    const closeButton = screen.getByRole('button', { name: /^tutup sidebar$/i });
    expect(closeButton).toBeTruthy();

    // Click close button
    fireEvent.click(closeButton);

    // Reopen and close by clicking backdrop
    fireEvent.pointerDown(burgerButton, { clientX: 20, clientY: 20, button: 0, pointerId: 1 });
    fireEvent.pointerUp(burgerButton, { clientX: 20, clientY: 20, button: 0, pointerId: 1 });

    const backdrop = document.querySelector('.bg-black\\/40');
    expect(backdrop).toBeTruthy();
    if (backdrop) {
      fireEvent.click(backdrop);
    }
  });
});
