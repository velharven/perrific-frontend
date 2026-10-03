import { describe, it, expect, beforeEach } from 'vitest';
import { initDisplayScale } from './useDisplayScale';

describe('initDisplayScale startup initialization', () => {
  beforeEach(() => {
    document.documentElement.style.zoom = '';
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1920 });
  });

  it('applies computed scale immediately on startup for 1920px screen', () => {
    initDisplayScale();
    expect((document.documentElement.style as any).zoom).toBe('1.2');
  });

  it('applies 1.0 on startup for 1600px screen', () => {
    Object.defineProperty(window, 'innerWidth', { value: 1600 });
    initDisplayScale();
    expect((document.documentElement.style as any).zoom).toBe('1');
  });

  it('applies 1.0 on startup for mobile screen', () => {
    Object.defineProperty(window, 'innerWidth', { value: 390 });
    initDisplayScale();
    expect((document.documentElement.style as any).zoom).toBe('1');
  });
});
