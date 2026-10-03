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
 * Menerapkan nilai skala ke document.documentElement melalui CSS zoom
 * dan menyelaraskan CSS variable --app-vh agar elemen full-height (sidebar, viewport)
 * selalu mengisi 100% tinggi fisik layar tanpa celah atau blok kosong di bawahnya.
 */
export function applyRootScale(scale: number): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (!root) return;

  const formattedScale = Math.abs(scale - 1.0) < 0.001 ? '1' : scale.toString();
  (root.style as any).zoom = formattedScale;
  root.style.setProperty('--app-scale', formattedScale);

  // Jika dokumen di-zoom dengan faktor S, elemen dengan tinggi 100vh hanya akan tampak (100 * S)vh.
  // Dengan menghitung (100 / S)vh, tinggi elemen setelah zoom akan tepat 100% dari tinggi layar fisik.
  const adjustedVh = scale > 0 ? (100 / scale).toFixed(4) : '100';
  const vhUnit = typeof CSS !== 'undefined' && CSS.supports && CSS.supports('height', '100dvh') ? 'dvh' : 'vh';
  root.style.setProperty('--app-vh', `${adjustedVh}${vhUnit}`);
}
