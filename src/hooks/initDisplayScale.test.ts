import { describe, it, expect, beforeEach } from 'vitest';
import { initDisplayScale } from './useDisplayScale';
import { SCALE_STORAGE_MODE_KEY, SCALE_STORAGE_CUSTOM_KEY } from '@/lib/displayScale';

describe('initDisplayScale startup initialization', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.zoom = '';
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });
  });

  it('applies computed scale immediately on startup for auto mode', () => {
    localStorage.setItem(SCALE_STORAGE_MODE_KEY, 'auto');
    initDisplayScale();
    expect((document.documentElement.style as any).zoom).toBe('1.2');
  });

  it('applies 1.0 on startup for standard mode', () => {
    localStorage.setItem(SCALE_STORAGE_MODE_KEY, 'standard');
    initDisplayScale();
    expect((document.documentElement.style as any).zoom).toBe('1');
  });

  it('applies custom scale on startup for custom mode', () => {
    localStorage.setItem(SCALE_STORAGE_MODE_KEY, 'custom');
    localStorage.setItem(SCALE_STORAGE_CUSTOM_KEY, '1.1');
    initDisplayScale();
    expect((document.documentElement.style as any).zoom).toBe('1.1');
  });
});
