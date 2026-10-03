import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import ModalShell from './ModalShell';

describe('ModalShell Component', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders modal dialog with bottom sheet responsive styles and drag handle on mobile', () => {
    const handleClose = vi.fn();
    render(
      <ModalShell label="Test Dialog" onClose={handleClose}>
        <div>Konten Dialog</div>
      </ModalShell>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Test Dialog' });
    expect(dialog).toBeTruthy();
    expect(screen.getByText('Konten Dialog')).toBeTruthy();

    // Pastikan container memiliki kelas responsif items-end sm:items-center
    expect(dialog.className).toContain('items-end');
    expect(dialog.className).toContain('sm:items-center');

    // Pastikan panel kartu memiliki kelas bottom-sheet rounded-t-2xl sm:rounded-2xl
    const panel = dialog.firstElementChild as HTMLElement;
    expect(panel.className).toContain('rounded-t-2xl');
    expect(panel.className).toContain('sm:rounded-2xl');

    // Pastikan drag handle visual muncul untuk perangkat mobile
    const dragBar = panel.querySelector('[aria-hidden="true"]');
    expect(dragBar).toBeTruthy();
    expect(dragBar?.className).toContain('sm:hidden');
  });

  it('calls onClose when backdrop is clicked or Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(
      <ModalShell label="Test Dialog" onClose={handleClose}>
        <div>Konten Dialog</div>
      </ModalShell>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Test Dialog' });
    fireEvent.mouseDown(dialog);
    expect(handleClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(2);
  });
});
