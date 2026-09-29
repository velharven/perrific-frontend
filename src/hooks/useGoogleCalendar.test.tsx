import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { CalendarSyncProvider, useCalendarSync } from '@/store/calendarSync';
import { useGoogleCalendar } from './useGoogleCalendar';

const mocks = vi.hoisted(() => ({ getStatus: vi.fn(), autoSync: vi.fn(), disconnect: vi.fn(), toast: vi.fn() }));
vi.mock('@/store/auth', () => ({ useAuth: () => ({ user: { id: 'user-1' } }) }));
vi.mock('@/store/socket', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('@react-oauth/google', () => ({ useGoogleLogin: () => vi.fn() }));
vi.mock('@/components/ui/Toast', () => ({ showToast: mocks.toast }));
vi.mock('@/api/calendar', () => ({ calendarApi: {
  getStatus: mocks.getStatus, autoSync: mocks.autoSync, disconnect: mocks.disconnect,
} }));

const result = { pushedCount: 0, importedCount: 0, updatedCount: 0, deletedCount: 0,
  pendingCount: 0, syncedAt: '2026-09-29T03:00:00Z' };
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
function Probe() {
  const google = useGoogleCalendar();
  const sync = useCalendarSync();
  return <>
    <span data-testid="status">{google.status.connected ? 'connected' : 'disconnected'}</span>
    <span data-testid="error">{google.error}</span>
    <span data-testid="pending">{sync.pendingCount}</span>
    <span data-testid="synced">{google.status.syncedAt}</span>
    <button disabled={google.disconnecting} onClick={() => void google.disconnect()}>
      {google.disconnecting ? 'Memutuskan…' : 'Putuskan'}
    </button>
    <button onClick={() => sync.setStatus({ connected: true })}>reconnect</button>
    <button onClick={() => void google.refreshStatus()}>refresh</button>
  </>;
}
beforeEach(() => {
  mocks.getStatus.mockReset().mockResolvedValue({ connected: true });
  mocks.autoSync.mockReset().mockResolvedValue(result);
  mocks.disconnect.mockReset().mockResolvedValue({ connected: false });
  mocks.toast.mockReset();
});
afterEach(cleanup);

it('disconnects while sync is pending and ignores its old response after reconnecting', async () => {
  const oldSync = deferred<typeof result>();
  const disconnect = deferred<{ connected: boolean }>();
  mocks.autoSync.mockImplementationOnce(() => oldSync.promise);
  mocks.disconnect.mockImplementationOnce(() => disconnect.promise);
  render(<CalendarSyncProvider><Probe /></CalendarSyncProvider>);
  await waitFor(() => expect(mocks.autoSync).toHaveBeenCalledTimes(1));
  fireEvent.click(screen.getByRole('button', { name: 'Putuskan' }));
  expect((screen.getByRole('button', { name: 'Memutuskan…' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Memutuskan…' }));
  expect(mocks.disconnect).toHaveBeenCalledTimes(1);
  await act(async () => { disconnect.resolve({ connected: false }); });
  expect(screen.getByTestId('status').textContent).toBe('disconnected');
  expect(mocks.toast).toHaveBeenCalledWith('Koneksi Google Calendar berhasil diputus.');
  fireEvent.click(screen.getByRole('button', { name: 'reconnect' }));
  await waitFor(() => expect(mocks.autoSync).toHaveBeenCalledTimes(2));
  await act(async () => { oldSync.resolve({ ...result, pendingCount: 99, syncedAt: 'old response' }); });
  expect(screen.getByTestId('status').textContent).toBe('connected');
  expect(screen.getByTestId('pending').textContent).toBe('0');
  expect(screen.getByTestId('synced').textContent).toBe(result.syncedAt);
});

it('ignores a status request started before disconnecting', async () => {
  render(<CalendarSyncProvider><Probe /></CalendarSyncProvider>);
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('connected'));
  const oldStatus = deferred<{ connected: boolean }>();
  mocks.getStatus.mockImplementationOnce(() => oldStatus.promise);
  fireEvent.click(screen.getByRole('button', { name: 'refresh' }));
  fireEvent.click(screen.getByRole('button', { name: 'Putuskan' }));
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('disconnected'));
  await act(async () => { oldStatus.resolve({ connected: true }); });
  expect(screen.getByTestId('status').textContent).toBe('disconnected');
});

it('shows a failed disconnect and allows retrying without hiding the connected profile', async () => {
  mocks.disconnect.mockRejectedValueOnce(new Error('offline'));
  render(<CalendarSyncProvider><Probe /></CalendarSyncProvider>);
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('connected'));
  fireEvent.click(screen.getByRole('button', { name: 'Putuskan' }));
  await waitFor(() => expect(screen.getByTestId('error').textContent).toBe('Gagal memutuskan koneksi Google Calendar.'));
  expect(screen.getByTestId('status').textContent).toBe('connected');
  expect(mocks.toast).toHaveBeenCalledWith('Gagal memutuskan koneksi Google Calendar.');
  fireEvent.click(screen.getByRole('button', { name: 'Putuskan' }));
  await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('disconnected'));
  expect(mocks.disconnect).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('error').textContent).toBe('');
});
