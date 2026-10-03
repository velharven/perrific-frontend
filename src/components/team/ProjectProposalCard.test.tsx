import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProjectProposalCard from './ProjectProposalCard';
import type { ProjectProposal } from '../../types';

describe('ProjectProposalCard Component', () => {
  afterEach(() => {
    cleanup();
  });

  const baseProposal: ProjectProposal = {
    id: 'prop-1',
    organizationId: 'org-1',
    teamId: 'team-1',
    createdById: 'user-1',
    name: 'Sistem Monitoring Inventaris',
    description: 'Aplikasi manajemen stok gudang otomatis',
    status: 'PENDING',
    createdAt: '2026-03-15T08:30:00.000Z',
    updatedAt: '2026-03-15T08:30:00.000Z',
    organization: {
      id: 'org-1',
      name: 'PT Maju Bersama',
    },
    createdBy: {
      id: 'user-1',
      name: 'Budi Darmawan',
      email: 'budi.darmawan@example.com',
      avatarUrl: 'https://example.com/budi.jpg',
    },
  };

  it('renders proposer name and avatar on the left, but DOES NOT render email', () => {
    render(
      <MemoryRouter>
        <ProjectProposalCard proposal={baseProposal} />
      </MemoryRouter>,
    );

    // Pastikan nama pengusul muncul
    expect(screen.getByText('Budi Darmawan')).toBeTruthy();

    // Pastikan foto avatar dirender
    const avatarImg = screen.getByRole('img');
    expect(avatarImg.getAttribute('src')).toBe('https://example.com/budi.jpg');

    // Pastikan email secara eksplisit TIDAK ditampilkan (permintaan user)
    expect(screen.queryByText('budi.darmawan@example.com')).toBeNull();
  });

  it('renders default silhouette avatar when avatarUrl is null', () => {
    const proposalWithoutAvatar: ProjectProposal = {
      ...baseProposal,
      createdBy: {
        id: 'user-2',
        name: 'Siti Rahma',
        email: 'siti@example.com',
        avatarUrl: null,
      },
    };

    render(
      <MemoryRouter>
        <ProjectProposalCard proposal={proposalWithoutAvatar} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Siti Rahma')).toBeTruthy();
    // Siluet ikon default harus ada
    expect(screen.getByTestId('avatar-silhouette')).toBeTruthy();
    // Email tidak boleh ditampilkan
    expect(screen.queryByText('siti@example.com')).toBeNull();
  });

  it('renders proposal name, description, organization name, and formatted date', () => {
    render(
      <MemoryRouter>
        <ProjectProposalCard proposal={baseProposal} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Sistem Monitoring Inventaris')).toBeTruthy();
    expect(screen.getByText('Aplikasi manajemen stok gudang otomatis')).toBeTruthy();
    expect(screen.getByText('PT Maju Bersama')).toBeTruthy();
  });

  it('renders PENDING status badge and action buttons when isAdmin is true', () => {
    const handleApprove = vi.fn();
    const handleReject = vi.fn();

    render(
      <MemoryRouter>
        <ProjectProposalCard
          proposal={baseProposal}
          isAdmin={true}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      </MemoryRouter>,
    );

    expect(screen.getByText('Menunggu Approval')).toBeTruthy();

    const approveBtn = screen.getByRole('button', { name: /setujui/i });
    const rejectBtn = screen.getByRole('button', { name: /tolak/i });

    expect(approveBtn).toBeTruthy();
    expect(rejectBtn).toBeTruthy();

    fireEvent.click(approveBtn);
    expect(handleApprove).toHaveBeenCalledWith(baseProposal);

    fireEvent.click(rejectBtn);
    expect(handleReject).toHaveBeenCalledWith(baseProposal);
  });

  it('disables buttons when isProcessing is true', () => {
    render(
      <MemoryRouter>
        <ProjectProposalCard
          proposal={baseProposal}
          isAdmin={true}
          isProcessing={true}
        />
      </MemoryRouter>,
    );

    const approveBtn = screen.getByRole('button', { name: /memproses\.\.\./i });
    const rejectBtn = screen.getByRole('button', { name: /tolak/i });

    expect(approveBtn.hasAttribute('disabled')).toBe(true);
    expect(rejectBtn.hasAttribute('disabled')).toBe(true);
  });

  it('renders REJECTED status with rejection reason and decidedBy info', () => {
    const rejectedProposal: ProjectProposal = {
      ...baseProposal,
      status: 'REJECTED',
      rejectionReason: 'Scope project tidak sesuai dengan kapasitas tim saat ini',
      decidedBy: {
        id: 'admin-1',
        name: 'Pak Mandor',
      },
      decidedAt: '2026-03-16T10:00:00.000Z',
    };

    render(
      <MemoryRouter>
        <ProjectProposalCard proposal={rejectedProposal} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Ditolak')).toBeTruthy();
    expect(screen.getByText(/Scope project tidak sesuai dengan kapasitas tim saat ini/)).toBeTruthy();
    expect(screen.getByText(/Pak Mandor/)).toBeTruthy();
  });

  it('renders APPROVED status with approval info and project link', () => {
    const approvedProposal: ProjectProposal = {
      ...baseProposal,
      status: 'APPROVED',
      approvedProjectId: 'proj-123',
      approvedProject: {
        id: 'proj-123',
        name: 'Monitoring Inventaris Live',
      },
      decidedBy: {
        id: 'admin-1',
        name: 'Pak Mandor',
      },
      decidedAt: '2026-03-16T10:00:00.000Z',
    };

    render(
      <MemoryRouter>
        <ProjectProposalCard proposal={approvedProposal} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Disetujui')).toBeTruthy();
    expect(screen.getByText(/Buka Project/i)).toBeTruthy();
  });
});
