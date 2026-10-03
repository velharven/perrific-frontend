# Desktop Display Scale (1600x900 Baseline) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement an adaptive desktop display scaling engine anchored to a 1600x900 reference resolution, ensuring all cards, modal popups, tables, typography, and spacing maintain exact proportional sizing on any laptop or desktop screen, with complete user preferences in Settings.

**Architecture:** A pure math and DOM scaling engine in `src/lib/displayScale.ts` calculates a width-based scale factor (`clamp(0.80, window.innerWidth / 1600, 1.35)`) and applies it via CSS `zoom` on `document.documentElement` for desktop screens (`window.innerWidth >= 1024`) while resetting to 1.0 on mobile/tablet. A React hook `src/hooks/useDisplayScale.ts` manages debounced window resizing, `localStorage` persistence, and cross-tab synchronization. `src/pages/SettingsPage.tsx` introduces a clean `SettingsBlock` with interactive cards for "Otomatis (Adaptif 1600x900)", "Standar (100%)", and "Kustom" preset buttons (80%, 90%, 100%, 110%, 120%).

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Vite, Vitest, Testing Library, Lucide React, LocalStorage API.

**Spec:** `docs/superpowers/specs/2026-10-03-desktop-display-scale-design.md`

## Global Constraints
- Target reference baseline: 1600x900 px.
- Desktop breakpoint threshold: `window.innerWidth >= 1024` (Tailwind `lg`).
- Auto mode clamp limits: `0.80` minimum to `1.35` maximum.
- Mobile/tablet reset: `scale = 1.0` whenever `window.innerWidth < 1024`.
- LocalStorage keys: `purrific_display_scale_mode` ('auto' | 'standard' | 'custom'), `purrific_display_scale_custom` (number: 0.8, 0.9, 1.0, 1.1, 1.2).
- Zero build or type errors: must pass `npm run typecheck` (`tsc -b`) and `vitest run`.

## Review Focus
1. Window resizing below 1024px: verify scale resets to 1.0 and mobile burger / layout works without distortion.
2. Ultra-wide screens (e.g. 2560px or 3840px): verify scale clamps at 1.35 so cards and modals do not become oversized.
3. Modals and dropdowns: verify `ModalShell`, `ConfirmModal`, and `MenuPortal` render accurately without broken overlay or misaligned anchors.
4. Settings persistence: verify changing settings updates UI immediately and persists across page reloads and browser tabs.
5. Invalid or corrupted localStorage values: verify fallback to default 'auto' mode and 1.0 custom scale without runtime crashes.

---

### Task 1: Core Engine & Math Calculation

**Files:**
- Create: `src/lib/displayScale.ts`
- Create: `src/lib/displayScale.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type DisplayScaleMode = 'auto' | 'standard' | 'custom';
  export const SCALE_STORAGE_MODE_KEY = 'purrific_display_scale_mode';
  export const SCALE_STORAGE_CUSTOM_KEY = 'purrific_display_scale_custom';
  export const REFERENCE_WIDTH = 1600;
  export const DESKTOP_BREAKPOINT = 1024;
  export const MIN_AUTO_SCALE = 0.8;
  export const MAX_AUTO_SCALE = 1.35;
  export const CUSTOM_SCALE_PRESETS = [0.8, 0.9, 1.0, 1.1, 1.2] as const;

  export function computeTargetScale(mode: DisplayScaleMode, customValue: number, width: number): number;
  export function getStoredScaleMode(): DisplayScaleMode;
  export function setStoredScaleMode(mode: DisplayScaleMode): void;
  export function getStoredCustomScale(): number;
  export function setStoredCustomScale(scale: number): void;
  export function applyRootScale(scale: number): void;
  ```

- [ ] **Step 1: Write the failing test for `displayScale.ts`**

```ts
// src/lib/displayScale.test.ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/displayScale.test.ts`
Expected: FAIL with "Cannot find module './displayScale'"

- [ ] **Step 3: Implement `src/lib/displayScale.ts`**

Implement `computeTargetScale`, `getStoredScaleMode`, `setStoredScaleMode`, `getStoredCustomScale`, `setStoredCustomScale`, `applyRootScale` in `src/lib/displayScale.ts`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/displayScale.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/displayScale.ts src/lib/displayScale.test.ts
git commit -m "feat(display-scale): implement core display scaling engine and math calculations"
```

---

### Task 2: React Hook, Resize Listener & Storage Sync

**Files:**
- Create: `src/hooks/useDisplayScale.ts`
- Create: `src/hooks/useDisplayScale.test.tsx`

**Interfaces:**
- Consumes: `computeTargetScale`, `getStoredScaleMode`, `setStoredScaleMode`, `getStoredCustomScale`, `setStoredCustomScale`, `applyRootScale` from `src/lib/displayScale`
- Produces:
  ```ts
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
  export function useDisplayScale(): DisplayScaleState;
  export function initDisplayScale(): void;
  ```

- [ ] **Step 1: Write the failing test for `useDisplayScale.ts`**

```tsx
// src/hooks/useDisplayScale.test.tsx
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/useDisplayScale.test.tsx`
Expected: FAIL with "Cannot find module './useDisplayScale'"

- [ ] **Step 3: Implement `src/hooks/useDisplayScale.ts`**

Implement `useDisplayScale` and `initDisplayScale` with resize debouncing (80ms), storage event listener for cross-tab sync, and automatic DOM zoom application.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/useDisplayScale.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Task 2**

```bash
git add src/hooks/useDisplayScale.ts src/hooks/useDisplayScale.test.tsx
git commit -m "feat(display-scale): implement useDisplayScale hook with resize listener and storage sync"
```

---

### Task 3: Global Startup Initialization & Layout Integration

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/components/layout/AppLayout.tsx`

**Interfaces:**
- Consumes: `initDisplayScale` and `useDisplayScale` from `src/hooks/useDisplayScale`

- [ ] **Step 1: Write integration test verifying initial scale is applied before App mounts**

Create test `src/hooks/initDisplayScale.test.ts` verifying that `initDisplayScale()` immediately computes and applies zoom from localStorage and current `window.innerWidth`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/hooks/initDisplayScale.test.ts`

- [ ] **Step 3: Integrate `initDisplayScale` into `main.tsx` and invoke `useDisplayScale()` in `AppLayout.tsx`**

1. In `src/main.tsx`: call `initDisplayScale()` before `createRoot` renders.
2. In `src/components/layout/AppLayout.tsx`: invoke `useDisplayScale()` to ensure active state lifecycle is maintained for the entire authenticated layout.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/hooks/initDisplayScale.test.ts`
Expected: PASS

- [ ] **Step 5: Commit Task 3**

```bash
git add src/main.tsx src/components/layout/AppLayout.tsx src/hooks/initDisplayScale.test.ts
git commit -m "feat(display-scale): initialize display scaling at app startup and in AppLayout"
```

---

### Task 4: UI Settings Block in SettingsPage

**Files:**
- Create: `src/components/settings/DisplayScaleSettings.tsx`
- Modify: `src/pages/SettingsPage.tsx`
- Create: `src/components/settings/DisplayScaleSettings.test.tsx`

**Interfaces:**
- Consumes: `useDisplayScale`, `CUSTOM_SCALE_PRESETS`
- Produces: `<DisplayScaleSettings />` component rendering:
  - Screen resolution badge (`1600 × 900`, etc.) and active scale percentage (`100% (Acuan Asli)` / `120% (Adaptif)`)
  - 3 mode cards: "Otomatis (Adaptif 1600x900)", "Standar (100%)", "Kustom"
  - Preset percentage buttons: 80%, 90%, 100%, 110%, 120%

- [ ] **Step 1: Write test for `DisplayScaleSettings.test.tsx`**

Test that:
- It renders current screen resolution and current active scale percentage.
- Clicking "Standar (100%)" calls `setMode('standard')`.
- Clicking "Otomatis (Adaptif 1600x900)" calls `setMode('auto')`.
- Clicking "Kustom" enables preset buttons (80%, 90%, 100%, 110%, 120%) and clicking a preset updates custom scale.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/settings/DisplayScaleSettings.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `DisplayScaleSettings.tsx` and embed in `SettingsPage.tsx`**

1. Create `src/components/settings/DisplayScaleSettings.tsx` using Purrific design system (`SettingsBlock`, `perrific-violet`, `Space Grotesk`, `Manrope`, Lucide icons `Monitor`, `Check`).
2. Add `<DisplayScaleSettings />` inside `src/pages/SettingsPage.tsx` right under the Profile / Password blocks.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/settings/DisplayScaleSettings.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit Task 4**

```bash
git add src/components/settings/DisplayScaleSettings.tsx src/components/settings/DisplayScaleSettings.test.tsx src/pages/SettingsPage.tsx
git commit -m "feat(settings): add display scaling controls and resolution preview to SettingsPage"
```

---

### Task 5: End-to-End Verification & Regression Testing

**Files:**
- Verify: Full codebase

- [ ] **Step 1: Run TypeScript compiler check**

Run: `npm run typecheck` in `purrific-frontend`
Expected: No type errors (`tsc -b` exits with 0).

- [ ] **Step 2: Run all Vitest suites**

Run: `npm test` in `purrific-frontend`
Expected: All test suites PASS.

- [ ] **Step 3: Commit and update documentation**

```bash
git add .
git commit -m "chore: complete desktop display scale implementation with tests and docs"
```
