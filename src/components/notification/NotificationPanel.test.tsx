import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import NotificationPanel from './NotificationPanel';
import { notificationApi } from '@/api/notifications';
import { BrowserRouter } from 'react-router-dom';

vi.mock('@/api/notifications', () => ({
  notificationApi: {
    list: vi.fn(),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
  },
}));

describe('NotificationPanel Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    vi.mocked(notificationApi.list).mockResolvedValue([]);
    vi.mocked(notificationApi.markAllRead).mockResolvedValue({ message: 'Success' });
    vi.mocked(notificationApi.markRead).mockResolvedValue({
      id: 'n1',
      type: 'TASK_ASSIGNED',
      title: 'Tugas Baru',
      message: 'Kamu ditugaskan tugas baru',
      read: true,
      createdAt: new Date().toISOString(),
    });
  });

  it('renders empty state when no notifications exist', async () => {
    render(
      <BrowserRouter>
        <NotificationPanel open={true} onClose={vi.fn()} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Belum ada notifikasi')).toBeTruthy();
    });
  });

  it('renders notification items and calls markAllRead when clicked', async () => {
    const mockNotifications = [
      {
        id: 'n1',
        type: 'TASK_ASSIGNED' as const,
        title: 'Review Pull Request',
        message: 'Mohon review PR #42',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ];
    vi.mocked(notificationApi.list).mockResolvedValue(mockNotifications);

    render(
      <BrowserRouter>
        <NotificationPanel open={true} onClose={vi.fn()} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Review Pull Request')).toBeTruthy();
      expect(screen.getByText('Mohon review PR #42')).toBeTruthy();
    });

    const markAllBtn = screen.getByTitle('Baca semua notifikasi');
    fireEvent.click(markAllBtn);

    await waitFor(() => {
      expect(notificationApi.markAllRead).toHaveBeenCalled();
    });
  });

  it('triggers onClose when X button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <NotificationPanel open={true} onClose={onClose} />
      </BrowserRouter>
    );

    const closeBtn = screen.getByLabelText('Tutup notifikasi');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('receives purrific:notification-new and displays new notification real-time', async () => {
    vi.mocked(notificationApi.list).mockResolvedValue([]);

    render(
      <BrowserRouter>
        <NotificationPanel open={true} onClose={vi.fn()} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Belum ada notifikasi')).toBeTruthy();
    });

    const newNotif = {
      id: 'rt-1',
      type: 'TASK_ASSIGNED' as const,
      title: 'Tugas Realtime Baru',
      message: 'Kamu mendapat tugas baru via socket',
      read: false,
      createdAt: new Date().toISOString(),
    };

    window.dispatchEvent(
      new CustomEvent('purrific:notification-new', { detail: newNotif })
    );

    await waitFor(() => {
      expect(screen.getByText('Tugas Realtime Baru')).toBeTruthy();
      expect(screen.getByText('Kamu mendapat tugas baru via socket')).toBeTruthy();
    });
  });

  it('handles purrific:notification-read-all event in real-time', async () => {
    const mockNotifications = [
      {
        id: 'n1',
        type: 'TASK_ASSIGNED' as const,
        title: 'Task Unread',
        message: 'Unread description',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ];
    vi.mocked(notificationApi.list).mockResolvedValue(mockNotifications);

    render(
      <BrowserRouter>
        <NotificationPanel open={true} onClose={vi.fn()} />
      </BrowserRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Task Unread')).toBeTruthy();
    });

    window.dispatchEvent(new CustomEvent('purrific:notification-read-all'));

    await waitFor(() => {
      // Tombol 'Baca semua' akan disabled karena unreadCount = 0
      const markAllBtn = screen.getByTitle('Baca semua notifikasi') as HTMLButtonElement;
      expect(markAllBtn.disabled).toBe(true);
    });
  });
});

