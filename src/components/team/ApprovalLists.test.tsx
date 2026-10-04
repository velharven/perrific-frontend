import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ApprovalLists from './ApprovalLists';
import { teamApi } from '@/api/teams';
import { taskApi } from '@/api/tasks';

vi.mock('@/api/teams', () => ({
  teamApi: {
    listPendingTasks: vi.fn(),
    listJoinRequests: vi.fn(),
    approveJoinRequest: vi.fn().mockResolvedValue({}),
    rejectJoinRequest: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/api/tasks', () => ({
  taskApi: {
    approve: vi.fn().mockResolvedValue({}),
    reject: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('@/components/ui/Toast', () => ({
  showToast: vi.fn(),
}));

describe('ApprovalLists Component', () => {
  const mockTasks = [
    {
      id: 'task-p1',
      title: 'Fitur Kalender Baru',
      project: { id: 'proj-1', name: 'Project Alpha' },
      createdBy: {
        id: 'user-budi',
        name: 'Budi Santoso',
        avatarUrl: 'https://example.com/budi.jpg',
      },
    },
  ];

  const mockRequests = [
    {
      id: 'req-1',
      teamId: 'team-1',
      userId: 'user-siti',
      status: 'PENDING' as const,
      createdAt: '2026-10-04T00:00:00Z',
      user: {
        id: 'user-siti',
        name: 'Siti Rahma',
        email: 'siti.secret@example.com',
        avatarUrl: 'https://example.com/siti.jpg',
      },
    },
  ];

  beforeEach(() => {
    vi.mocked(teamApi.listPendingTasks).mockResolvedValue(mockTasks as any);
    vi.mocked(teamApi.listJoinRequests).mockResolvedValue(mockRequests as any);
  });

  afterEach(() => {
    cleanup();
  });

  it('renders task proposer name and avatar on task proposal list', async () => {
    render(<ApprovalLists teamId="team-1" activeTab="task" />);

    await waitFor(() => {
      expect(screen.getByText('Fitur Kalender Baru')).toBeTruthy();
    });

    expect(screen.getByText(/Budi Santoso/i)).toBeTruthy();
    expect(screen.getByText(/Project Alpha/i)).toBeTruthy();

    const avatarImg = screen.getByAltText(/Budi Santoso/i);
    expect(avatarImg).toBeTruthy();
  });

  it('renders requester name and avatar on join request list, but DOES NOT render email', async () => {
    render(<ApprovalLists teamId="team-1" activeTab="anggota" />);

    await waitFor(() => {
      expect(screen.getByText('Siti Rahma')).toBeTruthy();
    });

    // Profil avatar tampil
    const avatar = screen.getByAltText(/Siti Rahma|calon anggota/i);
    expect(avatar).toBeTruthy();

    // Pastikan EMAIL TIDAK DITAMPILKAN
    expect(screen.queryByText('siti.secret@example.com')).toBeNull();
    expect(screen.queryByText(/@/)).toBeNull();
  });
});
