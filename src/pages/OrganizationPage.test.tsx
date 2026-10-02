import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import OrganizationPage from './OrganizationPage';
import { organizationApi } from '@/api/organizations';

vi.mock('@/store/auth', () => ({
  useAuth: () => ({ user: { id: 'u1', name: 'User 1' } }),
}));

vi.mock('@/hooks/useNavLabels', () => ({
  useTrash: () => ({ items: [] }),
}));

vi.mock('@/api/organizations', () => ({
  organizationApi: {
    get: vi.fn(),
    disconnectTeam: vi.fn(),
  },
}));

vi.mock('@/api/teams', () => ({
  teamApi: {
    listMyTeams: vi.fn().mockResolvedValue([]),
  },
}));

describe('OrganizationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders loading state initially', () => {
    vi.mocked(organizationApi.get).mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter initialEntries={['/org/org-1']}>
        <Routes>
          <Route path="/org/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>
    );
    const loadingEl = screen.getByRole('status');
    expect(loadingEl).toBeTruthy();
    expect(loadingEl.getAttribute('aria-busy')).toBe('true');
  });

  it('renders not found state when org does not exist', async () => {
    vi.mocked(organizationApi.get).mockRejectedValue(new Error('Not found'));
    render(
      <MemoryRouter initialEntries={['/org/org-1']}>
        <Routes>
          <Route path="/org/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Organisasi tidak ditemukan atau akses terbatas.')).toBeTruthy();
    });
  });

  it('renders organization details without white screen crash (Rules of Hooks test)', async () => {
    vi.mocked(organizationApi.get).mockResolvedValue({
      id: 'org-1',
      name: 'Org Testing',
      createdById: 'u1',
      order: 0,
      createdAt: '',
      updatedAt: '',
      members: [],
      connectedTeams: [],
      projectProposals: [],
      tasks: [],
    });

    render(
      <MemoryRouter initialEntries={['/org/org-1']}>
        <Routes>
          <Route path="/org/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Org Testing')).toBeTruthy();
    });
    expect(screen.getAllByText('Usulan Project').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Task Terkirim').length).toBeGreaterThan(0);
  });

  it('renders safely with connected teams data and allows switching tabs', async () => {
    vi.mocked(organizationApi.get).mockResolvedValue({
      id: 'org-1',
      name: 'Org Alpha',
      createdById: 'u1',
      order: 0,
      createdAt: '',
      updatedAt: '',
      members: [{ id: 'm1', organizationId: 'org-1', userId: 'u1', role: 'ADMIN', joinedAt: '', user: { id: 'u1', name: 'Admin User', email: 'admin@test.com' } }],
      connectedTeams: [
        {
          id: 'ct-1',
          organizationId: 'org-1',
          teamId: 't-1',
          createdAt: '',
          team: {
            id: 't-1',
            name: 'Dev Team',
            projects: [
              {
                id: 'p1',
                teamId: 't-1',
                name: 'Project 1',
                status: 'ACTIVE',
              },
            ],
          },
        },
      ],
      projectProposals: [],
      tasks: [],
    });

    render(
      <MemoryRouter initialEntries={['/org/org-1']}>
        <Routes>
          <Route path="/org/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Org Alpha')).toBeTruthy();
    });

    // Pindah ke tab Tim Terhubung
    const teamTab = screen.getByRole('button', { name: /Tim Terhubung/i });
    fireEvent.click(teamTab);

    expect(screen.getByText('Dev Team')).toBeTruthy();
    expect(screen.getByText('1 Project Aktif')).toBeTruthy();
  });
});
