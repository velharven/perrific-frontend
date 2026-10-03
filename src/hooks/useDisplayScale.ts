import { useState, useEffect, useCallback } from 'react';
import {
  type DisplayScaleMode,
  computeTargetScale,
  getStoredScaleMode,
  setStoredScaleMode,
  getStoredCustomScale,
  setStoredCustomScale,
  applyRootScale,
  DESKTOP_BREAKPOINT,
  SCALE_STORAGE_MODE_KEY,
  SCALE_STORAGE_CUSTOM_KEY,
} from '@/lib/displayScale';

export interface DisplayScaleState {
  mode: DisplayScaleMode;
  customScale: number;
  activeScale: number;
  screenWidth: number;
  screenHeight: number;
  isDesktop: boolean;
  setMode: (mode: DisplayScaleMode) => void;
  setCustomScale: (scale: number) => void;
}

/**
 * Inisialisasi awal skala tampilan sebelum render pertama React.
 * Mencegah layout shift / kedipan saat aplikasi baru dimuat.
 */
export function initDisplayScale(): void {
  if (typeof window === 'undefined') return;
  const mode = getStoredScaleMode();
  const custom = getStoredCustomScale();
  const scale = computeTargetScale(mode, custom, window.innerWidth);
  applyRootScale(scale);
}

/**
 * Hook reaktif untuk mengelola dan memantau status skala antarmuka desktop.
 */
export function useDisplayScale(): DisplayScaleState {
  const [mode, setModeState] = useState<DisplayScaleMode>(() => getStoredScaleMode());
  const [customScale, setCustomScaleState] = useState<number>(() => getStoredCustomScale());
  const [dimensions, setDimensions] = useState<{ width: number; height: number }>(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1600,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  const activeScale = computeTargetScale(mode, customScale, dimensions.width);
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

  // Listener sinkronisasi antar-tab jendela browser
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorage = (e: StorageEvent) => {
      if (e.key === SCALE_STORAGE_MODE_KEY) {
        setModeState(getStoredScaleMode());
      } else if (e.key === SCALE_STORAGE_CUSTOM_KEY) {
        setCustomScaleState(getStoredCustomScale());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const setMode = useCallback(
    (newMode: DisplayScaleMode) => {
      setModeState(newMode);
      setStoredScaleMode(newMode);
      const newScale = computeTargetScale(newMode, customScale, dimensions.width);
      applyRootScale(newScale);
    },
    [customScale, dimensions.width],
  );

  const setCustomScale = useCallback(
    (newCustom: number) => {
      setCustomScaleState(newCustom);
      setStoredCustomScale(newCustom);
      if (mode === 'custom') {
        const newScale = computeTargetScale('custom', newCustom, dimensions.width);
        applyRootScale(newScale);
      }
    },
    [mode, dimensions.width],
  );

  return {
    mode,
    customScale,
    activeScale,
    screenWidth: dimensions.width,
    screenHeight: dimensions.height,
    isDesktop,
    setMode,
    setCustomScale,
  };
}
