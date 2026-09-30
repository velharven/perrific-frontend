import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within, cleanup, act } from '@testing-library/react';
import PersonalProjectKanbanView from './PersonalProjectKanbanView';
import { projectApi } from '@/api/projects';
import { teamApi } from '@/api/teams';
import type { BoardColumn, Project, Task } from '@/types';

const socketHandlers: Record<string, ((payload?: unknown) => void)[]> = {};
const mockSocket = {
  on: vi.fn((event: string, cb: (payload?: unknown) => void) => {
    socketHandlers[event] = socketHandlers[event] ?? [];
    socketHandlers[event].push(cb);
  }),
  off: vi.fn((event: string, cb: (payload?: unknown) => void) => {
    socketHandlers[event] = (socketHandlers[event] ?? []).filter((h) => h !== cb);
  }),
};

vi.mock('@/store/auth', () => ({
  useAuth: () => ({
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
  }),
}));

vi.mock('@/store/socket', () => ({
  useSocket: () => ({ socket: mockSocket }),
}));

vi.mock('@/hooks/useUndoStack', () => ({
  useUndo: () => ({ push: vi.fn() }),
}));

vi.mock('@/components/ui/Toast', () => ({
  showToast: vi.fn(),
}));

vi.mock('@/api/projects', () => ({
  projectApi: {
    getMyPersonalProject: vi.fn(),
    listTasks: vi.fn(),
    listColumns: vi.fn(),
    createTask: vi.fn(),
    updateProject: vi.fn(),
    reorderTasks: vi.fn(),
    createColumn: vi.fn(),
    updateColumn: vi.fn(),
    reorderColumns: vi.fn(),
    deleteColumn: vi.fn(),
    setActivePersonalProject: vi.fn().mockResolvedValue({ projectId: 'proj-1' }),
  },
}));

vi.mock('@/api/teams', () => ({
  teamApi: {
    listProjects: vi.fn(),
    createProject: vi.fn(),
  },
}));

const mockColumns: BoardColumn[] = [
  { id: 'col-1', projectId: 'proj-1', name: 'To Do', color: '#E5E7EB', order: 0, createdAt: '2026-09-30T00:00:00.000Z' },
  { id: 'col-2', projectId: 'proj-1', name: 'In Progress', color: '#DBEAFE', order: 1, createdAt: '2026-09-30T00:00:00.000Z' },
  { id: 'col-3', projectId: 'proj-1', name: 'Done', color: '#DCFCE7', order: 2, createdAt: '2026-09-30T00:00:00.000Z' },
];

const mockProjects: Project[] = [
  {
    id: 'proj-1',
    teamId: 'personal-user-1',
    name: 'Project Pribadi',
    description: 'Default personal project',
    status: 'ACTIVE',
  },
  {
    id: 'proj-2',
    teamId: 'personal-user-1',
    name: 'Belajar Rust',
    description: 'Rust study',
    status: 'ACTIVE',
  },
  {
    id: 'proj-3',
    teamId: 'personal-user-1',
    name: 'Side Hustle App',
    description: 'Mobile app',
    status: 'ACTIVE',
  },
  {
    id: 'proj-4',
    teamId: 'personal-user-1',
    name: 'Renovasi Kamar',
    description: 'Home decor',
    status: 'ACTIVE',
  },
];

const mockTasksProj1: Task[] = [
  {
    id: 'task-1',
    number: 1,
    projectId: 'proj-1',
    columnId: 'col-1',
    column: { id: 'col-1', name: 'To Do', order: 0 },
    title: 'Task di Project Pribadi',
    priority: 'MEDIUM',
    approval: 'APPROVED',
    order: 0,
    createdById: 'user-1',
    assignees: [],
    createdAt: '2026-09-30T00:00:00.000Z',
    updatedAt: '2026-09-30T00:00:00.000Z',
  },
];

const mockTasksProj2: Task[] = [
  {
    id: 'task-2',
    number: 1,
    projectId: 'proj-2',
    columnId: 'col-1',
    column: { id: 'col-1', name: 'To Do', order: 0 },
    title: 'Baca The Rust Book',
    priority: 'HIGH',
    approval: 'APPROVED',
    order: 0,
    createdById: 'user-1',
    assignees: [],
    createdAt: '2026-09-30T01:00:00.000Z',
    updatedAt: '2026-09-30T01:00:00.000Z',
  },
];

describe('PersonalProjectKanbanView — Project Switcher Dropup & Real-Time Board', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    for (const k of Object.keys(socketHandlers)) delete socketHandlers[k];
    vi.mocked(projectApi.getMyPersonalProject).mockResolvedValue({
      ...mockProjects[0],
      columns: mockColumns,
    });
    vi.mocked(teamApi.listProjects).mockResolvedValue(mockProjects);
    vi.mocked(projectApi.listColumns).mockResolvedValue(mockColumns);
    vi.mocked(projectApi.listTasks).mockImplementation(async (projId: string) => {
      if (projId === 'proj-2') return mockTasksProj2;
      return mockTasksProj1;
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('menampilkan tombol dropup dengan nama project aktif di floating pill dan membuka menu dropup dengan tombol tambah, searchbar, serta scrollbar (max 3 item)', async () => {
    render(<PersonalProjectKanbanView />);

    // Tunggu board selesai dimuat
    const dropupBtn = await screen.findByRole('button', { name: /pilih project pribadi/i });
    expect(dropupBtn.textContent).toContain('Project Pribadi');

    // Klik tombol dropup untuk membuka menu dari atas
    fireEvent.click(dropupBtn);

    const menu = await screen.findByRole('menu', { name: /daftar project pribadi/i });
    expect(menu).toBeTruthy();

    // Pastikan ada button "+ Tambah Project Baru"
    expect(within(menu).getByRole('button', { name: /tambah project baru/i })).toBeTruthy();

    // Pastikan ada searchbar project
    const searchInput = within(menu).getByPlaceholderText(/cari project/i);
    expect(searchInput).toBeTruthy();

    // Pastikan container daftar project memiliki max-h-[112px] (maksimal 3 nama project terlihat) dan overflow-y-auto (scrollbar)
    const listContainer = within(menu).getByTestId('personal-project-list');
    expect(listContainer.className).toContain('max-h-[112px]');
    expect(listContainer.className).toContain('overflow-y-auto');

    // Ke-4 project ada di dalam list yang bisa di-scroll
    const items = within(listContainer).getAllByRole('menuitemradio');
    expect(items).toHaveLength(4);

    // Uji searchbar untuk memfilter nama project
    fireEvent.change(searchInput, { target: { value: 'Rust' } });
    const filteredItems = within(listContainer).getAllByRole('menuitemradio');
    expect(filteredItems).toHaveLength(1);
    expect(filteredItems[0].textContent).toContain('Belajar Rust');
  });

  it('mengganti project aktif saat salah satu project di dropup diklik', async () => {
    render(<PersonalProjectKanbanView />);

    const dropupBtn = await screen.findByRole('button', { name: /pilih project pribadi/i });
    expect(await screen.findByText('Task di Project Pribadi')).toBeTruthy();

    fireEvent.click(dropupBtn);
    const menu = await screen.findByRole('menu', { name: /daftar project pribadi/i });
    const rustOption = within(menu).getByRole('menuitemradio', { name: /belajar rust/i });
    fireEvent.click(rustOption);

    await waitFor(() => {
      expect(dropupBtn.textContent).toContain('Belajar Rust');
    });
    expect(await screen.findByText('Baca The Rust Book')).toBeTruthy();
  });

  it('dapat membuat project pribadi baru dari tombol di dalam dropup', async () => {
    const newProj: Project = {
      id: 'proj-5',
      teamId: 'personal-user-1',
      name: 'Project Skripsi',
      description: 'Catatan skripsi',
      status: 'ACTIVE',
    };
    vi.mocked(teamApi.createProject).mockResolvedValue(newProj);

    render(<PersonalProjectKanbanView />);

    const dropupBtn = await screen.findByRole('button', { name: /pilih project pribadi/i });
    fireEvent.click(dropupBtn);

    const menu = await screen.findByRole('menu', { name: /daftar project pribadi/i });
    fireEvent.click(within(menu).getByRole('button', { name: /tambah project baru/i }));

    // Modal tambah project baru terbuka
    const modal = await screen.findByRole('dialog', { name: /tambah project pribadi baru/i });
    const nameInput = within(modal).getByLabelText(/nama project/i);
    fireEvent.change(nameInput, { target: { value: 'Project Skripsi' } });

    const submitBtn = within(modal).getByRole('button', { name: /buat project/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(teamApi.createProject).toHaveBeenCalledWith('personal-user-1', {
        name: 'Project Skripsi',
        description: undefined,
      });
      expect(dropupBtn.textContent).toContain('Project Skripsi');
    });
  });

  it('memperbarui kolom board secara real-time saat kolom baru ditambahkan di Pengaturan Project maupun lewat event socket project:updated', async () => {
    const newCol: BoardColumn = {
      id: 'col-4',
      projectId: 'proj-1',
      name: 'Review QA',
      color: '#FDE68A',
      order: 3,
      createdAt: '2026-09-30T05:00:00.000Z',
    };
    vi.mocked(projectApi.createColumn).mockResolvedValue(newCol);

    render(<PersonalProjectKanbanView />);
    await screen.findByRole('button', { name: /pilih project pribadi/i });

    // Buka modal Pengaturan Project
    const settingsBtn = screen.getByRole('button', { name: /pengaturan project/i });
    fireEvent.click(settingsBtn);

    const modal = await screen.findByRole('dialog', { name: /pengaturan project pribadi/i });
    const colInput = await within(modal).findByPlaceholderText(/nama kolom baru/i);
    fireEvent.change(colInput, { target: { value: 'Review QA' } });
    fireEvent.click(within(modal).getByRole('button', { name: /^tambah$/i }));

    // Pastikan kolom baru langsung muncul di KanbanBoard secara real-time tanpa reload halaman
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tambah task di review qa/i })).toBeTruthy();
    });

    // Simulasikan juga event socket project:updated dari server
    const socketCol: BoardColumn = {
      id: 'col-5',
      projectId: 'proj-1',
      name: 'Staging',
      color: '#C7D2FE',
      order: 4,
      createdAt: '2026-09-30T06:00:00.000Z',
    };
    vi.mocked(projectApi.listColumns).mockResolvedValue([...mockColumns, newCol, socketCol]);

    await act(async () => {
      for (const cb of socketHandlers['project:updated'] ?? []) {
        cb({ teamId: 'personal-user-1', projectId: 'proj-1', action: 'COLUMN_UPDATED' });
      }
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /tambah task di staging/i })).toBeTruthy();
    });
  });

  it('menyinkronkan pemilihan project ke server dan beralih otomatis saat menerima event socket personal-project:switched dari perangkat lain', async () => {
    render(<PersonalProjectKanbanView />);
    await screen.findByRole('button', { name: /pilih project pribadi/i });

    // Buka dropup dan pilih Belajar Rust (proj-2)
    const toggleBtn = screen.getByRole('button', { name: /pilih project pribadi/i });
    fireEvent.click(toggleBtn);
    const menu = await screen.findByRole('menu', { name: /daftar project pribadi/i });
    const itemProj2 = within(menu).getByRole('menuitemradio', { name: /belajar rust/i });
    fireEvent.click(itemProj2);

    // Pastikan setActivePersonalProject dipanggil untuk sinkronisasi antar-device
    expect(projectApi.setActivePersonalProject).toHaveBeenCalledWith('proj-2');

    // Simulasikan perangkat lain beralih ke Side Hustle App (proj-3) lewat event socket
    vi.mocked(projectApi.listTasks).mockResolvedValue([]);
    vi.mocked(projectApi.listColumns).mockResolvedValue(mockColumns);

    await act(async () => {
      for (const cb of socketHandlers['personal-project:switched'] ?? []) {
        cb({ projectId: 'proj-3' });
      }
    });

    // Pastikan KanbanView otomatis berpindah ke proj-3 tanpa reload
    await waitFor(() => {
      expect(toggleBtn.textContent).toContain('Side Hustle App');
    });
  });

  it('melakukan auto-resume memuat ulang data saat pengguna kembali ke tab (visibilitychange / focus)', async () => {
    render(<PersonalProjectKanbanView />);
    await screen.findByRole('button', { name: /pilih project pribadi/i });

    const initialCalls = vi.mocked(projectApi.getMyPersonalProject).mock.calls.length;

    // Simulasikan tab kembali aktif (visibilitychange)
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => {
      expect(vi.mocked(projectApi.getMyPersonalProject).mock.calls.length).toBeGreaterThan(initialCalls);
    });
  });

  it('otomatis beralih ke project default jika project yang sedang dilihat dihapus di perangkat lain', async () => {
    // Awalnya buka proj-2
    localStorage.setItem('purrific:active-personal-project:user-1', 'proj-2');
    render(<PersonalProjectKanbanView />);
    const dropupBtn = await screen.findByRole('button', { name: /pilih project pribadi/i });
    expect(dropupBtn.textContent).toContain('Belajar Rust');

    // Simulasikan perangkat lain menghapus proj-2
    const remainingProjects = mockProjects.filter((p) => p.id !== 'proj-2');
    vi.mocked(teamApi.listProjects).mockResolvedValue(remainingProjects);
    vi.mocked(projectApi.listTasks).mockResolvedValue(mockTasksProj1);
    vi.mocked(projectApi.listColumns).mockResolvedValue(mockColumns);

    await act(async () => {
      for (const cb of socketHandlers['project:updated'] ?? []) {
        cb({ teamId: 'personal-user-1', projectId: 'proj-2', action: 'DELETED' });
      }
    });

    // Pastikan otomatis dialihkan ke project default (Project Pribadi / proj-1)
    await waitFor(() => {
      expect(dropupBtn.textContent).toContain('Project Pribadi');
    });
  });
});
