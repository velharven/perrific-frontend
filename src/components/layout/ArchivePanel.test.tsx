import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { BrowserRouter } from 'react-router-dom';
import ArchivePanel from './ArchivePanel';
import type { Team, Note } from '@/types';

describe('ArchivePanel Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const mockNotes: Note[] = [
    {
      id: 'note-1',
      title: 'Catatan Rahasia',
      kind: 'NOTE',
      content: '',
      userId: 'u1',
      order: 0,
      createdAt: '',
      updatedAt: '',
    },
  ];

  const mockTeams: Team[] = [
    {
      id: 'team-1',
      name: 'Tim Alpha',
      createdAt: '',
      updatedAt: '',
      ownerId: 'u1',
    },
  ];

  it('renders empty state when there are no archived items', () => {
    render(
      <BrowserRouter>
        <ArchivePanel
          open={true}
          onClose={vi.fn()}
          archivedNav={[]}
          archivedTeams={[]}
          notes={[]}
          navIcons={{}}
          starred={[]}
          onUnarchiveAll={vi.fn()}
          renderTeamBadge={(team) => <span>{team.name[0]}</span>}
        />
      </BrowserRouter>
    );

    expect(screen.getByText('Tidak ada arsip')).toBeTruthy();
    expect(
      screen.getByText('Arsipkan tab privat atau tim melalui menu ⋮ atau klik kanan pada sidebar.')
    ).toBeTruthy();
  });

  it('renders archived notes and teams and handles unarchive actions', () => {
    const onUnarchiveAll = vi.fn();
    const onUnarchiveNav = vi.fn();
    const onUnarchiveTeam = vi.fn();
    const onClose = vi.fn();

    render(
      <BrowserRouter>
        <ArchivePanel
          open={true}
          onClose={onClose}
          archivedNav={['/notes/note-1']}
          archivedTeams={mockTeams}
          notes={mockNotes}
          navIcons={{}}
          starred={[]}
          onUnarchiveAll={onUnarchiveAll}
          onUnarchiveNav={onUnarchiveNav}
          onUnarchiveTeam={onUnarchiveTeam}
          renderTeamBadge={(team) => <span>{team.name[0]}</span>}
        />
      </BrowserRouter>
    );

    // Judul & Counter badge
    expect(screen.getByText('Arsip')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy(); // 1 note + 1 team

    // Note & Team items
    expect(screen.getByText('Catatan Rahasia')).toBeTruthy();
    expect(screen.getByText('Tim Alpha')).toBeTruthy();

    // Tombol X di pojok kiri atas
    const closeBtn = screen.getByLabelText('Tutup arsip');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();

    // Tombol Keluarkan semua
    const unarchiveAllBtn = screen.getByLabelText('Keluarkan semua dari arsip');
    fireEvent.click(unarchiveAllBtn);
    expect(onUnarchiveAll).toHaveBeenCalled();

    // Quick unarchive note
    const unarchiveNoteBtn = screen.getByLabelText('Keluarkan Catatan Rahasia dari arsip');
    fireEvent.click(unarchiveNoteBtn);
    expect(onUnarchiveNav).toHaveBeenCalledWith('/notes/note-1');

    // Quick unarchive team
    const unarchiveTeamBtn = screen.getByLabelText('Keluarkan tim Tim Alpha dari arsip');
    fireEvent.click(unarchiveTeamBtn);
    expect(onUnarchiveTeam).toHaveBeenCalledWith('team-1');
  });

  it('handles Escape key to close the drawer', () => {
    const onClose = vi.fn();
    render(
      <BrowserRouter>
        <ArchivePanel
          open={true}
          onClose={onClose}
          archivedNav={[]}
          archivedTeams={[]}
          notes={[]}
          navIcons={{}}
          starred={[]}
          onUnarchiveAll={vi.fn()}
          renderTeamBadge={() => null}
        />
      </BrowserRouter>
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
