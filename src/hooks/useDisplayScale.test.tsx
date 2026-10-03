import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useDisplayScale } from './useDisplayScale';

describe('useDisplayScale hook', () => {
  beforeEach(() => {
    document.documentElement.style.zoom = '';
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1600 });
    Object.defineProperty(window, 'innerHeight', { writable: true, configurable: true, value: 900 });
  });

  it('initializes with scale 1.0 at 1600x900', () => {
    const { result } = renderHook(() => useDisplayScale());
    expect(result.current.activeScale).toBe(1.0);
    expect(result.current.isDesktop).toBe(true);
    expect((document.documentElement.style as any).zoom).toBe('1');
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
    expect((document.documentElement.style as any).zoom).toBe('1.2');
    vi.useRealTimers();
  });

  it('resets to 1.0 on mobile viewport', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useDisplayScale());

    act(() => {
      Object.defineProperty(window, 'innerWidth', { value: 768 });
      window.dispatchEvent(new Event('resize'));
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.activeScale).toBe(1.0);
    expect(result.current.isDesktop).toBe(false);
    expect((document.documentElement.style as any).zoom).toBe('1');
    vi.useRealTimers();
  });
});
