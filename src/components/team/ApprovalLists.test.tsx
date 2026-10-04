import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import ApprovalLists from './ApprovalLists';
import { teamApi } from '@/api/teams';
import { taskApi } from '@/api/tasks';

vi.mock('@/api/teams', () => ({
  teamApi: {
    listPendingTasks: vi.fn(),
    listJoinRequests: vi.fn(),
    getTeam: vi.fn(),
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
      assignees: [],
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

  const mockTeam = {
    id: 'team-1',
    name: 'Team Alpha',
    members: [
      {
        id: 'm-1',
        userId: 'user-budi',
        teamId: 'team-1',
        role: 'ADMIN' as const,
        user: {
          id: 'user-budi',
          name: 'Budi Santoso',
          email: 'budi@example.com',
          avatarUrl: 'https://example.com/budi.jpg',
        },
      },
      {
        id: 'm-2',
        userId: 'user-andi',
        teamId: 'team-1',
        role: 'MEMBER' as const,
        user: {
          id: 'user-andi',
          name: 'Andi Pratama',
          email: 'andi@example.com',
          avatarUrl: 'https://example.com/andi.jpg',
        },
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(teamApi.listPendingTasks).mockResolvedValue(mockTasks as any);
    vi.mocked(teamApi.listJoinRequests).mockResolvedValue(mockRequests as any);
    vi.mocked(teamApi.getTeam).mockResolvedValue(mockTeam as any);
    vi.mocked(taskApi.approve).mockResolvedValue({} as any);
    vi.mocked(taskApi.reject).mockResolvedValue({} as any);
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

  it('opens approval popup when clicking Setujui, and allows approving via "Atur nanti"', async () => {
    render(<ApprovalLists teamId="team-1" activeTab="task" />);

    await waitFor(() => {
      expect(screen.getByText('Fitur Kalender Baru')).toBeTruthy();
    });

    // Klik tombol Setujui pada task
    const approveBtn = screen.getByRole('button', { name: 'Setujui' });
    fireEvent.click(approveBtn);

    // Modal popup harus muncul
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Setujui dan Tugaskan Task/i })).toBeTruthy();
    });

    expect(screen.getByText(/Tugaskan task ini ke anggota tim atau atur nanti/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Atur nanti' })).toBeTruthy();

    // Klik "Atur nanti"
    fireEvent.click(screen.getByRole('button', { name: 'Atur nanti' }));

    await waitFor(() => {
      expect(taskApi.approve).toHaveBeenCalledWith('task-p1', { assigneeIds: [] });
    });
  });

  it('allows selecting an assignee and approving with assigned member', async () => {
    render(<ApprovalLists teamId="team-1" activeTab="task" />);

    await waitFor(() => {
      expect(screen.getByText('Fitur Kalender Baru')).toBeTruthy();
    });

    // Klik tombol Setujui
    const approveBtn = screen.getByRole('button', { name: 'Setujui' });
    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Setujui dan Tugaskan Task/i })).toBeTruthy();
    });

    // Pilih anggota Andi Pratama
    const andiBtn = screen.getByText('Andi Pratama');
    fireEvent.click(andiBtn);

    // Tombol submit berubah menjadi "Tugaskan (1) & Setujui"
    const submitBtn = screen.getByRole('button', { name: /Tugaskan \(1\) & Setujui/i });
    expect(submitBtn).toBeTruthy();

    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(taskApi.approve).toHaveBeenCalledWith('task-p1', { assigneeIds: ['user-andi'] });
    });
  });

  it('closes modal when clicking Batal without calling taskApi.approve', async () => {
    render(<ApprovalLists teamId="team-1" activeTab="task" />);

    await waitFor(() => {
      expect(screen.getByText('Fitur Kalender Baru')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Setujui' }));

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /Setujui dan Tugaskan Task/i })).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Setujui dan Tugaskan Task/i })).toBeNull();
    });

    expect(taskApi.approve).not.toHaveBeenCalled();
  });
});
