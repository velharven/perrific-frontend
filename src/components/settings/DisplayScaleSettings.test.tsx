import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import DisplayScaleSettings from './DisplayScaleSettings';
import { SCALE_STORAGE_MODE_KEY, SCALE_STORAGE_CUSTOM_KEY } from '@/lib/displayScale';

describe('DisplayScaleSettings Component', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.zoom = '';
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 });
  });

  afterEach(() => {
    cleanup();
    document.body.innerHTML = '';
  });

  it('renders resolution badge and 3 mode options', () => {
    render(<DisplayScaleSettings />);

    expect(screen.getByText('Tampilan & Skala Layar')).toBeTruthy();
    expect(screen.getAllByText(/1600/).length).toBeGreaterThan(0);
    expect(screen.getByText('Otomatis (Adaptif 1600x900)')).toBeTruthy();
    expect(screen.getByText('Standar 100%')).toBeTruthy();
    expect(screen.getByText('Kustom')).toBeTruthy();
  });

  it('switches to standard mode when clicking Standar 100%', () => {
    render(<DisplayScaleSettings />);

    const standardBtn = screen.getByText('Standar 100%').closest('button')!;
    fireEvent.click(standardBtn);

    expect(localStorage.getItem(SCALE_STORAGE_MODE_KEY)).toBe('standard');
    expect((document.documentElement.style as any).zoom).toBe('1');
  });

  it('switches to auto mode when clicking Otomatis', () => {
    localStorage.setItem(SCALE_STORAGE_MODE_KEY, 'standard');
    render(<DisplayScaleSettings />);

    const autoBtn = screen.getByText('Otomatis (Adaptif 1600x900)').closest('button')!;
    fireEvent.click(autoBtn);

    expect(localStorage.getItem(SCALE_STORAGE_MODE_KEY)).toBe('auto');
  });

  it('switches to custom mode and selects preset percentage', () => {
    render(<DisplayScaleSettings />);

    const customBtn = screen.getByText('Kustom').closest('button')!;
    fireEvent.click(customBtn);

    expect(localStorage.getItem(SCALE_STORAGE_MODE_KEY)).toBe('custom');

    const preset110 = screen.getByText(/110%/).closest('button')!;
    fireEvent.click(preset110);

    expect(localStorage.getItem(SCALE_STORAGE_CUSTOM_KEY)).toBe('1.1');
    expect((document.documentElement.style as any).zoom).toBe('1.1');
  });
});
