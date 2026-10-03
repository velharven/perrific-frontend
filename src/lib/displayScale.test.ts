import { describe, it, expect, beforeEach } from 'vitest';
import {
  computeTargetScale,
  applyRootScale,
} from './displayScale';

describe('displayScale core engine', () => {
  beforeEach(() => {
    document.documentElement.style.zoom = '';
  });

  it('computes 1.0 for 1600px width', () => {
    expect(computeTargetScale(1600)).toBe(1.0);
  });

  it('computes 1.20 for 1920px width', () => {
    expect(computeTargetScale(1920)).toBe(1.2);
  });

  it('computes ~0.85375 for 1366px width', () => {
    const scale = computeTargetScale(1366);
    expect(scale).toBeCloseTo(0.85375, 4);
  });

  it('clamps to 1.35 for ultra-wide screen (2560px)', () => {
    expect(computeTargetScale(2560)).toBe(1.35);
  });

  it('clamps to 0.80 for small desktop screen (1100px)', () => {
    expect(computeTargetScale(1100)).toBe(0.8);
  });

  it('resets to 1.0 when width is below 1024px (mobile/tablet)', () => {
    expect(computeTargetScale(800)).toBe(1.0);
    expect(computeTargetScale(375)).toBe(1.0);
  });

  it('applies zoom style to document.documentElement', () => {
    applyRootScale(1.2);
    expect((document.documentElement.style as any).zoom).toBe('1.2');
    applyRootScale(1.0);
    expect((document.documentElement.style as any).zoom).toBe('1');
  });
});
