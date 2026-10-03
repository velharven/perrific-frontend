import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import RejectProposalModal from './RejectProposalModal';
import type { ProjectProposal } from '@/types';

describe('RejectProposalModal Component', () => {
  const mockProposal: ProjectProposal = {
    id: 'prop-1',
    teamId: 'team-1',
    organizationId: 'org-1',
    createdById: 'user-1',
    name: 'Redesign UI Portal',
    description: 'Deskripsi proyek',
    status: 'PENDING',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    organization: { id: 'org-1', name: 'Acme Corp' },
    createdBy: { id: 'user-1', name: 'John Doe', email: 'john@example.com' },
  };

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when proposal is null', () => {
    const { container } = render(
      <RejectProposalModal proposal={null} onClose={vi.fn()} onConfirm={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders proposal details and textarea for rejection reason', () => {
    render(
      <RejectProposalModal
        proposal={mockProposal}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText('Tolak Usulan Project')).toBeTruthy();
    expect(screen.getByText(/Redesign UI Portal/i)).toBeTruthy();
    expect(screen.getByText(/Acme Corp/i)).toBeTruthy();

    const textarea = screen.getByPlaceholderText(/Tuliskan alasan penolakan usulan/i);
    expect(textarea).toBeTruthy();
  });

  it('calls onClose when clicking Batal button', () => {
    const onClose = vi.fn();
    render(
      <RejectProposalModal
        proposal={mockProposal}
        onClose={onClose}
        onConfirm={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /^Batal$/i });
    fireEvent.click(cancelBtn);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm with entered reason when submitting', () => {
    const onConfirm = vi.fn();
    render(
      <RejectProposalModal
        proposal={mockProposal}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const textarea = screen.getByPlaceholderText(/Tuliskan alasan penolakan usulan/i);
    fireEvent.change(textarea, { target: { value: 'Scope terlalu besar untuk sprint ini' } });

    const submitBtn = screen.getByRole('button', { name: /Tolak Usulan/i });
    fireEvent.click(submitBtn);

    expect(onConfirm).toHaveBeenCalledWith('Scope terlalu besar untuk sprint ini');
  });

  it('calls onConfirm with undefined when reason is left blank', () => {
    const onConfirm = vi.fn();
    render(
      <RejectProposalModal
        proposal={mockProposal}
        onClose={vi.fn()}
        onConfirm={onConfirm}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Tolak Usulan/i });
    fireEvent.click(submitBtn);

    expect(onConfirm).toHaveBeenCalledWith(undefined);
  });

  it('disables submit button and shows loading text when submitting is true', () => {
    render(
      <RejectProposalModal
        proposal={mockProposal}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        submitting={true}
      />
    );

    const submitBtn = screen.getByRole('button', { name: /Menolak\.\.\./i });
    expect(submitBtn).toBeTruthy();
    expect((submitBtn as HTMLButtonElement).disabled).toBe(true);
  });
});
