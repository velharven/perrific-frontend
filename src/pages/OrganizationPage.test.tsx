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
    update: vi.fn(),
    disconnectTeam: vi.fn(),
    addMember: vi.fn(),
    removeMember: vi.fn(),
  },
}));

vi.mock('@/api/teams', () => ({
  teamApi: {
    listMyTeams: vi.fn().mockResolvedValue([]),
  },
}));

const mockOrgData = {
  id: 'org-1',
  name: 'Org Testing',
  description: 'Deskripsi uji organisasi',
  createdById: 'u1',
  order: 0,
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01',
  members: [
    {
      id: 'm1',
      organizationId: 'org-1',
      userId: 'u1',
      role: 'ADMIN' as const,
      joinedAt: '2026-01-01',
      user: { id: 'u1', name: 'Admin Purrific', email: 'admin@purrific.test' },
    },
    {
      id: 'm2',
      organizationId: 'org-1',
      userId: 'u2',
      role: 'MEMBER' as const,
      joinedAt: '2026-01-01',
      user: { id: 'u2', name: 'Member Purrific', email: 'member@purrific.test' },
    },
  ],
  connectedTeams: [
    {
      id: 'ct-1',
      organizationId: 'org-1',
      teamId: 't-1',
      createdAt: '2026-01-01',
      team: {
        id: 't-1',
        name: 'Backend Core Team',
        avatarUrl: null,
        projects: [
          {
            id: 'p1',
            teamId: 't-1',
            name: 'API V2 Gateway',
            status: 'ACTIVE' as const,
          },
        ],
      },
    },
  ],
  projectProposals: [
    {
      id: 'prop-1',
      organizationId: 'org-1',
      teamId: 't-1',
      createdById: 'u1',
      name: 'Integrasi AI Service',
      description: 'Layanan kecerdasan buatan terpusat',
      status: 'PENDING' as const,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      team: { id: 't-1', name: 'Backend Core Team' },
      createdBy: { id: 'u1', name: 'Admin Purrific', email: 'admin@purrific.test' },
    },
    {
      id: 'prop-2',
      organizationId: 'org-1',
      teamId: 't-1',
      createdById: 'u1',
      name: 'Design System Rework',
      description: 'Penyegaran token desain UI',
      status: 'APPROVED' as const,
      approvedProjectId: 'p1',
      approvedProject: { id: 'p1', name: 'API V2 Gateway' },
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      team: { id: 't-1', name: 'Backend Core Team' },
      createdBy: { id: 'u1', name: 'Admin Purrific', email: 'admin@purrific.test' },
    },
  ],
  tasks: [
    {
      id: 'task-1',
      projectId: 'p1',
      columnId: 'col-1',
      column: { id: 'col-1', name: 'Backlog', order: 0 },
      number: 1,
      title: 'Setup Prisma Migration',
      description: 'Skema awal tabel organisasi',
      priority: 'HIGH' as const,
      approval: 'PENDING' as const,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      order: 0,
      assignees: [],
      project: {
        id: 'p1',
        name: 'API V2 Gateway',
        team: { id: 't-1', name: 'Backend Core Team' },
      },
      createdBy: { id: 'u1', name: 'Admin Purrific' },
    },
    {
      id: 'task-2',
      projectId: 'p1',
      columnId: 'col-1',
      column: { id: 'col-1', name: 'Backlog', order: 0 },
      number: 2,
      title: 'Fix Auth Rate Limiting',
      description: 'Pencegahan spam brute force',
      priority: 'URGENT' as const,
      approval: 'APPROVED' as const,
      createdAt: '2026-01-01',
      updatedAt: '2026-01-01',
      order: 1,
      assignees: [],
      project: {
        id: 'p1',
        name: 'API V2 Gateway',
        team: { id: 't-1', name: 'Backend Core Team' },
      },
      createdBy: { id: 'u1', name: 'Admin Purrific' },
    },
  ],
};

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
      </MemoryRouter>,
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
      </MemoryRouter>,
    );
    await waitFor(() => {
      expect(screen.getByText('Organisasi tidak ditemukan atau akses terbatas.')).toBeTruthy();
    });
  });

  it('renders organization details with interactive KPI cards and tabs', async () => {
    vi.mocked(organizationApi.get).mockResolvedValue(mockOrgData);

    render(
      <MemoryRouter initialEntries={['/org/org-1']}>
        <Routes>
          <Route path="/org/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Org Testing')).toBeTruthy();
    });

    expect(screen.getByText('Deskripsi uji organisasi')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Pengaturan/i })).toBeTruthy();

    // Verifikasi KPI cards
    const kpiProposals = screen.getByRole('button', { name: /Lihat Usulan Project/i });
    const kpiTasks = screen.getByRole('button', { name: /Lihat Task Terkirim/i });
    const kpiTeams = screen.getByRole('button', { name: /Lihat Tim Terhubung/i });
    const kpiMembers = screen.getByRole('button', { name: /Lihat Anggota Organisasi/i });

    expect(kpiProposals).toBeTruthy();
    expect(kpiTasks).toBeTruthy();
    expect(kpiTeams).toBeTruthy();
    expect(kpiMembers).toBeTruthy();

    // Klik KPI Task Terkirim untuk beralih tab
    fireEvent.click(kpiTasks);
    expect(screen.getByText('Daftar Task Terkirim')).toBeTruthy();
    expect(screen.getByText('Setup Prisma Migration')).toBeTruthy();
    expect(screen.getByText('Fix Auth Rate Limiting')).toBeTruthy();

    // Klik KPI Tim Terhubung
    fireEvent.click(kpiTeams);
    expect(screen.getByText('Backend Core Team')).toBeTruthy();
    expect(screen.getByText('1 Project Aktif')).toBeTruthy();

    // Klik KPI Anggota Organisasi
    fireEvent.click(kpiMembers);
    expect(screen.getByText('Admin Purrific')).toBeTruthy();
    expect(screen.getByText('Member Purrific')).toBeTruthy();
  });

  it('filters and searches proposals properly in Usulan Project tab', async () => {
    vi.mocked(organizationApi.get).mockResolvedValue(mockOrgData);

    render(
      <MemoryRouter initialEntries={['/org/org-1']}>
        <Routes>
          <Route path="/org/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Org Testing')).toBeTruthy();
    });

    // Default tab adalah proposals
    expect(screen.getByText('Integrasi AI Service')).toBeTruthy();
    expect(screen.getByText('Design System Rework')).toBeTruthy();

    // Filter chip "Menunggu"
    const chipPending = screen.getByRole('button', { name: 'Menunggu' });
    fireEvent.click(chipPending);

    expect(screen.getByText('Integrasi AI Service')).toBeTruthy();
    expect(screen.queryByText('Design System Rework')).toBeNull();

    // Filter chip "Disetujui"
    const chipApproved = screen.getByRole('button', { name: 'Disetujui' });
    fireEvent.click(chipApproved);

    expect(screen.queryByText('Integrasi AI Service')).toBeNull();
    expect(screen.getByText('Design System Rework')).toBeTruthy();

    // Search bar filter
    const searchInput = screen.getByPlaceholderText(/Cari nama project/i);
    fireEvent.change(searchInput, { target: { value: 'TidakAdaProject' } });

    expect(screen.getByText('Tidak ada usulan yang sesuai filter pencarian')).toBeTruthy();
  });

  it('filters and searches tasks properly in Task Terkirim tab', async () => {
    vi.mocked(organizationApi.get).mockResolvedValue(mockOrgData);

    render(
      <MemoryRouter initialEntries={['/org/org-1']}>
        <Routes>
          <Route path="/org/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Org Testing')).toBeTruthy();
    });

    // Pindah ke tab Task Terkirim via tablist
    const tasksTab = screen.getByRole('tab', { name: /Task Terkirim/i });
    fireEvent.click(tasksTab);

    expect(screen.getByText('Setup Prisma Migration')).toBeTruthy();
    expect(screen.getByText('Fix Auth Rate Limiting')).toBeTruthy();

    // Search task
    const taskInput = screen.getByPlaceholderText(/Cari judul task/i);
    fireEvent.change(taskInput, { target: { value: 'Prisma' } });

    expect(screen.getByText('Setup Prisma Migration')).toBeTruthy();
    expect(screen.queryByText('Fix Auth Rate Limiting')).toBeNull();
  });

  it('allows editing organization profile via EditOrganizationModal', async () => {
    vi.mocked(organizationApi.get).mockResolvedValue(mockOrgData);
    vi.mocked(organizationApi.update).mockResolvedValue({
      ...mockOrgData,
      name: 'Org Testing Updated',
      description: 'Deskripsi baru yang diperbarui',
    });

    render(
      <MemoryRouter initialEntries={['/org/org-1']}>
        <Routes>
          <Route path="/org/:orgId" element={<OrganizationPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText('Org Testing')).toBeTruthy();
    });

    // Buka modal Pengaturan
    const settingsBtn = screen.getByRole('button', { name: /Pengaturan/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByText('Edit Profil Organisasi')).toBeTruthy();

    // Ubah nama organisasi
    const nameInput = screen.getByLabelText(/Nama Organisasi/i);
    fireEvent.change(nameInput, { target: { value: 'Org Testing Updated' } });

    // Submit form
    const saveBtn = screen.getByRole('button', { name: /Simpan Perubahan/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(organizationApi.update).toHaveBeenCalledWith('org-1', {
        name: 'Org Testing Updated',
        description: 'Deskripsi uji organisasi',
      });
    });

    await waitFor(() => {
      expect(screen.getByText('Org Testing Updated')).toBeTruthy();
    });
  });
});
