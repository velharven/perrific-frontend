export type DisplayScaleMode = 'auto' | 'standard' | 'custom';

export const SCALE_STORAGE_MODE_KEY = 'purrific_display_scale_mode';
export const SCALE_STORAGE_CUSTOM_KEY = 'purrific_display_scale_custom';

export const REFERENCE_WIDTH = 1600;
export const DESKTOP_BREAKPOINT = 1024;
export const MIN_AUTO_SCALE = 0.8;
export const MAX_AUTO_SCALE = 1.35;
export const CUSTOM_SCALE_PRESETS = [0.8, 0.9, 1.0, 1.1, 1.2] as const;

/**
 * Menghitung skala target berdasarkan mode, nilai kustom, dan lebar viewport.
 * - Layar mobile/tablet (< 1024px) selalu di-reset ke 1.0 (normal).
 * - Mode 'standard' di desktop selalu 1.0.
 * - Mode 'custom' mengembalikan nilai customValue.
 * - Mode 'auto' menghitung width / 1600 dengan clamp antara 0.80 dan 1.35.
 */
export function computeTargetScale(
  mode: DisplayScaleMode,
  customValue: number,
  width: number = typeof window !== 'undefined' ? window.innerWidth : REFERENCE_WIDTH,
): number {
  if (width < DESKTOP_BREAKPOINT) {
    return 1.0;
  }

  if (mode === 'standard') {
    return 1.0;
  }

  if (mode === 'custom') {
    return Number.isFinite(customValue) && customValue > 0 ? customValue : 1.0;
  }

  // Mode 'auto'
  const rawRatio = width / REFERENCE_WIDTH;
  return Math.min(Math.max(rawRatio, MIN_AUTO_SCALE), MAX_AUTO_SCALE);
}

/**
 * Membaca mode skala dari localStorage dengan validasi aman.
 */
export function getStoredScaleMode(): DisplayScaleMode {
  if (typeof window === 'undefined') return 'auto';
  try {
    const raw = localStorage.getItem(SCALE_STORAGE_MODE_KEY);
    if (raw === 'auto' || raw === 'standard' || raw === 'custom') {
      return raw;
    }
  } catch {
    // Abaikan jika localStorage tidak dapat diakses
  }
  return 'auto';
}

/**
 * Menyimpan mode skala ke localStorage.
 */
export function setStoredScaleMode(mode: DisplayScaleMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCALE_STORAGE_MODE_KEY, mode);
  } catch {
    // Abaikan jika quota penuh / privacy mode
  }
}

/**
 * Membaca nilai skala kustom dari localStorage dengan validasi angka.
 */
export function getStoredCustomScale(): number {
  if (typeof window === 'undefined') return 1.0;
  try {
    const raw = localStorage.getItem(SCALE_STORAGE_CUSTOM_KEY);
    if (raw !== null) {
      const parsed = parseFloat(raw);
      if (Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 2.0) {
        return parsed;
      }
    }
  } catch {
    // Abaikan error
  }
  return 1.0;
}

/**
 * Menyimpan nilai skala kustom ke localStorage.
 */
export function setStoredCustomScale(scale: number): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SCALE_STORAGE_CUSTOM_KEY, String(scale));
  } catch {
    // Abaikan error
  }
}

/**
 * Menerapkan nilai skala ke document.documentElement melalui CSS zoom.
 */
export function applyRootScale(scale: number): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;

  const formattedScale = Math.abs(scale - 1.0) < 0.001 ? '1' : scale.toString();
  (root.style as any).zoom = formattedScale;
}
