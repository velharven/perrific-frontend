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

  it('handles removing an active preset with confirmation modal from preset sub-view', () => {
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

    // Modal konfirmasi harus muncul
    expect(screen.getByText('Hapus bagian Favorit?')).toBeTruthy();
    expect(screen.getByText(/Bagian ini akan disembunyikan dari sidebar/i)).toBeTruthy();

    // Batal konfirmasi
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onRemovePreset).not.toHaveBeenCalled();

    // Buka kembali modal konfirmasi dan setujui
    fireEvent.click(removeFavoritBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    expect(onRemovePreset).toHaveBeenCalledWith('favorit');
  });

  it('renders X button on each row in main view and deletes with confirmation', () => {
    const onRemovePreset = vi.fn();
    render(
      <EditSidebarPanel
        open={true}
        onClose={vi.fn()}
        sectionOrder={['privat', 'teams', 'organisasi']}
        presetSections={['privat', 'teams', 'organisasi']}
        onReorderSections={vi.fn()}
        onAddPreset={vi.fn()}
        onRemovePreset={onRemovePreset}
        sectionLabel={sectionLabel}
      />
    );

    // Tombol X harus tersedia di setiap baris bagian
    const removePrivatBtn = screen.getByLabelText('Hapus bagian PRIVAT');
    const removeTeamsBtn = screen.getByLabelText('Hapus bagian TIM SAYA');
    const removeOrgBtn = screen.getByLabelText('Hapus bagian ORGANISASI');
    expect(removePrivatBtn).toBeTruthy();
    expect(removeTeamsBtn).toBeTruthy();
    expect(removeOrgBtn).toBeTruthy();

    // Klik tombol X pada Organisasi
    fireEvent.click(removeOrgBtn);

    // Modal konfirmasi muncul
    expect(screen.getByText('Hapus bagian Organisasi?')).toBeTruthy();

    // Klik Batal
    fireEvent.click(screen.getByRole('button', { name: 'Batal' }));
    expect(onRemovePreset).not.toHaveBeenCalled();

    // Klik X lagi lalu konfirmasi Hapus
    fireEvent.click(removeOrgBtn);
    fireEvent.click(screen.getByRole('button', { name: 'Hapus' }));
    expect(onRemovePreset).toHaveBeenCalledWith('organisasi');
  });

  it('handles Escape key: cancels confirm modal first, then returns from preset view, then closes panel', () => {
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

    // Klik tombol X di daftar utama untuk membuka konfirmasi
    fireEvent.click(screen.getByLabelText('Hapus bagian PRIVAT'));
    expect(screen.getByText('Hapus bagian Privat?')).toBeTruthy();

    // Escape 1: Menutup modal konfirmasi
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByText('Hapus bagian Privat?')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // Buka preset sub-view
    fireEvent.click(screen.getByLabelText('Tambah bagian baru'));
    expect(screen.getByText('Tambah Bagian')).toBeTruthy();

    // Escape 2: Kembali ke main view
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.getByText('Edit Sidebar')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    // Escape 3: Menutup panel
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
