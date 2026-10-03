import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import KanbanFloatingCardAction from './KanbanFloatingCardAction';
import type { Task } from '@/types';

const mockTask: Task = {
  id: 'task-1',
  number: 1,
  title: 'Implementasi Fitur Responsif',
  description: 'Membuat tampilan responsif mobile',
  priority: 'HIGH',
  approval: 'APPROVED',
  columnId: 'col-2',
  column: { id: 'col-2', name: 'In Progress', order: 2 },
  projectId: 'proj-1',
  order: 1,
  assignees: [],
  attachments: [],
  createdAt: '2026-10-03T10:00:00Z',
  updatedAt: '2026-10-03T10:00:00Z',
};

describe('KanbanFloatingCardAction Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders task info and button "Buka Pengaturan Card" without blocking backdrop', () => {
    const handleOpen = vi.fn();
    const handleClose = vi.fn();

    render(
      <KanbanFloatingCardAction
        task={mockTask}
        columnName="In Progress"
        onOpenSettings={handleOpen}
        onClose={handleClose}
      />,
    );

    // Pastikan judul dan nama kolom tampil
    expect(screen.getByText('Implementasi Fitur Responsif')).toBeTruthy();
    expect(screen.getByText(/In Progress/i)).toBeTruthy();

    // Pastikan tombol "Buka Pengaturan Card" tampil
    const btnOpen = screen.getByRole('button', { name: /Buka Pengaturan Card/i });
    expect(btnOpen).toBeTruthy();

    // Pastikan tidak ada backdrop hitam pemblokir (tidak ada fixed inset-0 bg-black)
    const backdrop = document.querySelector('.bg-black\\/40, .bg-black\\/50, .backdrop-blur-sm');
    expect(backdrop).toBeNull();

    // Pastikan klik tombol memanggil handleOpen
    fireEvent.click(btnOpen);
    expect(handleOpen).toHaveBeenCalledTimes(1);

    // Pastikan tombol tutup berfungsi
    const btnClose = screen.getByRole('button', { name: /Tutup aksi kartu/i });
    fireEvent.click(btnClose);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
