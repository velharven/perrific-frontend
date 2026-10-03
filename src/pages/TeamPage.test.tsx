import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TeamPage from './TeamPage';
import { teamApi } from '@/api/teams';
import { projectApi } from '@/api/projects';
import type { ProjectProposal, Team } from '@/types';

vi.mock('@/store/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-admin', name: 'Admin User', email: 'admin@example.com' },
  }),
}));

vi.mock('@/components/ui/Toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('@/api/teams', () => ({
  teamApi: {
    getTeam: vi.fn(),
    listProjects: vi.fn(),
    listProjectProposals: vi.fn(),
    approveProjectProposal: vi.fn(),
    rejectProjectProposal: vi.fn(),
    addMember: vi.fn(),
  },
}));

vi.mock('@/api/projects', () => ({
  projectApi: {
    listTasks: vi.fn(),
  },
}));

describe('TeamPage - Tab Usulan in Cell Pill', () => {
  const mockTeam: Team = {
    id: 'team-1',
    name: 'Frontend Warriors',
    description: 'Tim pengembangan frontend',
    avatarUrl: null,
    inviteCode: 'CODE123',
    canManageInvite: true,
    members: [
      {
        id: 'member-1',
        teamId: 'team-1',
        userId: 'user-admin',
        role: 'ADMIN',
        user: { id: 'user-admin', name: 'Admin User', email: 'admin@example.com' },
      },
    ],
  };

  const mockProposals: ProjectProposal[] = [
    {
      id: 'prop-1',
      teamId: 'team-1',
      organizationId: 'org-1',
      createdById: 'user-org',
      name: 'Revamp Desain Web',
      description: 'Proposal untuk mendesain ulang portal',
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      organization: { id: 'org-1', name: 'Acme Corp' },
      createdBy: { id: 'user-org', name: 'Budi Organisasi', email: 'budi@example.com' },
    },
    {
      id: 'prop-2',
      teamId: 'team-1',
      organizationId: 'org-1',
      createdById: 'user-org',
      name: 'Integrasi Payment',
      description: 'Integrasi sistem pembayaran',
      status: 'APPROVED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      organization: { id: 'org-1', name: 'Acme Corp' },
      createdBy: { id: 'user-org', name: 'Budi Organisasi', email: 'budi@example.com' },
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (teamApi.getTeam as any).mockResolvedValue(mockTeam);
    (teamApi.listProjects as any).mockResolvedValue([]);
    (teamApi.listProjectProposals as any).mockResolvedValue(mockProposals);
    (teamApi.approveProjectProposal as any).mockResolvedValue({
      project: { id: 'proj-new', name: 'Revamp Desain Web' },
      proposal: { ...mockProposals[0], status: 'APPROVED' },
    });
    (teamApi.rejectProjectProposal as any).mockResolvedValue({
      ...mockProposals[0],
      status: 'REJECTED',
      rejectionReason: 'Belum prioritas',
    });
    (projectApi.listTasks as any).mockResolvedValue([]);
  });

  afterEach(() => {
    cleanup();
  });

  function renderTeamPage() {
    return render(
      <MemoryRouter initialEntries={['/team/team-1']}>
        <Routes>
          <Route path="/team/:teamId" element={<TeamPage />} />
        </Routes>
      </MemoryRouter>
    );
  }

  it('renders "Usulan" tab inside cell pill with pending count badge', async () => {
    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend Warriors')).toBeTruthy();
    });

    // Check cell pill tabs: Project, Team, and Usulan
    const usulanTab = screen.getByRole('tab', { name: /Usulan/i });
    expect(usulanTab).toBeTruthy();
    // Badge 1 pending proposal
    expect(usulanTab.textContent).toContain('1');
  });

  it('switches to Usulan tab when clicked and displays proposals with details', async () => {
    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend Warriors')).toBeTruthy();
    });

    const usulanTab = screen.getByRole('tab', { name: /Usulan/i });
    fireEvent.click(usulanTab);

    // Should display proposals
    expect(screen.getByText('Revamp Desain Web')).toBeTruthy();
    expect(screen.getByText('Proposal untuk mendesain ulang portal')).toBeTruthy();
    expect(screen.getAllByText(/Acme Corp/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Budi Organisasi/i).length).toBeGreaterThan(0);

    // Status badges
    expect(screen.getByText('Menunggu Approval')).toBeTruthy();
    expect(screen.getByText('Disetujui')).toBeTruthy();
  });

  it('switches to Usulan tab when clicking "Tinjau Usulan" in the warning banner', async () => {
    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend Warriors')).toBeTruthy();
    });

    const tinjauBtn = screen.getByRole('button', { name: /Tinjau Usulan/i });
    fireEvent.click(tinjauBtn);

    // Should now show Usulan view
    expect(screen.getByText('Revamp Desain Web')).toBeTruthy();
  });

  it('allows admin to approve a pending proposal', async () => {
    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend Warriors')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Usulan/i }));

    const approveBtn = screen.getByRole('button', { name: /Setujui/i });
    expect(approveBtn).toBeTruthy();

    fireEvent.click(approveBtn);

    await waitFor(() => {
      expect(teamApi.approveProjectProposal).toHaveBeenCalledWith('team-1', 'prop-1');
    });
  });

  it('allows admin to reject a pending proposal via RejectProposalModal with optional reason', async () => {
    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend Warriors')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Usulan/i }));

    const rejectBtn = screen.getByRole('button', { name: /^Tolak$/i });
    expect(rejectBtn).toBeTruthy();

    fireEvent.click(rejectBtn);

    // Modal should now be open
    expect(screen.getByText('Tolak Usulan Project')).toBeTruthy();

    const textarea = screen.getByPlaceholderText(/Tuliskan alasan penolakan usulan/i);
    fireEvent.change(textarea, { target: { value: 'Belum prioritas' } });

    const confirmRejectBtn = screen.getByRole('button', { name: /^Tolak Usulan$/i });
    fireEvent.click(confirmRejectBtn);

    await waitFor(() => {
      expect(teamApi.rejectProjectProposal).toHaveBeenCalledWith('team-1', 'prop-1', 'Belum prioritas');
    });
  });

  it('shows friendly empty state when no proposals exist', async () => {
    (teamApi.listProjectProposals as any).mockResolvedValue([]);

    renderTeamPage();

    await waitFor(() => {
      expect(screen.getByText('Frontend Warriors')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('tab', { name: /Usulan/i }));

    expect(screen.getByText(/Belum ada usulan project dari organisasi/i)).toBeTruthy();
  });
});
