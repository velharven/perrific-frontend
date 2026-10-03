export const REFERENCE_WIDTH = 1600;
export const DESKTOP_BREAKPOINT = 1024;
export const MIN_AUTO_SCALE = 0.8;
export const MAX_AUTO_SCALE = 1.35;

/**
 * Menghitung skala target otomatis berbasis acuan resolusi 1600x900.
 * - Layar mobile/tablet (< 1024px) selalu di-reset ke 1.0 (normal).
 * - Layar desktop (>= 1024px) menghitung rasio width / 1600 dengan clamp antara 0.80 dan 1.35.
 */
export function computeTargetScale(
  width: number = typeof window !== 'undefined' ? window.innerWidth : REFERENCE_WIDTH,
): number {
  if (width < DESKTOP_BREAKPOINT) {
    return 1.0;
  }

  const rawRatio = width / REFERENCE_WIDTH;
  return Math.min(Math.max(rawRatio, MIN_AUTO_SCALE), MAX_AUTO_SCALE);
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
