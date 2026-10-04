import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ApproveTaskModal from './ApproveTaskModal';
import type { PendingTask, TeamMember } from '@/types';

describe('ApproveTaskModal Component', () => {
  afterEach(() => {
    cleanup();
  });
  const mockTask: PendingTask = {
    id: 'task-1',
    projectId: 'p-1',
    columnId: 'col-1',
    number: 1,
    title: 'Desain Sistem Baru',
    priority: 'HIGH',
    approval: 'PENDING',
    order: 1,
    createdAt: '2026-10-04T00:00:00Z',
    updatedAt: '2026-10-04T00:00:00Z',
    assignees: [],
    column: { id: 'col-1', name: 'To Do', order: 1 },
    project: { id: 'p-1', name: 'Project Beta' },
    createdBy: { id: 'u-1', name: 'Doni Saputra', avatarUrl: null },
  };

  const mockMembers: TeamMember[] = [
    {
      id: 'm-1',
      teamId: 't-1',
      userId: 'u-1',
      role: 'ADMIN',
      user: { id: 'u-1', email: 'doni@example.com', name: 'Doni Saputra' },
    },
    {
      id: 'm-2',
      teamId: 't-1',
      userId: 'u-2',
      role: 'MEMBER',
      user: { id: 'u-2', email: 'maya@example.com', name: 'Maya Anggraini' },
    },
  ];

  it('renders modal with task details and team members', () => {
    render(
      <ApproveTaskModal
        task={mockTask}
        teamMembers={mockMembers}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    expect(screen.getByText('Setujui Usulan Task')).toBeTruthy();
    expect(screen.getByText('Desain Sistem Baru')).toBeTruthy();
    expect(screen.getByText(/Project Beta/i)).toBeTruthy();
    expect(screen.getAllByText(/Doni Saputra/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Maya Anggraini/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Atur nanti' })).toBeTruthy();
  });

  it('filters member list based on search query', () => {
    render(
      <ApproveTaskModal
        task={mockTask}
        teamMembers={mockMembers}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
      />,
    );

    const searchInput = screen.getByPlaceholderText('Cari anggota tim…');
    fireEvent.change(searchInput, { target: { value: 'Maya' } });

    expect(screen.getByText('Maya Anggraini')).toBeTruthy();
    expect(screen.queryByText('Doni Saputra (Anggota)')).toBeNull();
  });

  it('calls onConfirm with empty array when "Atur nanti" is clicked', () => {
    const handleConfirm = vi.fn();
    render(
      <ApproveTaskModal
        task={mockTask}
        teamMembers={mockMembers}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Atur nanti' }));
    expect(handleConfirm).toHaveBeenCalledWith([]);
  });

  it('calls onConfirm with selected user IDs when assigning members', () => {
    const handleConfirm = vi.fn();
    render(
      <ApproveTaskModal
        task={mockTask}
        teamMembers={mockMembers}
        onClose={vi.fn()}
        onConfirm={handleConfirm}
      />,
    );

    fireEvent.click(screen.getByText('Maya Anggraini'));
    fireEvent.click(screen.getByRole('button', { name: /Tugaskan \(1\) & Setujui/i }));

    expect(handleConfirm).toHaveBeenCalledWith(['u-2']);
  });

  it('calls onClose when clicking Batal', () => {
    const handleClose = vi.fn();
    render(
      <ApproveTaskModal
        task={mockTask}
        teamMembers={mockMembers}
        onClose={handleClose}
        onConfirm={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(handleClose).toHaveBeenCalled();
  });
});
