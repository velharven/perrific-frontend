import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDisplayScale } from './useDisplayScale';
import { SCALE_STORAGE_MODE_KEY, SCALE_STORAGE_CUSTOM_KEY } from '@/lib/displayScale';

describe('useDisplayScale hook', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.zoom = '';
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 });
  });

  it('initializes with default auto mode and scale 1.0 at 1600x900', () => {
    const { result } = renderHook(() => useDisplayScale());
    expect(result.current.mode).toBe('auto');
    expect(result.current.activeScale).toBe(1.0);
    expect(result.current.isDesktop).toBe(true);
  });

  it('updates mode and persists to localStorage', () => {
    const { result } = renderHook(() => useDisplayScale());
    act(() => {
      result.current.setMode('standard');
    });
    expect(result.current.mode).toBe('standard');
    expect(result.current.activeScale).toBe(1.0);
    expect(localStorage.getItem(SCALE_STORAGE_MODE_KEY)).toBe('standard');
  });

  it('updates custom scale and sets active scale in custom mode', () => {
    const { result } = renderHook(() => useDisplayScale());
    act(() => {
      result.current.setMode('custom');
      result.current.setCustomScale(1.1);
    });
    expect(result.current.mode).toBe('custom');
    expect(result.current.customScale).toBe(1.1);
    expect(result.current.activeScale).toBe(1.1);
    expect(localStorage.getItem(SCALE_STORAGE_CUSTOM_KEY)).toBe('1.1');
  });

  it('adapts scale upon window resize event with debounce', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDisplayScale());

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 1920 });
      window.dispatchEvent(new Event('resize'));
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.activeScale).toBe(1.2);
    vi.useRealTimers();
  });
});
