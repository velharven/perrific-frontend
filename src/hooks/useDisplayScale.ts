import { useState, useEffect } from 'react';
import {
  computeTargetScale,
  applyRootScale,
  DESKTOP_BREAKPOINT,
} from '@/lib/displayScale';

export interface DisplayScaleState {
  activeScale: number;
  screenWidth: number;
  screenHeight: number;
  isDesktop: boolean;
}

/**
 * Inisialisasi awal skala tampilan sebelum render pertama React.
 * Mencegah layout shift / kedipan saat aplikasi baru dimuat.
 */
export function initDisplayScale(): void {
  if (typeof window === 'undefined') return;
  const scale = computeTargetScale(window.innerWidth);
  applyRootScale(scale);
}

/**
 * Hook reaktif untuk memantau dan menerapkan skala desktop adaptif 1600x900 secara otomatis.
 */
export function useDisplayScale(): DisplayScaleState {
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1600,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  const activeScale = computeTargetScale(dimensions.width);
  const isDesktop = dimensions.width >= DESKTOP_BREAKPOINT;

  // Terapkan skala ke root setiap kali activeScale berubah
  useEffect(() => {
    applyRootScale(activeScale);
  }, [activeScale]);

  // Listener window resize dengan debounce 80ms
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const handleResize = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        setDimensions({
          width: window.innerWidth,
          height: window.innerHeight,
        });
      }, 80);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return {
    activeScale,
    screenWidth: dimensions.width,
    screenHeight: dimensions.height,
    isDesktop,
  };
}
