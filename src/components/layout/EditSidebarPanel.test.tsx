import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import EditSidebarPanel from './EditSidebarPanel';
import type { SidebarSection, PresetSection } from '@/hooks/useNavLabels';

describe('EditSidebarPanel Component', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  const sectionLabel = (s: string) => {
    if (s === 'privat') return 'PRIVAT';
    if (s === 'teams') return 'TIM SAYA';
    if (s === 'organisasi') return 'ORGANISASI';
    if (s === 'favorit') return 'FAVORIT';
    if (s === 'shortcut') return 'SHORTCUT';
    return s.toUpperCase();
  };

  const initialSections: SidebarSection[] = ['privat', 'teams'];
  const initialPresets: PresetSection[] = ['privat', 'teams'];

  it('renders main view with active sections, X button, and Selesai button', () => {
    const onClose = vi.fn();
    render(
      <EditSidebarPanel
        open={true}
        onClose={onClose}
        sectionOrder={initialSections}
        presetSections={initialPresets}
        onReorderSections={vi.fn()}
        onAddPreset={vi.fn()}
        onRemovePreset={vi.fn()}
        sectionLabel={sectionLabel}
      />
    );

    expect(screen.getByText('Edit Sidebar')).toBeTruthy();
    expect(screen.getByText('Selesai')).toBeTruthy();
    expect(screen.getByText('PRIVAT')).toBeTruthy();
    expect(screen.getByText('TIM SAYA')).toBeTruthy();

    // Klik tombol Selesai
    fireEvent.click(screen.getByText('Selesai'));
    expect(onClose).toHaveBeenCalledTimes(1);

    // Klik tombol X
    fireEvent.click(screen.getByLabelText('Tutup edit sidebar'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('navigates to preset sub-view and handles adding a preset', () => {
    const onAddPreset = vi.fn();
    render(
      <EditSidebarPanel
        open={true}
        onClose={vi.fn()}
        sectionOrder={initialSections}
        presetSections={initialPresets}
        onReorderSections={vi.fn()}
        onAddPreset={onAddPreset}
        onRemovePreset={vi.fn()}
        sectionLabel={sectionLabel}
      />
    );

    // Buka sub-view preset
    const addSectionBtn = screen.getByLabelText('Tambah bagian baru');
    fireEvent.click(addSectionBtn);

    // Header preset view
    expect(screen.getByText('Tambah Bagian')).toBeTruthy();
    expect(screen.getByLabelText('Kembali ke urutan bagian')).toBeTruthy();

    // Preset 'Favorit' belum aktif
    const addFavoritBtn = screen.getByLabelText('Tambah bagian Favorit');
    fireEvent.click(addFavoritBtn);
    expect(onAddPreset).toHaveBeenCalledWith('favorit');
  });

  it('handles removing an active preset', () => {
    const onRemovePreset = vi.fn();
    render(
      <EditSidebarPanel
        open={true}
        onClose={vi.fn()}
        sectionOrder={['privat', 'teams', 'favorit']}
        presetSections={['privat', 'teams', 'favorit']}
        onReorderSections={vi.fn()}
        onAddPreset={vi.fn()}
        onRemovePreset={onRemovePreset}
        sectionLabel={sectionLabel}
      />
    );

    // Buka sub-view preset terlebih dahulu
    fireEvent.click(screen.getByLabelText('Tambah bagian baru'));

    const removeFavoritBtn = screen.getByLabelText('Hapus bagian Favorit');
    fireEvent.click(removeFavoritBtn);
    expect(onRemovePreset).toHaveBeenCalledWith('favorit');
  });

  it('handles Escape key: returns from preset view first, then closes panel', () => {
    const onClose = vi.fn();
    render(
      <EditSidebarPanel
        open={true}
        onClose={onClose}
        sectionOrder={initialSections}
        presetSections={initialPresets}
        onReorderSections={vi.fn()}
        onAddPreset={vi.fn()}
        onRemovePreset={vi.fn()}
        sectionLabel={sectionLabel}
      />
    );

    // Buka preset sub-view
    fireEvent.click(screen.getByLabelText('Tambah bagian baru'));
    expect(screen.getByText('Tambah Bagian')).toBeTruthy();

    // Escape 1: Kembali ke main view
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Edit Sidebar')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    // Escape 2: Menutup panel
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
