import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeTargetScale,
  getStoredScaleMode,
  setStoredScaleMode,
  getStoredCustomScale,
  setStoredCustomScale,
  applyRootScale,
  SCALE_STORAGE_MODE_KEY,
  SCALE_STORAGE_CUSTOM_KEY,
} from './displayScale';

describe('displayScale core engine', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.style.zoom = '';
  });

  it('computes 1.0 for 1600px width in auto mode', () => {
    expect(computeTargetScale('auto', 1.0, 1600)).toBe(1.0);
  });

  it('computes 1.20 for 1920px width in auto mode', () => {
    expect(computeTargetScale('auto', 1.0, 1920)).toBe(1.2);
  });

  it('computes ~0.85375 for 1366px width in auto mode', () => {
    const scale = computeTargetScale('auto', 1.0, 1366);
    expect(scale).toBeCloseTo(0.85375, 4);
  });

  it('clamps to 1.35 for ultra-wide screen (2560px)', () => {
    expect(computeTargetScale('auto', 1.0, 2560)).toBe(1.35);
  });

  it('clamps to 0.80 for small desktop screen (1100px)', () => {
    expect(computeTargetScale('auto', 1.0, 1100)).toBe(0.8);
  });

  it('resets to 1.0 when width is below 1024px (mobile/tablet)', () => {
    expect(computeTargetScale('auto', 1.0, 800)).toBe(1.0);
    expect(computeTargetScale('custom', 1.2, 800)).toBe(1.0);
  });

  it('returns 1.0 in standard mode on desktop', () => {
    expect(computeTargetScale('standard', 1.2, 1920)).toBe(1.0);
  });

  it('returns custom value in custom mode on desktop', () => {
    expect(computeTargetScale('custom', 1.1, 1920)).toBe(1.1);
  });

  it('reads and writes mode to localStorage with fallback', () => {
    expect(getStoredScaleMode()).toBe('auto');
    setStoredScaleMode('standard');
    expect(getStoredScaleMode()).toBe('standard');
    localStorage.setItem(SCALE_STORAGE_MODE_KEY, 'invalid');
    expect(getStoredScaleMode()).toBe('auto');
  });

  it('reads and writes custom scale to localStorage with fallback', () => {
    expect(getStoredCustomScale()).toBe(1.0);
    setStoredCustomScale(1.1);
    expect(getStoredCustomScale()).toBe(1.1);
    localStorage.setItem(SCALE_STORAGE_CUSTOM_KEY, 'invalid');
    expect(getStoredCustomScale()).toBe(1.0);
  });

  it('applies zoom style to document.documentElement', () => {
    applyRootScale(1.2);
    expect((document.documentElement.style as any).zoom).toBe('1.2');
    applyRootScale(1.0);
    expect((document.documentElement.style as any).zoom).toBe('1');
  });
});
