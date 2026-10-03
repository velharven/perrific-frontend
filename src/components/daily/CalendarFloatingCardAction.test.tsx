import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import CalendarFloatingCardAction from './CalendarFloatingCardAction';
import type { CombinedItem } from './CalendarCardSettings';

const mockItem: CombinedItem = {
  id: 'activity-1',
  type: 'activity',
  act: {
    id: 'activity-1',
    userId: 'user-1',
    title: 'Meeting Proyek Purrific',
    startTime: '09:00',
    endTime: '10:30',
    description: 'Membahas responsivitas mobile',
    createdAt: '2026-10-03T00:00:00Z',
    updatedAt: '2026-10-03T00:00:00Z',
  } as any,
  time: '09:00',
  instanceDate: '2026-10-03',
};

describe('CalendarFloatingCardAction Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders calendar item info and button "Buka Pengaturan Card" without blocking backdrop', () => {
    const handleOpen = vi.fn();
    const handleClose = vi.fn();

    render(
      <CalendarFloatingCardAction
        item={mockItem}
        onOpenSettings={handleOpen}
        onClose={handleClose}
      />,
    );

    // Pastikan judul dan jam tampil
    expect(screen.getByText('Meeting Proyek Purrific')).toBeTruthy();
    expect(screen.getByText(/09:00/)).toBeTruthy();

    // Pastikan tombol "Buka Pengaturan Card" tampil
    const btnOpen = screen.getByRole('button', { name: /Buka Pengaturan Card/i });
    expect(btnOpen).toBeTruthy();

    // Pastikan tidak ada backdrop hitam pemblokir
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
